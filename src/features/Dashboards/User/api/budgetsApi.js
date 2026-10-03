import { apiRequest, pickQuery, toMoneyString } from "./apiClient";

const budgetPath = (budgetId) => `/budgets/${encodeURIComponent(budgetId)}`;

// Query params GET /budgets documents.
const LIST_QUERY = [
  "workspace_id",
  "category_id",
  "scope",
  "owner",
  "currency_code",
  "status",
  "progress_status",
  "date_from",
  "date_to",
  "active_on",
  "per_page",
  "page",
];

/*
 * Enforces the two rules the backend would otherwise reject with a 422:
 * `owner` only accepts "mine" (there is no filtering by another user's id),
 * and `date_from` / `date_to` travel together or not at all.
 */
function toListQuery(query) {
  const picked = pickQuery(query, LIST_QUERY);

  if (picked.owner !== "mine") delete picked.owner;

  if (!picked.date_from || !picked.date_to) {
    delete picked.date_from;
    delete picked.date_to;
  }

  return picked;
}

// Fields each write may carry. `user_id` and `status` are never sent (the
// owner comes from the token, the status from the backend), and an update
// never sends the fields that define what a budget measures: `workspace_id`,
// `category_id` and `currency_code`. Changing those means a new budget.
const CREATE_FIELDS = [
  "workspace_id",
  "name",
  "category_id",
  "amount_limit",
  "currency_code",
  "period_start",
  "period_end",
  "notes",
  "metadata",
];
const UPDATE_FIELDS = ["name", "amount_limit", "period_start", "period_end", "notes", "metadata"];

// Keeps only the allowed fields that are present. `amount_limit` travels as a
// 4-decimal string; a general budget simply has no `category_id`.
function pickPayload(payload, fields) {
  const body = {};

  fields.forEach((field) => {
    if (payload?.[field] !== undefined) body[field] = payload[field];
  });

  if (body.amount_limit !== undefined) body.amount_limit = toMoneyString(body.amount_limit);
  if (body.category_id == null) delete body.category_id;

  return body;
}

/*
 * Envelopes:
 * - list → `data.budgets`, a Laravel paginator (rows in `.data`), each row
 *   with the `progress` the backend calculated. `parseBudgetPage` also
 *   accepts a plain array defensively.
 * - get / create / update → `data.budget`, with its `progress` recalculated by
 *   the backend.
 * - archive → `data.budget` with `status: "archived"` (no `progress`).
 * - getProgress → `data.progress` only.
 *
 * There is intentionally no `delete`: DELETE /budgets/{id} archives the budget
 * (its history is kept), and `archive` states that clearly.
 */
export const budgetsApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/budgets", { query: toListQuery(query), signal: options.signal }),

  get: (budgetId, options = {}) =>
    apiRequest(budgetPath(budgetId), { signal: options.signal }),

  // Fresh spent / remaining / percentage / status without the whole budget.
  getProgress: (budgetId, options = {}) =>
    apiRequest(`${budgetPath(budgetId)}/progress`, { signal: options.signal }),

  create: (payload) =>
    apiRequest("/budgets", {
      method: "POST",
      body: pickPayload(payload, CREATE_FIELDS),
    }),

  // Partial update: send only the fields that changed. An archived budget is
  // rejected with 409.
  update: (budgetId, payload) =>
    apiRequest(budgetPath(budgetId), {
      method: "PATCH",
      body: pickPayload(payload, UPDATE_FIELDS),
    }),

  // DELETE archives: the budget becomes read-only and its history is kept.
  // Archiving an already archived budget is rejected with 409.
  archive: (budgetId) =>
    apiRequest(budgetPath(budgetId), { method: "DELETE" }),
};
