import { createContext, useContext } from "react";

/*
 * The element inside the Mobile root that overlays render into. Overlays
 * belong inside `.sm-root`: that is where the Mobile styles apply, whereas
 * the shared Desktop dialogs portal to <body>, outside them.
 */
export const MobilePortalContext = createContext(null);

export const useMobilePortal = () => useContext(MobilePortalContext);
