import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuLayoutDashboard,
  LuWalletCards,
  LuCircleDollarSign,
  LuArrowRightLeft,
  LuRepeat2,
  LuCalendarDays,
  LuFileUp,
  LuChartPie,
  LuTags,
  LuTarget,
  LuHandCoins,
  LuChartNoAxesCombined,
  LuSparkles,
  LuBell,
  LuSettings,
  LuLogOut,
  LuX,
} from "react-icons/lu";

import logo from "../../../../assets/smart-spend-logo.png";

import "./DashboardSidebar.css";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { useUnreadNotifications } from "../../../../contexts/notifications/useUnreadNotifications";
import { getDisplayLocale } from "../../../../features/Dashboards/User/Accounts/accountHelpers";
import { formatUnreadBadge } from "../../../../features/Dashboards/User/Notifications/notificationHelpers";
import { PATH } from "../../../../routes/Path";

export default function DashboardSidebar({
  isOpen,
  onClose,
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { logout } = useAuthContext();
  // Shared with the header bell (GET /notifications/unread-count).
  const { count: unreadCount } = useUnreadNotifications();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      console.error(
        "Logout failed:",
        error.response?.data?.message || error.message
      );
    } finally {
      setIsLoggingOut(false);
      onClose?.();
      navigate(PATH.AUTH.SIGNIN, { replace: true });
    }
  };

  const menuGroups = [
    {
      title: t(
        "dashboard.sidebar.sections.overview",
      ),

      items: [
        {
          label: t(
            "dashboard.sidebar.dashboard",
          ),
          path: PATH.USER.DASHBOARD,
          icon: LuLayoutDashboard,
          end: true,
        },
        
        {
          label: t(
            "dashboard.sidebar.accounts",
          ),
          path: PATH.USER.ACCOUNTS,
          icon: LuWalletCards,
        },
        
        {
          label: t(
            "dashboard.sidebar.financialOperations",
          ),
          path: PATH.USER.FINANCIAL_OPERATIONS,
          icon: LuCircleDollarSign,
        },

        {
          label: t(
            "dashboard.sidebar.transfers",
          ),
          path: PATH.USER.TRANSFERS,
          icon: LuArrowRightLeft,
        },

        {
          label: t(
            "dashboard.sidebar.recurring",
          ),
          path: PATH.USER.RECURRING,
          icon: LuRepeat2,
        },

        {
          label: t(
            "dashboard.sidebar.calendar",
          ),
          path: PATH.USER.CALENDAR,
          icon: LuCalendarDays,
        },

        {
          label: t(
            "dashboard.sidebar.import",
          ),
          path: PATH.USER.IMPORT,
          icon: LuFileUp,
        },
      ],
    },

    {
      title: t(
        "dashboard.sidebar.sections.manage",
      ),

      items: [
        {
          label: t(
            "dashboard.sidebar.categories",
          ),
          path: PATH.USER.CATEGORIES,
          icon: LuTags,
        },

        {
          label: t(
            "dashboard.sidebar.budgets",
          ),
          path: PATH.USER.BUDGETS,
          icon: LuChartPie,
        },

        {
          label: t(
            "dashboard.sidebar.savingsGoals",
          ),
          path: PATH.USER.SAVINGS_GOALS,
          icon: LuTarget,
        },

        {
          label: t(
            "dashboard.sidebar.debts",
          ),
          path: PATH.USER.DEBTS,
          icon: LuHandCoins,
        },

        {
          label: t(
            "dashboard.sidebar.reports",
          ),
          path: PATH.USER.REPORTS,
          icon: LuChartNoAxesCombined,
        },
      ],
    },

    {
      title: t(
        "dashboard.sidebar.sections.more",
      ),

      items: [
        {
          label: t(
            "dashboard.sidebar.aiAssistant",
          ),
          path: PATH.USER.AI_ASSISTANT,
          icon: LuSparkles,
        },

        {
          label: t(
            "dashboard.sidebar.notifications",
          ),
          path: PATH.USER.NOTIFICATIONS,
          icon: LuBell,
          badge:
            unreadCount > 0
              ? formatUnreadBadge(unreadCount, getDisplayLocale(i18n.language))
              : null,
          badgeLabel:
            unreadCount > 0
              ? t("dashboard.notifications.bell.unread", { count: unreadCount })
              : undefined,
        },

        {
          label: t(
            "dashboard.sidebar.settings",
          ),
          path: PATH.USER.SETTING,
          icon: LuSettings,
        },
      ],
    },
  ];

  return (
    <aside
      className={`dashboard-sidebar ${
        isOpen
          ? "dashboard-sidebar--open"
          : ""
      }`}
    >
      <Link to= {PATH.HOME} className="dashboard-sidebar__brand">
        <img
          src={logo}
          alt="Smart Spend"
        />

        <div className="dashboard-sidebar__brand-copy">
          <strong>
            Smart Spend
          </strong>

          <span>
            {t(
              "dashboard.sidebar.tagline",
            )}
          </span>
        </div>

        <button
          type="button"
          className="dashboard-sidebar__close"
          onClick={onClose}
        >
          <LuX />
        </button>
      </Link>

      <nav className="dashboard-sidebar__nav">
        {menuGroups.map((group) => (
          <div
            className="dashboard-sidebar__group"
            key={group.title}
          >
            <p className="dashboard-sidebar__group-title">
              {group.title}
            </p>

            <div className="dashboard-sidebar__links">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={onClose}
                    className={({
                      isActive,
                    }) =>
                      `dashboard-sidebar__link ${
                        isActive
                          ? "dashboard-sidebar__link--active"
                          : ""
                      }`
                    }
                  >
                    <Icon />

                    <span>
                      {item.label}
                    </span>

                    {item.badge && (
                      <>
                        <span
                          className="dashboard-sidebar__badge"
                          aria-hidden="true"
                        >
                          {item.badge}
                        </span>

                        <span className="dashboard-sidebar__sr-only">
                          {item.badgeLabel}
                        </span>
                      </>
                    )}
                  </NavLink>
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

          <span>
            {t(
              "dashboard.sidebar.logout",
            )}
          </span>
        </button>
      </div>
    </aside>
  );
}
