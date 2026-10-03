import { apiRequest, pickQuery, toMoneyString } from "./apiClient";

const path = (goalId) => `/savings-goals/${encodeURIComponent(goalId)}/planned-contributions`;
const itemPath = (goalId, planId) => `${path(goalId)}/${encodeURIComponent(planId)}`;

function planBody(values) {
  const body = {};
  for (const key of ["from_account_id", "amount", "planned_date", "notes"]) {
    if (values[key] !== undefined) body[key] = values[key];
  }
  if (body.amount !== undefined) body.amount = toMoneyString(body.amount);
  return body;
}

export const plannedSavingsApi = {
  list: (goalId, query = {}, options = {}) => apiRequest(path(goalId), {
    query: pickQuery(query, ["status", "from_account_id", "date_from", "date_to", "per_page", "page"]),
    signal: options.signal,
  }),
  create: (goalId, values) => apiRequest(path(goalId), { method: "POST", body: planBody(values) }),
  update: (goalId, planId, values) => apiRequest(itemPath(goalId, planId), {
    method: "PATCH", body: planBody(values),
  }),
  cancel: (goalId, planId) => apiRequest(itemPath(goalId, planId), { method: "DELETE" }),
};
