import { isCurrencyCode } from "../money/decimal.js";
import { amountIn, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * The answers to the account writes (AccountController; identical on develop @ fd87531 and fix/financial-idempotency-p0 @
 * 6b696d72 apart from the create's unique-name translation):
 *
 *   POST  /accounts               201 data.account: id, workspace_id, name, type, currency_code, opening_balance,
 *                                 current_balance, allow_negative_balance, color, icon, status, created_at
 *   PATCH /accounts/{id}          200 data.account: the same fields (no created_at), updated_at
 *   POST  /accounts/{id}/archive  200 data.account: id, name, type, currency_code, opening_balance, current_balance (the
 *                                 closing balance), status "archived", archived_at
 *
 * Each result is shown only when the answer is provably what was asked for: the account's own id (for a change), and the
 * values that were sent (a created account's name, type, currency, opening balance and negative-balance setting; the
 * fields an edit changed; the status an archive sets). Anything else returns null and the screen says only that SmartSpend
 * confirmed it, with no figures. Every figure is the server's (current_balance is BalanceService's); nothing is computed here.
 *
 * There is no restore and no "make default" endpoint on either ref (routes/api.php: only store, update, archive and the
 * DELETE alias of archive), so there is no result for those.
 */

const trim = (value) => (typeof value === "string" ? value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : null);
const sameAmount = (a, b) => typeof a === "string" && typeof b === "string" && trim(a) === trim(b);

function describe(raw, kind) {
  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  return {
    kind,
    id: idText(raw.id),
    name: textOrNull(raw.name, 150),
    type: typeof raw.type === "string" && /^[a-z_]{1,30}$/.test(raw.type) ? raw.type : null,
    currency,
    openingBalance: amountIn(raw.opening_balance, currency),
    balance: amountIn(raw.current_balance, currency),
    allowsNegative: flagOrNull(raw.allow_negative_balance),
    status: raw.status === "active" || raw.status === "archived" ? raw.status : null,
    archivedAt: typeof raw.archived_at === "string" && raw.archived_at ? raw.archived_at : null,
  };
}

/** @param {Record<string, unknown>} input what was sent (forms/writePayloads.js) */
export function buildAccountCreated(data, input) {
  const raw = isRecord(data) ? data.account : null;
  if (!isRecord(raw) || !isRecord(input)) return null;

  const account = describe(raw, "created");
  if (!account.id || account.status !== "active") return null;
  if (account.name !== String(input.name).trim() || account.type !== input.type || account.currency !== input.currency_code) return null;
  if (!sameAmount(account.openingBalance, input.opening_balance)) return null;
  if (account.allowsNegative !== (input.allow_negative_balance === true)) return null;

  return account;
}

/**
 * @param {Record<string, unknown>} input only the fields that changed
 * @param {{ id: string }} record the account as read before
 */
export function buildAccountUpdated(data, input, record) {
  const raw = isRecord(data) ? data.account : null;
  if (!isRecord(raw) || !isRecord(input) || !isRecord(record)) return null;

  const account = describe(raw, "updated");
  if (account.id !== String(record.id) || account.status !== "active") return null;
  if (Object.hasOwn(input, "name") && account.name !== String(input.name).trim()) return null;
  if (Object.hasOwn(input, "type") && account.type !== input.type) return null;
  if (Object.hasOwn(input, "opening_balance") && !sameAmount(account.openingBalance, input.opening_balance)) return null;
  if (Object.hasOwn(input, "allow_negative_balance") && account.allowsNegative !== input.allow_negative_balance) return null;

  return account;
}

export function buildAccountArchived(data, record) {
  const raw = isRecord(data) ? data.account : null;
  if (!isRecord(raw) || !isRecord(record)) return null;

  const account = describe(raw, "archived");
  if (account.id !== String(record.id) || account.status !== "archived") return null;

  return account;
}
