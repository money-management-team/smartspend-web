/*
 * What the last Mobile sign-out said happened ("confirmed", "ended" or "unconfirmed"; see useSignOut.js), kept in memory
 * for the sign-in page to show. The route guard also redirects to sign-in the moment the session is cleared, with the
 * page the person left as the return address, and that redirect can land after Mobile's own navigation, so the outcome
 * is not carried in navigation state: this is read by the sign-in page instead, whichever redirect arrived last.
 *
 * It holds a word, never a person or a token, and is dropped as soon as anyone is signed in again. Whoever signs in
 * while it is set starts at Mobile Home, not at the page the previous person left.
 */
const OUTCOMES = Object.freeze(["confirmed", "ended", "unconfirmed"]);
let notice = null;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

export const getSignOutNotice = () => notice;

export function setSignOutNotice(outcome) {
  notice = OUTCOMES.includes(outcome) ? outcome : null;
  emit();
}

export function clearSignOutNotice() {
  if (notice === null) return;
  notice = null;
  emit();
}

export function subscribeSignOutNotice(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
