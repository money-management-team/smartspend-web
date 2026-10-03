import { Suspense } from "react";
import { useLocation } from "react-router-dom";

import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";
import Loading from "../Loading/Loading";

/*
 * Wraps a layout's <Outlet/>: lazy route chunks show a loading state inside
 * the page area (the layout around it stays put), and a render error shows
 * the fallback in place of the page only. The error clears on navigation.
 */
export default function PageBoundary({ children, homePath = "/" }) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary variant="page" resetKey={pathname} homePath={homePath}>
      <Suspense fallback={<Loading variant="page" />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
