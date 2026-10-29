import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";

import logo from "../../assets/smart-spend-logo.png";
import "../i18n/register.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_ACCOUNTS, MOBILE_ACTIVITY, MOBILE_BUDGETS, MOBILE_CALENDAR, MOBILE_CATEGORIES, MOBILE_CATEGORY_NEW, MOBILE_DEBTS, MOBILE_EXPORTS, MOBILE_GOALS, MOBILE_IMPORTS, MOBILE_NOTIFICATIONS, MOBILE_REPORTS, MOBILE_RECURRING, MOBILE_SCREENS, MOBILE_TRANSFERS } from "../navigation.js";
import { normalizePathname } from "../presentation/resolver.js";
import PwaNotices from "../pwa/PwaNotices.jsx";
import { PwaContext } from "../pwa/pwaContext.js";
import { usePwa } from "../pwa/usePwa.js";
import { newEntryPath, workflowAt } from "../forms/actionRoutes.js";
import { NEW_ENTRY_ORDER, WORKFLOWS } from "../forms/workflows.js";
import MobileMenu from "./MobileMenu.jsx";
import MobileNav from "./MobileNav.jsx";
import MobileSheet from "./MobileSheet.jsx";
import { ShellModalContext } from "./modalContext.js";
import { MobilePortalContext } from "./portalContext.js";
import { useCompactNav } from "./useCompactNav.js";

// Proves in a built bundle that this code shipped; see tests/mobileBundle.test.mjs.
export const MOBILE_BUILD_MARKER = "SMARTSPEND_MOBILE_S04B4";

// The pages added in the unblocked-feature pass, by address.
const EXTRA_TITLES = [
  [/^\/m\/assistant$/, "titles.assistant"],
  [/^\/m\/assistant\/conversations\/[^/]+$/, "titles.conversation"],
  [/^\/m\/captures$/, "titles.captures"],
  [/^\/m\/captures\/receipts\/new$/, "titles.receiptNew"],
  [/^\/m\/captures\/voice\/new$/, "titles.voiceNew"],
  [/^\/m\/captures\/(receipts|voice)\/[^/]+$/, "titles.capture"],
  [/^\/m\/whatsapp$/, "titles.whatsapp"],
  [/^\/m\/whatsapp\/drafts$/, "titles.whatsappDrafts"],
  [/^\/m\/whatsapp\/drafts\/[^/]+$/, "titles.whatsappDraft"],
  [/^\/m\/profile$/, "titles.profile"],
  [/^\/m\/profile\/edit$/, "forms.flows.profile-edit.title"],
  [/^\/m\/profile\/password$/, "forms.flows.password-change.title"],
  [/^\/m\/search$/, "titles.search"],
  [/^\/m\/review$/, "titles.review"],
  [/^\/m\/templates$/, "titles.templates"],
];

function getTitleKey(pathname) {
  const path = normalizePathname(pathname);
  const screen = MOBILE_SCREENS.find((item) => item.mobile === path);

  if (screen) return `titles.${screen.id}`;

  const workflow = workflowAt(path);
  if (workflow && Object.hasOwn(WORKFLOWS, workflow)) return `forms.flows.${workflow}.title`;
  if (path === MOBILE_ACCOUNTS) return "titles.accounts";
  if (path.startsWith(`${MOBILE_ACCOUNTS}/`) && !path.slice(MOBILE_ACCOUNTS.length + 1).includes("/")) return "titles.accountDetail";

  if (path.startsWith(`${MOBILE_ACTIVITY}/`) && !path.slice(MOBILE_ACTIVITY.length + 1).includes("/")) return "titles.transaction";

  if (path === MOBILE_CATEGORIES) return "titles.categories";
  if (path === MOBILE_CATEGORY_NEW) return "titles.categoryNew";
  if (path.startsWith(`${MOBILE_CATEGORIES}/`)) {
    const rest = path.slice(MOBILE_CATEGORIES.length + 1);
    if (/^[^/]+$/.test(rest)) return "titles.category";
    if (/^[^/]+\/edit$/.test(rest)) return "titles.categoryEdit";
  }

  const extra = EXTRA_TITLES.find(([pattern]) => pattern.test(path));
  if (extra) return extra[1];

  if (path === MOBILE_CALENDAR) return "titles.calendar";
  if (path === MOBILE_NOTIFICATIONS) return "titles.notifications";
  if (path === MOBILE_EXPORTS) return "titles.exports";

  for (const [prefix, list, record] of [[MOBILE_BUDGETS, "titles.budgets", "titles.budget"], [MOBILE_GOALS, "titles.goals", "titles.goal"], [MOBILE_RECURRING, "titles.recurring", "titles.rule"], [MOBILE_DEBTS, "titles.debts", "titles.debt"], [MOBILE_TRANSFERS, "titles.transfers", "titles.transfer"], [MOBILE_REPORTS, "titles.reports", "titles.report"], [MOBILE_IMPORTS, "titles.imports", "titles.statementImport"]]) {
    if (path === prefix) return list;
    if (path.startsWith(`${prefix}/`) && !path.slice(prefix.length + 1).includes("/")) return record;
  }

  return "titles.notAvailable";
}

/*
 * The Mobile frame: app bar with the page title, a scrolling main region,
 * the bottom navigation, and a container for overlays. It sits inside the
 * app's own providers (theme, language, session), so it holds no session or
 * theme state of its own.
 *
 * Add is a button. It opens a sheet listing the Mobile forms (forms/): each can
 * be filled in and reviewed, and none is sent from Mobile yet (the review says
 * so and links to the full version).
 */
export default function MobileAppShell() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { pathname } = useLocation();
  const compact = useCompactNav();
  const pwa = usePwa();

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
  // A sheet that a screen opened (see modalContext.js) counts too.
  const [screenModal, setScreenModal] = useState(false);
  const modalOpen = menuOpen || addOpen || screenModal;

  return (
    <MobilePortalContext.Provider value={portal}>
      <ShellModalContext.Provider value={setScreenModal}>
      <div className="sm-root" data-sm-build={MOBILE_BUILD_MARKER} data-sm-nav={compact ? "compact" : "standard"}>
        <header className="sm-bar" inert={modalOpen}>
          <a className="sm-skip" href="#sm-main">{t("skip")}</a>
          <img className="sm-bar-logo" src={logo} alt={t("bar.logo")} width="32" height="32" />
          <h1 className="sm-bar-title" ref={titleRef} tabIndex={-1}>{t(getTitleKey(pathname))}</h1>
        </header>

        <main id="sm-main" className="sm-main" inert={modalOpen}>
          <PwaNotices pwa={pwa} />
          <PwaContext.Provider value={pwa}>
            <Outlet />
          </PwaContext.Provider>
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
          <p className="sm-text sm-muted">{t("forms.addBody")}</p>
          <nav className="sm-add-list" aria-label={t("add.title")}>
            {NEW_ENTRY_ORDER.map((id) => (
              <Link key={id} className="sm-link-row" to={newEntryPath(id)} state={{ from: pathname }} onClick={closeOverlay} data-sm-action={`add-${id}`}>
                <span className="sm-row-main">
                  <span className="sm-row-title">{t(`forms.flows.${id}.link`)}</span>
                  <span className="sm-row-meta">{t(`forms.flows.${id}.addHint`)}</span>
                </span>
              </Link>
            ))}
          </nav>
          <button type="button" className="sm-button sm-button-quiet" onClick={closeOverlay}>{t("add.close")}</button>
        </MobileSheet>

        <MobileMenu open={menuOpen} onClose={closeOverlay} returnFocusRef={menuRef} />
      </div>
      </ShellModalContext.Provider>
    </MobilePortalContext.Provider>
  );
}
