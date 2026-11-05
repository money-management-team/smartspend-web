/*
 * A trend bucket's label as the backend sent it ("2026-10" for a month, "2026-10-05" for a day) shown for people:
 * "Oct 26", "Oct 5". Latin digits like the amounts. Anything else (a week's label, an unknown shape) is shown as
 * sent: it is never reinterpreted.
 */
export function bucketLabel(label, locale = "en") {
  if (typeof label !== "string" || !label) return "";

  const month = /^(\d{4})-(\d{2})$/.exec(label);
  if (month) return render(Date.UTC(int(month[1]), int(month[2]) - 1, 1), locale, { month: "short", year: "2-digit" }) ?? label;

  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(label);
  if (dayMatch) return render(Date.UTC(int(dayMatch[1]), int(dayMatch[2]) - 1, int(dayMatch[3])), locale, { month: "short", day: "numeric" }) ?? label;

  return label;
}

const int = (text) => Number.parseInt(text, 10);

function render(time, locale, options) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { ...options, numberingSystem: "latn", timeZone: "UTC" }).format(date);
}
