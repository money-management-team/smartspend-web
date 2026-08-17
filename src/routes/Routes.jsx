import ForgotPassword from "../features/Auth/ForgotPassword/ForgotPassword";
import Login from "../features/Auth/Login/Login";
import PasswordChanged from "../features/Auth/PasswordChanged/PasswordChanged";
import Register from "../features/Auth/Register/Register";
import ResetPassword from "../features/Auth/ResetPassword/ResetPassword";
import VerifyCode from "../features/Auth/VerifyCode/VerifyCode";
import Accounts from "../features/Dashboards/User/Accounts/Accounts";
import AIAssistant from "../features/Dashboards/User/AIAssistant/AIAssistant";
import Budgets from "../features/Dashboards/User/Budgets/Budgets";
import Dashboard from "../features/Dashboards/User/Dashboard/Dashboard";
import FinancialOperations from "../features/Dashboards/User/FinancialOperations/FinancialOperations";
import Import from "../features/Dashboards/User/Import/Import";
import Notifications from "../features/Dashboards/User/Notifications/Notifications";
import Recurring from "../features/Dashboards/User/Recurring/Recurring";
import Reports from "../features/Dashboards/User/Reports/Reports";
import SavingsGoals from "../features/Dashboards/User/SavingsGoals/SavingsGoals";
import Settings from "../features/Dashboards/User/Settings/Settings";

import Home from "../features/PublicPages/Home/Home";

import AuthLayout from "../layouts/AuthLayout/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout/DashboardLayout";
import PublicLayout from "../layouts/PublicLayout/PublicLayout";

import { PATH } from "./Path";

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
    ],
  },
];

/* =========================
   Guest Routes
========================= */

const guestRoutes = [
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      {
        path: PATH.AUTH.SIGNIN,
        element: <Login />,
      },
      {
        path: PATH.AUTH.REGISTER,
        element: <Register />,
      },
      {
        path: PATH.AUTH.FORGOT_PASSWORD,
        element: <ForgotPassword />,
      },
      {
        path: PATH.AUTH.RESET_PASSWORD,
        element: <ResetPassword />,
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
   User Routes
========================= */

const userRoutes = [
  {
    path: "/",
    element: <DashboardLayout />,
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
        path: PATH.USER.FINANCIAL_OPERATIONS,
        element: <FinancialOperations />,
      },
      {
        path: PATH.USER.RECURRING,
        element: <Recurring />,
      },
      {
        path: PATH.USER.IMPORT,
        element: <Import />,
      },

      {
        path: PATH.USER.BUDGETS,
        element: <Budgets />,
      },
      {
        path: PATH.USER.SAVINGS_GOALS,
        element: <SavingsGoals />,
      },
      {
        path: PATH.USER.REPORTS,
        element: <Reports />,
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

export { routes, guestRoutes, userRoutes };
