/* Display helpers for the WhatsApp settings UI. Pure; no storage, no logging. */

/** "5678" → "••5678". Only digits the backend already masked; null when absent. */
export function maskedDigits(lastDigits) {
  return typeof lastDigits === "string" && /^\d{1,6}$/.test(lastDigits) ? `••${lastDigits}` : null;
}

export function formatLinkedDate(iso, language) {
  const date = new Date(iso);
  if (typeof iso !== "string" || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(date);
}
