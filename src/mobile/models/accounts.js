import { isCurrencyCode } from "../money/decimal.js";
import { amountIn, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Accounts as Mobile shows them. Balances are the backend's `current_balance`
 * text, untouched, and only when the account has a valid currency; they are
 * never summed, converted or recomputed here.
 */

export const ACCOUNT_STATUSES = ["active", "archived"];

/** One account row (dashboard `accounts[]`, `GET /accounts`, or `GET /accounts/{id}`), or null when it is not an object. */
export function normalizeAccount(raw) {
  if (!isRecord(raw)) return null;

  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const status = ACCOUNT_STATUSES.includes(raw.status) ? raw.status : null;

  return {
    id: idText(raw.id),
    name: textOrNull(raw.name),
    type: typeof raw.type === "string" && raw.type ? raw.type : null,
    isGoal: Boolean(raw.savings_goal),
    currency,
    balance: amountIn(raw.current_balance, currency),
    status,
    archived: status === "archived" || (raw.archived_at != null && raw.archived_at !== ""),
  };
}

/**
 * `GET /accounts` as groups per currency, in the backend's order within each
 * group. The primary currency's group (when known) comes first; the others
 * keep the order in which their first account appears. A group has no total.
 *
 * @returns {{ count: number, groups: { currency: string | null, items: object[] }[] } | null} null when the response is not an accounts list
 */
export function buildAccountList(data, primaryCurrency = null) {
  if (!isRecord(data) || !Array.isArray(data.accounts)) return null;

  const items = [];
  for (const raw of data.accounts) {
    const account = normalizeAccount(raw);
    if (!account) return null;
    items.push(account);
  }

  const groups = [];
  for (const account of items) {
    let group = groups.find((candidate) => candidate.currency === account.currency);
    if (!group) {
      group = { currency: account.currency, items: [] };
      groups.push(group);
    }
    group.items.push(account);
  }

  const rank = (group) => (group.currency && group.currency === primaryCurrency ? 0 : group.currency ? 1 : 2);

  return { count: items.length, groups: groups.map((group, index) => ({ group, index })).sort((a, b) => rank(a.group) - rank(b.group) || a.index - b.index).map(({ group }) => group) };
}

/**
 * `GET /accounts/{id}`. The account must be the one that was asked for: a
 * response about another id is refused, so a figure is never shown under the
 * wrong account's name.
 */
export function buildAccountDetail(data, requestedId) {
  const raw = isRecord(data) ? data.account : null;
  const account = normalizeAccount(raw);

  if (!account || !account.id || account.id !== String(requestedId)) return null;

  return {
    ...account,
    workspaceId: idText(raw.workspace_id),
    openingBalance: amountIn(raw.opening_balance, account.currency),
    lowBalanceThreshold: amountIn(raw.low_balance_threshold, account.currency),
    allowsNegative: flagOrNull(raw.allow_negative_balance),
    isDefault: flagOrNull(raw.is_default),
    lastFour: typeof raw.last_four_digits === "string" && /^\d{4}$/.test(raw.last_four_digits) ? raw.last_four_digits : null,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
  };
}
