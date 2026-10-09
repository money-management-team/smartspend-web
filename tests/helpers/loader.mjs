import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { transformWithOxc } from "vite";

/*
 * Node module hooks for tests only:
 * - .jsx is compiled with Vite's own transform (automatic JSX runtime);
 * - `import.meta.env` is replaced by a fixed test object;
 * - .css and image imports become empty modules;
 * - .json imported the Vite way (no import attribute) becomes a default export;
 * - extensionless relative imports resolve like Vite does (.jsx, .js, /index).
 */
const SUFFIXES = ["", ".jsx", ".js", "/index.jsx", "/index.js"];
const STUBBED = /\.(css|png|jpe?g|svg|webp|woff2?|ttf)$/i;

export async function resolve(specifier, context, nextResolve) {
  if (!/^\.{1,2}\//.test(specifier) || /\.[a-z0-9]+$/i.test(specifier)) {
    return nextResolve(specifier, context);
  }

  let lastError;
  for (const suffix of SUFFIXES) {
    try {
      return await nextResolve(specifier + suffix, context);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function load(url, context, nextLoad) {
  const clean = url.split("?")[0];

  if (STUBBED.test(clean)) {
    return { format: "module", source: 'export default "";', shortCircuit: true };
  }

  if (clean.endsWith(".json") && context.importAttributes?.type !== "json") {
    const json = await readFile(fileURLToPath(clean), "utf8");
    return { format: "module", source: `export default ${json};`, shortCircuit: true };
  }

  const isJsx = clean.endsWith(".jsx");
  const isAppJs = clean.endsWith(".js") && clean.includes("/src/");

  if (isJsx || isAppJs) {
    const filename = fileURLToPath(clean);
    const source = await readFile(filename, "utf8");
    // Plain .js only needs work when it reads Vite's `import.meta.env`.
    if (isAppJs && !source.includes("import.meta.env")) return nextLoad(url, context);

    const { code } = await transformWithOxc(source, filename, {
      lang: isJsx ? "jsx" : "js",
      jsx: { runtime: "automatic" },
      define: { "import.meta.env": '({ DEV: false, PROD: false, MODE: "test" })' },
    });
    return { format: "module", source: code, shortCircuit: true };
  }

  return nextLoad(url, context);
}
