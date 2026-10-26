import { PATH } from "../routes/Path.js";

/* URL prefix of the Mobile route tree. Canonical URLs never use it. */
export const MOBILE_PREFIX = "/m";

/*
 * Mobile screens that are not one of the four primary destinations.
 *
 * Accounts is reached from Home and from More (More's current-page marker
 * stays on while a visitor is inside it). An account's page is
 * /m/accounts/{id}. /m/enter is the explicit way into Mobile for someone whose
 * stored choice is the full version: it asks, and only a tap changes the choice.
 */
export const MOBILE_ACCOUNTS = `${MOBILE_PREFIX}/accounts`;
export const MOBILE_ENTER = `${MOBILE_PREFIX}/enter`;
export const accountDetailPath = (accountId) => `${MOBILE_ACCOUNTS}/${encodeURIComponent(accountId)}`;

/*
 * The four primary destinations. Add is an action (a button that opens a
 * sheet), not a fifth destination, so it is not listed here.
 *
 * `canonical` is the Desktop page that covers the same ground.
 * `fromCanonical` says whether a visit to that Desktop page is sent to the
 * Mobile screen when Mobile is the chosen presentation. Only Home is: it is a
 * real read-only screen. Activity and Planning are still placeholders, and
 * More is a different page from Desktop's Settings, so a working Desktop page
 * is never replaced by something that does less. Accounts is not listed here
 * either: Desktop's Accounts page can create, edit and archive, and Mobile's
 * is read-only, so /dashboard/accounts stays Desktop.
 */
export const MOBILE_SCREENS = Object.freeze([
  { id: "home", mobile: MOBILE_PREFIX, canonical: PATH.USER.DASHBOARD, fromCanonical: true },
  { id: "activity", mobile: `${MOBILE_PREFIX}/activity`, canonical: PATH.USER.FINANCIAL_OPERATIONS, fromCanonical: false },
  { id: "planning", mobile: `${MOBILE_PREFIX}/planning`, canonical: PATH.USER.BUDGETS, fromCanonical: false },
  { id: "more", mobile: `${MOBILE_PREFIX}/more`, canonical: PATH.USER.SETTING, fromCanonical: false, within: [`${MOBILE_PREFIX}/accounts`] },
]);

/*
 * aria-current for a destination: "page" on the page itself, "true" while the
 * visitor is on a page inside it (Accounts under More), nothing otherwise.
 */
export function currentOf(screen, pathname) {
  if (pathname === screen.mobile) return "page";
  return screen.within?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ? "true" : undefined;
}

/*
 * Below this width (in rem, so enlarged text makes it a wider screen) the
 * bottom bar cannot show five labelled slots, and switches to "Menu + Add".
 * 17rem is the provisional value from the S03.5 prototype; change it here.
 */
export const COMPACT_NAV_MAX_REM = 17;
