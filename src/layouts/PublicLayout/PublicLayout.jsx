import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PublicFooter from "../../features/PublicPage/components/PublicFooter";
import PublicNavbar from "../../features/PublicPage/components/PublicNavbar";
import { resolveHomeSection } from "../../features/PublicPage/Home/homeAnchors";

/**
 * Public pages. `variant="landing"` is the home page, which renders its own
 * header and footer (the landing design), so the shared navbar and footer
 * are left out there; every other public page keeps them.
 */
export default function PublicLayout({ variant = "default" }) {
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
      // Fragments of the previous home page (#how-it-works, #security…) map to their current sections.
      const target = id
        ? document.getElementById(id) ?? document.getElementById(resolveHomeSection(id))
        : null;
      if (target) {
        const reduceMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches || document.documentElement.dataset.motion === "off";
        const top = target.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({
          top: Math.max(0, top),
          behavior: reduceMotion ? "instant" : "smooth",
        });
      } else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash, key]);

  if (variant === "landing") return <Outlet />;

  return (
    <div className="public-layout">
      <PublicNavbar />
      <Outlet />
      <PublicFooter />
    </div>
  );
}
