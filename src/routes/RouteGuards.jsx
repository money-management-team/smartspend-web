import { Navigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading/Loading";
import { useAuthContext } from "../contexts/auth/useAuthContext";
import { PATH } from "./Path";
import { getPostAuthPath, toReturnPath } from "./postAuthRedirect";

export function RequireAuth({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();
  const location = useLocation();

  if (initializing) return <Loading variant="page" size="large" message={false} />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={PATH.AUTH.SIGNIN}
        replace
        state={{ from: toReturnPath(location) }}
      />
    );
  }

  return children;
}

export function GuestOnly({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();
  const location = useLocation();

  if (initializing) return <Loading variant="page" size="large" message={false} />;
  if (isAuthenticated) {
    return <Navigate to={getPostAuthPath(location.state)} replace />;
  }

  return children;
}
