import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuLayoutDashboard,
  LuWalletCards,
  LuCircleDollarSign,
  LuRepeat2,
  LuFileUp,
  LuChartPie,
  LuTarget,
  LuChartNoAxesCombined,
  LuSparkles,
  LuBell,
  LuSettings,
  LuLogOut,
  LuX,
} from "react-icons/lu";

import logo from "../../../../assets/smart-spend-logo.png";

import "./DashboardSidebar.css";
import { PATH } from "../../../../routes/Path";

export default function DashboardSidebar({
  isOpen,
  onClose,
}) {
  const { t } = useTranslation();

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
            "dashboard.sidebar.recurring",
          ),
          path: "/dashboard/recurring",
          icon: LuRepeat2,
        },

        {
          label: t(
            "dashboard.sidebar.import",
          ),
          path: "/dashboard/import",
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
            "dashboard.sidebar.budgets",
          ),
          path: "/dashboard/budgets",
          icon: LuChartPie,
        },

        {
          label: t(
            "dashboard.sidebar.savingsGoals",
          ),
          path: "/dashboard/savings-goals",
          icon: LuTarget,
        },

        {
          label: t(
            "dashboard.sidebar.reports",
          ),
          path: "/dashboard/reports",
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
          path: "/dashboard/ai-assistant",
          icon: LuSparkles,
        },

        {
          label: t(
            "dashboard.sidebar.notifications",
          ),
          path: "/dashboard/notifications",
          icon: LuBell,
        },

        {
          label: t(
            "dashboard.sidebar.settings",
          ),
          path: "/dashboard/settings",
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
      <div className="dashboard-sidebar__brand">
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
      </div>

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
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="dashboard-sidebar__footer">
        <button
          type="button"
          className="dashboard-sidebar__logout"
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