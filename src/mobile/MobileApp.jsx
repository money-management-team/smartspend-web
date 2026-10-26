import { useRoutes } from "react-router-dom";

import { mobileRoutes } from "./routes.jsx";

/*
 * The Mobile route tree. Loaded lazily by entry/MobileEntry.jsx, and only for
 * a Mobile URL, so the Desktop route table is never part of it.
 */
export default function MobileApp() {
  return useRoutes(mobileRoutes);
}
