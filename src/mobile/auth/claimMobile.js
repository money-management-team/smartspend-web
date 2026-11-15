import { readPreference, writePreference } from "../presentation/preference.js";

/*
 * Signing in from a Mobile page is the choice of Mobile, as "Open Mobile" at /m/enter is. The presentation gate sits
 * above the route tree and, for a signed-in visitor whose mode is "desktop" (an explicit choice, or "auto" on a
 * non-touch browser), sends every Mobile address to the dashboard. The session appearing is what makes the gate
 * act, so the choice has to be stored before the sign-in request resolves, not after.
 *
 * Returns the undo: a sign-in that fails puts the stored choice back exactly as it was ("auto" is the absence of a
 * stored value). Nothing else is stored, and nothing is sent anywhere.
 */
export function claimMobile() {
  const previous = readPreference();
  writePreference("mobile");
  return () => {
    writePreference(previous);
  };
}
