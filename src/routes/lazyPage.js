import { lazy } from "react";

const RELOAD_FLAG = "smartspend:chunk-reload";

/*
 * `lazy()` for route pages. After a new deploy, a tab that is still running
 * the old build asks for chunk files that no longer exist, and the import
 * fails. Reload once to pick up the new build; if it fails again the error
 * reaches the ErrorBoundary instead of looping.
 */
export function lazyPage(importer) {
  return lazy(async () => {
    try {
      const module = await importer();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // Storage unavailable: nothing to reset.
      }
      return module;
    } catch (error) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        // Without storage we cannot tell, so do not reload.
      }

      if (!alreadyReloaded) {
        window.location.reload();
        // Keep Suspense pending while the page reloads.
        return new Promise(() => {});
      }

      throw error;
    }
  });
}
