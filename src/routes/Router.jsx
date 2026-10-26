import { Suspense } from "react";
import { useRoutes } from "react-router-dom";
// Supplied by scripts/mobileEntryPlugin.mjs: null unless this build has Mobile on.
import { MobileRouter } from "virtual:smartspend-mobile";

import Loading from "../components/Loading/Loading";
import { routes, guestRoutes, emailLinkRoutes, userRoutes } from "./Routes";

const desktopRoutes = [
  ...routes,
  ...guestRoutes,
  ...emailLinkRoutes,
  ...userRoutes,
];

function DesktopRouter() {
  return useRoutes(desktopRoutes);
}

function Router() {
  if (MobileRouter) {
    return (
      <Suspense fallback={<Loading variant="page" size="large" message={false} />}>
        <MobileRouter desktopRoutes={desktopRoutes} />
      </Suspense>
    );
  }

  return <DesktopRouter />;
}

export default Router;
