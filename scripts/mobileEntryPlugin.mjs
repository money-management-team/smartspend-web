/*
 * The one place the Mobile code enters the build.
 *
 * routes/Router.jsx imports `MobileRouter` from the virtual module
 * "virtual:smartspend-mobile". This plugin answers that import:
 *
 *   Mobile off  ->  `export const MobileRouter = null;`   (no import at all)
 *   Mobile on   ->  a lazy import of src/mobile/MobileRouter.jsx
 *
 * Why not `flag ? lazy(() => import("../mobile/...")) : null` in the router?
 * A bundler records a dynamic import before it folds the dead branch, so a
 * build with the flag off still emitted an (unreferenced) Mobile chunk and
 * moved Desktop chunk hashes. Deciding here, when the import is resolved,
 * means a flag-off build never sees the Mobile code. tests/mobileBundle.test.mjs
 * builds both ways and checks the output.
 */

import path from "node:path";

export const MOBILE_ENTRY_ID = "virtual:smartspend-mobile";
const RESOLVED_ID = `\0${MOBILE_ENTRY_ID}`;

export function mobileEntrySource(enabled, root) {
  if (!enabled) return "export const MobileRouter = null;\n";

  const router = path.resolve(root, "src/mobile/MobileRouter.jsx").split(path.sep).join("/");

  return [
    'import { lazy } from "react";',
    `export const MobileRouter = lazy(() => import(${JSON.stringify(router)}));`,
    "",
  ].join("\n");
}

export function mobileEntryPlugin(enabled) {
  let root = process.cwd();

  return {
    name: "smartspend-mobile-entry",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === MOBILE_ENTRY_ID ? RESOLVED_ID : null;
    },
    load(id) {
      return id === RESOLVED_ID ? mobileEntrySource(enabled, root) : null;
    },
  };
}
