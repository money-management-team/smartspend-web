import { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";

import PresentationGate from "../presentation/PresentationGate.jsx";
import { isMobilePath } from "../presentation/resolver.js";
import "../styles/mobile.css";
import MobileBoot from "./MobileBoot.jsx";

// The Mobile screens, shell and data layer. Requested only when a Mobile URL is
// actually shown, so a Desktop visitor never downloads it.
const MobileApp = lazy(() => import("../MobileApp.jsx"));

/*
 * The one piece of Mobile that is in the main bundle (and only in a build with
 * Mobile on; see scripts/mobileEntryPlugin.mjs). It decides, before anything
 * mounts, which presentation to show:
 *
 * - a redirect (presentation gate): only a navigation, no page mounts;
 * - a Mobile URL: the lazy Mobile app, behind its own loading state;
 * - anything else: `desktop`, the Desktop route table, rendered exactly as it
 *   is with Mobile off. No Suspense boundary, no chunk request, no Mobile
 *   element in the Desktop tree.
 */
export default function MobileEntry({ desktop }) {
  const { pathname } = useLocation();

  return (
    <PresentationGate>
      {isMobilePath(pathname) ? (
        <Suspense fallback={<MobileBoot />}>
          <MobileApp />
        </Suspense>
      ) : (
        desktop
      )}
    </PresentationGate>
  );
}
