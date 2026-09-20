import AccountType from "../features/Auth/AccountType/AccountType";
import CompanyLogin from "../features/Auth/CompanyLogin/CompanyLogin";
import CompanyRegister from "../features/Auth/CompanyRegister/CompanyRegister";
import ForgotPassword from "../features/Auth/ForgotPassword/ForgotPassword";
import Login from "../features/Auth/Login/Login";
import PasswordChanged from "../features/Auth/PasswordChanged/PasswordChanged";
import Register from "../features/Auth/Register/Register";
import ResetPassword from "../features/Auth/ResetPassword/ResetPassword";
import VerifyCode from "../features/Auth/VerifyCode/VerifyCode";
import VerifyEmail from "../features/Auth/VerifyEmail/VerifyEmail";
import AccountDetails from "../features/Dashboards/User/AccountDetails/AccountDetails";
import Accounts from "../features/Dashboards/User/Accounts/Accounts";
import AIAssistant from "../features/Dashboards/User/AIAssistant/AIAssistant";
import AiExpenseCaptureDetails from "../features/Dashboards/User/AiExpenseCaptureDetails/AiExpenseCaptureDetails";
import AiExpenseCaptures from "../features/Dashboards/User/AiExpenseCaptures/AiExpenseCaptures";
import BudgetDetails from "../features/Dashboards/User/BudgetDetails/BudgetDetails";
import Budgets from "../features/Dashboards/User/Budgets/Budgets";
import Calendar from "../features/Dashboards/User/Calendar/Calendar";
import Categories from "../features/Dashboards/User/Categories/Categories";
import CategoryDetails from "../features/Dashboards/User/CategoryDetails/CategoryDetails";
import Dashboard from "../features/Dashboards/User/Dashboard/Dashboard";
import DebtDetails from "../features/Dashboards/User/DebtDetails/DebtDetails";
import Debts from "../features/Dashboards/User/Debts/Debts";
import FinancialOperations from "../features/Dashboards/User/FinancialOperations/FinancialOperations";
import Import from "../features/Dashboards/User/Import/Import";
import ImportHistory from "../features/Dashboards/User/ImportHistory/ImportHistory";
import Notifications from "../features/Dashboards/User/Notifications/Notifications";
import Recurring from "../features/Dashboards/User/Recurring/Recurring";
import RecurringDetails from "../features/Dashboards/User/RecurringDetails/RecurringDetails";
import ReportExports from "../features/Dashboards/User/ReportExports/ReportExports";
import Reports from "../features/Dashboards/User/Reports/Reports";
import SavingsGoalDetails from "../features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails";
import SavingsGoals from "../features/Dashboards/User/SavingsGoals/SavingsGoals";
import Settings from "../features/Dashboards/User/Settings/Settings";
import TransactionDetails from "../features/Dashboards/User/TransactionDetails/TransactionDetails";
import TransferDetails from "../features/Dashboards/User/TransferDetails/TransferDetails";
import Transfers from "../features/Dashboards/User/Transfers/Transfers";

import Home from "../features/PublicPage/Home/Home";
import NotFound from "../features/PublicPage/NotFound/NotFound";

import AuthLayout from "../layouts/AuthLayout/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout/DashboardLayout";
import PublicLayout from "../layouts/PublicLayout/PublicLayout";
import { PATH } from "./Path";
import { GuestOnly, RequireAuth } from "./RouteGuards";

/* =========================
   Public Routes
========================= */

const routes = [
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];

/* =========================
   Guest Routes
========================= */

const guestRoutes = [
  {
    path: "/",
    element: (
      <GuestOnly>
        <AuthLayout />
      </GuestOnly>
    ),
    children: [
      {
        path: PATH.AUTH.ACCOUNT_TYPE,
        element: <AccountType />,
      },
      {
        path: PATH.AUTH.SIGNIN,
        element: <Login />,
      },
      {
        path: PATH.AUTH.REGISTER,
        element: <Register />,
      },
      {
        path: PATH.AUTH.COMPANY_SIGNIN,
        element: <CompanyLogin />,
      },
      {
        path: PATH.AUTH.COMPANY_REGISTER,
        element: <CompanyRegister />,
      },
      {
        path: PATH.AUTH.FORGOT_PASSWORD,
        element: <ForgotPassword />,
      },
      {
        path: PATH.AUTH.VERIFY_CODE,
        element: <VerifyCode />,
      },
      {
        path: PATH.AUTH.PASSWORD_CHANGED,
        element: <PasswordChanged />,
      },
    ],
  },
];

/* =========================
   Email-link Routes
   Opened from links in emails, so they work signed in or out (no GuestOnly).
========================= */

const emailLinkRoutes = [
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      {
        path: PATH.AUTH.RESET_PASSWORD,
        element: <ResetPassword />,
      },
      {
        path: `${PATH.AUTH.VERIFY_EMAIL}/:id/:hash`,
        element: <VerifyEmail />,
      },
    ],
  },
];

/* =========================
   User Routes
========================= */

const userRoutes = [
  {
    path: "/",
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: PATH.USER.DASHBOARD,
        element: <Dashboard />,
      },
      {
        path: PATH.USER.ACCOUNTS,
        element: <Accounts />,
      },
      {
        path: PATH.USER.ACCOUNT_DETAILS,
        element: <AccountDetails />,
      },
      {
        path: PATH.USER.FINANCIAL_OPERATIONS,
        element: <FinancialOperations />,
      },
      {
        path: PATH.USER.TRANSACTION_DETAILS,
        element: <TransactionDetails />,
      },
      {
        path: PATH.USER.TRANSFERS,
        element: <Transfers />,
      },
      {
        path: PATH.USER.TRANSFER_DETAILS,
        element: <TransferDetails />,
      },
      {
        path: PATH.USER.RECURRING,
        element: <Recurring />,
      },
      {
        path: PATH.USER.RECURRING_DETAILS,
        element: <RecurringDetails />,
      },
      {
        path: PATH.USER.CALENDAR,
        element: <Calendar />,
      },
      {
        path: PATH.USER.IMPORT,
        element: <Import />,
      },
      {
        path: PATH.USER.IMPORT_HISTORY,
        element: <ImportHistory />,
      },
      {
        path: PATH.USER.AI_EXPENSE_CAPTURES,
        element: <AiExpenseCaptures />,
      },
      {
        path: PATH.USER.AI_EXPENSE_CAPTURE_DETAILS,
        element: <AiExpenseCaptureDetails />,
      },

      {
        path: PATH.USER.CATEGORIES,
        element: <Categories />,
      },
      {
        path: PATH.USER.CATEGORY_DETAILS,
        element: <CategoryDetails />,
      },
      {
        path: PATH.USER.BUDGETS,
        element: <Budgets />,
      },
      {
        path: PATH.USER.BUDGET_DETAILS,
        element: <BudgetDetails />,
      },
      {
        path: PATH.USER.SAVINGS_GOALS,
        element: <SavingsGoals />,
      },
      {
        path: PATH.USER.SAVINGS_GOAL_DETAILS,
        element: <SavingsGoalDetails />,
      },
      {
        path: PATH.USER.DEBTS,
        element: <Debts />,
      },
      {
        path: PATH.USER.DEBT_DETAILS,
        element: <DebtDetails />,
      },
      {
        path: PATH.USER.REPORTS,
        element: <Reports />,
      },
      {
        path: PATH.USER.REPORT_EXPORTS,
        element: <ReportExports />,
      },
      {
        path: PATH.USER.AI_ASSISTANT,
        element: <AIAssistant />,
      },
      {
        path: PATH.USER.NOTIFICATIONS,
        element: <Notifications />,
      },
      {
        path: PATH.USER.SETTING,
        element: <Settings />,
      },
    ],
  },
];

export { routes, guestRoutes, emailLinkRoutes, userRoutes };
