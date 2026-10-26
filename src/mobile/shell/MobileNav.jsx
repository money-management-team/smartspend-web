import { LuMenu, LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_SCREENS } from "../navigation.js";
import { SCREEN_ICONS } from "./screenIcons.js";

const linkClass = ({ isActive }) => `sm-nav-item${isActive ? " sm-active" : ""}`;

function AddButton({ onAdd, addRef, compact }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <button
      type="button"
      ref={addRef}
      className={`sm-add${compact ? " sm-add-compact" : ""}`}
      aria-haspopup="dialog"
      onClick={onAdd}
    >
      <span className="sm-add-icon" aria-hidden="true"><LuPlus /></span>
      <span className="sm-add-label">{t("nav.add")}</span>
    </button>
  );
}

/*
 * The bottom bar. Standard: Home, Activity, Add, Planning, More (Add is a
 * button in the middle, not a destination). Compact: Menu + Add, where the
 * menu lists all four destinations.
 */
export default function MobileNav({ compact, onAdd, onMenu, menuOpen, addRef, menuRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  if (compact) {
    return (
      <nav className="sm-nav sm-nav-compact" aria-label={t("nav.label")}>
        <button
          type="button"
          ref={menuRef}
          className="sm-nav-item sm-menu-button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={onMenu}
        >
          <span className="sm-nav-icon" aria-hidden="true"><LuMenu /></span>
          <span className="sm-nav-label">{t("nav.menu")}</span>
        </button>
        <AddButton onAdd={onAdd} addRef={addRef} compact />
      </nav>
    );
  }

  const [home, activity, planning, more] = MOBILE_SCREENS;
  const item = (screen) => {
    const Icon = SCREEN_ICONS[screen.id];

    return (
      <NavLink key={screen.id} to={screen.mobile} end className={linkClass}>
        <span className="sm-nav-icon" aria-hidden="true"><Icon /></span>
        <span className="sm-nav-label">{t(`nav.${screen.id}`)}</span>
      </NavLink>
    );
  };

  return (
    <nav className="sm-nav" aria-label={t("nav.label")}>
      {item(home)}
      {item(activity)}
      <AddButton onAdd={onAdd} addRef={addRef} />
      {item(planning)}
      {item(more)}
    </nav>
  );
}
