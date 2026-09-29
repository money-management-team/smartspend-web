import { apiRequest } from "./apiClient";

/*
 * GET /calendar → `data.period` ({ from, to, view }), `data.events[]` and
 * `data.summary` ({ total, by_type, by_status, by_severity }).
 *
 * The calendar is a READ-ONLY aggregation: the backend builds the events from
 * existing dated records (recurring occurrences, debt due dates, budget period
 * ends, savings goal target dates). Nothing is stored or changed through it;
 * an event's `actions` are carried out by the source resource's own module
 * (recurringTransactionsApi, debtsApi, …) from its details page.
 *
 * `/financial-calendar` is a backend alias of the same endpoint. Only
 * `/calendar` is used, so there is one request, one module and one page.
 *
 * Query: month (1..12) + year (2000..2100), or from + to (dates, to >= from,
 * at most 366 days); view (month | week); `types[]`; `statuses[]`; owner
 * (mine | all); workspace_id. Array filters must be sent under their `[]`
 * names (e.g. `{ "types[]": ["debt_due"] }`), which `apiRequest` repeats.
 */
export const calendarApi = {
  get: (query = {}, options = {}) =>
    apiRequest("/calendar", { query, signal: options.signal }),
};
