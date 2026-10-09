import {
  LuLayoutDashboard,
  LuWalletCards,
  LuCircleDollarSign,
  LuCalendarDays,
  LuTarget,
  LuChartNoAxesCombined,
  LuSparkles,
  LuBell,
  LuSettings,
} from "react-icons/lu";

import { PATH } from "../../routes/Path";

/* ================================
   NAVIGATION MODEL
================================ */

/*
 * The whole menu as data. A section holds direct links (`type: "item"`) and
 * collapsible groups (`type: "group"`) of related pages. Groups exist only
 * where several pages belong together; a single page stays a direct link.
 * Paths always come from PATH.
 *
 * `end: true` makes a link active on its exact path only (Reports must not
 * also light up on /dashboard/reports/exports). Otherwise a link is active on
 * its path and everything below it, so a budget's details page keeps Budgets
 * (and the Planning group) active.
 */
export function getNavigation(t, notificationsBadge, whatsappBadge = null) {
  return [
    {
      id: "overview",
      title: t("dashboard.sidebar.sections.overview"),
      entries: [
        {
          type: "item",
          label: t("dashboard.sidebar.dashboard"),
          path: PATH.USER.DASHBOARD,
          icon: LuLayoutDashboard,
          end: true,
        },
        {
          type: "item",
          label: t("dashboard.sidebar.accounts"),
          path: PATH.USER.ACCOUNTS,
          icon: LuWalletCards,
        },
        {
          type: "item",
          label: t("experience:attention"),
          path: PATH.USER.ATTENTION,
          icon: LuBell,
        },
        {
          type: "group",
          id: "transactions",
          label: t("dashboard.sidebar.groups.transactions"),
          icon: LuCircleDollarSign,
          children: [
            {
              label: t("dashboard.sidebar.financialOperations"),
              path: PATH.USER.FINANCIAL_OPERATIONS,
            },
            {
              label: t("experience:templates"),
              path: PATH.USER.QUICK_TEMPLATES,
            },
            {
              label: t("dashboard.sidebar.transfers"),
              path: PATH.USER.TRANSFERS,
            },
            {
              label: t("dashboard.sidebar.recurring"),
              path: PATH.USER.RECURRING,
            },
            {
              label: t("dashboard.sidebar.aiCaptures"),
              path: PATH.USER.AI_EXPENSE_CAPTURES,
            },
            {
              label: t("dashboard.sidebar.whatsappDrafts"),
              path: PATH.USER.WHATSAPP_DRAFTS,
              badge: whatsappBadge,
            },
            { label: t("dashboard.imports.title"), path: PATH.USER.IMPORTS },
          ],
        },
        {
          type: "item",
          label: t("dashboard.sidebar.calendar"),
          path: PATH.USER.CALENDAR,
          icon: LuCalendarDays,
        },
      ],
    },
    {
      id: "manage",
      title: t("dashboard.sidebar.sections.manage"),
      entries: [
        {
          type: "group",
          id: "planning",
          label: t("dashboard.sidebar.groups.planning"),
          icon: LuTarget,
          children: [
            {
              label: t("dashboard.sidebar.categories"),
              path: PATH.USER.CATEGORIES,
            },
            { label: t("dashboard.sidebar.budgets"), path: PATH.USER.BUDGETS },
            {
              label: t("dashboard.sidebar.savingsGoals"),
              path: PATH.USER.SAVINGS_GOALS,
            },
            { label: t("dashboard.sidebar.debts"), path: PATH.USER.DEBTS },
          ],
        },
        {
          type: "group",
          id: "reports",
          label: t("dashboard.sidebar.reports"),
          icon: LuChartNoAxesCombined,
          children: [
            {
              label: t("dashboard.sidebar.financialReports"),
              path: PATH.USER.REPORTS,
              end: true,
            },
            {
              label: t("dashboard.sidebar.reportExports"),
              path: PATH.USER.REPORT_EXPORTS,
            },
            { label: t("experience:monthly"), path: PATH.USER.MONTHLY_REVIEW },
          ],
        },
      ],
    },
    {
      id: "more",
      title: t("dashboard.sidebar.sections.more"),
      entries: [
        {
          type: "item",
          label: t("experience:guide"),
          path: PATH.USER.GETTING_STARTED,
          icon: LuTarget,
        },
        {
          type: "item",
          label: t("dashboard.sidebar.aiAssistant"),
          path: PATH.USER.AI_ASSISTANT,
          icon: LuSparkles,
        },
        {
          type: "item",
          label: t("dashboard.sidebar.notifications"),
          path: PATH.USER.NOTIFICATIONS,
          icon: LuBell,
          badge: notificationsBadge,
        },
        {
          type: "item",
          label: t("dashboard.sidebar.settings"),
          path: PATH.USER.SETTING,
          icon: LuSettings,
        },
      ],
    },
  ];
}
