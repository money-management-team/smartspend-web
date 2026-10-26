import { useTranslation } from "react-i18next";

import { useLanguageContext } from "../../contexts/language/useLanguageContext";
import { useThemeContext } from "../../contexts/theme/useThemeContext";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { PRESENTATION_PREFERENCES } from "../presentation/preference.js";
import { usePresentation } from "../presentation/usePresentation.js";

/*
 * More, in S04A: the three display choices that already exist elsewhere in
 * the app (theme, language) plus the presentation switch. The switch is how
 * a visitor leaves Mobile for the full version; it stores one word on this
 * device and nothing else.
 */
export default function MobileMore() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { theme, changeTheme } = useThemeContext();
  const { language, setLanguage } = useLanguageContext();
  const { preference, setPreference } = usePresentation();

  return (
    <section className="sm-page" data-sm-screen="more">
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
