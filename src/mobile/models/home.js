import { isCurrencyCode } from "../money/decimal.js";
import { normalizeAccount } from "./accounts.js";
import { amountIn, amountOrNull, countOrNull, dateOnlyOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * `GET /dashboard` and `GET /financial-alerts` as the Home screen needs them.
 *
 * Each section is read on its own and ends up in one of these states, so one
 * bad part of a response does not take the others down and none of them is
 * ever filled in with a made-up value:
 *
 *   ready        the data is there and consistent
 *   empty        the backend says there is nothing (e.g. no accounts yet)
 *   unavailable  the data is missing, malformed, or contradicts itself
 *
 * Money rules: amounts stay as the backend's decimal text; currencies are never
 * added together (the per-currency rows of `summary_by_currency` are the only
 * source of balances); `totals` is used only when the backend says the user has
 * a single currency.
 */

const UNAVAILABLE = Object.freeze({ state: "unavailable", rows: [], items: [] });
const EMPTY = Object.freeze({ state: "empty", rows: [], items: [] });

function currencyRow(row) {
  return {
    currency: row.currency_code,
    balance: amountOrNull(row.current_balance),
    income: amountOrNull(row.income),
    expense: amountOrNull(row.expense),
    net: amountOrNull(row.net),
    accountsCount: countOrNull(row.accounts_count),
  };
}

function buildBalances(data) {
  const scope = isRecord(data.scope) ? data.scope : {};
  const totals = isRecord(data.totals) ? data.totals : null;
  const multi = flagOrNull(scope.is_multi_currency);
  const primary = isCurrencyCode(scope.primary_currency_code) ? scope.primary_currency_code : null;
  const summary = data.summary_by_currency;

  if (Array.isArray(summary) && summary.length > 0) {
    const seen = new Set();
    const rows = [];

    for (const raw of summary) {
      // A row that cannot be placed under a currency, or a currency listed twice,
      // means the grouping cannot be trusted: say nothing rather than skip one.
      if (!isRecord(raw) || !isCurrencyCode(raw.currency_code) || seen.has(raw.currency_code)) return UNAVAILABLE;
      seen.add(raw.currency_code);
      rows.push(currencyRow(raw));
    }

    // The scope and the rows must agree about whether there is more than one currency.
    if (multi === false && rows.length > 1) return UNAVAILABLE;
    if (multi === true && rows.length < 2) return UNAVAILABLE;
    if (rows.length === 1 && isCurrencyCode(totals?.currency_code) && totals.currency_code !== rows[0].currency) return UNAVAILABLE;

    const ordered = [...rows.filter((row) => row.currency === primary), ...rows.filter((row) => row.currency !== primary)];

    return { state: "ready", rows: ordered, items: [], multi: rows.length > 1, primary };
  }

  if (Array.isArray(summary)) {
    const accounts = Array.isArray(data.accounts) ? data.accounts.length : null;

    return accounts === 0 || countOrNull(totals?.accounts_count) === 0 ? EMPTY : UNAVAILABLE;
  }

  // No per-currency rows: the totals stand in for them only when the backend
  // says this is a single-currency user, and only in their own currency.
  if (multi === false && totals && isCurrencyCode(totals.currency_code)) {
    return { state: "ready", rows: [currencyRow({ ...totals, currency_code: totals.currency_code })], items: [], multi: false, primary };
  }

  return UNAVAILABLE;
}

function buildPeriod(data) {
  const period = isRecord(data.period) ? data.period : {};

  return { preset: textOrNull(period.preset, 20), from: dateOnlyOrNull(period.date_from), to: dateOnlyOrNull(period.date_to), timezone: textOrNull(period.timezone, 64) };
}

function buildAccounts(data) {
  if (!Array.isArray(data.accounts)) return UNAVAILABLE;
  if (data.accounts.length === 0) return EMPTY;

  const items = [];
  for (const raw of data.accounts) {
    const account = normalizeAccount(raw);
    if (!account) return UNAVAILABLE;
    items.push(account);
  }

  return { state: "ready", rows: [], items };
}

// Income adds, expense and fees take away, everything else is neutral. This is
// only the sign shown in front of the backend's amount, not arithmetic.
export function signedAmount(type, amount) {
  if (amount == null) return null;
  if (type === "expense" || type === "fee") return amount.startsWith("-") ? amount : `-${amount}`;
  return amount;
}

function buildRecent(data) {
  if (!Array.isArray(data.recent_transactions)) return UNAVAILABLE;
  if (data.recent_transactions.length === 0) return EMPTY;

  const items = [];
  for (const raw of data.recent_transactions.slice(0, 5)) {
    if (!isRecord(raw)) return UNAVAILABLE;

    const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
    const type = typeof raw.type === "string" ? raw.type : null;

    items.push({
      id: idText(raw.id),
      type,
      title: textOrNull(raw.description) ?? textOrNull(raw.category?.name),
      occurredAt: typeof raw.occurred_at === "string" ? raw.occurred_at : null,
      currency,
      amount: signedAmount(type, amountIn(raw.amount, currency)),
      reversed: raw.status === "reversed",
    });
  }

  return { state: "ready", rows: [], items };
}

/** @returns {object | null} null when the response is not an object at all */
export function buildHomeModel(data) {
  if (!isRecord(data)) return null;

  return {
    period: buildPeriod(data),
    balances: buildBalances(data),
    accounts: buildAccounts(data),
    recent: buildRecent(data),
  };
}

const SEVERITIES = ["critical", "warning", "info"];

/**
 * `GET /financial-alerts`: how many alerts there are and the first few. An
 * unknown severity is shown as info; a response without an `alerts` array is
 * not a list of alerts at all.
 *
 * @returns {{ count: number, items: { severity: string, message: string }[] } | null}
 */
export function buildAlertsModel(data) {
  if (!isRecord(data) || !Array.isArray(data.alerts)) return null;

  const items = data.alerts
    .filter(isRecord)
    .map((alert) => ({ severity: SEVERITIES.includes(alert.severity) ? alert.severity : "info", message: textOrNull(alert.message, 240) }))
    .filter((alert) => alert.message);

  return { count: items.length, items: items.slice(0, 3) };
}
