import { createContext, useContext } from "react";

/* The shell's PWA state (usePwa.js), for the pages that show it (More's install card). */
export const PwaContext = createContext({ online: true, updateReady: false, update() {}, canInstall: false, install() {} });

export const usePwaState = () => useContext(PwaContext);
