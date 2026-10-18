import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { AUTH_INTENT, getAccountTypePath, PATH } from "../../../routes/Path";

export const cx = (...classes) => classes.filter(Boolean).join(" ");

/**
 * Where a "SmartSpend" action leads: the dashboard when signed in; otherwise
 * account creation (`register`) or sign-in (`signin`), through the account
 * type page like the rest of the public site. The route guards still decide.
 */
export function usePlatformDestination(intent = AUTH_INTENT.REGISTER) {
  const { isAuthenticated } = useAuthContext();
  if (isAuthenticated) return { to: PATH.USER.DASHBOARD, signedIn: true };
  return { to: getAccountTypePath(intent), signedIn: false };
}

/** Arrow, Home and End keys for a tablist, mirrored in RTL. Focus follows selection. */
export function onTabKey(event, ids, index, rtl, select, prefix) {
  let next;
  if (event.key === "Home") next = 0;
  else if (event.key === "End") next = ids.length - 1;
  else if (event.key === "ArrowRight") next = (index + (rtl ? -1 : 1) + ids.length) % ids.length;
  else if (event.key === "ArrowLeft") next = (index + (rtl ? 1 : -1) + ids.length) % ids.length;
  else return;
  event.preventDefault();
  select(ids[next]);
  document.getElementById(`${prefix}${ids[next]}`)?.focus();
}
