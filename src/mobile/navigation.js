import { PATH } from "../routes/Path.js";

/* URL prefix of the Mobile route tree. Canonical URLs never use it. */
export const MOBILE_PREFIX = "/m";

/*
 * Mobile screens that are not one of the four primary destinations.
 *
 * Accounts is reached from Home and from More (More's current-page marker
 * stays on while a visitor is inside it). An account's page is
 * /m/accounts/{id}. /m/enter is the explicit way into Mobile for someone whose
 * stored choice is the full version: it asks, and only a tap changes the choice.
 */
export const MOBILE_ACCOUNTS = `${MOBILE_PREFIX}/accounts`;
export const MOBILE_ENTER = `${MOBILE_PREFIX}/enter`;
export const MOBILE_ACTIVITY = `${MOBILE_PREFIX}/activity`;
export const activityDetailPath = (transactionId) => `${MOBILE_ACTIVITY}/${encodeURIComponent(transactionId)}`;
export const accountDetailPath = (accountId) => `${MOBILE_ACCOUNTS}/${encodeURIComponent(accountId)}`;

/*
 * Planning (S04B3): the overview at /m/planning and, under it, the read-only
 * lists and pages of budgets, savings goals and recurring rules. Debts,
 * Calendar and Reports are not Mobile screens; the overview links to their
 * full-version pages. Categories (S04B4) are the one place under Planning that
 * can be written to: add a category and rename your own (planning/categories/new
 * and planning/categories/{id}/edit); nothing about money.
 */
export const MOBILE_PLANNING = `${MOBILE_PREFIX}/planning`;
export const MOBILE_BUDGETS = `${MOBILE_PLANNING}/budgets`;
export const MOBILE_GOALS = `${MOBILE_PLANNING}/goals`;
export const MOBILE_RECURRING = `${MOBILE_PLANNING}/recurring`;
export const MOBILE_CATEGORIES = `${MOBILE_PLANNING}/categories`;
export const MOBILE_CATEGORY_NEW = `${MOBILE_CATEGORIES}/new`;
export const categoryDetailPath = (categoryId) => `${MOBILE_CATEGORIES}/${encodeURIComponent(categoryId)}`;
export const categoryEditPath = (categoryId) => `${categoryDetailPath(categoryId)}/edit`;
export const budgetDetailPath = (budgetId) => `${MOBILE_BUDGETS}/${encodeURIComponent(budgetId)}`;
export const goalDetailPath = (goalId) => `${MOBILE_GOALS}/${encodeURIComponent(goalId)}`;
export const recurringDetailPath = (ruleId) => `${MOBILE_RECURRING}/${encodeURIComponent(ruleId)}`;

/*
 * Added in the full Mobile sprint, all read-only. Debts and the calendar are
 * under Planning; transfers, notifications, reports and exports, imports, the
 * AI assistant's insights, WhatsApp and the profile are reached from More.
 */
export const MOBILE_DEBTS = `${MOBILE_PLANNING}/debts`;
export const debtDetailPath = (debtId) => `${MOBILE_DEBTS}/${encodeURIComponent(debtId)}`;
export const MOBILE_CALENDAR = `${MOBILE_PLANNING}/calendar`;
export const MOBILE_TRANSFERS = `${MOBILE_PREFIX}/transfers`;
export const transferDetailPath = (transferId) => `${MOBILE_TRANSFERS}/${encodeURIComponent(transferId)}`;
export const MOBILE_NOTIFICATIONS = `${MOBILE_PREFIX}/notifications`;
export const MOBILE_REPORTS = `${MOBILE_PREFIX}/reports`;
export const reportPath = (type) => `${MOBILE_REPORTS}/${encodeURIComponent(type)}`;
export const MOBILE_EXPORTS = `${MOBILE_PREFIX}/exports`;
export const MOBILE_IMPORTS = `${MOBILE_PREFIX}/imports`;
export const importDetailPath = (importId) => `${MOBILE_IMPORTS}/${encodeURIComponent(importId)}`;
export const MOBILE_AI = `${MOBILE_PREFIX}/assistant`;
export const MOBILE_WHATSAPP = `${MOBILE_PREFIX}/whatsapp`;
export const MOBILE_PROFILE = `${MOBILE_PREFIX}/profile`;
export const MOBILE_ADD_ENTRY = `${MOBILE_PREFIX}/add`;

/*
 * Added in the unblocked-feature pass: the assistant's conversations, receipt
 * and voice captures, WhatsApp drafts, the profile and password forms, search,
 * the monthly review and quick-entry templates. All read, or fill in and
 * review only (forms/).
 */
export const MOBILE_MORE = `${MOBILE_PREFIX}/more`;
export const aiConversationPath = (conversationId) => `${MOBILE_AI}/conversations/${encodeURIComponent(conversationId)}`;
export const MOBILE_CAPTURES = `${MOBILE_PREFIX}/captures`;
export const MOBILE_RECEIPT_NEW = `${MOBILE_CAPTURES}/receipts/new`;
export const MOBILE_VOICE_NEW = `${MOBILE_CAPTURES}/voice/new`;
export const captureDetailPath = (source, captureId) => `${MOBILE_CAPTURES}/${source === "voice" ? "voice" : "receipts"}/${encodeURIComponent(captureId)}`;
export const MOBILE_WHATSAPP_DRAFTS = `${MOBILE_WHATSAPP}/drafts`;
export const whatsappDraftPath = (draftId) => `${MOBILE_WHATSAPP_DRAFTS}/${encodeURIComponent(draftId)}`;
export const MOBILE_PROFILE_EDIT = `${MOBILE_PROFILE}/edit`;
export const MOBILE_PASSWORD = `${MOBILE_PROFILE}/password`;
export const MOBILE_SEARCH = `${MOBILE_PREFIX}/search`;
export const MOBILE_REVIEW = `${MOBILE_PREFIX}/review`;
export const MOBILE_TEMPLATES = `${MOBILE_PREFIX}/templates`;

/* The More pages: More's current-page marker stays on inside them. */
const MORE_WITHIN = [MOBILE_ACCOUNTS, MOBILE_TRANSFERS, MOBILE_NOTIFICATIONS, MOBILE_REPORTS, MOBILE_EXPORTS, MOBILE_IMPORTS, MOBILE_AI, MOBILE_WHATSAPP, MOBILE_PROFILE, MOBILE_CAPTURES, MOBILE_SEARCH, MOBILE_REVIEW, MOBILE_TEMPLATES];

/*
 * The four primary destinations. Add is an action (a button that opens a
 * sheet), not a fifth destination, so it is not listed here.
 *
 * `canonical` is the Desktop page that covers the same ground.
 * `fromCanonical` says whether a visit to that Desktop page is sent to the
 * Mobile screen when Mobile is the chosen presentation. Only Home is: it is a
 * real read-only screen. Planning is real and read-only in S04B3 and still not
 * listed: Desktop's Budgets, Savings goals and Recurring pages create, edit,
 * contribute, confirm and skip, which Mobile cannot, so those stay Desktop until
 * there is parity or an approved fallback. More is a different page from
 * Desktop's Settings, so a working Desktop page is never replaced by something
 * that does less. Accounts is not listed here
 * either: Desktop's Accounts page can create, edit and archive, and Mobile's
 * is read-only, so /dashboard/accounts stays Desktop. Activity is real and
 * read-only in S04B2, and still not listed: Desktop's Financial operations page
 * records, corrects and reverses money, which Mobile cannot, so
 * /dashboard/financial-operations (and a transaction's page under it) stays
 * Desktop until there is parity or an approved fallback.
 */
export const MOBILE_SCREENS = Object.freeze([
  { id: "home", mobile: MOBILE_PREFIX, canonical: PATH.USER.DASHBOARD, fromCanonical: true },
  { id: "activity", mobile: `${MOBILE_PREFIX}/activity`, canonical: PATH.USER.FINANCIAL_OPERATIONS, fromCanonical: false, within: [`${MOBILE_PREFIX}/activity`] },
  { id: "planning", mobile: `${MOBILE_PREFIX}/planning`, canonical: PATH.USER.BUDGETS, fromCanonical: false, within: [`${MOBILE_PREFIX}/planning`] },
  { id: "more", mobile: `${MOBILE_PREFIX}/more`, canonical: PATH.USER.SETTING, fromCanonical: false, within: MORE_WITHIN },
]);

/*
 * aria-current for a destination: "page" on the page itself, "true" while the
 * visitor is on a page inside it (Accounts under More), nothing otherwise.
 */
export function currentOf(screen, pathname) {
  if (pathname === screen.mobile) return "page";
  return screen.within?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ? "true" : undefined;
}

/*
 * Below this width (in rem, so enlarged text makes it a wider screen) the
 * bottom bar cannot show five labelled slots, and switches to "Menu + Add".
 * 17rem is the provisional value from the S03.5 prototype; change it here.
 */
export const COMPACT_NAV_MAX_REM = 17;

/* How many pages of a list were loaded when a row was opened, so Back shows as much again (2 to 50). */
export const backStateFrom = (state) => (Number.isInteger(state?.pages) && state.pages > 1 && state.pages <= 50 ? { pages: state.pages } : null);

/*
 * Where "Back" goes from a page opened from a list: the address the list was at
 * (carried in the link's router state), but only if it is a Mobile address.
 * Anything else (a missing state, a foreign or odd value) falls back to `fallback`.
 */
export function backPathFrom(state, fallback) {
  const from = state?.from;

  if (typeof from !== "string" || from.length > 600) return fallback;
  if (!/^\/m(?:[/?#]|$)/.test(from) || from.startsWith("//") || [...from].some((char) => char === "\\" || char.charCodeAt(0) < 32)) return fallback;

  return from;
}

/*
 * The Mobile page of the record a notification or a calendar event refers to
 * (the backend sends `subject_type` + `subject_id`, never a URL), mirroring the
 * full version's getSubjectPath. An unknown type or an id that is not a plain
 * positive integer gives null: the item is shown without a link.
 */
const SUBJECT_PATHS = {
  recurring_transaction: recurringDetailPath,
  debt: debtDetailPath,
  budget: budgetDetailPath,
  savings_goal: goalDetailPath,
  transaction: activityDetailPath,
  transfer: transferDetailPath,
  account: accountDetailPath,
  category: categoryDetailPath,
};

export const mobileSubjectPath = (subjectType, subjectId) =>
  typeof subjectType === "string" && Object.hasOwn(SUBJECT_PATHS, subjectType) && /^[1-9]\d{0,14}$/.test(String(subjectId ?? "")) ? SUBJECT_PATHS[subjectType](subjectId) : null;
