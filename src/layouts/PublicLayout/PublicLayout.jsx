import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PageBoundary from "../../components/PageBoundary/PageBoundary";
import PublicFooter from "../../features/PublicPage/components/PublicFooter";
import PublicNavbar from "../../features/PublicPage/components/PublicNavbar";

export default function PublicLayout() {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    // Public navigation only; dashboard scroll and route guards stay unchanged.
    const frame = window.requestAnimationFrame(() => {
      let id = "";
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        /* Invalid fragment: go to top. */
      }
      const target = id ? document.getElementById(id) : null;
      if (target) {
        const reduceMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const top = target.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({
          top: Math.max(0, top),
          behavior: reduceMotion ? "instant" : "smooth",
        });
      } else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash, key]);

  return (
    <div className="public-layout">
      <PublicNavbar />
      <PageBoundary>
          <Outlet />
        </PageBoundary>
      <PublicFooter />
    </div>
  );
}
