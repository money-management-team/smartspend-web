import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useLanguageContext } from "../../contexts/language/useLanguageContext";
import { useThemeContext } from "../../contexts/theme/useThemeContext";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_ACCOUNTS, MOBILE_AI, MOBILE_CAPTURES, MOBILE_IMPORTS, MOBILE_NOTIFICATIONS, MOBILE_PROFILE, MOBILE_REPORTS, MOBILE_REVIEW, MOBILE_SEARCH, MOBILE_TEMPLATES, MOBILE_TRANSFERS, MOBILE_WHATSAPP } from "../navigation.js";
import { PRESENTATION_PREFERENCES } from "../presentation/preference.js";
import { usePresentation } from "../presentation/usePresentation.js";
import { InstallCard } from "../pwa/PwaNotices.jsx";
import { usePwaState } from "../pwa/pwaContext.js";
import { PWA_BUILD } from "../pwa/worker.js";
import Chevron from "../ui/Chevron.jsx";

function MoreLink({ to, title, hint }) {
  return (
    <Link className="sm-link-row" to={to}>
      <span className="sm-row-main">
        <span className="sm-row-title">{title}</span>
        <span className="sm-row-meta">{hint}</span>
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * More: Accounts and the other read-only pages (transfers, notifications, ...), the display choices that already exist elsewhere in
 * the app (theme, language) plus the presentation switch. The switch is how
 * a visitor leaves Mobile for the full version; it stores one word on this
 * device and nothing else.
 */
export default function MobileMore() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { theme, changeTheme } = useThemeContext();
  const { language, setLanguage } = useLanguageContext();
  const { preference, setPreference } = usePresentation();
  const pwa = usePwaState();

  return (
    <section className="sm-page" data-sm-screen="more">
      <div className="sm-card">
        <h2 className="sm-card-title">{t("more.yourMoney")}</h2>
        <Link className="sm-link-row" to={MOBILE_ACCOUNTS}>
          <span className="sm-row-main">
            <span className="sm-row-title">{t("more.accounts")}</span>
            <span className="sm-row-meta">{t("more.accountsHint")}</span>
          </span>
          <Chevron />
        </Link>
        <MoreLink to={MOBILE_TRANSFERS} title={t("moreLinks.transfers")} hint={t("moreLinks.transfersHint")} />
        <MoreLink to={MOBILE_REPORTS} title={t("moreLinks.reports")} hint={t("moreLinks.reportsHint")} />
        <MoreLink to={MOBILE_IMPORTS} title={t("moreLinks.imports")} hint={t("moreLinks.importsHint")} />
      </div>

      <div className="sm-card">
        <h2 className="sm-card-title">{t("moreLinks.tools")}</h2>
        <MoreLink to={MOBILE_SEARCH} title={t("moreLinks.search")} hint={t("moreLinks.searchHint")} />
        <MoreLink to={MOBILE_REVIEW} title={t("moreLinks.review")} hint={t("moreLinks.reviewHint")} />
        <MoreLink to={MOBILE_TEMPLATES} title={t("moreLinks.templates")} hint={t("moreLinks.templatesHint")} />
        <MoreLink to={MOBILE_AI} title={t("moreLinks.assistant")} hint={t("moreLinks.assistantHint")} />
        <MoreLink to={MOBILE_CAPTURES} title={t("moreLinks.captures")} hint={t("moreLinks.capturesHint")} />
        <MoreLink to={MOBILE_WHATSAPP} title={t("moreLinks.whatsapp")} hint={t("moreLinks.whatsappHint")} />
      </div>

      <div className="sm-card">
        <h2 className="sm-card-title">{t("moreLinks.updates")}</h2>
        <MoreLink to={MOBILE_NOTIFICATIONS} title={t("moreLinks.notifications")} hint={t("moreLinks.notificationsHint")} />
        <MoreLink to={MOBILE_PROFILE} title={t("moreLinks.profile")} hint={t("moreLinks.profileHint")} />
      </div>

      <div className="sm-card">
        <h2 className="sm-card-title">{t("more.appearance")}</h2>

        <div className="sm-field" role="group" aria-labelledby="sm-theme-label">
          <span id="sm-theme-label" className="sm-label">{t("more.theme")}</span>
          <div className="sm-segment">
            <button type="button" className="sm-segment-button" aria-pressed={theme === "light"} onClick={() => changeTheme("light")}>
              {t("more.themeLight")}
            </button>
            <button type="button" className="sm-segment-button" aria-pressed={theme === "dark"} onClick={() => changeTheme("dark")}>
              {t("more.themeDark")}
            </button>
          </div>
        </div>

        <div className="sm-field" role="group" aria-labelledby="sm-language-label">
          <span id="sm-language-label" className="sm-label">{t("more.language")}</span>
          <div className="sm-segment">
            <button type="button" className="sm-segment-button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
              {t("more.languageEn")}
            </button>
            <button type="button" className="sm-segment-button" lang="ar" aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>
              {t("more.languageAr")}
            </button>
          </div>
        </div>
      </div>

      <InstallCard pwa={pwa} enabled={PWA_BUILD} />

      <div className="sm-card">
        <fieldset className="sm-fieldset">
          <legend className="sm-card-title">{t("more.presentation")}</legend>
          <p className="sm-text sm-muted">{t("more.presentationHint")}</p>
          {PRESENTATION_PREFERENCES.map((value) => (
            <label key={value} className="sm-choice">
              <input
                type="radio"
                name="sm-presentation"
                value={value}
                checked={preference === value}
                onChange={() => setPreference(value)}
              />
              <span>{t(`more.${value}`)}</span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="sm-button sm-button-quiet" onClick={() => setPreference("desktop")}>
          {t("more.openFull")}
        </button>
      </div>
    </section>
  );
}
