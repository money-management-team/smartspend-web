/*
 * "Don't switch presentation now": a form with unsaved edits, or a request in
 * flight, registers itself here and the automatic redirect waits.
 *
 * S04A has no such screen yet; later slices call markPresentationBusy() while a
 * form is dirty or a write is running, and release it when it ends. A Desktop
 * form with unsaved changes is already protected by the router blocker, which
 * a redirect goes through like any other navigation.
 */

let busy = 0;

/** Returns a function that ends this registration (safe to call twice). */
export function markPresentationBusy() {
  let released = false;
  busy += 1;

  return () => {
    if (released) return;
    released = true;
    busy = Math.max(0, busy - 1);
  };
}

export const isPresentationBusy = () => busy > 0;

// For tests.
export function resetPresentationGuard() {
  busy = 0;
}

/*
 * Loop breaker, a second line of defence behind the resolver's idempotence:
 * a redirect straight back to where the previous one came from, within a
 * second, is refused.
 */
const LOOP_WINDOW_MS = 1000;
let lastRedirect = null;

export function recordRedirect(from, to, now = Date.now()) {
  lastRedirect = { from, to, at: now };
}

export function isRedirectLoop(from, to, now = Date.now()) {
  return Boolean(
    lastRedirect &&
      lastRedirect.from === to &&
      lastRedirect.to === from &&
      now - lastRedirect.at < LOOP_WINDOW_MS,
  );
}

export function resetRedirectHistory() {
  lastRedirect = null;
}
