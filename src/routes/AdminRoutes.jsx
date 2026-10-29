import { lazy, Suspense } from "react";
import Loading from "../components/Loading/Loading";

const AdminOverview = lazy(() => import("../features/Admin/Overview/AdminOverview"));

// Public, synthetic-data preview only. Add a server-backed admin role guard
// before wiring any protected admin APIs; personal-user auth is insufficient.
export default function AdminRoutePage() {
  return <Suspense fallback={<Loading message={false} />}><AdminOverview /></Suspense>;
}
