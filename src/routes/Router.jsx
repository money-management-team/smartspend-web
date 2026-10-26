import { useRoutes } from "react-router-dom";
// Supplied by scripts/mobileEntryPlugin.mjs: null unless this build has Mobile on.
import { MobileEntry } from "virtual:smartspend-mobile";

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

// With Mobile on, MobileEntry shows this same element for every Desktop URL.
function Router() {
  if (MobileEntry) return <MobileEntry desktop={<DesktopRouter />} />;

  return <DesktopRouter />;
}

export default Router;
