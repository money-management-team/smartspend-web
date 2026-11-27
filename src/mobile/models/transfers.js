import { isCurrencyCode } from "../money/decimal.js";
import { buildPlanningPage, readState } from "./planning.js";
import { amountIn, amountOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Transfers between the person's own accounts, read-only (docs/transfers/api.md).
 *
 * - GET /transfers takes status (pending | posted | reversed | failed; the
 *   backend's input alias "confirmed" is never sent or shown), per_page and page,
 *   and has NO workspace filter. Paginator at data.transfers, newest first.
 * - A transfer has amount and fee_amount (4-decimal strings) in currency_code,
 *   from_account / to_account, fee_category, and on its own page transactions[]
 *   (the transfer, a fee, reversals), each with ledger_entries[]. Mobile looks
 *   transactions up by type and never assumes there is exactly one.
 * - Nothing is computed: the total moved, the fee and the status are the backend's.
 */

export const TRANSFER_STATUSES = ["pending", "posted", "reversed", "failed"];

/* ---------- Filters ---------- */

export function readTransferFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  let status = params.get("status") ?? "";
  // An old link with the input alias is the stored status.
  if (status === "confirmed") status = "posted";

  return { status: TRANSFER_STATUSES.includes(status) ? status : "" };
}

export function transferFiltersToSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  return params;
}

export const transferFilterSignature = (filters) => transferFiltersToSearchParams(filters).toString() || "default";

export const hasActiveTransferFilters = (filters) => Boolean(filters.status);

// No workspace_id: the endpoint does not document one, so none is invented.
export const transferFiltersToQuery = (filters, page, perPage) => ({ status: filters.status || undefined, per_page: perPage, page });

/* ---------- One transfer ---------- */

const accountOf = (raw, id) => {
  const accountId = idText(isRecord(raw) ? raw.id : id) ?? idText(id);
  if (!accountId) return null;
  return { id: accountId, name: isRecord(raw) ? textOrNull(raw.name) : null };
};

function normalizeLedger(raw) {
  if (!isRecord(raw)) return null;
  const accountId = idText(raw.account_id);
  const amount = amountOrNull(raw.signed_amount);
  if (!accountId || !amount) return null;
  return { accountId, amount, role: textOrNull(raw.entry_role, 40) };
}

function normalizeTransaction(raw) {
  if (!isRecord(raw)) return null;
  const id = idText(raw.id);
  if (!id) return null;
  return {
    id,
    type: textOrNull(raw.type, 40),
    subtype: textOrNull(raw.subtype, 40),
    status: textOrNull(raw.status, 40),
    entries: Array.isArray(raw.ledger_entries) ? raw.ledger_entries.map(normalizeLedger).filter(Boolean) : [],
  };
}

export function normalizeTransfer(raw) {
  if (!isRecord(raw)) return null;
  const id = idText(raw.id);
  if (!id) return null;

  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const state = readState(raw.status === "confirmed" ? "posted" : raw.status, TRANSFER_STATUSES);
  const fee = amountIn(raw.fee_amount, currency);
  const transactions = Array.isArray(raw.transactions) ? raw.transactions.map(normalizeTransaction).filter(Boolean) : [];
  const transferTx = transactions.find((item) => item.type === "transfer");

  return {
    id,
    amount: amountIn(raw.amount, currency),
    fee,
    // A fee is shown only when the backend sent a non-zero one.
    hasFee: fee !== null && !/^-?0+(\.0+)?$/.test(fee),
    currency,
    status: state.word,
    statusKnown: state.known,
    occurredAt: typeof raw.occurred_at === "string" ? raw.occurred_at : null,
    postedAt: typeof raw.posted_at === "string" ? raw.posted_at : null,
    from: accountOf(raw.from_account, raw.from_account_id),
    to: accountOf(raw.to_account, raw.to_account_id),
    feeCategory: isRecord(raw.fee_category) ? textOrNull(raw.fee_category.name) : null,
    description: textOrNull(raw.description, 500) ?? textOrNull(raw.metadata?.description, 500),
    reference: textOrNull(raw.reference_number, 100),
    transactions,
    transferTransactionId: transferTx?.id ?? null,
  };
}

export const buildTransfersPage = (response, expected) => buildPlanningPage(response, expected, "transfers", normalizeTransfer);

export function buildTransferDetail(data, expectedId) {
  const transfer = normalizeTransfer(data?.transfer);
  return transfer && transfer.id === String(expectedId) ? transfer : null;
}
