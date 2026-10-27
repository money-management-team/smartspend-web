import { isCurrencyCode } from "../money/decimal.js";
import { buildPlanningPage, readState } from "./planning.js";
import { amountIn, countOrNull, dateOnlyOrNull, idText, isRecord, textOrNull } from "./values.js";

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
 * a rule is overdue: that is the backend's `is_overdue` on an occurrence,
 * which this read-only screen does not fetch.
 *
 * - GET /recurring-transactions takes status (active | paused | completed |
 *   archived), type (income | expense), per_page and page, and answers with a
 *   Laravel paginator at data.recurring_transactions.
 * - GET /recurring-transactions/{id} answers with data.recurring_transaction
 *   and, for the schedule, data.recurring_transaction.schedule.
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
    accountName: textOrNull(raw.account?.name, 80),
    categoryName: textOrNull(raw.category?.name, 80),
    startDate: dateOnlyOrNull(raw.start_date),
    endDate: dateOnlyOrNull(raw.end_date),
    maxOccurrences: countOrNull(raw.max_occurrences),
    lastProcessedAt: dateOnlyOrNull(raw.last_processed_at),
    description: textOrNull(raw.description, 500),
    notes: textOrNull(raw.notes, 1000),
  };
}

export const buildRulesPage = (response, expected) => buildPlanningPage(response, expected, "recurring_transactions", normalizeRule);

/** GET /recurring-transactions/{id}. The rule must be the one asked for. */
export function buildRuleDetail(data, requestedId) {
  const rule = normalizeRule(isRecord(data) ? data.recurring_transaction : null);
  return rule && rule.id === String(requestedId) ? rule : null;
}
