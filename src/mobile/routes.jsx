import { RequireAuth } from "../routes/RouteGuards";
import MobileAccountDetail from "./accounts/MobileAccountDetail.jsx";
import MobileActivity from "./activity/MobileActivity.jsx";
import MobileTransactionDetail from "./activity/MobileTransactionDetail.jsx";
import MobileAccounts from "./accounts/MobileAccounts.jsx";
import MobileCategories from "./categories/MobileCategories.jsx";
import MobileCategoryDetail from "./categories/MobileCategoryDetail.jsx";
import { MobileCategoryCreate, MobileCategoryEdit } from "./categories/MobileCategoryForm.jsx";
import { RECORD_ACTIONS } from "./forms/actionRoutes.js";
import { MobileNewEntry, MobileRecordAction } from "./forms/MobileWorkflow.jsx";
import MobileAssistant, { MobileConversation } from "./assist/MobileAssistant.jsx";
import MobileCaptures, { MobileCaptureDetail } from "./assist/MobileCaptures.jsx";
import MobileReceiptNew from "./assist/MobileReceiptNew.jsx";
import MobileVoiceNew from "./assist/MobileVoiceNew.jsx";
import MobileHome from "./home/MobileHome.jsx";
import MobileProfile, { MobileProfileForm } from "./settings/MobileProfile.jsx";
import MobileReview from "./tools/MobileReview.jsx";
import MobileSearch from "./tools/MobileSearch.jsx";
import MobileTemplates from "./tools/MobileTemplates.jsx";
import MobileWhatsApp, { MobileWhatsAppDraft, MobileWhatsAppDrafts } from "./whatsapp/MobileWhatsApp.jsx";
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
import MobileImportNew from "./imports/MobileImportNew.jsx";
import MobileImports, { MobileImportDetail } from "./imports/MobileImports.jsx";
import MobileNotifications from "./notifications/MobileNotifications.jsx";
import MobileExports from "./reports/MobileExports.jsx";
import MobileReport from "./reports/MobileReport.jsx";
import MobileReports from "./reports/MobileReports.jsx";
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
 * The other forms (forms/, at /m/add/... and the record actions in
 * forms/actionRoutes.js) end at a review and have no code that sends.
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
      { path: "reports", element: <MobileReports /> },
      { path: "reports/:reportType", element: <MobileReport /> },
      { path: "exports", element: <MobileExports /> },
      { path: "imports", element: <MobileImports /> },
      { path: "imports/new", element: <MobileImportNew /> },
      { path: "imports/:importId", element: <MobileImportDetail /> },
      { path: "add/:workflow", element: <MobileNewEntry /> },
      ...RECORD_ACTIONS.map((action) => ({ path: action.path, element: <MobileRecordAction workflowId={action.workflow} /> })),
      { path: "assistant", element: <MobileAssistant /> },
      { path: "assistant/conversations/:conversationId", element: <MobileConversation /> },
      { path: "captures", element: <MobileCaptures /> },
      { path: "captures/receipts/new", element: <MobileReceiptNew /> },
      { path: "captures/receipts/:captureId", element: <MobileCaptureDetail source="receipt" /> },
      { path: "captures/voice/new", element: <MobileVoiceNew /> },
      { path: "captures/voice/:captureId", element: <MobileCaptureDetail source="voice" /> },
      { path: "whatsapp", element: <MobileWhatsApp /> },
      { path: "whatsapp/drafts", element: <MobileWhatsAppDrafts /> },
      { path: "whatsapp/drafts/:draftId", element: <MobileWhatsAppDraft /> },
      { path: "profile", element: <MobileProfile /> },
      { path: "profile/edit", element: <MobileProfileForm workflowId="profile-edit" /> },
      { path: "profile/password", element: <MobileProfileForm workflowId="password-change" /> },
      { path: "search", element: <MobileSearch /> },
      { path: "review", element: <MobileReview /> },
      { path: "templates", element: <MobileTemplates /> },
      { path: "more", element: <MobileMore /> },
      { path: "*", element: <MobileNotAvailable /> },
    ],
  },
];
