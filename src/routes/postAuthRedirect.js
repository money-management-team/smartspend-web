import { PATH } from "./Path.js";

/*
 * Where to send a user after authentication. RequireAuth stores the page the
 * visitor asked for in router state (`state.from`, a "/path?query#hash"
 * string); the sign-in flows and GuestOnly read it back here.
 *
 * The value comes from history state, which a crafted link can't set, but it
 * is still validated: only same-origin application paths are accepted, so an
 * absolute URL, a protocol-relative "//host" or a "/\host" can never become a
 * redirect target.
 */

// Pages a signed-in user must not be sent back to (they would bounce away).
const GUEST_ONLY_PATHS = [
  PATH.AUTH.ACCOUNT_TYPE,
  PATH.AUTH.SIGNIN,
  PATH.AUTH.REGISTER,
  PATH.AUTH.COMPANY_SIGNIN,
  PATH.AUTH.COMPANY_REGISTER,
  PATH.AUTH.FORGOT_PASSWORD,
  PATH.AUTH.VERIFY_CODE,
  PATH.AUTH.PASSWORD_CHANGED,
];

const hasControlCharacter = (value) =>
  [...value].some((char) => char.charCodeAt(0) < 0x20 || char === "\u007f");

export function getSafeRedirectPath(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || hasControlCharacter(value)) return null;

  const pathname = value.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const isGuestOnly = GUEST_ONLY_PATHS.some(
    (guestPath) =>
      pathname === guestPath || pathname.startsWith(`${guestPath}/`),
  );

  return isGuestOnly ? null : value;
}

// The value RequireAuth stores: the full requested location.
export const toReturnPath = ({ pathname, search = "", hash = "" }) =>
  `${pathname}${search}${hash}`;

// Destination after a successful sign-in; falls back to the dashboard.
export const getPostAuthPath = (state) =>
  getSafeRedirectPath(state?.from) ?? PATH.USER.DASHBOARD;
