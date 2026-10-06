import { useState } from "react";
import {
  Link,
  NavLink,
  matchPath,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuLogOut,
  LuChevronDown,
  LuX,
} from "react-icons/lu";

import logo from "../../../../assets/smart-spend-logo.png";

import "./DashboardSidebar.css";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { useUnreadNotifications } from "../../../../contexts/notifications/useUnreadNotifications";
import { getDisplayLocale } from "../../../../features/Dashboards/User/Accounts/accountHelpers";
import { formatUnreadBadge } from "../../../../features/Dashboards/User/Notifications/notificationHelpers";
import { PATH } from "../../../../routes/Path";
import { getNavigation } from "../../dashboardNavigation";

const linkMatchesExactly = (link, pathname) =>
  Boolean(link.end) ||
  (link.path === PATH.USER.FINANCIAL_OPERATIONS &&
    pathname === PATH.USER.QUICK_TEMPLATES);
const isLinkActive = (link, pathname) =>
  matchPath(
    { path: link.path, end: linkMatchesExactly(link, pathname) },
    pathname,
  ) != null;

/* ================================
   OPEN GROUPS (session)
================================ */

// Open / closed choices survive a reload within the tab, nothing more.
const OPEN_GROUPS_KEY = "smartspend:sidebar-groups";

function readStoredGroups() {
  try {
    const stored = JSON.parse(
      window.sessionStorage.getItem(OPEN_GROUPS_KEY) ?? "{}",
    );
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function storeGroups(choices) {
  try {
    const open = Object.fromEntries(
      Object.entries(choices).map(([id, choice]) => [id, choice.open]),
    );
    window.sessionStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(open));
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only.
  }
}

/*
 * The user's open / closed choice per group: { [id]: { open, path } }, where
 * `path` is the page it was made on. The group holding the current page is
 * open unless the user closed it on this very page, so navigating into a
 * group — or reloading — always reveals the active link. Other groups keep
 * whatever the user chose (closed by default). Several can be open at once.
 */
function useGroupChoices(pathname) {
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(
      Object.entries(readStoredGroups()).map(([id, open]) => [
        id,
        { open: open === true, path: null },
      ]),
    ),
  );

  const isOpen = (group, containsActive) => {
    const choice = choices[group.id];
    if (containsActive) return choice?.path === pathname ? choice.open : true;
    return choice?.open ?? false;
  };

  const toggle = (group, containsActive) => {
    const next = {
      ...choices,
      [group.id]: { open: !isOpen(group, containsActive), path: pathname },
    };
    setChoices(next);
    storeGroups(next);
  };

  return { isOpen, toggle };
}

/* ================================
   ITEMS
================================ */

function SidebarItem({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `dashboard-sidebar__link ${isActive ? "dashboard-sidebar__link--active" : ""}`
      }
    >
      <Icon aria-hidden="true" />

      <span className="dashboard-sidebar__label">{item.label}</span>

      {item.badge && (
        <>
          <span className="dashboard-sidebar__badge" aria-hidden="true">
            {item.badge.text}
          </span>

          <span className="dashboard-sidebar__sr-only">{item.badge.label}</span>
        </>
      )}
    </NavLink>
  );
}

/*
 * A parent row that shows / hides related pages. The row is a real button
 * (Enter / Space toggle it); it never navigates by itself. The children stay
 * in the DOM so the height can animate, and are `inert` while collapsed so
 * they are skipped by Tab and screen readers.
 */
function SidebarGroup({ group, isOpen, isActive, onToggle, onNavigate }) {
  const { pathname } = useLocation();
  const Icon = group.icon;
  const panelId = `dashboard-sidebar-group-${group.id}`;

  return (
    <div
      className={[
        "dashboard-sidebar__tree",
        isOpen ? "dashboard-sidebar__tree--open" : "",
        isActive ? "dashboard-sidebar__tree--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="dashboard-sidebar__toggle"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <Icon aria-hidden="true" />

        <span className="dashboard-sidebar__label">{group.label}</span>

        <LuChevronDown
          className="dashboard-sidebar__chevron"
          aria-hidden="true"
        />
      </button>

      <div className="dashboard-sidebar__panel" id={panelId} inert={!isOpen}>
        <ul className="dashboard-sidebar__children">
          {group.children.map((child) => (
            <li key={child.path}>
              <NavLink
                to={child.path}
                end={linkMatchesExactly(child, pathname)}
                onClick={onNavigate}
                className={({ isActive: isChildActive }) =>
                  `dashboard-sidebar__child ${isChildActive ? "dashboard-sidebar__child--active" : ""}`
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ================================
   SIDEBAR
================================ */

export default function DashboardSidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const { logout } = useAuthContext();
  // Shared with the header bell (GET /notifications/unread-count).
  const { count: unreadCount } = useUnreadNotifications();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const groups = useGroupChoices(pathname);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      console.error(
        "Logout failed:",
        error.response?.data?.message || error.message,
      );
    } finally {
      setIsLoggingOut(false);
      onClose?.();
      navigate(PATH.AUTH.SIGNIN, { replace: true });
    }
  };

  const navigation = getNavigation(
    t,
    unreadCount > 0
      ? {
          text: formatUnreadBadge(unreadCount, getDisplayLocale(i18n.language)),
          label: t("dashboard.notifications.bell.unread", {
            count: unreadCount,
          }),
        }
      : null,
  );

  return (
    <aside
      id="dashboard-sidebar"
      className={`dashboard-sidebar ${isOpen ? "dashboard-sidebar--open" : ""}`}
    >
      <div className="dashboard-sidebar__brand">
        <Link to={PATH.HOME} className="dashboard-sidebar__brand-link">
          <img src={logo} alt="Smart Spend" />

          <div className="dashboard-sidebar__brand-copy">
            <strong>Smart Spend</strong>

            <span>{t("dashboard.sidebar.tagline")}</span>
          </div>
        </Link>

        <button
          type="button"
          className="dashboard-sidebar__close"
          onClick={onClose}
          aria-label={t("dashboard.sidebar.close")}
        >
          <LuX aria-hidden="true" />
        </button>
      </div>

      <nav className="dashboard-sidebar__nav">
        {navigation.map((section) => (
          <div className="dashboard-sidebar__group" key={section.id}>
            <p className="dashboard-sidebar__group-title">{section.title}</p>

            <div className="dashboard-sidebar__links">
              {section.entries.map((entry) => {
                if (entry.type === "item") {
                  return (
                    <SidebarItem
                      key={entry.path}
                      item={entry}
                      onNavigate={onClose}
                    />
                  );
                }

                const containsActive = entry.children.some((child) =>
                  isLinkActive(child, pathname),
                );

                return (
                  <SidebarGroup
                    key={entry.id}
                    group={entry}
                    isActive={containsActive}
                    isOpen={groups.isOpen(entry, containsActive)}
                    onToggle={() => groups.toggle(entry, containsActive)}
                    onNavigate={onClose}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="dashboard-sidebar__footer">
        <button
          onClick={handleLogout}
          type="button"
          className="dashboard-sidebar__logout"
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
        >
          <LuLogOut />

          <span>{t("dashboard.sidebar.logout")}</span>
        </button>
      </div>
    </aside>
  );
}
