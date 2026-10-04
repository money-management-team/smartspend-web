import { Suspense } from "react";
import { useLocation } from "react-router-dom";

import ErrorBoundary from "../components/ErrorBoundary/ErrorBoundary";
import Loading from "../components/Loading/Loading";

/*
 * Boundary for lazily loaded pages. It wraps only the page area inside a
 * layout, so the sidebar, header and footer stay mounted while a page's code
 * downloads. Loading fades in after a short delay, so a cached chunk never
 * flashes a spinner.
 *
 * The error boundary resets on navigation, so one broken page (or a chunk
 * that failed to download) never traps the user inside the layout.
 */
export default function RouteSuspense({ children, variant = "page" }) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary variant="page" resetKey={pathname}>
      <Suspense
        fallback={<Loading variant={variant} size="large" message={false} />}
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
