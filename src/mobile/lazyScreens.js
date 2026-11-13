import { createElement, lazy, useState } from "react";

/*
 * The Mobile screens that are not needed to show Home, each loaded on first use (route-level code splitting).
 *
 * Before this file every screen was a static import of routes.jsx, so opening Mobile Home downloaded the code of all
 * forty-odd screens (about 680 kB of JavaScript in one chunk). Now only the shell, the route guards and Home are in
 * the Mobile chunk; a screen is requested the first time its address is shown, and the shell stays on screen while it
 * loads (shell/ScreenBoundary.jsx).
 *
 * What stays eager, on purpose: Home (the first screen), the shell with its dock and Add sheet, the route guards and
 * identity boundary, and the not-available page (tiny, and the catch-all). Screens that live in one module share one
 * loader, so a module is requested once however many of its screens are opened.
 *
 * `SCREEN_LOADERS` is the single list of those modules: the idle prefetch below and the test harness (which warms
 * every module once, as it always warmed the single Mobile chunk) both read it, so a screen cannot be lazy and missing
 * from either.
 */
export const SCREEN_LOADERS = Object.freeze({
  accounts: () => import("./accounts/MobileAccounts.jsx"),
  accountDetail: () => import("./accounts/MobileAccountDetail.jsx"),
  activity: () => import("./activity/MobileActivity.jsx"),
  transactionDetail: () => import("./activity/MobileTransactionDetail.jsx"),
  categories: () => import("./categories/MobileCategories.jsx"),
  categoryDetail: () => import("./categories/MobileCategoryDetail.jsx"),
  categoryForm: () => import("./categories/MobileCategoryForm.jsx"),
  workflow: () => import("./forms/MobileWorkflow.jsx"),
  assistant: () => import("./assist/MobileAssistant.jsx"),
  captures: () => import("./assist/MobileCaptures.jsx"),
  attention: () => import("./assist/MobileAttention.jsx"),
  receiptNew: () => import("./assist/MobileReceiptNew.jsx"),
  voiceNew: () => import("./assist/MobileVoiceNew.jsx"),
  auth: () => import("./auth/MobileAuth.jsx"),
  profile: () => import("./settings/MobileProfile.jsx"),
  review: () => import("./tools/MobileReview.jsx"),
  search: () => import("./tools/MobileSearch.jsx"),
  templates: () => import("./tools/MobileTemplates.jsx"),
  gettingStarted: () => import("./guide/MobileGettingStarted.jsx"),
  whatsapp: () => import("./whatsapp/MobileWhatsApp.jsx"),
  enter: () => import("./screens/MobileEnter.jsx"),
  more: () => import("./screens/MobileMore.jsx"),
  planning: () => import("./planning/MobilePlanning.jsx"),
  budgets: () => import("./planning/MobileBudgets.jsx"),
  budgetDetail: () => import("./planning/MobileBudgetDetail.jsx"),
  goals: () => import("./planning/MobileGoals.jsx"),
  goalDetail: () => import("./planning/MobileGoalDetail.jsx"),
  recurring: () => import("./planning/MobileRecurring.jsx"),
  recurringDetail: () => import("./planning/MobileRecurringDetail.jsx"),
  calendar: () => import("./calendar/MobileCalendar.jsx"),
  debts: () => import("./debts/MobileDebts.jsx"),
  debtDetail: () => import("./debts/MobileDebtDetail.jsx"),
  imports: () => import("./imports/MobileImports.jsx"),
  importNew: () => import("./imports/MobileImportNew.jsx"),
  notifications: () => import("./notifications/MobileNotifications.jsx"),
  exports: () => import("./reports/MobileExports.jsx"),
  exportDetail: () => import("./reports/MobileExportDetail.jsx"),
  report: () => import("./reports/MobileReport.jsx"),
  reports: () => import("./reports/MobileReports.jsx"),
  transfers: () => import("./transfers/MobileTransfers.jsx"),
  transferDetail: () => import("./transfers/MobileTransferDetail.jsx"),
});

/*
 * A lazy screen for one export of one of the modules above (the default export unless a name is given).
 *
 * `React.lazy` suspends on a component's first render even when its module has long since arrived, which shows the
 * loading state for a moment (and, measured on a throttled phone profile, made a tap on an already prefetched
 * destination slower than the old single chunk). So a screen whose module is already here (prefetched, or opened before)
 * renders at once: each instance decides at mount which component to render and keeps it, so nothing remounts when
 * the module arrives later. `preload()` is what the prefetch calls.
 */
function screen(key, name = "default") {
  let loaded = null;
  const remember = (module) => {
    loaded = module[name];
    return loaded;
  };
  const Lazy = lazy(() => SCREEN_LOADERS[key]().then((module) => ({ default: remember(module) })));
  const Screen = (props) => {
    const [Component] = useState(() => loaded ?? Lazy);
    return createElement(Component, props);
  };

  Screen.preload = () => SCREEN_LOADERS[key]().then(remember);
  return Screen;
}

export const MobileAccounts = screen("accounts");
export const MobileAccountDetail = screen("accountDetail");
export const MobileActivity = screen("activity");
export const MobileTransactionDetail = screen("transactionDetail");
export const MobileCategories = screen("categories");
export const MobileCategoryDetail = screen("categoryDetail");
export const MobileCategoryCreate = screen("categoryForm", "MobileCategoryCreate");
export const MobileCategoryEdit = screen("categoryForm", "MobileCategoryEdit");
export const MobileNewEntry = screen("workflow", "MobileNewEntry");
export const MobileRecordAction = screen("workflow", "MobileRecordAction");
export const MobileAssistant = screen("assistant");
export const MobileConversation = screen("assistant", "MobileConversation");
export const MobileCaptures = screen("captures");
export const MobileCaptureDetail = screen("captures", "MobileCaptureDetail");
export const MobileAttention = screen("attention");
export const MobileReceiptNew = screen("receiptNew");
export const MobileVoiceNew = screen("voiceNew");
export const MobileSignIn = screen("auth", "MobileSignIn");
export const MobileRegister = screen("auth", "MobileRegister");
export const MobileProfile = screen("profile");
export const MobileProfileForm = screen("profile", "MobileProfileForm");
export const MobileReview = screen("review");
export const MobileSearch = screen("search");
export const MobileTemplates = screen("templates");
export const MobileGettingStarted = screen("gettingStarted");
export const MobileWhatsApp = screen("whatsapp");
export const MobileWhatsAppDrafts = screen("whatsapp", "MobileWhatsAppDrafts");
export const MobileWhatsAppDraft = screen("whatsapp", "MobileWhatsAppDraft");
export const MobileEnter = screen("enter");
export const MobileMore = screen("more");
export const MobilePlanning = screen("planning");
export const MobileBudgets = screen("budgets");
export const MobileBudgetDetail = screen("budgetDetail");
export const MobileGoals = screen("goals");
export const MobileGoalDetail = screen("goalDetail");
export const MobileRecurring = screen("recurring");
export const MobileRecurringDetail = screen("recurringDetail");
export const MobileCalendar = screen("calendar");
export const MobileDebts = screen("debts");
export const MobileDebtDetail = screen("debtDetail");
export const MobileImports = screen("imports");
export const MobileImportDetail = screen("imports", "MobileImportDetail");
export const MobileImportNew = screen("importNew");
export const MobileNotifications = screen("notifications");
export const MobileExports = screen("exports");
export const MobileExportDetail = screen("exportDetail");
export const MobileReport = screen("report");
export const MobileReports = screen("reports");
export const MobileTransfers = screen("transfers");
export const MobileTransferDetail = screen("transferDetail");

/*
 * The screens a person is most likely to open next from Home: the dock's destinations and an account or a transaction.
 * They are requested once, when the browser is idle, so that tapping the dock rarely waits for a download and a
 * screen opened once offline-first is already in the service worker's cache. Nothing is requested on a metered
 * connection (Save-Data, or a 2G type), when the page is hidden, or while offline.
 */
const likely = () => [MobileActivity, MobilePlanning, MobileMore, MobileAccounts, MobileTransactionDetail];

export function prefetchLikelyScreens({ win = globalThis } = {}) {
  const connection = win.navigator?.connection;
  if (win.navigator?.onLine === false || connection?.saveData === true || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return () => {};
  if (win.document?.visibilityState === "hidden") return () => {};

  const run = () => likely().forEach((component) => component.preload().catch(() => {}));

  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(run, { timeout: 4000 });
    return () => win.cancelIdleCallback?.(handle);
  }

  const handle = win.setTimeout(run, 2000);
  return () => win.clearTimeout(handle);
}
