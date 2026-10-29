import { useRoutes } from "react-router-dom";
import AdminRoutePage from "./AdminRoutes";
import { PATH } from "./Path";
import { routes, guestRoutes, emailLinkRoutes, userRoutes } from "./Routes";

function Router() {
  const router = useRoutes([
    { path: PATH.ADMIN, element: <AdminRoutePage /> },
    { path: PATH.ADMIN_PERSONAL, element: <AdminRoutePage page="personal" /> },
    { path: "/admin/personal/users/:userId", element: <AdminRoutePage page="personal-user" /> },
    { path: PATH.ADMIN_BUSINESS, element: <AdminRoutePage page="business" /> },
    { path: "/admin/business/companies/:companyId", element: <AdminRoutePage page="company" /> },
    { path: PATH.ADMIN_BILLING, element: <AdminRoutePage page="billing" /> },
    { path: PATH.ADMIN_SUPPORT, element: <AdminRoutePage page="support" /> },
    { path: PATH.ADMIN_AI, element: <AdminRoutePage page="ai" /> },
    { path: PATH.ADMIN_SECURITY, element: <AdminRoutePage page="security" /> },
    { path: PATH.ADMIN_SETTINGS, element: <AdminRoutePage page="settings" /> },
    ...routes,
    ...guestRoutes,
    ...emailLinkRoutes,
    ...userRoutes,
  ]);

  return router;
}

export default Router;
