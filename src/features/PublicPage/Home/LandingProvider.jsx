import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLanguageContext } from "../../../contexts/language/useLanguageContext";
import { useThemeContext } from "../../../contexts/theme/useThemeContext";
import { LandingContext } from "./landingContext";
import { LANDING_NAMESPACE } from "./landingMessages";

/* The motion switch is the landing's only own preference. */
export const MOTION_STORAGE_KEY = "smartspend-landing-motion";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function readMotion() {
  try {
    return localStorage.getItem(MOTION_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION).matches ?? false;
}

/** Sets a <meta name> content while mounted and puts the original value back on unmount. */
function useMetaContent(name, content) {
  const metaRef = useRef(null);

  useEffect(() => {
    let meta = document.querySelector(`meta[name="${name}"]`);
    const created = !meta;
    if (created) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    const original = meta.getAttribute("content");
    metaRef.current = meta;
    return () => {
      metaRef.current = null;
      if (created) meta.remove();
      else if (original === null) meta.removeAttribute("content");
      else meta.setAttribute("content", original);
    };
  }, [name]);

  useEffect(() => {
    metaRef.current?.setAttribute("content", content);
  }, [content]);
}

export default function LandingProvider({ children }) {
  const { t } = useTranslation(LANDING_NAMESPACE);
  const { language, changeLanguage } = useLanguageContext();
  const { theme, toggleTheme } = useThemeContext();
  const [motionOn, setMotionOn] = useState(readMotion);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const rootRef = useRef(null);
  const lang = language === "ar" ? "ar" : "en";
  const animated = motionOn && !reduced;

  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION);
    if (!query) return undefined;
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  /*
   * Before the first paint: the landing's styles read html[data-motion] (only
   * set while this page is mounted) and html[data-theme] (ThemeProvider sets
   * the same value, but only after paint).
   */
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = animated ? "on" : "off";
    root.dataset.theme = theme;
  }, [animated, theme]);

  useLayoutEffect(() => () => {
    delete document.documentElement.dataset.motion;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, motionOn ? "on" : "off");
    } catch {
      /* Storage can be unavailable; the switch still works for this visit. */
    }
  }, [motionOn]);

  // The page title follows the language; the app's title comes back on leaving.
  useEffect(() => {
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, []);

  useEffect(() => {
    document.title = t("meta.title");
  }, [t, lang]);

  useMetaContent("description", t("meta.description"));
  useMetaContent("theme-color", theme === "dark" ? "#050b17" : "#f4f6fb");

  // Scroll reveals use one IntersectionObserver. Without motion, everything is shown at once.
  useEffect(() => {
    const elements = Array.from(rootRef.current?.querySelectorAll("[data-reveal]") ?? []);
    if (!animated || !window.IntersectionObserver) {
      elements.forEach((element) => {
        element.dataset.shown = "true";
      });
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.shown = "true";
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -5% 0px" });
    elements.forEach((element) => {
      if (element.dataset.shown !== "true") observer.observe(element);
    });
    return () => observer.disconnect();
  }, [animated]);

  const value = useMemo(() => ({
    t,
    lang,
    theme,
    animated,
    reduced,
    toggleLanguage: changeLanguage,
    toggleTheme,
    toggleMotion: () => setMotionOn((current) => !current),
  }), [t, lang, theme, animated, reduced, changeLanguage, toggleTheme]);

  return (
    <LandingContext.Provider value={value}>
      <div ref={rootRef} className="smartspend-landing smartspend-landing--page">
        {children}
      </div>
    </LandingContext.Provider>
  );
}
