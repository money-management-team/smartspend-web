import { isCurrencyCode } from "../money/decimal.js";
import { buildPlanningPage, readState } from "./planning.js";
import { amountIn, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * The notification inbox, read-only (docs/notifications/api.md).
 *
 * - GET /notifications takes status (read | unread), per_page and page; the
 *   inbox is the person's, so no workspace is sent. Paginator at
 *   data.notifications (documented without from/to), plus data.unread_count.
 * - Reading the list does not mark anything read; marking is a PATCH that
 *   Mobile does not send, so a row shows the read state the server reported.
 * - `subject_type` / `subject_id` say what a notification is about. Only the
 *   kinds Mobile has a page for get a link; the others are text.
 */

export const NOTIFICATION_STATUSES = ["unread", "read"];
const SEVERITIES = ["info", "warning", "critical"];

export function readNotificationFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const status = params.get("status") ?? "";
  return { status: NOTIFICATION_STATUSES.includes(status) ? status : "" };
}

export function notificationFiltersToSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  return params;
}

export const notificationFilterSignature = (filters) => notificationFiltersToSearchParams(filters).toString() || "default";

export const hasActiveNotificationFilters = (filters) => Boolean(filters.status);

export const notificationFiltersToQuery = (filters, page, perPage) => ({ status: filters.status || undefined, per_page: perPage, page });

export function normalizeNotification(raw) {
  if (!isRecord(raw)) return null;
  const id = idText(raw.id);
  if (!id) return null;

  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const severity = readState(raw.severity, SEVERITIES);

  return {
    id,
    type: textOrNull(raw.type, 60),
    severity: severity.known ? severity.word : "info",
    title: textOrNull(raw.title, 255),
    message: textOrNull(raw.body, 2000),
    amount: amountIn(raw.amount, currency),
    currency,
    read: flagOrNull(raw.is_read),
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
    subjectType: textOrNull(raw.subject_type, 60),
    subjectId: idText(raw.subject_id),
  };
}

export const buildNotificationsPage = (response, expected) => buildPlanningPage(response, expected, "notifications", normalizeNotification, { rangeOptional: true });

/** The backend's unread count, or null when it is not a plain non-negative integer. */
export const unreadCountOf = (response) => (Number.isSafeInteger(response?.data?.unread_count) && response.data.unread_count >= 0 ? response.data.unread_count : null);
