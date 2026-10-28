import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const MOBILE = path.join(SRC, "mobile");
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const mobileFiles = walk(MOBILE);
const mobileSource = mobileFiles.filter((file) => /\.(js|jsx)$/.test(file));
const mobileCss = mobileFiles.filter((file) => file.endsWith(".css"));

/*
 * What the Mobile tree may import from outside itself. Everything else is
 * refused, which keeps Desktop pages, layouts, shared components and their
 * CSS out of Mobile. Two are reviewed exceptions:
 *  - RouteGuards: Mobile must use the app's own RequireAuth rather than a
 *    second copy of the sign-in redirect;
 *  - Experience/experienceStore.js: the full app's device-preference store, read
 *    (never written) so that "hide amounts" is respected in Mobile. It is plain
 *    JavaScript with no component and no CSS.
 * Which of the api/ modules may be imported, and by which file, is checked in
 * tests/mobileReadOnly.test.mjs.
 */
const ALLOWED_OUTSIDE = [
  /^src\/routes\/Path\.js$/,
  /^src\/routes\/postAuthRedirect\.js$/,
  /^src\/routes\/RouteGuards\.jsx$/,
  /^src\/contexts\/(auth|language|theme)\/use[A-Za-z]+\.js$/,
  /^src\/i18n\.js$/,
  /^src\/assets\/smart-spend-logo\.png$/,
  /^src\/features\/Dashboards\/User\/api\/[A-Za-z]+\.js$/,
  /^src\/features\/Dashboards\/User\/Experience\/experienceStore\.js$/,
];

const ALLOWED_PACKAGES = ["react", "react-dom", "react-router-dom", "react-i18next", "react-icons/lu"];
// The PWA build switch, answered by scripts/mobileEntryPlugin.mjs (only pwa/worker.js imports it).
const ALLOWED_VIRTUAL = ["virtual:smartspend-mobile-pwa"];

const withExtension = (target) => ["", ".js", ".jsx", "/index.js", "/index.jsx"].map((suffix) => target + suffix).find((candidate) => { try { return statSync(candidate).isFile(); } catch { return false; } }) ?? target;

const specifiers = (source) => {
  const found = [];
  for (const match of source.matchAll(/(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']/g)) found.push(match[1]);
  for (const match of source.matchAll(/import\s*["']([^"']+)["']/g)) found.push(match[1]);
  for (const match of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) found.push(match[1]);
  return found;
};

describe("Mobile import boundaries", () => {
  it("the Mobile tree exists and has source, styles and nothing unexpected", () => {
    assert.ok(mobileSource.length >= 15);
    assert.deepEqual(mobileCss.map(rel), ["src/mobile/styles/mobile.css"]);
  });

  it("imports only itself, the approved shared modules, and approved packages", () => {
    const violations = [];

    for (const file of mobileSource) {
      for (const specifier of specifiers(readFileSync(file, "utf8"))) {
        if (specifier.startsWith(".")) {
          const target = withExtension(path.resolve(path.dirname(file), specifier));
          const targetRel = rel(target);
          if (targetRel.startsWith("src/mobile/")) continue;
          if (!ALLOWED_OUTSIDE.some((pattern) => pattern.test(targetRel))) violations.push(`${rel(file)} -> ${specifier}`);
        } else if (ALLOWED_VIRTUAL.includes(specifier)) {
          if (rel(file) !== "src/mobile/pwa/worker.js") violations.push(`${rel(file)} -> ${specifier}`);
        } else if (!ALLOWED_PACKAGES.includes(specifier)) {
          violations.push(`${rel(file)} -> ${specifier}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });

  it("imports no Desktop page, layout, shared component or CSS", () => {
    for (const file of mobileSource) {
      for (const specifier of specifiers(readFileSync(file, "utf8"))) {
        assert.doesNotMatch(specifier, /\/(layouts|components|features\/(?!Dashboards\/User\/api\/|Dashboards\/User\/Experience\/experienceStore))/, `${rel(file)} -> ${specifier}`);

        if (specifier.endsWith(".css")) {
          const target = rel(path.resolve(path.dirname(file), specifier));
          assert.equal(target, "src/mobile/styles/mobile.css", `${rel(file)} imports CSS outside the Mobile tree`);
        }
      }
    }
  });

  it("does not import the application's global stylesheet or its other entry files", () => {
    for (const file of mobileSource) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /index\.css|main\.jsx|Root\.jsx|\bApp\.jsx/, rel(file));
    }
  });

  it("nothing in Desktop imports the Mobile tree (Router.jsx reaches it only through the virtual module)", () => {
    const offenders = walk(SRC)
      .filter((file) => !file.startsWith(MOBILE) && /\.(js|jsx)$/.test(file))
      .filter((file) => specifiers(readFileSync(file, "utf8")).some((specifier) => /(^|\/)mobile(\/|$)/.test(specifier)))
      .map(rel);

    assert.deepEqual(offenders, []);
  });

  it("renders overlays only inside the Mobile root, never into document.body", () => {
    for (const file of mobileSource) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /document\.body/, rel(file));
    }
  });

  it("every class name used in Mobile markup starts with sm-", () => {
    const bad = [];

    // The value after `className=`: a "string", or a {balanced expression}.
    const valueAfter = (text, start) => {
      if (text[start] === '"') return text.slice(start + 1, text.indexOf('"', start + 1));
      if (text[start] !== "{") return "";
      let depth = 0;
      for (let index = start; index < text.length; index += 1) {
        if (text[index] === "{") depth += 1;
        if (text[index] === "}" && (depth -= 1) === 0) return text.slice(start + 1, index);
      }
      return "";
    };

    // Class tokens of a JS expression: template literals (with the string
    // literals inside their ${...} parts) and plain quoted strings.
    const expressionTokens = (expression) => {
      const tokens = [];
      const rest = expression.replace(/`([^`]*)`/g, (_, body) => {
        const plain = body.replace(/\$\{([^{}]*)\}/g, (__, code) => {
          for (const quoted of code.matchAll(/"([^"]*)"|'([^']*)'/g)) tokens.push(...(quoted[1] ?? quoted[2]).split(/\s+/));
          return " ";
        });
        tokens.push(...plain.split(/\s+/));
        return " ";
      });

      for (const quoted of rest.matchAll(/"([^"]*)"|'([^']*)'/g)) tokens.push(...(quoted[1] ?? quoted[2]).split(/\s+/));
      return tokens.filter(Boolean);
    };

    let checked = 0;

    for (const file of mobileSource.filter((item) => item.endsWith(".jsx"))) {
      const text = readFileSync(file, "utf8");

      for (const match of text.matchAll(/className=/g)) {
        const start = match.index + match[0].length;
        const value = valueAfter(text, start);
        let tokens;

        if (text[start] === '"') {
          tokens = value.split(/\s+/).filter(Boolean);
        } else if (/^[A-Za-z_]\w*$/.test(value)) {
          // className={someConst}: read that const's definition in the same file.
          const definition = text.match(new RegExp(`const ${value} = ([^;]*);`));
          assert.ok(definition, `${rel(file)}: cannot find ${value}`);
          tokens = expressionTokens(definition[1]);
        } else {
          tokens = expressionTokens(value);
        }

        for (const token of tokens) {
          checked += 1;
          if (!token.startsWith("sm-")) bad.push(`${rel(file)}: ${token}`);
        }
      }
    }

    assert.ok(checked > 30, `only ${checked} class names found`);
    assert.deepEqual(bad, []);
  });
});

/* A small brace-aware reader: enough to list selectors, at-rules and declared custom properties. */
function readCss(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = { selectors: [], keyframes: [], atRules: [], properties: [], text };
  const stack = [];
  let prelude = "";

  for (const char of text) {
    if (char === "{") {
      const head = prelude.trim();
      prelude = "";

      if (head.startsWith("@")) {
        if (head.startsWith("@keyframes")) out.keyframes.push(head.split(/\s+/)[1]);
        else out.atRules.push(head);
      } else if (!stack.some((item) => item.startsWith("@keyframes"))) {
        out.selectors.push(...head.split(",").map((selector) => selector.trim()));
      }

      stack.push(head);
    } else if (char === "}") {
      stack.pop();
      prelude = "";
    } else if (char === ";") {
      prelude = "";
    } else {
      prelude += char;
    }
  }

  for (const match of text.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) out.properties.push(match[1]);
  return out;
}

describe("Mobile CSS isolation", () => {
  const css = readCss(readFileSync(path.join(MOBILE, "styles/mobile.css"), "utf8"));

  it("reads a plausible number of rules (the reader works)", () => {
    assert.ok(css.selectors.length > 60, `only ${css.selectors.length} selectors found`);
    assert.ok(css.keyframes.length >= 1);
  });

  it("every selector is scoped to .sm-root", () => {
    const loose = css.selectors.filter(
      (selector) => !/^(?::root\[data-theme="dark"\]\s+)?\.sm-root(?![A-Za-z0-9_-])/.test(selector),
    );
    assert.deepEqual(loose, []);
  });

  it("introduces no bare element, html, body, :root or universal rule", () => {
    for (const selector of css.selectors) {
      assert.doesNotMatch(selector, /^(html|body|:root(?!\[data-theme="dark"\]\s+\.sm-root)|\*|#root|button|input|a|h[1-6]|p|ul|li|label|img)\b/, selector);
      assert.match(selector, /\.sm-root/, selector);
    }
  });

  it("keyframes are prefixed", () => {
    for (const name of css.keyframes) assert.match(name, /^sm-/, name);
  });

  it("declares custom properties only with the --sm- prefix, so no Desktop token is redefined", () => {
    const foreign = css.properties.filter((name) => !name.startsWith("--sm-"));
    assert.deepEqual([...new Set(foreign)], []);
  });

  it("uses no @import, no @font-face, no !important, no remote URL", () => {
    assert.doesNotMatch(css.text, /@import|@font-face|!important|https?:\/\//);
    assert.deepEqual(css.atRules.filter((rule) => !/^@media \(prefers-reduced-motion: reduce\)$/.test(rule)), []);
  });

  it("uses logical properties instead of physical left/right ones", () => {
    assert.doesNotMatch(css.text, /\b(margin|padding|border)-(left|right)\b|(?<![a-z-])(left|right)\s*:/);
    assert.doesNotMatch(css.text, /text-align:\s*(left|right)/);
  });

  it("sets the theme through html[data-theme], like the rest of the app", () => {
    assert.match(css.text, /:root\[data-theme="dark"\]\s+\.sm-root/);
    assert.doesNotMatch(css.text, /prefers-color-scheme/);
  });

  it("keeps every action target at least 44px (2.75rem)", () => {
    assert.match(css.text, /--sm-target:\s*2\.75rem/);
    assert.ok((css.text.match(/min-height:\s*var\(--sm-target\)/g) ?? []).length >= 5);
  });
});
