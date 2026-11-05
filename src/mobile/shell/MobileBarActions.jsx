import { LuBell, LuSunMoon } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_NOTIFICATIONS } from "../navigation.js";

/*
 * The two quiet actions at the end of the app bar on the main screens:
 * Notifications (a link) and the display sheet (language and theme).
 *
 * Neither makes a request. The bell deliberately carries no unread badge: the
 * count is a read of the notifications endpoints, and the main screens'
 * footprints (tests/mobileActivity.test.mjs forbids any notification endpoint
 * on Activity, and the other screens list their reads exactly) must not grow
 * for decoration. The count is on the Notifications screen itself.
 */
export default function MobileBarActions({ onDisplay, displayRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <div className="sm-bar-actions">
      <Link className="sm-bar-action" to={MOBILE_NOTIFICATIONS} data-sm-action="bar-notifications">
        <LuBell aria-hidden="true" />
        <span className="sm-sr">{t("bar.notifications")}</span>
      </Link>
      <button type="button" className="sm-bar-action" ref={displayRef} onClick={onDisplay} data-sm-action="bar-display">
        <LuSunMoon aria-hidden="true" />
        <span className="sm-sr">{t("bar.display")}</span>
      </button>
    </div>
  );
}
