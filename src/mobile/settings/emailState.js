/*
 * What the app's EmailVerificationProvider (the single owner of GET /auth/email/status) says, as one word:
 * "verified", "unverified", "loading", "error", or "unknown" (outside the provider, or an answer without a yes or no).
 * Pure, so every state is tested without the provider. Nothing is guessed: no status is "unknown", never "verified".
 */
export function emailState(verification) {
  if (!verification) return "unknown";
  if (verification.loading) return "loading";
  if (verification.error) return "error";
  const verified = verification.status?.verified;
  return verified === true ? "verified" : verified === false ? "unverified" : "unknown";
}
