import { useRoutes } from "react-router-dom";
import { routes, guestRoutes, userRoutes } from "./Routes";

function Router() {
  const router = useRoutes([...routes, ...guestRoutes, ...userRoutes]);

  return router;
}

export default Router;
