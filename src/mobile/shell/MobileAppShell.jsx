import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router-dom";

import logo from "../../assets/smart-spend-logo.png";
import "../i18n/register.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_ACCOUNTS, MOBILE_SCREENS } from "../navigation.js";
import { normalizePathname } from "../presentation/resolver.js";
import MobileMenu from "./MobileMenu.jsx";
import MobileNav from "./MobileNav.jsx";
import MobileSheet from "./MobileSheet.jsx";
import { MobilePortalContext } from "./portalContext.js";
import { useCompactNav } from "./useCompactNav.js";

// Proves in a built bundle that this code shipped; see tests/mobileBundle.test.mjs.
export const MOBILE_BUILD_MARKER = "SMARTSPEND_MOBILE_S04B1";

function getTitleKey(pathname) {
  const path = normalizePathname(pathname);
  const screen = MOBILE_SCREENS.find((item) => item.mobile === path);

  if (screen) return `titles.${screen.id}`;
  if (path === MOBILE_ACCOUNTS) return "titles.accounts";
  if (path.startsWith(`${MOBILE_ACCOUNTS}/`) && !path.slice(MOBILE_ACCOUNTS.length + 1).includes("/")) return "titles.accountDetail";

  return "titles.notAvailable";
}

/*
 * The Mobile frame: app bar with the page title, a scrolling main region,
 * the bottom navigation, and a container for overlays. It sits inside the
 * app's own providers (theme, language, session), so it holds no session or
 * theme state of its own.
 *
 * Add is a button. It opens an informational sheet and nothing else: no form,
 * no request. Recording money is not part of Mobile yet.
 */
export default function MobileAppShell() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { pathname } = useLocation();
  const compact = useCompactNav();

  const [overlay, setOverlay] = useState(null); // null | "add" | "menu"
  const [portal, setPortal] = useState(null);
  const titleRef = useRef(null);
  const addRef = useRef(null);
  const menuRef = useRef(null);
  const lastPath = useRef(pathname);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  // After a navigation, focus goes to the page title so keyboard and screen
  // reader users start at the top of the new page.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    titleRef.current?.focus();
  }, [pathname]);

  // The compact menu has no place in the standard layout: if the layout
  // changes while it is open, it is closed for good (not just hidden), so
  // narrowing the screen again does not bring it back. State is adjusted
  // during render, as React recommends for resetting state on a change.
  const [wasCompact, setWasCompact] = useState(compact);
  if (wasCompact !== compact) {
    setWasCompact(compact);
    if (overlay === "menu") setOverlay(null);
  }

  const menuOpen = overlay === "menu" && compact;
  const addOpen = overlay === "add";
  const modalOpen = menuOpen || addOpen;

  return (
    <MobilePortalContext.Provider value={portal}>
      <div className="sm-root" data-sm-build={MOBILE_BUILD_MARKER} data-sm-nav={compact ? "compact" : "standard"}>
        <header className="sm-bar" inert={modalOpen}>
          <a className="sm-skip" href="#sm-main">{t("skip")}</a>
          <img className="sm-bar-logo" src={logo} alt={t("bar.logo")} width="32" height="32" />
          <h1 className="sm-bar-title" ref={titleRef} tabIndex={-1}>{t(getTitleKey(pathname))}</h1>
        </header>

        <main id="sm-main" className="sm-main" inert={modalOpen}>
          <Outlet />
        </main>

        <div className="sm-nav-wrap" inert={modalOpen}>
          <MobileNav
            compact={compact}
            onAdd={() => setOverlay("add")}
            onMenu={() => setOverlay("menu")}
            menuOpen={menuOpen}
            addRef={addRef}
            menuRef={menuRef}
          />
        </div>

        <div className="sm-portal" ref={setPortal} />

        <MobileSheet
          open={addOpen}
          onClose={closeOverlay}
          titleId="sm-add-title"
          title={t("add.title")}
          returnFocusRef={addRef}
        >
          <p className="sm-text">{t("add.body")}</p>
          <button type="button" className="sm-button" onClick={closeOverlay}>{t("add.close")}</button>
        </MobileSheet>

        <MobileMenu open={menuOpen} onClose={closeOverlay} returnFocusRef={menuRef} />
      </div>
    </MobilePortalContext.Provider>
  );
}
