import { RequireAuth } from "../routes/RouteGuards";
import MobileAccountDetail from "./accounts/MobileAccountDetail.jsx";
import MobileAccounts from "./accounts/MobileAccounts.jsx";
import MobileHome from "./home/MobileHome.jsx";
import IdentityBoundary from "./identity/IdentityBoundary.jsx";
import { MOBILE_ENTER, MOBILE_PREFIX } from "./navigation.js";
import MobileEnter from "./screens/MobileEnter.jsx";
import MobileMore from "./screens/MobileMore.jsx";
import MobileNotAvailable from "./screens/MobileNotAvailable.jsx";
import PlaceholderScreen from "./screens/PlaceholderScreen.jsx";
import MobileAppShell from "./shell/MobileAppShell.jsx";

/*
 * The Mobile route tree. It uses the app's own RequireAuth, so a signed-out
 * visitor is sent to sign-in and returns here afterwards, exactly as on
 * Desktop. Everything inside the shell sits in the identity boundary, which
 * owns the in-memory data and takes the screen down if the signed-in identity
 * stops being consistent. Nothing here writes financial data: Home, Accounts
 * and an account's page only read (see data/readApi.js).
 *
 * /m/enter is outside the shell on purpose (it is the way in, not a screen of
 * the app) but behind the same sign-in guard.
 */
export const mobileRoutes = [
  {
    path: MOBILE_ENTER,
    element: (
      <RequireAuth>
        <MobileEnter />
      </RequireAuth>
    ),
  },
  {
    path: MOBILE_PREFIX,
    element: (
      <RequireAuth>
        <IdentityBoundary>
          <MobileAppShell />
        </IdentityBoundary>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <MobileHome /> },
      { path: "accounts", element: <MobileAccounts /> },
      { path: "accounts/:accountId", element: <MobileAccountDetail /> },
      { path: "activity", element: <PlaceholderScreen id="activity" /> },
      { path: "planning", element: <PlaceholderScreen id="planning" /> },
      { path: "more", element: <MobileMore /> },
      { path: "*", element: <MobileNotAvailable /> },
    ],
  },
];
