import { RequireAuth } from "../routes/RouteGuards";
import { MOBILE_PREFIX } from "./navigation.js";
import MobileMore from "./screens/MobileMore.jsx";
import MobileNotAvailable from "./screens/MobileNotAvailable.jsx";
import PlaceholderScreen from "./screens/PlaceholderScreen.jsx";
import MobileAppShell from "./shell/MobileAppShell.jsx";

/*
 * The Mobile route tree. It uses the app's own RequireAuth, so a signed-out
 * visitor is sent to sign-in and returns here afterwards, exactly as on
 * Desktop. Nothing here reads or writes financial data.
 */
export const mobileRoutes = [
  {
    path: MOBILE_PREFIX,
    element: (
      <RequireAuth>
        <MobileAppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <PlaceholderScreen id="home" /> },
      { path: "activity", element: <PlaceholderScreen id="activity" /> },
      { path: "planning", element: <PlaceholderScreen id="planning" /> },
      { path: "more", element: <MobileMore /> },
      { path: "*", element: <MobileNotAvailable /> },
    ],
  },
];
