import { useMemo } from "react";
import { useRoutes } from "react-router-dom";
import { useAuthContext } from "../contexts/auth/useAuthContext";
import { routes, guestRoutes, userRoutes } from "./Routes";

function Router() {
  const { isAuthenticated } = useAuthContext();
  const availableRoutes = useMemo(
    () => [
      ...routes,
      ...(isAuthenticated ? userRoutes : guestRoutes),
    ],
    [isAuthenticated],
  );
  const router = useRoutes(availableRoutes);

  return router;
}

export default Router;
