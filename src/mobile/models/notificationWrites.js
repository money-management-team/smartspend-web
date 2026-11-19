import { classifyWriteOutcome } from "../forms/useWorkflowSubmit.js";

/*
 * What an answer to marking notifications read proves (notifications/useNotificationWrite.js). Pure, so every case is
 * tested without a screen.
 *
 * The backend (NotificationController, identical on develop @ fd87531 and fix/financial-idempotency-p0 @ 6b696d72):
 *   PATCH /notifications/{id}/read -> data.notification (the row, with is_read) + data.unread_count
 *   POST  /notifications/read-all  -> data.marked_count (0 when nothing was unread) + data.unread_count
 *
 * "confirmed" needs that proof in the answer: the unread count is the server's own and is what the screen shows next;
 * it is never worked out here. An answer without it is "unknown", since the request may have been applied.
 */

const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** The proof that notification `id` is now read: the server's unread count, or null. */
export function readProof(data, id) {
  if (!isRecord(data) || !isRecord(data.notification)) return null;
  const unreadCount = count(data.unread_count);
  if (unreadCount === null) return null;
  if (String(data.notification.id) !== String(id) || data.notification.is_read !== true) return null;
  return { unreadCount };
}

/** The proof that everything was marked read: the server's unread count and how many it marked, or null. */
export function readAllProof(data) {
  if (!isRecord(data)) return null;
  const unreadCount = count(data.unread_count);
  const marked = count(data.marked_count);
  if (unreadCount === null || marked === null) return null;
  return { unreadCount, marked };
}

/*
 * A failure, in the same words as every other Mobile write (forms/useWorkflowSubmit.js classifyWriteOutcome):
 *   rejected  the server looked and refused (403 inactive account, 404 not found or not yours, 429), or nothing was
 *             sent (the gate is closed, or the id is not a notification id);
 *   identity  401: the session is gone, and the app's boundary takes the screen down;
 *   unknown   everything else: a timeout, the network, a 5xx, an answer that is not the envelope.
 * Both writes are "same-result", so trying an unknown one again by hand is safe; nothing is ever resent by itself.
 */
export function notificationWriteOutcome(error) {
  if (error?.code === "INVALID_ID") return { kind: "rejected", code: "INVALID_ID", error };
  const outcome = classifyWriteOutcome(error);
  return outcome.kind === "possibleDuplicate" ? { kind: "unknown", code: outcome.code, status: 409 } : outcome;
}

/** The message key (under `notifications.write`) for an outcome the screen shows. */
export function outcomeMessageKey(outcome) {
  if (!outcome) return null;
  if (outcome.kind === "confirmed") return outcome.target === "all" ? "readAll" : "read";
  if (outcome.kind === "rejected") {
    if (outcome.code === "NOT_FOUND") return "notFound";
    if (outcome.code === "FORBIDDEN") return "forbidden";
    if (outcome.code === "RATE_LIMITED") return "rateLimited";
    if (outcome.code === "WRITE_CLOSED") return "closed";
    return "refused";
  }
  return "unknown";
}
