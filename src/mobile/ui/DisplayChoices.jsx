import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useLanguageContext } from "../../contexts/language/useLanguageContext";
import { useThemeContext } from "../../contexts/theme/useThemeContext";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * The two display choices the app already has, theme and language, as two
 * segmented groups. The More page and the app bar's display sheet both show
 * this one component, so they can never disagree. Each choice applies at once
 * through the same providers Desktop uses; nothing is sent anywhere.
 */
export default function DisplayChoices() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { theme, changeTheme } = useThemeContext();
  const { language, setLanguage } = useLanguageContext();
  const ids = useId();

  return (
    <>
      <div className="sm-field" role="group" aria-labelledby={`${ids}-language`}>
        <span id={`${ids}-language`} className="sm-label">{t("more.language")}</span>
        <div className="sm-segment">
          <button type="button" className="sm-segment-button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
            {t("more.languageEn")}
          </button>
          <button type="button" className="sm-segment-button" lang="ar" aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>
            {t("more.languageAr")}
          </button>
        </div>
      </div>

      <div className="sm-field" role="group" aria-labelledby={`${ids}-theme`}>
        <span id={`${ids}-theme`} className="sm-label">{t("more.theme")}</span>
        <div className="sm-segment">
          <button type="button" className="sm-segment-button" aria-pressed={theme === "light"} onClick={() => changeTheme("light")}>
            {t("more.themeLight")}
          </button>
          <button type="button" className="sm-segment-button" aria-pressed={theme === "dark"} onClick={() => changeTheme("dark")}>
            {t("more.themeDark")}
          </button>
        </div>
      </div>
    </>
  );
}
