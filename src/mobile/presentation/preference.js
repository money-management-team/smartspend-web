/*
 * The visitor's choice of presentation, and the automatic fallback.
 *
 * Only a harmless display choice is stored: one of three words, in the
 * browser's localStorage, shared by every account on this device. No
 * financial data, no identifiers.
 */

export const PRESENTATION_KEY = "smartspend:presentation:v1";
export const PRESENTATION_EVENT = "smartspend:presentation-changed";
export const PRESENTATION_PREFERENCES = Object.freeze(["auto", "mobile", "desktop"]);

// "Automatic" picks Mobile for a touch device whose shorter screen side is at
// most this many CSS pixels. The shorter side does not change when a phone is
// rotated, so rotating never switches presentation.
export const AUTO_MOBILE_MAX_SHORT_SIDE_PX = 600;

export const parsePreference = (value) => (PRESENTATION_PREFERENCES.includes(value) ? value : "auto");

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readPreference(storage = getStorage()) {
  try {
    return parsePreference(storage?.getItem(PRESENTATION_KEY));
  } catch {
    return "auto";
  }
}

/** Saves the choice and tells every listener. Returns false when storage is blocked. */
export function writePreference(preference, storage = getStorage(), target = globalThis.window) {
  const value = parsePreference(preference);
  let persisted = false;

  try {
    if (storage) {
      if (value === "auto") storage.removeItem(PRESENTATION_KEY);
      else storage.setItem(PRESENTATION_KEY, value);
      persisted = true;
    }
  } catch {
    // Blocked storage: the choice still reaches the listeners below, for this visit.
  }

  target?.dispatchEvent?.(new Event(PRESENTATION_EVENT));
  return persisted;
}

/** What the device looks like; read fresh each time, never watched. */
export function detectEnvironment(win = globalThis.window) {
  const screen = win?.screen;
  const sides = [screen?.width, screen?.height].filter((side) => Number.isFinite(side) && side > 0);

  return {
    coarsePointer: Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches),
    shortSidePx: sides.length ? Math.min(...sides) : Infinity,
  };
}

/** "mobile" or "desktop". An explicit choice always wins; "auto" asks the device. */
export function resolveMode(preference, environment) {
  const choice = parsePreference(preference);
  if (choice !== "auto") return choice;

  return environment?.coarsePointer && environment.shortSidePx <= AUTO_MOBILE_MAX_SHORT_SIDE_PX
    ? "mobile"
    : "desktop";
}
