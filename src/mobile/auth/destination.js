import { getSafeRedirectPath } from "../../routes/postAuthRedirect.js";
import { MOBILE_PREFIX } from "../navigation.js";

/*
 * Where to go after signing in from Mobile: the remembered address when the
 * app's own getSafeRedirectPath accepts it and it is a Mobile page other than
 * sign-in or registration (no loop), else Mobile Home.
 */
export function mobileDestination(state) {
  const from = getSafeRedirectPath(state?.from);
  const isMobile = from && (from === MOBILE_PREFIX || /^\/m[/?#]/.test(from));
  return isMobile && !/^\/m\/(signin|register)(?:[/?#]|$)/.test(from) ? from : MOBILE_PREFIX;
}
