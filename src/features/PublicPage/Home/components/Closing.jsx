import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowUpRight, Moon, Sun } from "lucide-react";

import { AUTH_INTENT, PATH } from "../../../../routes/Path";
import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { usePlatformDestination } from "../landingUi";
import { Brand, Heading, Logo, PlatformLink, SectionLink, Wordmark } from "./Shared";

export function FinalCTA() {
  const { t } = useLanding();
  return <section className="section section-cta" aria-labelledby="cta-title">
    <div className="cta-light" aria-hidden="true" />
    <div className="container cta" data-reveal>
      <span className="cta-logo"><span className="hero-logo-ring" aria-hidden="true" /><Logo size={64} /></span>
      <Heading id="cta-title" title={t("closing.title")} accent={t("closing.accent")} />
      <p className="lede">{t("closing.lede")}</p>
      <div className="cta-actions">
        <PlatformLink />
        <SectionLink className="btn btn-ghost" section={HOME_SECTIONS.EXPERIENCE}><span>{t("closing.back")}</span><span className="btn-icon" aria-hidden="true"><ArrowUp size={15} /></span></SectionLink>
      </div>
    </div>
  </section>;
}

/* Legal pages are static files generated at build time (scripts/generateLegalPages.mjs). */
const HELP_LINKS = [
  { key: "contact", to: PATH.PUBLIC.CONTACT },
  { key: "support", to: PATH.PUBLIC.SUPPORT },
  { key: "terms", href: "/terms.html" },
  { key: "privacy", href: "/privacy.html" },
];

export function LandingFooter({ onOpen }) {
  const { t, lang, theme, toggleLanguage, toggleTheme } = useLanding();
  const { t: tApp } = useTranslation();
  const platform = usePlatformDestination(AUTH_INTENT.SIGNIN);
  return <footer className="footer">
    <div className="container">
      <div className="footer-top">
        <div className="footer-brand">
          <SectionLink section={HOME_SECTIONS.TOP} aria-label={t("footer.backToTopLabel")}><Brand size="lg" /></SectionLink>
          <p>{t("footer.tagline")}</p>
        </div>
        <nav className="footer-cols" aria-label={t("footer.links")}>
          <div><h2>{t("footer.platform")}</h2><ul>
            <li><SectionLink section={HOME_SECTIONS.EXPERIENCE}>{t("footer.demo")}</SectionLink></li>
            <li><SectionLink section={HOME_SECTIONS.FEATURES}>{t("footer.features")}</SectionLink></li>
            <li><SectionLink section={HOME_SECTIONS.CAPTURE}>{t("footer.capture")}</SectionLink></li>
            <li><SectionLink section={HOME_SECTIONS.ASSISTANT}>{t("footer.assistant")}</SectionLink></li>
          </ul></div>
          <div><h2>SmartSpend</h2><ul>
            <li><button onClick={() => onOpen("about")}>{t("footer.about")}</button></li>
            <li><SectionLink section={HOME_SECTIONS.BUSINESS}>{t("footer.business")} <span className="menu-tag">{t("header.inDevelopment")}</span></SectionLink></li>
            <li><SectionLink section={HOME_SECTIONS.FAQ}>{t("footer.faq")}</SectionLink></li>
            <li><Link to={platform.to}>{t("footer.openPlatform")}<ArrowUpRight size={13} className="flip-rtl" aria-hidden="true" /></Link></li>
          </ul></div>
          <div><h2>{t("footer.preferences")}</h2><ul>
            <li><button onClick={toggleLanguage} lang={lang === "ar" ? "en" : "ar"}>{t("header.languageName")}</button></li>
            <li><button onClick={toggleTheme}>{theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}{theme === "dark" ? t("header.lightMode") : t("header.darkMode")}</button></li>
            <li><SectionLink section={HOME_SECTIONS.TOP}>{t("footer.backToTop")}<ArrowUp size={13} aria-hidden="true" /></SectionLink></li>
          </ul></div>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
        <nav className="footer-legal" aria-label={t("footer.legal")}>
          {HELP_LINKS.map(({ key, to, href }) => (to
            ? <Link key={key} to={to}>{tApp(`home.footer.links.${key}`)}</Link>
            : <a key={key} href={href}>{tApp(`home.footer.links.${key}`)}</a>))}
        </nav>
        <span>{t("footer.illustrative")}</span>
      </div>
    </div>
    <div className="footer-mark" aria-hidden="true"><Wordmark /></div>
  </footer>;
}
