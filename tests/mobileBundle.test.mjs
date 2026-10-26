import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/*
 * Real production builds, written to temporary folders (never to dist/), with
 * Mobile off and on. A bundler can keep code a flag "removes", so the claims
 * here are checked on the output itself:
 *
 *   off: no Mobile chunk, no Mobile string, no Mobile CSS; the stylesheet is
 *        the Desktop one, rule for rule.
 *   on:  the Mobile code is in its own lazy chunk, not in the entry bundle.
 *
 * Slow (two builds, ~10 s); it needs no network and no backend.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VITE = path.join(ROOT, "node_modules/vite/bin/vite.js");
const SENTINEL = "SMARTSPEND_MOBILE_S04A";
const MOBILE_STRINGS = [SENTINEL, "sm-root", "data-sm-build", "smartspend:presentation", "Mobile Foundation preview", "virtual:smartspend-mobile", "sm-sheet"];

const cleanEnv = (extra = {}) => {
  const env = { ...process.env };
  for (const key of ["VITE_MOBILE_ENABLED", "SMARTSPEND_MOBILE_RELEASE_APPROVED", "VITE_SMART_SAVINGS_ENABLED", "NODE_OPTIONS"]) delete env[key];
  return { ...env, ...extra };
};

const dirs = [];
function build(name, extra, args = []) {
  const out = mkdtempSync(path.join(tmpdir(), `smartspend-bundle-${name}-`));
  dirs.push(out);
  execFileSync(process.execPath, [VITE, "build", "--outDir", out, "--emptyOutDir", ...args], {
    cwd: ROOT,
    env: cleanEnv(extra),
    stdio: "pipe",
  });
  return out;
}

const files = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
const text = (file) => readFileSync(file, "utf8");
const stylesheets = (dir) => files(dir).filter((file) => /assets[\\/]style-[^\\/]+\.css$/.test(file));
const assets = (dir) => files(dir).filter((file) => /\.(js|css|html)$/.test(file));

// The rules of a minified stylesheet, split at top-level closing braces.
function topLevelRules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}" && (depth -= 1) === 0) {
      rules.push(css.slice(start, index + 1));
      start = index + 1;
    }
  }

  return rules;
}

let off;
let on;

before(() => {
  off = build("off", {});
  on = build("on", { VITE_MOBILE_ENABLED: "true" }, ["--mode", "preview"]);
});

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
});

describe("a production build with Mobile off", () => {
  it("emits no Mobile chunk and no Mobile string in any JS, CSS or HTML file", () => {
    assert.deepEqual(files(off).filter((file) => /mobile/i.test(path.basename(file))), []);

    for (const file of assets(off)) {
      const content = text(file);
      for (const needle of MOBILE_STRINGS) assert.ok(!content.includes(needle), `${path.basename(file)} contains "${needle}"`);
    }
  });

  it("emits no Mobile custom property or selector in the stylesheet", () => {
    const css = stylesheets(off);
    assert.equal(css.length, 1, "still a single stylesheet");
    assert.doesNotMatch(text(css[0]), /--sm-|\.sm-|@keyframes sm-/);
  });

  it("emits no unreferenced chunk either: every JS file is reachable from index.html", () => {
    const html = text(path.join(off, "index.html"));
    const entry = html.match(/assets\/(index-[^"]+\.js)/)?.[1];
    assert.ok(entry, "entry chunk found in index.html");

    const all = new Map(files(off).filter((file) => file.endsWith(".js")).map((file) => [path.basename(file), text(file)]));
    const seen = new Set([entry]);
    const queue = [entry];

    while (queue.length) {
      const content = all.get(queue.pop()) ?? "";
      for (const match of content.matchAll(/["'`./]((?:[A-Za-z0-9_.-]+)-[A-Za-z0-9_-]{8}\.js)/g)) {
        if (all.has(match[1]) && !seen.has(match[1])) { seen.add(match[1]); queue.push(match[1]); }
      }
    }

    assert.deepEqual([...all.keys()].filter((name) => !seen.has(name)), []);
  });
});

describe("a production build with Mobile on (local testing mode)", () => {
  it("holds the Mobile code in its own lazy chunk, and not in the entry bundle", () => {
    const chunks = files(on).filter((file) => /MobileRouter-[^/\\]+\.js$/.test(file));
    assert.equal(chunks.length, 1);
    assert.ok(text(chunks[0]).includes(SENTINEL));

    const entry = files(on).find((file) => /assets[\\/]index-[^/\\]+\.js$/.test(file));
    for (const needle of [SENTINEL, "sm-root", "Mobile Foundation preview"]) assert.ok(!text(entry).includes(needle), `entry contains "${needle}"`);
  });

  it("adds only Mobile rules to the stylesheet; the Desktop rules are the same, in the same order apart from a bounded head", () => {
    // @import statements end with ";" not "}", so they would glue to the next rule: drop them first.
    const css = (dir) => text(stylesheets(dir)[0]).replace(/@import\s+"[^"]*"[^;{}]*;/g, "");
    const offRules = topLevelRules(css(off));
    const onRules = topLevelRules(css(on));
    const isMobile = (rule) => /\.sm-root|@keyframes sm-/.test(rule);
    const added = onRules.filter(isMobile);
    const desktop = onRules.filter((rule) => !isMobile(rule));

    assert.ok(added.length > 20, `only ${added.length} Mobile rules found`);
    assert.equal(desktop.length, offRules.length);
    assert.deepEqual([...desktop].sort(), [...offRules].sort(), "no Desktop rule added, removed or changed");

    // Known, measured, not harmful: with Mobile on, the bundler puts the Loading
    // component's rules (a module shared with the Mobile chunk) ahead of the
    // first rules of index.css. Everything after that head is in its original
    // order. Review this before a release build turns Mobile on.
    let common = 0;
    while (common < offRules.length && offRules[offRules.length - 1 - common] === desktop[desktop.length - 1 - common]) common += 1;
    const headLength = offRules.length - common;

    assert.ok(headLength < 120, `${headLength} Desktop rules changed place: the reordering is no longer a small head`);
    assert.deepEqual(desktop.slice(0, headLength).sort(), offRules.slice(0, headLength).sort());
    assert.ok(desktop.slice(0, headLength).filter((rule) => /\.loading/.test(rule)).length > 0, "the moved block is the Loading rules");
  });

  it("still ships every Desktop chunk", () => {
    const names = (dir) => new Set(files(dir).map((file) => path.basename(file).replace(/-[A-Za-z0-9_-]{8}\.(js|css)$/, ".$1")));
    const offNames = names(off);
    const onNames = names(on);

    for (const name of offNames) assert.ok(onNames.has(name), `missing ${name}`);
  });
});

describe("the real build command refuses unsafe flag values", () => {
  const run = (env, args = []) =>
    spawnSync(process.execPath, [VITE, "build", "--outDir", path.join(tmpdir(), "smartspend-never-written"), ...args], {
      cwd: ROOT,
      env: cleanEnv(env),
      encoding: "utf8",
    });

  it("production with the flag on and no approval fails before building", () => {
    const result = run({ VITE_MOBILE_ENABLED: "true" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /SMARTSPEND_MOBILE_RELEASE_APPROVED/);
  });

  it("production with TRUE, 1 or yes fails instead of enabling Mobile", () => {
    for (const value of ["TRUE", "1", "yes"]) {
      const result = run({ VITE_MOBILE_ENABLED: value });
      assert.notEqual(result.status, 0, value);
      assert.match(result.stderr + result.stdout, /exactly "true" or "false"/, value);
    }
  });
});
