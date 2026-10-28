import { RequireAuth } from "../routes/RouteGuards";
import MobileAccountDetail from "./accounts/MobileAccountDetail.jsx";
import MobileActivity from "./activity/MobileActivity.jsx";
import MobileTransactionDetail from "./activity/MobileTransactionDetail.jsx";
import MobileAccounts from "./accounts/MobileAccounts.jsx";
import MobileCategories from "./categories/MobileCategories.jsx";
import MobileCategoryDetail from "./categories/MobileCategoryDetail.jsx";
import { MobileCategoryCreate, MobileCategoryEdit } from "./categories/MobileCategoryForm.jsx";
import MobileHome from "./home/MobileHome.jsx";
import IdentityBoundary from "./identity/IdentityBoundary.jsx";
import { MOBILE_ENTER, MOBILE_PREFIX } from "./navigation.js";
import MobileEnter from "./screens/MobileEnter.jsx";
import MobileMore from "./screens/MobileMore.jsx";
import MobileNotAvailable from "./screens/MobileNotAvailable.jsx";
import MobileBudgetDetail from "./planning/MobileBudgetDetail.jsx";
import MobileBudgets from "./planning/MobileBudgets.jsx";
import MobileGoalDetail from "./planning/MobileGoalDetail.jsx";
import MobileGoals from "./planning/MobileGoals.jsx";
import MobilePlanning from "./planning/MobilePlanning.jsx";
import MobileRecurring from "./planning/MobileRecurring.jsx";
import MobileRecurringDetail from "./planning/MobileRecurringDetail.jsx";
import MobileAppShell from "./shell/MobileAppShell.jsx";
import MobileCalendar from "./calendar/MobileCalendar.jsx";
import MobileDebtDetail from "./debts/MobileDebtDetail.jsx";
import MobileDebts from "./debts/MobileDebts.jsx";
import MobileNotifications from "./notifications/MobileNotifications.jsx";
import MobileTransferDetail from "./transfers/MobileTransferDetail.jsx";
import MobileTransfers from "./transfers/MobileTransfers.jsx";

/*
 * The Mobile route tree. It uses the app's own RequireAuth, so a signed-out
 * visitor is sent to sign-in and returns here afterwards, exactly as on
 * Desktop. Everything inside the shell sits in the identity boundary, which
 * owns the in-memory data and takes the screen down if the signed-in identity
 * stops being consistent. Nothing here writes: every screen only reads (see
 * data/readApi.js). The category form (data/writeApi.js) is the only code that
 * could send a write, and the write gate keeps it closed (data/writeGate.js).
 *
 * /m/enter is outside the shell on purpose (it is the way in, not a screen of
 * the app) but behind the same sign-in guard.
 */
export const mobileRoutes = [
  {
    path: MOBILE_ENTER,
    element: (
      <RequireAuth>
        <MobileEnter />
      </RequireAuth>
    ),
  },
  {
    path: MOBILE_PREFIX,
    element: (
      <RequireAuth>
        <IdentityBoundary>
          <MobileAppShell />
        </IdentityBoundary>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <MobileHome /> },
      { path: "accounts", element: <MobileAccounts /> },
      { path: "accounts/:accountId", element: <MobileAccountDetail /> },
      { path: "activity", element: <MobileActivity /> },
      { path: "activity/:transactionId", element: <MobileTransactionDetail /> },
      { path: "planning", element: <MobilePlanning /> },
      { path: "planning/budgets", element: <MobileBudgets /> },
      { path: "planning/budgets/:budgetId", element: <MobileBudgetDetail /> },
      { path: "planning/goals", element: <MobileGoals /> },
      { path: "planning/goals/:goalId", element: <MobileGoalDetail /> },
      { path: "planning/recurring", element: <MobileRecurring /> },
      { path: "planning/recurring/:ruleId", element: <MobileRecurringDetail /> },
      { path: "planning/categories", element: <MobileCategories /> },
      { path: "planning/categories/new", element: <MobileCategoryCreate /> },
      { path: "planning/categories/:categoryId", element: <MobileCategoryDetail /> },
      { path: "planning/categories/:categoryId/edit", element: <MobileCategoryEdit /> },
      { path: "planning/debts", element: <MobileDebts /> },
      { path: "planning/debts/:debtId", element: <MobileDebtDetail /> },
      { path: "planning/calendar", element: <MobileCalendar /> },
      { path: "transfers", element: <MobileTransfers /> },
      { path: "transfers/:transferId", element: <MobileTransferDetail /> },
      { path: "notifications", element: <MobileNotifications /> },
      { path: "more", element: <MobileMore /> },
      { path: "*", element: <MobileNotAvailable /> },
    ],
  },
];
