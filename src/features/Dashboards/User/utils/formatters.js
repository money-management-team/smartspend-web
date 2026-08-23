export function formatMoney(amount, currency = "ILS", locale = "en-US") {
  const value = Number(amount) || 0;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString(locale)} ${currency}`;
  }
}

export function formatDate(value, locale) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
