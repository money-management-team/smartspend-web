import { classifyWriteOutcome } from "../forms/useWorkflowSubmit.js";
import { buildNotificationPreferences } from "./assist.js";

/*
 * What an answer to saving the savings reminder preference proves (settings/usePreferenceWrite.js). Pure, so every
 * case is tested without a screen.
 *
 * PATCH /notifications/preferences { savings_installment_reminders: true|false } answers with the same envelope as the
 * read (NotificationController::preferencesResponse, identical on develop @ fd87531 and 6b696d72):
 *   data.preferences.savings_installment_reminders  the saved value
 *   data.channels                                   ["in_app"]
 *   data.savings_installment_reminders_available    the backend's global switch
 *
 * The answer is the server's saved state and is what the screen shows next. It is "confirmed" when it says the value
 * that was asked for; an answer that parses but says the other value is shown as it is (it is the server's) and
 * reported as "unknown", since the request alone doesn't say why.
 */

/** The parsed answer when it is a usable preferences envelope with a saved true/false; otherwise null. */
export function preferencesAnswer(data) {
  try {
    const prefs = buildNotificationPreferences(data);
    return typeof prefs.reminders === "boolean" ? { data, reminders: prefs.reminders } : null;
  } catch {
    return null;
  }
}

/*
 * A failure:
 *   rejected  the server looked and refused (422 not a valid value, 403 inactive account, 429), or nothing was sent
 *             (the gate is closed, or the value was not true or false);
 *   identity  401;
 *   unknown   a timeout, the network, a 5xx, an answer that is not the envelope.
 * The write is "same-result" (an explicit value), so saving it again by hand is safe; nothing is resent by itself.
 */
export function preferenceWriteOutcome(error) {
  if (error?.code === "INVALID_VALUE") return { kind: "rejected", code: "INVALID_VALUE", error };
  const outcome = classifyWriteOutcome(error);
  return outcome.kind === "possibleDuplicate" ? { kind: "unknown", code: outcome.code, status: 409 } : outcome;
}

/** The message key (under `profile.prefsWrite`) for an outcome the screen shows. */
export function preferenceMessageKey(outcome) {
  if (!outcome) return null;
  if (outcome.kind === "confirmed") return "saved";
  if (outcome.kind === "rejected") {
    if (outcome.code === "VALIDATION_ERROR" || outcome.code === "INVALID_VALUE") return "invalid";
    if (outcome.code === "FORBIDDEN") return "forbidden";
    if (outcome.code === "RATE_LIMITED") return "rateLimited";
    if (outcome.code === "WRITE_CLOSED") return "closed";
    return "refused";
  }
  return "unknown";
}
