import { MOBILE_PREFIX, MOBILE_SCREENS } from "../navigation.js";
import { PATH } from "../../routes/Path.js";

/*
 * Maps a location to the presentation that should show it. Pure: no React, no
 * storage, no window. A canonical Desktop URL stays canonical; the resolver
 * only decides whether to send the visitor to the Mobile equivalent (or back).
 *
 * Rules:
 * - Mobile off, or the visitor signed out: never redirect. The existing route
 *   guards own the signed-out flow, and they remember the canonical URL.
 * - Protected paths are never touched: emailed links (their query is a
 *   signature), authentication pages, static documents, the API.
 * - Mode "mobile": a canonical page with a Mobile equivalent that is marked
 *   `fromCanonical` goes to it. Anything else stays where it is, so a page
 *   without a Mobile screen keeps showing the Desktop page.
 * - Mode "desktop": a Mobile URL goes back to its canonical page; an unknown
 *   Mobile URL goes to the dashboard.
 * - Pathname, query and hash are carried across unchanged.
 * - Idempotent: resolveLocation(resolveLocation(x)) equals resolveLocation(x),
 *   so the result of one redirect is never redirected again.
 */

// Whole path segments only: "/signin" matches "/signin/company", not "/signing".
const matchesPrefix = (pathname, prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export const PROTECTED_PREFIXES = Object.freeze([
  PATH.AUTH.VERIFY_EMAIL,
  PATH.AUTH.RESET_PASSWORD,
  PATH.AUTH.SIGNIN,
  PATH.AUTH.REGISTER,
  PATH.AUTH.ACCOUNT_TYPE,
  PATH.AUTH.FORGOT_PASSWORD,
  PATH.AUTH.PASSWORD_CHANGED,
  PATH.AUTH.VERIFY_CODE,
  PATH.USER.WHATSAPP_REVIEW_LINK.replace("/:draftId", ""),
  "/api",
]);

export const normalizePathname = (pathname) => {
  const text = typeof pathname === "string" && pathname.startsWith("/") ? pathname : "/";
  return text.replace(/\/+$/, "") || "/";
};

// A file such as /privacy.html or /terms.html is served by the host, not routed.
const isStaticDocument = (pathname) => /\.[a-z0-9]{1,8}$/i.test(pathname.split("/").pop() ?? "");

export const isMobilePath = (pathname) => matchesPrefix(normalizePathname(pathname), MOBILE_PREFIX);

export function isProtectedPath(pathname) {
  const path = normalizePathname(pathname);
  return isStaticDocument(path) || PROTECTED_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

export const toPath = ({ pathname, search = "", hash = "" }) => `${pathname}${search}${hash}`;

/**
 * @param {{ pathname: string, search?: string, hash?: string }} location
 * @param {{ enabled: boolean, authenticated: boolean, mode: "mobile" | "desktop" }} context
 * @returns {{ pathname: string, search: string, hash: string } | null} where to go, or null to stay
 */
export function getRedirect(location, { enabled, authenticated, mode }) {
  if (!enabled || !authenticated) return null;

  const { search = "", hash = "" } = location;
  const pathname = normalizePathname(location.pathname);

  if (isProtectedPath(pathname)) return null;

  if (mode === "mobile") {
    const screen = MOBILE_SCREENS.find((item) => item.fromCanonical && item.canonical === pathname);
    return screen ? { pathname: screen.mobile, search, hash } : null;
  }

  if (mode === "desktop" && isMobilePath(pathname)) {
    const screen = MOBILE_SCREENS.find((item) => item.mobile === pathname);
    return screen
      ? { pathname: screen.canonical, search, hash }
      : { pathname: PATH.USER.DASHBOARD, search: "", hash: "" };
  }

  return null;
}

/** Where the visitor ends up: the redirect target, or the location itself. */
export function resolveLocation(location, context) {
  const { search = "", hash = "" } = location;
  return getRedirect(location, context) ?? { pathname: location.pathname, search, hash };
}
