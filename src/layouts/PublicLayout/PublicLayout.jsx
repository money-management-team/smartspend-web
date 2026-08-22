import { Outlet } from "react-router-dom";

import PublicFooter from "../../features/PublicPages/components/PublicFooter";
import PublicNavbar from "../../features/PublicPages/components/PublicNavbar";

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <PublicNavbar />

      <Outlet />

      <PublicFooter />
    </div>
  );
}
