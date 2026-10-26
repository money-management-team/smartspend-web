import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { isPresentationBusy, isRedirectLoop, recordRedirect } from "./guard.js";
import { getRedirect, toPath } from "./resolver.js";
import { usePresentation } from "./usePresentation.js";

// One automatic redirect, by history replacement, carrying the router state
// (RequireAuth keeps the post-sign-in destination there).
function RedirectOnce({ from, to, state }) {
  useEffect(() => {
    recordRedirect(from, to);
  }, [from, to]);

  return <Navigate to={to} replace state={state} />;
}

/*
 * Sends a signed-in visitor to the presentation they should see, before the
 * page behind it mounts. While the session is still being restored nothing is
 * decided: the route guards show their loading state, and nothing here
 * redirects a signed-out visitor, so their canonical URL is what gets
 * remembered for after sign-in.
 *
 * This module is only ever loaded by a build with Mobile on, so `enabled`
 * defaults to true; the resolver ignores the stored preference entirely when
 * it is false (tested), as a second line of defence.
 */
export default function PresentationGate({
  children,
  enabled = true,
  resolve = getRedirect,
}) {
  const location = useLocation();
  const { initializing, isAuthenticated } = useAuthContext();
  const { mode } = usePresentation();

  const target = initializing
    ? null
    : resolve(location, { enabled, authenticated: isAuthenticated, mode });

  if (target) {
    const from = toPath(location);
    const to = toPath(target);

    if (to !== from && !isPresentationBusy() && !isRedirectLoop(from, to)) {
      return <RedirectOnce from={from} to={to} state={location.state} />;
    }
  }

  return children;
}
