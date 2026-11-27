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

import { PWA_APPLE_TOUCH_ICON, PWA_ENTRY_ID, PWA_ICONS, PWA_LEGACY_SW_PATH, PWA_SW_PATH, pwaEntrySource, pwaManifest, retireSwSource, swSource } from "./mobilePwa.mjs";

export const MOBILE_ENTRY_ID = "virtual:smartspend-mobile";
const RESOLVED_ID = `\0${MOBILE_ENTRY_ID}`;
const RESOLVED_PWA_ID = `\0${PWA_ENTRY_ID}`;
export function mobileEntrySource(enabled, root) {
  if (!enabled) return "export const MobileEntry = null;\n";

  const entry = path.resolve(root, "src/mobile/entry/MobileEntry.jsx").split(path.sep).join("/");

  return `export { default as MobileEntry } from ${JSON.stringify(entry)};\n`;
}

/*
 * `pwa` (scripts/mobilePwa.mjs) is only ever true with Mobile on, and in a
 * production-mode build only for an approved PWA release. Then the worker (at the root, so its scope can be /m), and the
 * manifest and icons (under m/) are emitted; otherwise nothing is, and
 * "virtual:smartspend-mobile-pwa" says MOBILE_PWA = false.
 * `retire` (never with `pwa`) emits only the retire
 * worker, at the current worker's address and at the first builds' (m/sw.js),
 * whatever the Mobile flag says: the rollback path.
 */
export function mobileEntryPlugin(enabled, { pwa = false, retire = false } = {}) {
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
      if (!withPwa) {
        if (retire) for (const address of [PWA_SW_PATH, PWA_LEGACY_SW_PATH]) this.emitFile({ type: "asset", fileName: address.slice(1), source: retireSwSource() });
        return;
      }
      // The worker's version follows the build's own file names, so a new build is a new cache.
      const version = createHash("sha256").update(Object.keys(bundle).sort().join(",")).digest("hex").slice(0, 12);
      this.emitFile({ type: "asset", fileName: PWA_SW_PATH.slice(1), source: swSource(version) });
      this.emitFile({ type: "asset", fileName: "m/manifest.webmanifest", source: JSON.stringify(pwaManifest(), null, 2) });
      for (const file of [...PWA_ICONS.map((icon) => icon.file), PWA_APPLE_TOUCH_ICON]) {
        this.emitFile({ type: "asset", fileName: `m/${file}`, source: readFileSync(path.resolve(root, "src/mobile/pwa/icons", file)) });
      }
    },
  };
}
