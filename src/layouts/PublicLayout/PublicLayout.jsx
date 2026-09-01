import { Outlet } from "react-router-dom";

import PublicFooter from "../../features/PublicPage/components/PublicFooter";
import PublicNavbar from "../../features/PublicPage/components/PublicNavbar";

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <PublicNavbar />

      <Outlet />

      <PublicFooter />
    </div>
  );
}
