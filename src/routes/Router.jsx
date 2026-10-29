import { useRoutes } from "react-router-dom";
import AdminRoutePage from "./AdminRoutes";
import { PATH } from "./Path";
import { routes, guestRoutes, emailLinkRoutes, userRoutes } from "./Routes";

function Router() {
  const router = useRoutes([
    { path: PATH.ADMIN, element: <AdminRoutePage /> },
    ...routes,
    ...guestRoutes,
    ...emailLinkRoutes,
    ...userRoutes,
  ]);

  return router;
}

export default Router;
