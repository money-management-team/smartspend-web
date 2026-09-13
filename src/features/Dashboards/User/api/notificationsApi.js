import { apiRequest } from "./apiClient";

const notificationPath = (notificationId) =>
  `/notifications/${encodeURIComponent(notificationId)}`;

/*
 * Persistent, per-USER notifications (an inbox with read state). They are not
 * the financial alerts of GET /financial-alerts, which are calculated on
 * request and never stored (see financialAlertsApi).
 *
 * Notifications belong to the signed-in user, not to a workspace: no request
 * here sends `workspace_id`.
 *
 * Envelopes:
 * - list → `data.notifications` (Laravel paginator, rows in `.data`) +
 *   `data.unread_count`.
 * - unreadCount → `data.unread_count`.
 * - markRead → `data.notification` (the updated row) + `data.unread_count`.
 * - markAllRead → `data.marked_count` (may be 0) + `data.unread_count`.
 *
 * After a write, the unread count to show is the one the response returns;
 * it is never decremented locally.
 */
export const notificationsApi = {
  // Query: status (read | unread), type, severity (info | warning |
  // critical), per_page (1..100, default 20), page.
  list: (query = {}, options = {}) =>
    apiRequest("/notifications", { query, signal: options.signal }),

  // For the header / sidebar badge: never fetch the list just for the count.
  unreadCount: (options = {}) =>
    apiRequest("/notifications/unread-count", { signal: options.signal }),

  // PATCH, no body (the backend also accepts POST; PATCH is used everywhere).
  // Idempotent: marking an already-read notification again succeeds. 404 when
  // the notification doesn't exist or belongs to another user.
  markRead: (notificationId) =>
    apiRequest(`${notificationPath(notificationId)}/read`, { method: "PATCH" }),

  // No body. Safe to repeat: `marked_count` is 0 when nothing was unread.
  markAllRead: () =>
    apiRequest("/notifications/read-all", { method: "POST" }),
};
