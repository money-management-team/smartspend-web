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

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PWA_ENTRY_ID, pwaEntrySource, pwaManifest, swSource } from "./mobilePwa.mjs";

export const MOBILE_ENTRY_ID = "virtual:smartspend-mobile";
const RESOLVED_ID = `\0${MOBILE_ENTRY_ID}`;
const RESOLVED_PWA_ID = `\0${PWA_ENTRY_ID}`;
export function mobileEntrySource(enabled, root) {
  if (!enabled) return "export const MobileEntry = null;\n";

  const entry = path.resolve(root, "src/mobile/entry/MobileEntry.jsx").split(path.sep).join("/");

  return `export { default as MobileEntry } from ${JSON.stringify(entry)};\n`;
}

/*
 * `pwa` (scripts/mobilePwa.mjs) is only ever true in a non-production build with
 * Mobile on. Then the worker, the manifest and the icon are emitted under m/;
 * otherwise nothing is, and "virtual:smartspend-mobile-pwa" says MOBILE_PWA = false.
 */
export function mobileEntryPlugin(enabled, { pwa = false } = {}) {
  let root = process.cwd();
  const withPwa = Boolean(enabled && pwa);

  return {
    name: "smartspend-mobile-entry",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === MOBILE_ENTRY_ID) return RESOLVED_ID;
      if (id === PWA_ENTRY_ID) return RESOLVED_PWA_ID;
      return null;
    },
    load(id) {
      if (id === RESOLVED_ID) return mobileEntrySource(enabled, root);
      if (id === RESOLVED_PWA_ID) return pwaEntrySource(withPwa, "");
      return null;
    },
    generateBundle(_options, bundle) {
      if (!withPwa) return;
      // The worker's version follows the build's own file names, so a new build is a new cache.
      const version = createHash("sha256").update(Object.keys(bundle).sort().join(",")).digest("hex").slice(0, 12);
      this.emitFile({ type: "asset", fileName: "m/sw.js", source: swSource(version) });
      this.emitFile({ type: "asset", fileName: "m/manifest.webmanifest", source: JSON.stringify(pwaManifest(), null, 2) });
      this.emitFile({ type: "asset", fileName: "m/icon-256.png", source: readFileSync(path.resolve(root, "src/assets/smartspend-logo-256.png")) });
    },
  };
}
