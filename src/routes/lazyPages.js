import { lazy } from "react";

/*
 * Route-level code splitting: every page below is downloaded on first visit.
 * The layouts, the route guards, the home page and the not-found page stay in
 * the main bundle (see Routes.jsx), so the navigation chrome and the landing
 * page render immediately. Keep this list in its own file: the components are
 * created here, not exported from a component module.
 */

export const AttentionCenter = lazy(() => import("../features/Dashboards/User/Experience/AttentionCenter"));
export const MonthlyReview = lazy(() => import("../features/Dashboards/User/Experience/MonthlyReview"));
export const QuickTemplates = lazy(() => import("../features/Dashboards/User/Experience/QuickTemplates"));
export const GettingStarted = lazy(() => import("../features/Dashboards/User/Experience/GettingStarted"));
export const AccountType = lazy(() => import("../features/Auth/AccountType/AccountType"));
export const CompanyUnavailable = lazy(() => import("../features/Auth/CompanyUnavailable/CompanyUnavailable"));
export const ForgotPassword = lazy(() => import("../features/Auth/ForgotPassword/ForgotPassword"));
export const Login = lazy(() => import("../features/Auth/Login/Login"));
export const PasswordChanged = lazy(() => import("../features/Auth/PasswordChanged/PasswordChanged"));
export const Register = lazy(() => import("../features/Auth/Register/Register"));
export const ResetPassword = lazy(() => import("../features/Auth/ResetPassword/ResetPassword"));
export const VerifyEmail = lazy(() => import("../features/Auth/VerifyEmail/VerifyEmail"));
export const AccountDetails = lazy(() => import("../features/Dashboards/User/AccountDetails/AccountDetails"));
export const Accounts = lazy(() => import("../features/Dashboards/User/Accounts/Accounts"));
export const AIAssistant = lazy(() => import("../features/Dashboards/User/AIAssistant/AIAssistant"));
export const Imports = lazy(() => import("../features/Dashboards/User/Imports/Imports"));
export const AiExpenseCaptureDetails = lazy(() => import("../features/Dashboards/User/AiExpenseCaptureDetails/AiExpenseCaptureDetails"));
export const AiExpenseCaptures = lazy(() => import("../features/Dashboards/User/AiExpenseCaptures/AiExpenseCaptures"));
export const BudgetDetails = lazy(() => import("../features/Dashboards/User/BudgetDetails/BudgetDetails"));
export const Budgets = lazy(() => import("../features/Dashboards/User/Budgets/Budgets"));
export const Calendar = lazy(() => import("../features/Dashboards/User/Calendar/Calendar"));
export const Categories = lazy(() => import("../features/Dashboards/User/Categories/Categories"));
export const CategoryDetails = lazy(() => import("../features/Dashboards/User/CategoryDetails/CategoryDetails"));
export const Dashboard = lazy(() => import("../features/Dashboards/User/Dashboard/Dashboard"));
export const DebtDetails = lazy(() => import("../features/Dashboards/User/DebtDetails/DebtDetails"));
export const Debts = lazy(() => import("../features/Dashboards/User/Debts/Debts"));
export const FinancialOperations = lazy(() => import("../features/Dashboards/User/FinancialOperations/FinancialOperations"));
export const WhatsAppDrafts = lazy(() => import("../features/Dashboards/User/WhatsAppDrafts/WhatsAppDrafts"));
export const WhatsAppDraftDetails = lazy(() => import("../features/Dashboards/User/WhatsAppDrafts/WhatsAppDraftDetails"));
export const Notifications = lazy(() => import("../features/Dashboards/User/Notifications/Notifications"));
export const Recurring = lazy(() => import("../features/Dashboards/User/Recurring/Recurring"));
export const RecurringDetails = lazy(() => import("../features/Dashboards/User/RecurringDetails/RecurringDetails"));
export const ReportExports = lazy(() => import("../features/Dashboards/User/ReportExports/ReportExports"));
export const Reports = lazy(() => import("../features/Dashboards/User/Reports/Reports"));
export const SavingsGoalDetails = lazy(() => import("../features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails"));
export const SavingsGoals = lazy(() => import("../features/Dashboards/User/SavingsGoals/SavingsGoals"));
export const Settings = lazy(() => import("../features/Dashboards/User/Settings/Settings"));
export const TransactionDetails = lazy(() => import("../features/Dashboards/User/TransactionDetails/TransactionDetails"));
export const TransferDetails = lazy(() => import("../features/Dashboards/User/TransferDetails/TransferDetails"));
export const Transfers = lazy(() => import("../features/Dashboards/User/Transfers/Transfers"));
