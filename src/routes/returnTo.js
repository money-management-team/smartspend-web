import { PATH } from "./Path";

/*
 * Return-to-destination for the sign-in flow. `RequireAuth` sends a guest to
 * the sign-in page with `?redirect=<path>`; after login, register or Google
 * sign-in the user goes back there. The value comes from the URL, so it is
 * untrusted: only internal paths under the dashboard are accepted, everything
 * else (external URLs, protocol-relative `//host`, auth pages, garbage) falls
 * back to the default landing page.
 */

export const RETURN_TO_PARAM = "redirect";

// Only the signed-in area can be a destination. This also rules out auth
// pages, so a stale or crafted link can never loop between them.
const ALLOWED_PREFIX = PATH.USER.DASHBOARD;
const hasUnsafeChars = (value) =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f || code === 0x5c;
  });

export function sanitizeReturnPath(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    return null;
  }

  if (!raw.startsWith("/") || raw.startsWith("//") || hasUnsafeChars(raw)) {
    return null;
  }

  let url;
  try {
    // A relative path resolved against a throwaway origin stays on it.
    url = new URL(raw, "https://return-to.invalid");
  } catch {
    return null;
  }

  if (url.origin !== "https://return-to.invalid") return null;

  const { pathname } = url;
  if (
    pathname !== ALLOWED_PREFIX &&
    !pathname.startsWith(`${ALLOWED_PREFIX}/`)
  ) {
    return null;
  }

  return `${pathname}${url.search}${url.hash}`;
}

/* The safe destination encoded in a `location.search`, or the dashboard. */
export function getReturnPath(search) {
  const raw = new URLSearchParams(search).get(RETURN_TO_PARAM);
  return sanitizeReturnPath(raw) ?? PATH.USER.DASHBOARD;
}

/* Sign-in URL that comes back to `location` (pathname + search + hash). */
export function getSigninPathFor({ pathname, search = "", hash = "" }) {
  const target = sanitizeReturnPath(`${pathname}${search}${hash}`);
  return target
    ? `${PATH.AUTH.SIGNIN}?${RETURN_TO_PARAM}=${encodeURIComponent(target)}`
    : PATH.AUTH.SIGNIN;
}

/* Carries the pending destination across the sign-in <-> register switch. */
export function withReturnTo(path, search) {
  const raw = new URLSearchParams(search).get(RETURN_TO_PARAM);
  const target = sanitizeReturnPath(raw);
  return target
    ? `${path}?${RETURN_TO_PARAM}=${encodeURIComponent(target)}`
    : path;
}
