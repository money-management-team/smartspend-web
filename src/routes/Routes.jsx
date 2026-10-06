import PublicInformationRoute from "../features/PublicPage/Information/PublicInformationRoute";
import Home from "../features/PublicPage/Home/Home";
import NotFound from "../features/PublicPage/NotFound/NotFound";

import AuthLayout from "../layouts/AuthLayout/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout/DashboardLayout";
import PublicLayout from "../layouts/PublicLayout/PublicLayout";
import { Navigate } from "react-router-dom";

import {
  AttentionCenter,
  MonthlyReview,
  QuickTemplates,
  GettingStarted,
  AccountType,
  CompanyUnavailable,
  ForgotPassword,
  Login,
  PasswordChanged,
  Register,
  ResetPassword,
  VerifyEmail,
  AccountDetails,
  Accounts,
  AIAssistant,
  Imports,
  AiExpenseCaptureDetails,
  AiExpenseCaptures,
  BudgetDetails,
  Budgets,
  Calendar,
  Categories,
  CategoryDetails,
  Dashboard,
  DebtDetails,
  Debts,
  FinancialOperations,
  Notifications,
  Recurring,
  RecurringDetails,
  ReportExports,
  Reports,
  SavingsGoalDetails,
  SavingsGoals,
  Settings,
  TransactionDetails,
  TransferDetails,
  Transfers,
} from "./lazyPages";
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
      ...Object.entries(PATH.PUBLIC).map(([key, path]) => ({
        path,
        element: <PublicInformationRoute pageKey={key.toLowerCase()} />,
      })),
      /* Legacy demo page, removed. Verification is by the emailed link and the
         dashboard banner, so old links go to the dashboard (sign-in first when
         signed out, and back here afterwards). */
      {
        path: PATH.AUTH.VERIFY_CODE,
        element: <Navigate to={PATH.USER.DASHBOARD} replace />,
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
