import { isCurrencyCode } from "../money/decimal.js";
import { amountIn, idText, isRecord, textOrNull } from "./values.js";

/*
 * The answer to POST /transactions/expense and POST /transactions/income (201, TransactionController::storeExpense /
 * storeIncome; the same on develop @ fd87531 and fix/financial-idempotency-p0 @ 6b696d72): data.transaction is
 * TransactionResource with `ledger_entries` (each with its `account`) and `category` loaded. A replay of the same
 * Idempotency-Key with the same request answers with the first transaction, in the same shape. The answer carries no
 * balance; the result card reads the account again from the server.
 *
 * Like models/transferResult.js, the result is shown only when the answer is provably the entry that was asked for: an
 * id, the type that was sent, the amount that was sent, and the account that was sent (a ledger leg on it). Anything
 * else returns null and the screen falls back to the generic "SmartSpend confirmed this" (it was a 2xx), never to
 * figures it could not check. Every figure is the server's; nothing is worked out here.
 */

const trimZeros = (value) => value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
const sameAmount = (a, b) => typeof a === "string" && typeof b === "string" && trimZeros(a) === trimZeros(b);

/**
 * @param {unknown} data the response's `data`
 * @param {Record<string, unknown>} input what was sent (forms/writePayloads.js)
 * @param {"expense" | "income"} type
 */
export function buildTransactionResult(data, input, type) {
  const raw = isRecord(data) ? data.transaction : null;
  if (!isRecord(raw) || !isRecord(input)) return null;

  const id = idText(raw.id);
  if (!id || raw.type !== type) return null;

  const legs = Array.isArray(raw.ledger_entries) ? raw.ledger_entries.filter(isRecord) : [];
  const leg = legs.find((entry) => idText(entry.account_id ?? entry.account?.id) === String(input.account_id));
  if (!leg) return null;

  const account = isRecord(leg.account) ? leg.account : {};
  const currency = [raw.currency_code, leg.currency_code, account.currency_code].find((value) => isCurrencyCode(value)) ?? null;
  const amount = amountIn(raw.amount, currency);
  if (!amount || !sameAmount(amount, input.amount)) return null;

  // A category that was sent must be the one recorded (null: cleared); an income may have none.
  const categoryId = idText(raw.category_id ?? raw.category?.id);
  const wantedCategory = input.category_id === undefined ? undefined : input.category_id === null ? null : String(input.category_id);
  if (wantedCategory !== undefined && categoryId !== wantedCategory) return null;

  return {
    id,
    type,
    status: typeof raw.status === "string" && raw.status ? raw.status : null,
    currency,
    amount,
    account: { id: String(input.account_id), name: textOrNull(account.name, 150) },
    category: categoryId ? { id: categoryId, name: textOrNull(raw.category?.name, 150) } : null,
    occurredAt: typeof raw.occurred_at === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw.occurred_at) ? raw.occurred_at.slice(0, 10) : null,
    postedAt: typeof raw.posted_at === "string" && raw.posted_at ? raw.posted_at : null,
    description: textOrNull(raw.description, 500),
    reference: textOrNull(raw.reference_number, 120),
  };
}

/*
 * The answer to PATCH /transactions/{id} (200, UpdateTransactionAction; develop @ fd87531 and 6b696d72): a correction
 * reverses the original and posts a NEW replacement, and data.transaction is that replacement (a new id, the same
 * type, related_transaction_id = the original's id). It is shown only when it provably is the replacement of the
 * transaction the form was about, with what the correction asked for: the fields that changed as sent, the others as
 * they were. Otherwise null, and the screen says only that SmartSpend confirmed it.
 *
 * @param {Record<string, unknown>} input what was sent: the reason and only the changed fields (forms/writePayloads.js)
 * @param {{ id: string, type: string, currency: string | null, amount: string, accountId: string, categoryId: string }} record the transaction as read before
 */
export function buildCorrectionResult(data, input, record) {
  if (!isRecord(input) || !isRecord(record) || !["income", "expense"].includes(record.type)) return null;

  const expected = {
    account_id: input.account_id ?? record.accountId,
    amount: input.amount ?? record.amount,
    ...(input.category_id !== undefined ? { category_id: input.category_id } : record.categoryId ? { category_id: record.categoryId } : {}),
  };
  const result = buildTransactionResult(data, expected, record.type);
  if (!result) return null;

  const raw = data.transaction;
  if (result.id === String(record.id) || idText(raw.related_transaction_id) !== String(record.id)) return null;
  if (record.currency && result.currency !== record.currency) return null;

  return { ...result, replaces: String(record.id) };
}

/*
 * The answer to POST /transactions/{id}/reverse (200, TransactionController::reverse; identical on both refs):
 * data.original_transaction is the original, now `reversed`, and data.reversals are the reversal transactions (type
 * `reversal`, reversal_of_id = the original's id, with their ledger entries and accounts). Shown only when that is
 * provably the transaction the form was about: the original's id and status, one reversal of it, and its amount.
 */
export function buildReversalResult(data, record) {
  const original = isRecord(data) ? data.original_transaction : null;
  if (!isRecord(original) || !isRecord(record) || idText(original.id) !== String(record.id) || original.status !== "reversed") return null;

  const reversals = (Array.isArray(data.reversals) ? data.reversals : []).filter((item) => isRecord(item) && item.type === "reversal" && idText(item.reversal_of_id) === String(record.id) && idText(item.id));
  if (reversals.length === 0) return null;

  const currency = [original.currency_code, reversals[0].currency_code, record.currency].find((value) => isCurrencyCode(value)) ?? null;
  const amount = amountIn(original.amount, currency);
  if (!amount || !sameAmount(amount, record.amount)) return null;

  const accounts = [];
  for (const entry of reversals.flatMap((item) => (Array.isArray(item.ledger_entries) ? item.ledger_entries : [])).filter(isRecord)) {
    const id = idText(entry.account_id ?? entry.account?.id);
    if (id && !accounts.some((account) => account.id === id)) accounts.push({ id, name: textOrNull(entry.account?.name, 150) });
  }

  return {
    id: String(record.id),
    currency,
    amount,
    type: typeof original.type === "string" ? original.type : record.type,
    status: "reversed",
    reversalIds: reversals.map((item) => idText(item.id)),
    reversedAt: typeof original.reversed_at === "string" && original.reversed_at ? original.reversed_at : null,
    reason: textOrNull(original.reversal_reason, 500),
    accounts,
  };
}
