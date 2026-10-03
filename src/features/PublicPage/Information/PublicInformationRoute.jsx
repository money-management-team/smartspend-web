import { lazy, Suspense } from "react";
import Loading from "../../../components/Loading/Loading";

const PublicInformationPage = lazy(() => import("./PublicInformationPage"));

export default function PublicInformationRoute({ pageKey }) {
  return (
    <Suspense fallback={<Loading />}>
      <PublicInformationPage pageKey={pageKey} />
    </Suspense>
  );
}
