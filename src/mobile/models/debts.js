import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
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
 * - GET /debts/{id}/payments: a paginator at data.payments, newest first. A
 *   reversed payment stays in the list with status "reversed", and says when
 *   and by which transaction it was reversed.
 * - GET /debts/summary (workspace_id): data.summary.by_currency, one bucket per
 *   currency with a payable and a receivable side and a net_position. Open
 *   debts only (active and partly paid); currencies are never added together,
 *   and every figure is the backend's.
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
    owner: textOrNull(isRecord(raw.owner) ? raw.owner.name : null, 80),
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
    // A moment (the backend's timestamp), kept whole so the day is shown in the person's own time zone.
    reversedAt: typeof raw.reversed_at === "string" && raw.reversed_at ? raw.reversed_at : null,
    account,
    transactionId: idText(raw.transaction_id),
    reversalTransactionId: idText(raw.reversal_transaction_id),
    notes: textOrNull(raw.notes, 1000),
  };
}

export const buildPaymentsPage = (response, expected, debtId, currency) => buildPlanningPage(response, expected, "payments", (raw) => normalizePayment(raw, debtId, currency));

/* ---------- The summary ---------- */

const invalidSummary = () => Object.assign(new Error("Debt summary could not be validated."), { code: "MALFORMED_RESPONSE" });

function readSide(raw, currency) {
  if (!isRecord(raw)) throw invalidSummary();

  const side = {
    original: amountIn(raw.original_amount, currency),
    paid: amountIn(raw.paid_amount, currency),
    remaining: amountIn(raw.remaining_amount, currency),
    count: countOrNull(raw.debts_count),
    overdue: countOrNull(raw.overdue_count),
  };
  // A side whose figures are not valid decimals would show "—" under a heading that promises a total: refuse it whole.
  if (side.original === null || side.paid === null || side.remaining === null) throw invalidSummary();

  return side;
}

/**
 * GET /debts/summary's `data`: one entry per currency, as the backend grouped them.
 *
 * Refused whole when a bucket has no valid currency, a currency appears twice, a
 * side is missing or carries an amount that is not a decimal, or the net position
 * is not one. Nothing is added, subtracted or converted here: the net position,
 * the open-debt count and the overdue count are the backend's own.
 *
 * @returns {Array<{ currency: string, payable: object, receivable: object, net: string, netSign: "positive" | "negative" | "zero", openCount: number | null, overdueCount: number | null }>}
 */
export function buildDebtSummary(data) {
  const rows = isRecord(data) && isRecord(data.summary) ? data.summary.by_currency : null;
  if (!Array.isArray(rows) || rows.length > 40) throw invalidSummary();

  const seen = new Set();

  return rows.map((raw) => {
    if (!isRecord(raw) || !isCurrencyCode(raw.currency_code) || seen.has(raw.currency_code)) throw invalidSummary();
    seen.add(raw.currency_code);

    const currency = raw.currency_code;
    const net = amountIn(raw.net_position, currency);
    if (net === null) throw invalidSummary();

    const parsed = parseDecimal(net);
    const zero = /^0$/.test(parsed.integer) && /^0*$/.test(parsed.fraction);

    return {
      currency,
      payable: readSide(raw.payable, currency),
      receivable: readSide(raw.receivable, currency),
      net,
      netSign: zero ? "zero" : parsed.negative ? "negative" : "positive",
      openCount: countOrNull(raw.active_debts_count),
      overdueCount: countOrNull(raw.overdue_debts_count),
    };
  });
}
