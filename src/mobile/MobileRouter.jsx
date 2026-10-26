import { useRoutes } from "react-router-dom";

import PresentationGate from "./presentation/PresentationGate.jsx";
import { mobileRoutes } from "./routes.jsx";

/*
 * The route table when Mobile is built in: the Desktop routes exactly as
 * given (passed in by routes/Router.jsx, so this tree never imports Desktop
 * pages) plus the Mobile tree, behind the presentation gate.
 *
 * Loaded lazily, and only by a build where VITE_MOBILE_ENABLED is "true"
 * (see scripts/mobileEntryPlugin.mjs).
 */
export default function MobileRouter({ desktopRoutes }) {
  const element = useRoutes([...desktopRoutes, ...mobileRoutes]);

  return <PresentationGate>{element}</PresentationGate>;
}
