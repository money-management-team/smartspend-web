import { useRoutes } from "react-router-dom";
import { routes, guestRoutes, emailLinkRoutes, userRoutes } from "./Routes";

function Router() {
  const router = useRoutes([
    ...routes,
    ...guestRoutes,
    ...emailLinkRoutes,
    ...userRoutes,
  ]);

  return router;
}

export default Router;
