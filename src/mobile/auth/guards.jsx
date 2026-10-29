import { Navigate, useLocation } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { toReturnPath } from "../../routes/postAuthRedirect.js";
import { MOBILE_SIGNIN } from "../navigation.js";
import { mobileDestination } from "./destination.js";
import Skeleton from "../ui/Skeleton.jsx";

/*
 * Sign-in guards for the Mobile tree. They read the app's one AuthProvider and
 * do what RouteGuards.jsx does, with Mobile's own sign-in page as the place a
 * signed-out visitor is sent: a Mobile visitor stays in Mobile. The return
 * address goes in router state, exactly as the full version's guard puts it,
 * and is validated with the same getSafeRedirectPath on the way back.
 */
export function MobileRequireAuth({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();
  const location = useLocation();

  if (initializing) return <div className="sm-root sm-standalone"><Skeleton lines={3} /></div>;
  if (!isAuthenticated) return <Navigate to={MOBILE_SIGNIN} replace state={{ from: toReturnPath(location) }} />;
  return children;
}

/* Sign-in and registration are for signed-out visitors; someone signed in goes where they were going. */
export function MobileGuestOnly({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();
  const location = useLocation();

  if (initializing) return <div className="sm-root sm-standalone"><Skeleton lines={3} /></div>;
  if (isAuthenticated) return <Navigate to={mobileDestination(location.state)} replace />;
  return children;
}
