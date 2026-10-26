import { useCallback, useSyncExternalStore } from "react";

import { COMPACT_NAV_MAX_REM } from "../navigation.js";

const DEFAULT_ROOT_FONT_PX = 16;

/*
 * True when the screen is narrower than `thresholdRem` root-font units, the
 * point where five labelled slots no longer fit. Measuring in rem rather than
 * pixels means enlarged text turns a "wide enough" phone into a narrow one.
 * Pure, so the rule is tested without a browser.
 */
export function isCompactNav(widthPx, rootFontPx, thresholdRem = COMPACT_NAV_MAX_REM) {
  if (!(widthPx > 0)) return false;
  const font = rootFontPx > 0 ? rootFontPx : DEFAULT_ROOT_FONT_PX;
  return widthPx / font < thresholdRem;
}

function readCompact(thresholdRem) {
  const root = document.documentElement;
  const width = window.innerWidth || root.clientWidth;
  const font = Number.parseFloat(window.getComputedStyle(root).fontSize);

  return isCompactNav(width, font, thresholdRem);
}

/*
 * Whether the bottom bar should use the compact "Menu + Add" layout. It is
 * re-measured when the window is resized, rotated, or the page becomes
 * visible again (a text-size change made in system settings shows up then).
 */
export function useCompactNav(thresholdRem = COMPACT_NAV_MAX_REM) {
  const subscribe = useCallback((notify) => {
    window.addEventListener("resize", notify);
    window.addEventListener("orientationchange", notify);
    document.addEventListener("visibilitychange", notify);

    return () => {
      window.removeEventListener("resize", notify);
      window.removeEventListener("orientationchange", notify);
      document.removeEventListener("visibilitychange", notify);
    };
  }, []);

  return useSyncExternalStore(subscribe, () => readCompact(thresholdRem), () => false);
}
