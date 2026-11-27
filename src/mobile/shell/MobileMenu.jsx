import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_SCREENS, currentOf } from "../navigation.js";
import MobileSheet from "./MobileSheet.jsx";
import { SCREEN_ICONS } from "./screenIcons.js";

// Up/Down/Home/End move between the destinations; Tab and Escape come from the sheet.
function moveFocus(event) {
  const keys = { ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" };
  if (!(event.key in keys)) return;

  const links = [...event.currentTarget.querySelectorAll("a[href]")];
  const index = links.indexOf(document.activeElement);
  const step = keys[event.key];
  const next = step === "first" ? 0 : step === "last" ? links.length - 1 : (index + step + links.length) % links.length;

  event.preventDefault();
  links[next]?.focus();
}

/*
 * The compact layout's menu: every primary destination, reachable by touch
 * and keyboard. Choosing one closes the menu and navigates.
 */
export default function MobileMenu({ open, onClose, returnFocusRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { pathname } = useLocation();

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      titleId="sm-menu-title"
      title={t("nav.menuTitle")}
      returnFocusRef={returnFocusRef}
    >
      <nav aria-label={t("nav.menuTitle")}>
        <ul className="sm-menu-list" onKeyDown={moveFocus}>
          {MOBILE_SCREENS.map((screen) => {
            const Icon = SCREEN_ICONS[screen.id];
            const current = currentOf(screen, pathname);

            return (
              <li key={screen.id}>
                <Link
                  to={screen.mobile}
                  aria-current={current}
                  className={`sm-menu-link${current ? " sm-active" : ""}`}
                  onClick={onClose}
                >
                  <span className="sm-nav-icon" aria-hidden="true"><Icon /></span>
                  <span>{t(`nav.${screen.id}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <button type="button" className="sm-button sm-button-quiet" onClick={onClose}>
        {t("nav.menuClose")}
      </button>
    </MobileSheet>
  );
}
