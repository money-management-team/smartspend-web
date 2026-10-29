import { lazy, Suspense } from "react";
import Loading from "../components/Loading/Loading";

const AdminOverview = lazy(() => import("../features/Admin/Overview/AdminOverview"));
const PersonalOverview = lazy(() => import("../features/Admin/Personal/PersonalOverview"));
const BusinessOverview = lazy(() => import("../features/Admin/Business/BusinessOverview"));
const Billing = lazy(() => import("../features/Admin/Billing/Billing"));
const Support = lazy(() => import("../features/Admin/Support/Support"));
const AI = lazy(() => import("../features/Admin/AI/AI"));
const Security = lazy(() => import("../features/Admin/Security/Security"));
const Settings = lazy(() => import("../features/Admin/Settings/Settings"));
const PersonalUser = lazy(() => import("../features/Admin/Personal/PersonalUser"));
const Company = lazy(() => import("../features/Admin/Business/Company"));

// Public, synthetic-data preview only. Add a server-backed admin role guard
// before wiring any protected admin APIs; personal-user auth is insufficient.
export default function AdminRoutePage({ page = "overview" }) {
  if (page === "company") return <Suspense fallback={<Loading message={false} />}><Company /></Suspense>;
  return <Suspense fallback={<Loading message={false} />}>
    {page === "personal-user" ? <PersonalUser /> : page === "settings" ? <Settings /> : page === "security" ? <Security /> : page === "ai" ? <AI /> : page === "support" ? <Support /> : page === "billing" ? <Billing /> : page === "personal" ? <PersonalOverview /> : page === "business" ? <BusinessOverview /> : <AdminOverview />}
  </Suspense>;
}
