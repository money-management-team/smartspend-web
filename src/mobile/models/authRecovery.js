/*
 * Account recovery on Mobile, as pure functions (no React, no requests, no storage): what a form may accept before anything
 * is sent, how the emailed reset link is read, and how a failed request is described. The contract is in
 * docs/mobile/AUTH-RECOVERY.md; the backend (PasswordResetController, EmailVerificationController and their requests)
 * still has the last word on every rule here.
 *
 * Nothing here keeps, logs or returns a password or a token except to the caller that passed it in.
 */

export const PASSWORD_MIN = 8;
const EMAIL_MAX = 255;

/** "required" | "email" | null. The backend rule is `required|string|email|max:255`; this is a plain-shape check, the server decides. */
export function emailError(value) {
  const email = typeof value === "string" ? value.trim() : "";
  if (!email) return "required";
  if (email.length > EMAIL_MAX || /\s/.test(email) || !/^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email)) return "email";
  return null;
}

/** "required" | "passwordShort" | "passwordMix" | null: the backend's `min(8)->letters()->numbers()`. */
export function passwordError(value) {
  if (typeof value !== "string" || !value) return "required";
  if ([...value].length < PASSWORD_MIN) return "passwordShort";
  if (!/\p{L}/u.test(value) || !/\p{N}/u.test(value)) return "passwordMix";
  return null;
}

/** "required" | "passwordMismatch" | null. */
export function confirmationError(password, confirmation) {
  if (typeof confirmation !== "string" || !confirmation) return "required";
  return confirmation === password ? null : "passwordMismatch";
}

/** The three requirements as a checklist, so the screen can show which are met without saying anything about the password itself. */
export const passwordChecklist = (value) => {
  const text = typeof value === "string" ? value : "";
  return { length: [...text].length >= PASSWORD_MIN, letter: /\p{L}/u.test(text), digit: /\p{N}/u.test(text) };
};

/*
 * The emailed link is `<frontend>/reset-password?token=…&identifier=…` (ResetPasswordNotification, `http_build_query`).
 * An address cannot contain a space, so a space in `identifier` is a "+" that reached us unencoded (query parsing turns
 * "+" into a space), as the full version's page also assumes. Returns null when either part is missing or not shaped
 * like the real thing, so a mangled link is "incomplete" and nothing is sent. The token is never validated further:
 * only the backend can say whether it is the right one.
 */
export function readResetLink(search) {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  const token = params.get("token") ?? "";
  const identifier = (params.get("identifier") ?? "").replaceAll(" ", "+");
  if (!/^[A-Za-z0-9._~-]{16,256}$/.test(token) || emailError(identifier)) return null;
  return { token, identifier };
}

/** Seconds to wait after a 429: the server's Retry-After (a number of seconds), else a minute; never 0, never more than an hour. */
export function retryAfterSeconds(error, fallback = 60) {
  const seconds = Number.parseInt(String(error?.retryAfter ?? ""), 10);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : fallback;
}

/*
 * What a failed request means for the person, from the error's code and nothing else (never the backend's text, which is
 * in one language and not meant for display):
 *   closed    the gate is closed: nothing was sent
 *   rate      429: too many requests, with a wait
 *   link      reset only: the link was refused (bad, used or expired token, or an address that is not the link's)
 *   password  reset only: the new password was refused
 *   invalid   the request was refused as malformed (422 without more to say)
 *   session   401: the signed-in session is gone (resend only)
 *   forbidden 403: the account may not do this
 *   unknown   the request may or may not have reached SmartSpend and may or may not have done its work (no answer, a
 *             timeout, a 5xx, an answer that could not be read): the person is told, and nothing is retried for them
 *   failed    any other refusal: it was not done
 */
export function failureKind(error) {
  switch (error?.code) {
    case "WRITE_CLOSED":
      return "closed";
    case "RATE_LIMITED":
      return "rate";
    case "VALIDATION_ERROR": {
      const fields = error.errors && typeof error.errors === "object" ? error.errors : {};
      if (fields.token || fields.identifier) return "link";
      if (fields.password || fields.password_confirmation) return "password";
      return "invalid";
    }
    case "UNAUTHENTICATED":
      return "session";
    case "FORBIDDEN":
      return "forbidden";
    case "NETWORK_ERROR":
    case "TIMEOUT":
    case "MALFORMED_RESPONSE":
    case "SERVER_ERROR":
    case "WORKSPACE_UNAVAILABLE":
      return "unknown";
    default:
      // No code at all is a bug on our side or a transport we do not know: the outcome is not known either.
      return error?.code ? "failed" : "unknown";
  }
}
