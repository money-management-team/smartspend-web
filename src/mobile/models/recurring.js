import { isCurrencyCode } from "../money/decimal.js";
import { OCCURRENCES_PER_PAGE, OCCURRENCE_STATUSES } from "./occurrenceTabs.js";
import { buildPlanningPage, readState } from "./planning.js";
import { amountIn, countOrNull, dateOnlyOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Recurring rules as Mobile Planning shows them: the list's filters, a page of
 * the list, one rule.
 *
 * A recurring transaction is a RULE, not money (docs/recurring-transactions/
 * business-rules.md): it describes something that will be posted on a
 * schedule, and money moves only when an occurrence is posted. So a rule is
 * never shown as a transaction: no posted-looking row, no balance effect, no
 * "paid". Its amount is the amount it would post, unsigned, with its type
 * (income or expense) as a word next to it.
 *
 * The date of the next occurrence is the backend's `next_due_date`. Mobile
 * does not work out dates from the frequency and the start date (month ends,
 * anchor days and the end of a rule are rules of their own), and does not say
 * a rule is overdue: that is the backend's `is_overdue` on an occurrence, as
 * carried by `schedule.next_occurrence` (a rule's own next open occurrence,
 * sent with every rule) and by the rows of its occurrence history.
 *
 * - GET /recurring-transactions takes status (active | paused | completed |
 *   archived), type (income | expense), per_page and page, and answers with a
 *   Laravel paginator at data.recurring_transactions.
 * - GET /recurring-transactions/{id} answers with data.recurring_transaction
 *   and, for the schedule, data.recurring_transaction.schedule
 *   ({ next_occurrence, open_occurrences_count }).
 * - GET /recurring-transactions/{id}/occurrences takes occurrence_status and
 *   per_page / page, and answers with a paginator at data.occurrences, newest
 *   due date first. An occurrence has its own status, amount and currency; only
 *   a "posted" one has a transaction.
 */

export const RULE_STATUSES = ["active", "paused", "completed", "archived"];
export const RULE_TYPES = ["income", "expense"];
export const RULE_FREQUENCIES = ["weekly", "monthly", "yearly"];
export const RULE_MODES = ["manual", "automatic"];
export const DEFAULT_RULE_STATUS = "active";

/* ---------- Filters ---------- */

export function readRuleFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const status = params.get("status") ?? "";
  const type = params.get("type") ?? "";

  return { status: RULE_STATUSES.includes(status) ? status : DEFAULT_RULE_STATUS, type: RULE_TYPES.includes(type) ? type : "" };
}

export function ruleFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== DEFAULT_RULE_STATUS) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);

  return params;
}

export const ruleFilterSignature = (filters) => ruleFiltersToSearchParams(filters).toString() || "default";

export const hasActiveRuleFilters = (filters) => filters.status !== DEFAULT_RULE_STATUS || Boolean(filters.type);

export function ruleFiltersToQuery(filters, page, perPage, workspaceId) {
  return { workspace_id: workspaceId, status: filters.status, type: filters.type || undefined, per_page: perPage, page };
}

/* ---------- One rule ---------- */

/**
 * One occurrence of `rule` ({ id, currency }), or null when it is not usable: no id, another rule's, a different
 * currency than the rule's, or an amount that is not a decimal. The amount is the occurrence's own (a rule's amount
 * can change after an occurrence was made), shown in the rule's currency.
 */
export function normalizeOccurrence(raw, rule) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  if (!id) return null;
  if (raw.recurring_transaction_id != null && idText(raw.recurring_transaction_id) !== rule.id) return null;
  if (raw.currency_code != null && raw.currency_code !== rule.currency) return null;

  const status = readState(raw.status, OCCURRENCE_STATUSES);

  return {
    id,
    dueDate: dateOnlyOrNull(raw.due_date),
    status: status.word,
    statusKnown: status.known,
    open: flagOrNull(raw.is_open),
    overdue: flagOrNull(raw.is_overdue) === true,
    amount: amountIn(raw.amount, rule.currency),
    currency: rule.currency,
    transactionId: idText(raw.transaction_id),
    attempts: countOrNull(raw.attempts),
    failureReason: textOrNull(raw.failure_reason, 500),
    processedAt: typeof raw.processed_at === "string" && raw.processed_at ? raw.processed_at : null,
  };
}

/** One rule, or null when it is not an object with a usable id. */
export function normalizeRule(raw) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  if (!id) return null;

  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const status = readState(raw.status ?? (raw.archived_at ? "archived" : null), RULE_STATUSES);
  const type = readState(raw.type, RULE_TYPES);
  const frequency = readState(raw.frequency, RULE_FREQUENCIES);
  const mode = readState(raw.processing_mode, RULE_MODES);
  const interval = Number.isSafeInteger(raw.interval) && raw.interval >= 1 && raw.interval <= 60 ? raw.interval : null;
  const schedule = isRecord(raw.schedule) ? raw.schedule : null;

  return {
    id,
    name: textOrNull(raw.name, 150),
    type: type.word,
    typeKnown: type.known,
    amount: amountIn(raw.amount, currency),
    currency,
    frequency: frequency.word,
    frequencyKnown: frequency.known,
    interval,
    status: status.word,
    statusKnown: status.known,
    archived: status.word === "archived",
    mode: mode.word,
    modeKnown: mode.known,
    nextDue: dateOnlyOrNull(raw.next_due_date),
    openOccurrences: countOrNull(schedule?.open_occurrences_count),
    // The rule's own next open occurrence, as the backend sent it; null when the schedule says there is none or it is not usable.
    scheduleKnown: schedule !== null,
    nextOccurrence: schedule ? normalizeOccurrence(schedule.next_occurrence, { id, currency }) : null,
    accountName: textOrNull(raw.account?.name, 80),
    accountId: idText(raw.account?.id ?? raw.account_id),
    categoryName: textOrNull(raw.category?.name, 80),
    categoryId: idText(raw.category?.id ?? raw.category_id),
    owner: textOrNull(isRecord(raw.owner) ? raw.owner.name : null, 80),
    startDate: dateOnlyOrNull(raw.start_date),
    endDate: dateOnlyOrNull(raw.end_date),
    maxOccurrences: countOrNull(raw.max_occurrences),
    lastProcessedAt: dateOnlyOrNull(raw.last_processed_at),
    description: textOrNull(raw.description, 500),
    notes: textOrNull(raw.notes, 1000),
  };
}

/**
 * One page of a rule's occurrences. Refused whole when a row is another rule's, in another currency, or (with a
 * status asked for) has another status: a history that does not hold together is an error, never a half-right list.
 *
 * @param {{ id: string, currency: string }} rule
 * @param {{ status: string, page: number }} asked `status` is "" for all of them
 */
export function buildOccurrencesPage(response, rule, { status, page }) {
  const built = buildPlanningPage(response, { page, perPage: OCCURRENCES_PER_PAGE }, "occurrences", (raw) => normalizeOccurrence(raw, rule));

  if (status && built.rows.some((row) => row.status !== status)) {
    throw Object.assign(new Error("Occurrences could not be validated."), { code: "MALFORMED_RESPONSE" });
  }

  return built;
}

export const buildRulesPage = (response, expected) => buildPlanningPage(response, expected, "recurring_transactions", normalizeRule);

/** GET /recurring-transactions/{id}. The rule must be the one asked for. */
export function buildRuleDetail(data, requestedId) {
  const rule = normalizeRule(isRecord(data) ? data.recurring_transaction : null);
  return rule && rule.id === String(requestedId) ? rule : null;
}
