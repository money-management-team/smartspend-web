import { lazy, Suspense } from "react";
import Loading from "../components/Loading/Loading";

const AdminOverview = lazy(() => import("../features/Admin/Overview/AdminOverview"));
const PersonalOverview = lazy(() => import("../features/Admin/Personal/PersonalOverview"));
const BusinessOverview = lazy(() => import("../features/Admin/Business/BusinessOverview"));

// Public, synthetic-data preview only. Add a server-backed admin role guard
// before wiring any protected admin APIs; personal-user auth is insufficient.
export default function AdminRoutePage({ page = "overview" }) {
  return <Suspense fallback={<Loading message={false} />}>
    {page === "personal" ? <PersonalOverview /> : page === "business" ? <BusinessOverview /> : <AdminOverview />}
  </Suspense>;
}
