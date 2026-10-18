import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowUpRight, Moon, Sun } from "lucide-react";

import { AUTH_INTENT } from "../../../../routes/Path";
import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { usePlatformDestination } from "../landingUi";
import { Brand, ButtonIcon, PlatformLink, SectionLink } from "./Shared";

// The section being read, for the navigation mark. Features belong to "Platform"; the hero clears it.
const CURRENT = {
  [HOME_SECTIONS.TOP]: "",
  [HOME_SECTIONS.EXPERIENCE]: HOME_SECTIONS.EXPERIENCE,
  [HOME_SECTIONS.FEATURES]: HOME_SECTIONS.EXPERIENCE,
  [HOME_SECTIONS.CAPTURE]: HOME_SECTIONS.CAPTURE,
  [HOME_SECTIONS.ASSISTANT]: HOME_SECTIONS.ASSISTANT,
  [HOME_SECTIONS.BUSINESS]: HOME_SECTIONS.BUSINESS,
  [HOME_SECTIONS.FAQ]: HOME_SECTIONS.FAQ,
};

export default function LandingHeader() {
  const { t, lang, theme, toggleLanguage, toggleTheme } = useLanding();
  const { t: tApp } = useTranslation();
  const account = usePlatformDestination(AUTH_INTENT.SIGNIN);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState("");
  const firstLink = useRef(null);

  // The island gains its glass once the hero's top edge leaves the viewport. No scroll listener.
  useEffect(() => {
    const sentinel = document.querySelector("[data-header-sentinel]");
    if (!sentinel || !window.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!window.IntersectionObserver) return undefined;
    const sections = Object.keys(CURRENT).map((id) => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setCurrent(CURRENT[entry.target.id] ?? "");
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return undefined;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstLink.current?.focus();
    const key = (event) => { if (event.key === "Escape") setMenu(false); };
    const wide = window.matchMedia?.("(min-width: 1101px)");
    const resize = () => { if (wide?.matches) setMenu(false); };
    document.addEventListener("keydown", key);
    wide?.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      wide?.removeEventListener("change", resize);
    };
  }, [menu]);

  const close = () => setMenu(false);
  // The sheet closes when the language changes, as it re-lays out in the other direction.
  const switchLanguage = () => {
    setMenu(false);
    toggleLanguage();
  };
  const links = [
    [HOME_SECTIONS.EXPERIENCE, t("header.nav.platform")],
    [HOME_SECTIONS.CAPTURE, t("header.nav.capture")],
    [HOME_SECTIONS.ASSISTANT, t("header.nav.assistant")],
    [HOME_SECTIONS.BUSINESS, t("header.nav.business")],
    [HOME_SECTIONS.FAQ, t("header.nav.faq")],
  ];
  const accountLabel = account.signedIn ? t("cta.open") : tApp("home.nav.signIn");

  return <header className="site-header" data-scrolled={scrolled || menu ? "true" : undefined}>
    <div className="island">
      <span className="island-progress" aria-hidden="true" />
      <SectionLink section={HOME_SECTIONS.TOP} className="island-brand" aria-label={t("header.home")} onClick={close}><Brand size="sm" /></SectionLink>
      <nav className="island-nav" aria-label={t("header.mainNavigation")}>
        {links.map(([id, label]) => <SectionLink className="nav-link" section={id} key={id} aria-current={current === id ? "location" : undefined}>{label}</SectionLink>)}
      </nav>
      <div className="island-actions">
        <button className="pill-btn lang-btn" onClick={switchLanguage} aria-label={t("header.switchLanguage")}>
          <span lang={lang === "ar" ? "en" : "ar"}>{t("header.languageShort")}</span>
        </button>
        <button className="icon-btn theme-button" onClick={toggleTheme} aria-label={theme === "dark" ? t("header.toLightMode") : t("header.toDarkMode")}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <Link className="btn btn-primary btn-sm island-cta" to={account.to}>
          <span>{accountLabel}</span><ButtonIcon><ArrowUpRight size={14} className="flip-rtl" /></ButtonIcon>
        </Link>
        <button className="icon-btn menu-toggle" onClick={() => setMenu((value) => !value)} aria-expanded={menu} aria-controls="mobile-navigation" aria-label={menu ? t("header.closeMenu") : t("header.openMenu")}>
          <span className="burger" data-open={menu ? "true" : undefined} aria-hidden="true"><i /><i /></span>
        </button>
      </div>
    </div>

    {menu && <div className="menu-sheet" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <nav id="mobile-navigation" className="menu-sheet-inner" aria-label={t("header.mobileNavigation")}>
        <ul>
          {links.map(([id, label], index) => <li key={id} style={{ "--i": index }}>
            <SectionLink section={id} onClick={close} ref={index === 0 ? firstLink : undefined}>
              <span className="menu-index" dir="ltr">0{index + 1}</span>
              <span>{label}</span>
              {id === HOME_SECTIONS.BUSINESS && <span className="menu-tag">{t("header.inDevelopment")}</span>}
            </SectionLink>
          </li>)}
        </ul>
        <div className="menu-prefs" style={{ "--i": links.length }}>
          <button className="btn btn-ghost btn-sm" onClick={switchLanguage} lang={lang === "ar" ? "en" : "ar"}>{t("header.languageName")}</button>
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>{theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}{theme === "dark" ? t("header.lightMode") : t("header.darkMode")}</button>
        </div>
        <div className="menu-sheet-foot" style={{ "--i": links.length + 1 }}>
          <PlatformLink onClick={close} />
          {!account.signedIn && <Link className="btn btn-ghost" to={account.to} onClick={close}>{accountLabel}</Link>}
        </div>
      </nav>
    </div>}
  </header>;
}
