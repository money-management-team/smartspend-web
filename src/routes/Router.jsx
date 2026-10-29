import { useRoutes } from "react-router-dom";
import AdminRoutePage from "./AdminRoutes";
import { PATH } from "./Path";
import { routes, guestRoutes, emailLinkRoutes, userRoutes } from "./Routes";

function Router() {
  const router = useRoutes([
    { path: PATH.ADMIN, element: <AdminRoutePage /> },
    { path: PATH.ADMIN_PERSONAL, element: <AdminRoutePage page="personal" /> },
    { path: PATH.ADMIN_BUSINESS, element: <AdminRoutePage page="business" /> },
    ...routes,
    ...guestRoutes,
    ...emailLinkRoutes,
    ...userRoutes,
  ]);

  return router;
}

export default Router;
