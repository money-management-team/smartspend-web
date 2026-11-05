import { LuBell, LuSunMoon } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useLanguageContext } from "../../contexts/language/useLanguageContext";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_NOTIFICATIONS } from "../navigation.js";
import { useCompactNav } from "./useCompactNav.js";

// Below this width (root-font units, so enlarged text counts) the bar has no room for a third action.
const LANGUAGE_SWITCH_MIN_REM = 22.5;

/*
 * The quiet actions at the end of the app bar on the main screens:
 * Notifications (a link), a direct AR/EN switch where there is room, and the
 * display sheet (language and theme).
 *
 * None of them makes a request. The bell deliberately carries no unread badge: the
 * count is a read of the notifications endpoints, and the main screens'
 * footprints (tests/mobileActivity.test.mjs forbids any notification endpoint
 * on Activity, and the other screens list their reads exactly) must not grow
 * for decoration. The count is on the Notifications screen itself.
 */
export default function MobileBarActions({ onDisplay, displayRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { language, setLanguage } = useLanguageContext();
  const toArabic = language !== "ar";
  const room = !useCompactNav(LANGUAGE_SWITCH_MIN_REM);

  return (
    <div className="sm-bar-actions">
      <Link className="sm-bar-action" to={MOBILE_NOTIFICATIONS} data-sm-action="bar-notifications">
        <LuBell aria-hidden="true" />
        <span className="sm-sr">{t("bar.notifications")}</span>
      </Link>
      {room && (
        <button type="button" className="sm-bar-action sm-bar-lang" lang={toArabic ? "ar" : "en"} onClick={() => setLanguage(toArabic ? "ar" : "en")} data-sm-action="bar-language">
          <span className="sm-bar-lang-mark" aria-hidden="true">{toArabic ? "ع" : "EN"}</span>
          <span className="sm-sr" lang={language === "ar" ? "ar" : "en"}>{t(toArabic ? "bar.toArabic" : "bar.toEnglish")}</span>
        </button>
      )}
      <button type="button" className="sm-bar-action" ref={displayRef} onClick={onDisplay} data-sm-action="bar-display">
        <LuSunMoon aria-hidden="true" />
        <span className="sm-sr">{t("bar.display")}</span>
      </button>
    </div>
  );
}
