import { Navigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading/Loading";
import { useAuthContext } from "../contexts/auth/useAuthContext";
import { getSigninPathFor } from "./returnTo";
import { useReturnPath } from "./useReturnPath";

export function RequireAuth({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();
  const location = useLocation();

  if (initializing) return <Loading message={false} />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={getSigninPathFor(location)}
        replace
      />
    );
  }

  return children;
}

export function GuestOnly({ children }) {
  const { initializing, isAuthenticated } = useAuthContext();
  const returnPath = useReturnPath();

  if (initializing) return <Loading message={false} />;
  if (isAuthenticated) return <Navigate to={returnPath} replace />;

  return children;
}
