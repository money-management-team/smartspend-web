import { isCurrencyCode } from "../money/decimal.js";
import { buildPlanningPage, readState } from "./planning.js";
import { amountIn, countOrNull, dateOnlyOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Debts as Mobile shows them: the list's filters, a page of the list, one debt
 * and a page of its payments. Read-only.
 *
 * The contract (docs/debts/api.md, business-rules.md):
 * - GET /debts takes workspace_id, direction (payable | receivable), status
 *   (active | partially_paid | paid | archived, or the derived "overdue"),
 *   per_page and page, and answers with a paginator at data.debts.
 * - A debt carries original_amount, paid_amount and remaining_amount as
 *   4-decimal strings in its currency_code, the lifecycle `status` and the
 *   `effective_status` to show (the lifecycle, or "overdue"), is_overdue,
 *   days_until_due and payments_count. All of them are the backend's: Mobile
 *   never subtracts paid from original, and never decides a debt is overdue
 *   or settled from the dates.
 * - GET /debts/{id}/payments: a paginator at data.payments. A reversed payment
 *   stays in the list with status "reversed".
 */

export const DEBT_DIRECTIONS = ["payable", "receivable"];
export const DEBT_FILTER_STATUSES = ["active", "partially_paid", "paid", "archived", "overdue"];
const DEBT_STATES = ["active", "partially_paid", "paid", "archived", "overdue"];
const PAYMENT_STATES = ["posted", "reversed"];

/* ---------- Filters ---------- */

export function readDebtFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const direction = params.get("direction") ?? "";
  const status = params.get("status") ?? "";

  return { direction: DEBT_DIRECTIONS.includes(direction) ? direction : "", status: DEBT_FILTER_STATUSES.includes(status) ? status : "" };
}

export function debtFiltersToSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.status) params.set("status", filters.status);
  return params;
}

export const debtFilterSignature = (filters) => debtFiltersToSearchParams(filters).toString() || "default";

export const hasActiveDebtFilters = (filters) => Boolean(filters.direction || filters.status);

export function debtFiltersToQuery(filters, page, perPage, workspaceId) {
  return { workspace_id: workspaceId, direction: filters.direction || undefined, status: filters.status || undefined, per_page: perPage, page };
}

/* ---------- One debt ---------- */

export function normalizeDebt(raw) {
  if (!isRecord(raw)) return null;
  const id = idText(raw.id);
  if (!id) return null;

  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const direction = DEBT_DIRECTIONS.includes(raw.direction) ? raw.direction : null;
  const lifecycle = readState(raw.status, DEBT_STATES);
  // What to show is the backend's effective status; without it, an explicit is_overdue still shows as overdue.
  const shown = raw.effective_status != null ? readState(raw.effective_status, DEBT_STATES) : flagOrNull(raw.is_overdue) === true ? readState("overdue", DEBT_STATES) : lifecycle;

  return {
    id,
    counterparty: textOrNull(raw.counterparty_name, 150),
    direction,
    currency,
    original: amountIn(raw.original_amount, currency),
    paid: amountIn(raw.paid_amount, currency),
    remaining: amountIn(raw.remaining_amount, currency),
    status: shown.word,
    statusKnown: shown.known,
    lifecycle: lifecycle.word,
    lifecycleKnown: lifecycle.known,
    overdue: flagOrNull(raw.is_overdue),
    daysUntilDue: Number.isSafeInteger(raw.days_until_due) ? raw.days_until_due : null,
    issuedAt: dateOnlyOrNull(raw.issued_at),
    dueDate: dateOnlyOrNull(raw.due_date),
    settledAt: dateOnlyOrNull(raw.settled_at),
    archivedAt: dateOnlyOrNull(raw.archived_at),
    paymentsCount: countOrNull(raw.payments_count),
    hasMovement: flagOrNull(raw.has_movement),
    openingTransactionId: idText(raw.opening_transaction_id),
    notes: textOrNull(raw.notes, 1000),
  };
}

export const buildDebtsPage = (response, expected) => buildPlanningPage(response, expected, "debts", normalizeDebt);

/** The debt in a GET /debts/{id} answer, only if it is the one asked for. */
export function buildDebtDetail(data, expectedId) {
  const debt = normalizeDebt(data?.debt);
  return debt && debt.id === String(expectedId) ? debt : null;
}

/* ---------- Its payments ---------- */

export function normalizePayment(raw, debtId, currency) {
  if (!isRecord(raw)) return null;
  const id = idText(raw.id);
  if (!id) return null;
  if (raw.debt_id != null && idText(raw.debt_id) !== debtId) return null;
  // A payment in another currency than its debt is not one Mobile can show next to it.
  if (raw.currency_code != null && raw.currency_code !== currency) return null;

  const state = readState(raw.status, PAYMENT_STATES);
  const account = isRecord(raw.account) ? { id: idText(raw.account.id), name: textOrNull(raw.account.name) } : null;

  return {
    id,
    amount: amountIn(raw.amount, currency),
    currency,
    paidAt: dateOnlyOrNull(raw.paid_at),
    status: state.word,
    statusKnown: state.known,
    reversed: flagOrNull(raw.is_reversed) === true || state.word === "reversed",
    reversedAt: dateOnlyOrNull(raw.reversed_at),
    account,
    transactionId: idText(raw.transaction_id),
    notes: textOrNull(raw.notes, 1000),
  };
}

export const buildPaymentsPage = (response, expected, debtId, currency) => buildPlanningPage(response, expected, "payments", (raw) => normalizePayment(raw, debtId, currency));
