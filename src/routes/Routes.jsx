
import Home from "../features/PublicPage/Home/Home";

import AuthLayout from "../layouts/AuthLayout/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout/DashboardLayout";
import PublicLayout from "../layouts/PublicLayout/PublicLayout";
import { Navigate } from "react-router-dom";
import { lazyPage } from "./lazyPage";
import { LEGACY_VERIFY_CODE_PATH, PATH } from "./Path";
import { GuestOnly, RequireAuth } from "./RouteGuards";

/* Pages load on demand; Home and the layouts stay in the main bundle. */
const PublicInformationRoute = lazyPage(() => import("../features/PublicPage/Information/PublicInformationRoute"));
const AttentionCenter = lazyPage(() => import("../features/Dashboards/User/Experience/AttentionCenter"));
const MonthlyReview = lazyPage(() => import("../features/Dashboards/User/Experience/MonthlyReview"));
const QuickTemplates = lazyPage(() => import("../features/Dashboards/User/Experience/QuickTemplates"));
const GettingStarted = lazyPage(() => import("../features/Dashboards/User/Experience/GettingStarted"));
const AccountType = lazyPage(() => import("../features/Auth/AccountType/AccountType"));
const CompanyUnavailable = lazyPage(() => import("../features/Auth/CompanyUnavailable/CompanyUnavailable"));
const ForgotPassword = lazyPage(() => import("../features/Auth/ForgotPassword/ForgotPassword"));
const Login = lazyPage(() => import("../features/Auth/Login/Login"));
const PasswordChanged = lazyPage(() => import("../features/Auth/PasswordChanged/PasswordChanged"));
const Register = lazyPage(() => import("../features/Auth/Register/Register"));
const ResetPassword = lazyPage(() => import("../features/Auth/ResetPassword/ResetPassword"));
const VerifyEmail = lazyPage(() => import("../features/Auth/VerifyEmail/VerifyEmail"));
const AccountDetails = lazyPage(() => import("../features/Dashboards/User/AccountDetails/AccountDetails"));
const Accounts = lazyPage(() => import("../features/Dashboards/User/Accounts/Accounts"));
const AIAssistant = lazyPage(() => import("../features/Dashboards/User/AIAssistant/AIAssistant"));
const Imports = lazyPage(() => import("../features/Dashboards/User/Imports/Imports"));
const AiExpenseCaptureDetails = lazyPage(() => import("../features/Dashboards/User/AiExpenseCaptureDetails/AiExpenseCaptureDetails"));
const AiExpenseCaptures = lazyPage(() => import("../features/Dashboards/User/AiExpenseCaptures/AiExpenseCaptures"));
const BudgetDetails = lazyPage(() => import("../features/Dashboards/User/BudgetDetails/BudgetDetails"));
const Budgets = lazyPage(() => import("../features/Dashboards/User/Budgets/Budgets"));
const Calendar = lazyPage(() => import("../features/Dashboards/User/Calendar/Calendar"));
const Categories = lazyPage(() => import("../features/Dashboards/User/Categories/Categories"));
const CategoryDetails = lazyPage(() => import("../features/Dashboards/User/CategoryDetails/CategoryDetails"));
const Dashboard = lazyPage(() => import("../features/Dashboards/User/Dashboard/Dashboard"));
const DebtDetails = lazyPage(() => import("../features/Dashboards/User/DebtDetails/DebtDetails"));
const Debts = lazyPage(() => import("../features/Dashboards/User/Debts/Debts"));
const FinancialOperations = lazyPage(() => import("../features/Dashboards/User/FinancialOperations/FinancialOperations"));
const Notifications = lazyPage(() => import("../features/Dashboards/User/Notifications/Notifications"));
const Recurring = lazyPage(() => import("../features/Dashboards/User/Recurring/Recurring"));
const RecurringDetails = lazyPage(() => import("../features/Dashboards/User/RecurringDetails/RecurringDetails"));
const ReportExports = lazyPage(() => import("../features/Dashboards/User/ReportExports/ReportExports"));
const Reports = lazyPage(() => import("../features/Dashboards/User/Reports/Reports"));
const SavingsGoalDetails = lazyPage(() => import("../features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails"));
const SavingsGoals = lazyPage(() => import("../features/Dashboards/User/SavingsGoals/SavingsGoals"));
const Settings = lazyPage(() => import("../features/Dashboards/User/Settings/Settings"));
const TransactionDetails = lazyPage(() => import("../features/Dashboards/User/TransactionDetails/TransactionDetails"));
const TransferDetails = lazyPage(() => import("../features/Dashboards/User/TransferDetails/TransferDetails"));
const Transfers = lazyPage(() => import("../features/Dashboards/User/Transfers/Transfers"));
const NotFound = lazyPage(() => import("../features/PublicPage/NotFound/NotFound"));

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
      ...Object.entries(PATH.PUBLIC).map(([key, path]) => ({
        path,
        element: <PublicInformationRoute pageKey={key.toLowerCase()} />,
      })),
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
        element: <CompanyUnavailable />,
      },
      {
        path: PATH.AUTH.COMPANY_REGISTER,
        element: <CompanyUnavailable />,
      },
      {
        path: PATH.AUTH.FORGOT_PASSWORD,
        element: <ForgotPassword />,
      },
      {
        // The OTP prototype was replaced by the emailed verification link.
        path: LEGACY_VERIFY_CODE_PATH,
        element: <Navigate to={PATH.AUTH.SIGNIN} replace />,
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
        path: PATH.USER.ATTENTION,
        element: <AttentionCenter />,
      },
      { path: PATH.USER.MONTHLY_REVIEW, element: <MonthlyReview /> },
      { path: PATH.USER.QUICK_TEMPLATES, element: <QuickTemplates /> },
      { path: PATH.USER.GETTING_STARTED, element: <GettingStarted /> },
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
      { path: PATH.USER.IMPORTS, element: <Imports /> },
      { path: PATH.USER.IMPORT_DETAILS, element: <Imports /> },
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
