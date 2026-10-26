/*
 * The one place the Mobile code enters the build.
 *
 * routes/Router.jsx imports `MobileEntry` from the virtual module
 * "virtual:smartspend-mobile". This plugin answers that import:
 *
 *   Mobile off  ->  `export const MobileEntry = null;`   (nothing else exists)
 *   Mobile on   ->  a re-export of src/mobile/entry/MobileEntry.jsx
 *
 * Why a module the plugin answers, and not `flag ? import(...) : null` in the
 * router? A bundler records a dynamic import before it folds the dead branch,
 * so a build with the flag off still emitted an (unreferenced) Mobile chunk and
 * moved Desktop chunk hashes. Deciding here, when the import is resolved,
 * means a flag-off build never sees any Mobile module at all.
 *
 * MobileEntry is small and static: it decides which presentation to show. The
 * Mobile screens themselves are a lazy chunk it loads only for a Mobile URL
 * (see entry/MobileEntry.jsx), so a Desktop visitor never requests them.
 * tests/mobileBundle.test.mjs builds both ways and checks the output.
 */

import path from "node:path";

export const MOBILE_ENTRY_ID = "virtual:smartspend-mobile";
const RESOLVED_ID = `\0${MOBILE_ENTRY_ID}`;

export function mobileEntrySource(enabled, root) {
  if (!enabled) return "export const MobileEntry = null;\n";

  const entry = path.resolve(root, "src/mobile/entry/MobileEntry.jsx").split(path.sep).join("/");

  return `export { default as MobileEntry } from ${JSON.stringify(entry)};\n`;
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
