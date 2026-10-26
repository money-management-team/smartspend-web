import { PATH } from "../routes/Path.js";

/* URL prefix of the Mobile route tree. Canonical URLs never use it. */
export const MOBILE_PREFIX = "/m";

/*
 * The four primary destinations. Add is an action (a button that opens a
 * sheet), not a fifth destination, so it is not listed here.
 *
 * `canonical` is the Desktop page that covers the same ground.
 * `fromCanonical` says whether a visit to that Desktop page is sent to the
 * Mobile screen when Mobile is the chosen presentation. In S04A every screen
 * except Home is a placeholder, so only Home is: a working Desktop page is
 * never replaced by a placeholder. A later slice turns this on per screen
 * when the Mobile screen is a real equivalent.
 */
export const MOBILE_SCREENS = Object.freeze([
  { id: "home", mobile: MOBILE_PREFIX, canonical: PATH.USER.DASHBOARD, fromCanonical: true },
  { id: "activity", mobile: `${MOBILE_PREFIX}/activity`, canonical: PATH.USER.FINANCIAL_OPERATIONS, fromCanonical: false },
  { id: "planning", mobile: `${MOBILE_PREFIX}/planning`, canonical: PATH.USER.BUDGETS, fromCanonical: false },
  { id: "more", mobile: `${MOBILE_PREFIX}/more`, canonical: PATH.USER.SETTING, fromCanonical: false },
]);

/*
 * Below this width (in rem, so enlarged text makes it a wider screen) the
 * bottom bar cannot show five labelled slots, and switches to "Menu + Add".
 * 17rem is the provisional value from the S03.5 prototype; change it here.
 */
export const COMPACT_NAV_MAX_REM = 17;
