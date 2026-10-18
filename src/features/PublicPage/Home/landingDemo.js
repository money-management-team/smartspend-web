/*
 * The landing page's illustrative figures and the arithmetic behind its demos.
 * Marketing only: nothing here reads or writes real balances, ledgers or the API.
 * Every figure stays in page state and resets on reload.
 */

export const DEMO = {
  balance: 12450,
  income: 6200,
  initialExpenses: 3750,
  budget: 5300,
  goalSaved: 3200,
  goalTarget: 8000,
};

/** Demo categories, in display order. Labels live in the landing translations. */
export const CATEGORIES = ["food", "transport", "subscriptions", "bills"];

export const initialBudgets = [
  { category: "food", spent: 1450, limit: 2000 },
  { category: "transport", spent: 720, limit: 1000 },
  { category: "subscriptions", spent: 180, limit: 300 },
  { category: "bills", spent: 1400, limit: 2000 },
];

/** Week by week spending of the demo month; the last week grows with added expenses. */
export const WEEKLY_SPENDING = [820, 940, 870, 1120];

export function demoTotals(entries) {
  const added = Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  return {
    balance: DEMO.balance - added,
    income: DEMO.income,
    expenses: DEMO.initialExpenses + added,
    net: DEMO.income - DEMO.initialExpenses - added,
    budgets: initialBudgets.map((budget) => ({
      ...budget,
      spent: budget.spent + entries.filter((entry) => entry.category === budget.category).reduce((sum, entry) => sum + entry.amount, 0),
    })),
  };
}

/** A demo amount from Latin, Arabic-Indic or Persian digits; null unless 0 < amount ≤ 100,000 with ≤ 2 decimals. */
export function parseAmount(input) {
  const value = input.trim().replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/٫/g, ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 100000 ? amount : null;
}

/** Amounts are always shown with Latin digits and US grouping, matching the product. */
export const money = (value) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  maximumFractionDigits: 2,
}).format(value);

export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Wraps a figure such as "$1,450" or "39%" in a left-to-right isolate, so Arabic sentences keep it intact. */
export const ltr = (value) => `⁦${value}⁩`;

/** "October 2027" or "أكتوبر 2027", counted from the demo period (October 2026). */
export function monthAfter(months, lang) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en-US", { month: "long", year: "numeric" })
    .format(new Date(2026, 9 + months, 1));
}

/** Arabic counted-noun agreement for months. */
export function arabicMonths(count) {
  if (count === 1) return "شهر واحد";
  if (count === 2) return "شهرين";
  if (count <= 10) return `${count} أشهر`;
  return `${count} شهرًا`;
}

/** Months to reach the demo goal when saving `monthly` each month. */
export const monthsToGoal = (monthly) => Math.ceil((DEMO.goalTarget - DEMO.goalSaved) / monthly);
