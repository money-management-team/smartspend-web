import { PATH, getSavingsGoalDetailsPath, getSubjectPath } from "../../../../routes/Path";
import { getApiErrorMessage } from "../api/apiClient";
import { parsePage } from "../SavingsGoals/savingsGoalHelpers";
import { SMART_SAVINGS_ENABLED } from "../SavingsGoals/smartSavingsFlag";

// Backend values of the `status` and `severity` filters.
export const NOTIFICATION_STATUSES = ["unread", "read"];
export const NOTIFICATION_SEVERITIES = ["info", "warning", "critical"];
export const NOTIFICATIONS_PER_PAGE = 20;
// The two tabs of the Notifications page (`?tab=`): the persistent inbox, and
// the calculated financial alerts, which are a separate feature.
export const NOTIFICATION_TABS = ["inbox", "alerts"];

const BADGE_MAX = 99;

/* ---------- Counts ---------- */

// A backend unread count as a non-negative integer; null when unusable.
export function toUnreadCount(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

// Text of the bell / sidebar badge ("99+" past 99).
export const formatUnreadBadge = (count, locale) =>
  count > BADGE_MAX
    ? `${BADGE_MAX.toLocaleString(locale)}+`
    : count.toLocaleString(locale);

/* ---------- Rows ---------- */

export const isNotificationEntity = (value) =>
  Boolean(value && typeof value === "object" && value.id != null);

// `is_read` is the backend's flag; `read_at` only backs it up when absent.
export const isNotificationRead = (notification) =>
  notification?.is_read != null
    ? notification.is_read === true || notification.is_read === 1 || notification.is_read === "1"
    : Boolean(notification?.read_at);

export const getNotificationSeverity = (notification) =>
  NOTIFICATION_SEVERITIES.includes(notification?.severity) ? notification.severity : "info";

/*
 * `data.notifications` is a Laravel paginator whose rows are in `.data`; it
 * is never an array itself. Anything else is malformed (null).
 */
export function parseNotificationsPage(response) {
  const paginator = response?.data?.notifications;
  if (!paginator || typeof paginator !== "object" || Array.isArray(paginator)) return null;

  const page = parsePage(response, "notifications");
  return page ? { ...page, items: page.items.filter(isNotificationEntity) } : null;
}

// Replaces a row with the backend's updated copy; other rows are untouched.
export const replaceNotification = (items, updated) =>
  items.map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item));

/* ---------- Links ---------- */

// Savings plan installment reminders (smart savings, gated).
export const SAVINGS_REMINDER_TYPES = ["savings_installment_due", "savings_installment_overdue"];

// A positive integer id, as a number or a digit string; anything else is null.
const toId = (value) => {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  return typeof text === "string" && /^[1-9]\d{0,17}$/.test(text) ? text : null;
};

/*
 * Where a savings reminder points, from the notification's top-level
 * `action` (the backend validates it; null for other types or bad data):
 * `{ goalId, planId, installmentId }` as id strings, `planId` null when the
 * action has none. Null without a usable action.
 *
 * Only these ids are read. The action's preview paths are never followed:
 * the app builds its own routes, and the goal page fetches a fresh preview
 * itself before anything can move.
 */
export function getSavingsReminderTarget(notification) {
  if (!SAVINGS_REMINDER_TYPES.includes(notification?.type)) return null;

  const action = notification.action;
  if (!action || typeof action !== "object" || action.type !== "review_savings_installment") return null;

  const goalId = toId(action.savings_goal_id);
  const installmentId = toId(action.installment_id);
  if (!goalId || !installmentId) return null;

  return { goalId, planId: toId(action.savings_plan_id), installmentId };
}

/*
 * The app route a notification opens, or null for no link. A savings
 * reminder opens its goal on the exact plan and installment
 * (`?plan=&installment=`); without a usable action it opens the savings
 * goals overview, whose upcoming installments list the plan's next one.
 * With smart savings off they get no link, exactly as before. Everything
 * else maps `subject_type` + `subject_id`.
 */
export function getNotificationPath(notification, { smartSavingsEnabled = SMART_SAVINGS_ENABLED } = {}) {
  if (SAVINGS_REMINDER_TYPES.includes(notification?.type)) {
    if (!smartSavingsEnabled) return null;

    const target = getSavingsReminderTarget(notification);
    if (!target) return PATH.USER.SAVINGS_GOALS;

    const query = new URLSearchParams();
    if (target.planId) query.set("plan", target.planId);
    query.set("installment", target.installmentId);
    return `${getSavingsGoalDetailsPath(target.goalId)}?${query.toString()}`;
  }

  return getSubjectPath(notification?.subject_type, notification?.subject_id);
}

/* ---------- Preferences ---------- */

/*
 * `data` of GET / PATCH /notifications/preferences as `{ enabled, available }`
 * (the savings reminder preference and the backend's global switch), or
 * null when malformed.
 */
export function readNotificationPreferences(data) {
  const enabled = data?.preferences?.savings_installment_reminders;
  if (typeof enabled !== "boolean") return null;

  return { enabled, available: data.savings_installment_reminders_available === true };
}

/* ---------- Filters (kept in the URL) ---------- */

export function readNotificationFilters(searchParams) {
  const status = searchParams.get("status") ?? "";
  const severity = searchParams.get("severity") ?? "";
  const page = Number(searchParams.get("page"));

  return {
    status: NOTIFICATION_STATUSES.includes(status) ? status : "",
    severity: NOTIFICATION_SEVERITIES.includes(severity) ? severity : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function notificationFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}

// No `workspace_id`: the inbox belongs to the user, not to a workspace.
export const notificationFiltersToQuery = (filters) => ({
  status: filters.status || undefined,
  severity: filters.severity || undefined,
  per_page: NOTIFICATIONS_PER_PAGE,
  page: filters.page > 1 ? filters.page : undefined,
});

export const hasActiveNotificationFilters = (filters) =>
  Boolean(filters.status || filters.severity);

/* ---------- Errors ---------- */

/*
 * Notification wording where the generic message would mislead.
 * `context`: "load", "markRead" or "markAll". A 404 on mark-read means the
 * notification doesn't exist or belongs to another user; it never says which.
 * A 422 keeps the backend's message (an invalid filter value).
 */
export function getNotificationErrorMessage(error, t, context = "load") {
  if (error?.code === "NOT_FOUND" && context === "markRead") {
    return t("dashboard.notifications.errors.notFound");
  }

  if (error?.code === "VALIDATION_ERROR" && !error.message) {
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.notifications.errors.invalidFilters");
  }

  return getApiErrorMessage(error, t);
}
