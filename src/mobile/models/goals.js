import { isCurrencyCode } from "../money/decimal.js";
import { buildPlanningPage, parsePercent, readState } from "./planning.js";
import { amountIn, countOrNull, dateOnlyOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Savings goals as Mobile Planning shows them: the list's filters, a page of
 * the list, one goal.
 *
 * What the backend contract gives (docs/savings-goals/api.md and
 * business-rules.md, and the Desktop pages that already read it):
 *
 * - GET /savings-goals takes status (active | paused | achieved | archived:
 *   the lifecycle), per_page and page, and answers with a Laravel paginator at
 *   data.savings_goals.
 * - A goal carries its own `progress`: saved_amount, remaining_amount,
 *   percentage_funded, status (not_started | in_progress | almost_there |
 *   achieved), days_remaining, contributions_count and the flags
 *   deadline_passed / is_achieved. Saved comes from the goal's dedicated
 *   savings account on the backend. Mobile adds up nothing and never decides a
 *   goal is achieved: it shows the lifecycle and progress words as sent.
 * - Amounts are in the goal's own currency; a progress block that names
 *   another goal or another currency is refused.
 */

export const GOAL_LIFECYCLES = ["active", "paused", "achieved", "archived"];
export const GOAL_PROGRESS = ["not_started", "in_progress", "almost_there", "achieved"];
export const DEFAULT_GOAL_STATUS = "active";

/* ---------- Filters ---------- */

export function readGoalFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const status = params.get("status") ?? "";

  return { status: GOAL_LIFECYCLES.includes(status) ? status : DEFAULT_GOAL_STATUS };
}

export function goalFiltersToSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== DEFAULT_GOAL_STATUS) params.set("status", filters.status);
  return params;
}

export const goalFilterSignature = (filters) => goalFiltersToSearchParams(filters).toString() || "default";

export const hasActiveGoalFilters = (filters) => filters.status !== DEFAULT_GOAL_STATUS;

export function goalFiltersToQuery(filters, page, perPage, workspaceId) {
  return { workspace_id: workspaceId, status: filters.status, per_page: perPage, page };
}

/* ---------- One goal ---------- */

function buildProgress(raw, id, currency) {
  if (!isRecord(raw)) return null;
  if (raw.goal_id != null && idText(raw.goal_id) !== id) return null;
  if (raw.currency_code != null && raw.currency_code !== currency) return null;

  const state = readState(raw.status, GOAL_PROGRESS);

  return {
    saved: amountIn(raw.saved_amount, currency),
    remaining: amountIn(raw.remaining_amount, currency),
    percent: parsePercent(raw.percentage_funded),
    status: state.word,
    statusKnown: state.known,
    contributionsCount: countOrNull(raw.contributions_count),
    daysRemaining: countOrNull(raw.days_remaining),
    deadlinePassed: flagOrNull(raw.deadline_passed),
    isAchieved: flagOrNull(raw.is_achieved),
  };
}

/** The goal's currency: its own, and when it does not say, its progress's or its account's, provided every one that is present agrees. */
function goalCurrency(raw) {
  const found = [raw.currency_code, raw.progress?.currency_code, raw.account?.currency_code].filter((value) => value != null);
  if (found.length === 0 || !found.every((value) => value === found[0])) return null;
  return isCurrencyCode(found[0]) ? found[0] : null;
}

/** One goal, or null when it is not an object with a usable id. */
export function normalizeGoal(raw) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  if (!id) return null;

  const currency = goalCurrency(raw);
  const lifecycle = readState(raw.status ?? (raw.archived_at ? "archived" : null), GOAL_LIFECYCLES);

  return {
    id,
    name: textOrNull(raw.name, 150),
    currency,
    target: amountIn(raw.target_amount, currency),
    targetDate: dateOnlyOrNull(raw.target_date),
    status: lifecycle.word,
    statusKnown: lifecycle.known,
    archived: lifecycle.word === "archived",
    achievedAt: dateOnlyOrNull(raw.achieved_at),
    notes: textOrNull(raw.notes, 1000),
    accountName: textOrNull(raw.account?.name, 80),
    progress: buildProgress(raw.progress, id, currency),
  };
}

export const buildGoalsPage = (response, expected) => buildPlanningPage(response, expected, "savings_goals", normalizeGoal);

/** GET /savings-goals/{id}. The goal must be the one asked for. */
export function buildGoalDetail(data, requestedId) {
  const goal = normalizeGoal(isRecord(data) ? data.savings_goal : null);
  return goal && goal.id === String(requestedId) ? goal : null;
}
