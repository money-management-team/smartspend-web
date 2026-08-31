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

function moneyToMinorUnits(value, scale = 4) {
  const match = String(value ?? "0")
    .trim()
    .match(/^([+-]?)(\d+)(?:\.(\d+))?$/);

  if (!match) return 0n;

  const [, sign, integer, rawFraction = ""] = match;
  const fraction = rawFraction.slice(0, scale).padEnd(scale, "0");
  const units = BigInt(`${integer}${fraction}`);
  return sign === "-" ? -units : units;
}

function minorUnitsToMoney(units, scale = 4) {
  const sign = units < 0n ? "-" : "";
  const absolute = units < 0n ? -units : units;
  const value = absolute.toString().padStart(scale + 1, "0");

  return `${sign}${value.slice(0, -scale)}.${value.slice(-scale)}`;
}

export function sumMoney(values) {
  const total = values.reduce(
    (sum, value) => sum + moneyToMinorUnits(value),
    0n,
  );

  return minorUnitsToMoney(total);
}

export function subtractMoney(left, right) {
  return minorUnitsToMoney(
    moneyToMinorUnits(left) - moneyToMinorUnits(right),
  );
}

export function formatDate(value, locale, timeZone) {
  if (!value) return "—";

  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00Z`
    : value;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(dateValue));
}
