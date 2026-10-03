import { movementUnits } from "../accountMovementHelpers.js";

export function formatStatementPdfMoney(value, currency, signed = false) {
  const units = movementUnits(value),
    absolute = units < 0n ? -units : units;
  const integer = (absolute / 10000n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = String(absolute % 10000n)
    .padStart(4, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return `${units < 0n ? "-" : signed && units > 0n ? "+" : ""}${integer}.${fraction} ${currency}`;
}

const utcText = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? `${new Date(timestamp).toISOString().replace("T", " ").slice(0, 19)} UTC`
    : "—";
};
export function buildStatementPdfModel({
  statement,
  t,
  typeLabel,
  language,
  generatedAt = new Date(),
}) {
  const currency = statement.account.currency_code;
  return {
    title: t("statement"),
    account: statement.account.name,
    currency,
    rtl: language.startsWith("ar"),
    period: `${statement.dates.from} - ${statement.dates.to}`,
    note: t("statementNote"),
    empty: t("empty"),
    labels: t("statementColumns", { returnObjects: true }),
    generatedLabel: t("generated"),
    generatedDate: utcText(generatedAt.toISOString()),
    totals: ["incoming", "outgoing", "net"].map((key) => ({
      label: t(`statementColumns.${key}`),
      value: formatStatementPdfMoney(
        statement.totals[key],
        currency,
        key === "net",
      ),
    })),
    rows: statement.rows.map((row) => ({
      id: String(row.transaction.id),
      date: utcText(row.transaction.occurred_at),
      description: row.transaction.description ?? "—",
      type: typeLabel(row),
      status: t(row.transaction.status),
      net: formatStatementPdfMoney(row.amount, currency, true),
    })),
  };
}
