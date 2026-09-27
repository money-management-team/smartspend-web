import { useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuLayoutDashboard,
  LuWalletCards,
  LuCircleDollarSign,
  LuArrowRightLeft,
  LuRepeat2,
  LuCalendarDays,
  LuFileUp,
  LuHistory,
  LuReceiptText,
  LuChartPie,
  LuTags,
  LuTarget,
  LuHandCoins,
  LuChartNoAxesCombined,
  LuMessageSquare,
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
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");
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

        {
          label: t(
            "dashboard.sidebar.importHistory",
          ),
          path: PATH.USER.IMPORT_HISTORY,
          icon: LuHistory,
        },

        {
          label: t(
            "dashboard.sidebar.aiCaptures",
          ),
          path: PATH.USER.AI_EXPENSE_CAPTURES,
          icon: LuReceiptText,
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
          icon: LuMessageSquare,
        },

        {
          label: t(
            "dashboard.sidebar.smartInsights",
          ),
          path: PATH.USER.SMART_INSIGHTS,
          icon: LuSparkles,
          subItems: [
            {
              label: isArabic
                ? "التوقع المالي لـ 30 يوماً"
                : "30-Day Financial Forecast",
              path: PATH.USER.SMART_INSIGHTS_FORECAST,
            },
          ],
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
                const isParentActive =
                  Boolean(item.subItems) &&
                  (location.pathname.startsWith(item.path) ||
                    item.subItems.some((s) => s.path === location.pathname));

                return (
                  <div key={item.path} className="dashboard-sidebar__item-wrapper">
                    <NavLink
                      to={item.path}
                      end={item.end}
                      onClick={onClose}
                      className={({
                        isActive,
                      }) =>
                        `dashboard-sidebar__link ${
                          isActive || isParentActive
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

                    {item.subItems && isParentActive && (
                      <div className="dashboard-sidebar__sublinks">
                        {item.subItems.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `dashboard-sidebar__sublink ${
                                isActive ? "dashboard-sidebar__sublink--active" : ""
                              }`
                            }
                          >
                            <span className="dashboard-sidebar__sublink-bullet">•</span>
                            <span>{sub.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
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
