import { Navigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading/Loading";
import { useAuthContext } from "../contexts/auth/useAuthContext";
import { PATH } from "./Path";

export function RequireAuth({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();
  const location = useLocation();

  if (initializing) return <Loading message={false} />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={PATH.AUTH.SIGNIN}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}

export function GuestOnly({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();

  if (initializing) return <Loading message={false} />;
  if (isAuthenticated) return <Navigate to={PATH.USER.DASHBOARD} replace />;

  return children;
}
