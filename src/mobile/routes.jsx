import { RequireAuth } from "../routes/RouteGuards";
import { RECORD_ACTIONS } from "./forms/actionRoutes.js";
import { MobileGuestOnly, MobileRequireAuth } from "./auth/guards.jsx";
import MobileHome from "./home/MobileHome.jsx";
import IdentityBoundary from "./identity/IdentityBoundary.jsx";
import {
  MobileAccountDetail, MobileAccounts, MobileActivity, MobileAssistant, MobileAttention, MobileBudgetDetail, MobileBudgets, MobileCalendar, MobileCaptureDetail,
  MobileCaptures, MobileCategories, MobileCategoryCreate, MobileCategoryDetail, MobileCategoryEdit, MobileConversation, MobileDebtDetail, MobileDebts, MobileEnter,
  MobileExportDetail, MobileExports, MobileGettingStarted, MobileGoalDetail, MobileGoals, MobileImportDetail, MobileImportNew, MobileImports, MobileMore,
  MobileNewEntry, MobileNotifications, MobilePlanning, MobileProfile, MobileProfileForm, MobileReceiptNew, MobileRecordAction, MobileRecurring, MobileRecurringDetail,
  MobileRegister, MobileReport, MobileReports, MobileReview, MobileSearch, MobileSignIn, MobileTemplates, MobileTransactionDetail, MobileTransferDetail,
  MobileTransfers, MobileVoiceNew, MobileWhatsApp, MobileWhatsAppDraft, MobileWhatsAppDrafts,
} from "./lazyScreens.js";
import { MOBILE_ENTER, MOBILE_PREFIX, MOBILE_REGISTER, MOBILE_SIGNIN } from "./navigation.js";
import MobileNotAvailable from "./screens/MobileNotAvailable.jsx";
import MobileAppShell from "./shell/MobileAppShell.jsx";
import ScreenBoundary from "./shell/ScreenBoundary.jsx";

/*
 * The Mobile route tree. It uses the app's own RequireAuth, so a signed-out
 * visitor is sent to sign-in and returns here afterwards, exactly as on
 * Desktop. Everything inside the shell sits in the identity boundary, which
 * owns the in-memory data and takes the screen down if the signed-in identity
 * stops being consistent. Nothing here writes: the screens read through
 * data/readApi.js (and the assist and plan read facades). Every write Mobile has
 * code for (the category form, the forms under forms/ at /m/add/... and the
 * record actions in forms/actionRoutes.js, and the receipt and voice uploads)
 * goes through data/writeApi.js, which asks the write gate first; the gate keeps
 * every one of them closed (data/writeGate.js, APPROVED is empty).
 *
 * /m/enter is outside the shell on purpose (it is the way in, not a screen of
 * the app) but behind the app's own sign-in guard (a visitor who chose the full
 * version signs in there). The shell's screens use MobileRequireAuth, the same
 * rule with Mobile's own sign-in page (auth/): /m/signin and /m/register sit
 * outside the shell, for signed-out visitors only, and sign in through the
 * app's one AuthProvider.
 */
export const mobileRoutes = [
  {
    path: MOBILE_ENTER,
    element: (
      <RequireAuth>
        <ScreenBoundary standalone>
          <MobileEnter />
        </ScreenBoundary>
      </RequireAuth>
    ),
  },
  { path: MOBILE_SIGNIN, element: <MobileGuestOnly><ScreenBoundary standalone><MobileSignIn /></ScreenBoundary></MobileGuestOnly> },
  // Registration applies the guest rule itself, so a registration that succeeds can go on to Profile (verification).
  { path: MOBILE_REGISTER, element: <ScreenBoundary standalone><MobileRegister /></ScreenBoundary> },
  {
    path: MOBILE_PREFIX,
    element: (
      <MobileRequireAuth>
        <IdentityBoundary>
          <MobileAppShell />
        </IdentityBoundary>
      </MobileRequireAuth>
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
      { path: "exports/:exportId", element: <MobileExportDetail /> },
      { path: "imports", element: <MobileImports /> },
      { path: "imports/new", element: <MobileImportNew /> },
      { path: "imports/:importId", element: <MobileImportDetail /> },
      { path: "add/:workflow", element: <MobileNewEntry /> },
      ...RECORD_ACTIONS.map((action) => ({ path: action.path, element: <MobileRecordAction workflowId={action.workflow} /> })),
      { path: "assistant", element: <MobileAssistant /> },
      { path: "assistant/conversations/:conversationId", element: <MobileConversation /> },
      { path: "attention", element: <MobileAttention /> },
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
      { path: "getting-started", element: <MobileGettingStarted /> },
      { path: "more", element: <MobileMore /> },
      { path: "*", element: <MobileNotAvailable /> },
    ],
  },
];
