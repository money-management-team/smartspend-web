import { positiveId } from "./experienceStore.js";
import {
  movementUnits,
  movementDecimal,
} from "../AccountDetails/accountMovementHelpers.js";

export const dataError = (code = "MALFORMED_RESPONSE") =>
  Object.assign(new Error("The requested data could not be validated."), {
    code,
  });
export function isCalendarDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function monthRange(month) {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month ?? ""))
    throw dataError("MONTH_INVALID");
  const [year, number] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10),
  };
}
export function previousMonthRange(month) {
  const { from } = monthRange(month);
  const date = new Date(`${from}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return {
    from: date.toISOString().slice(0, 10),
    to: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10),
  };
}
export function calendarMonthComparison(current, previous, fields) {
  const currencies = [
    ...new Set([...current, ...previous].map((row) => row.currency_code)),
  ];
  return currencies
    .map((currency) => {
      const now = current.find((row) => row.currency_code === currency),
        before = previous.find((row) => row.currency_code === currency);
      const metrics = fields
        .map((key) => {
          const value = now?.[key] ?? null,
            old = before?.[key] ?? null;
          let change = null;
          if (typeof value === "string" && typeof old === "string") {
            try {
              change = movementDecimal(
                movementUnits(value) - movementUnits(old),
              );
            } catch {
              /* Unavailable fields remain unavailable. */
            }
          }
          return {
            key,
            current: value,
            previous: old,
            change,
            percent: null,
            trend: null,
          };
        })
        .filter((metric) => metric.current != null || metric.previous != null);
      return { currency, metrics };
    })
    .filter((group) => group.metrics.length);
}
export function hasWorkspaceTransactions(response, workspaceId) {
  const data = response?.data;
  if (
    !Array.isArray(data?.recent_transactions) ||
    String(data.scope?.workspace_id) !== String(workspaceId)
  )
    throw dataError();
  return data.recent_transactions.length > 0;
}
export function attentionEvents(events, filter, today) {
  const settled = [
    "completed",
    "confirmed",
    "posted",
    "paid",
    "skipped",
    "cancelled",
    "closed",
    "achieved",
    "archived",
  ];
  return events
    .filter(
      (event) =>
        !settled.includes(event.status) &&
        (filter === "all" ||
          (filter === "overdue" && event.status === "overdue") ||
          (filter === "upcoming" &&
            event.date >= today &&
            event.status !== "overdue")),
    )
    .sort(
      (a, b) =>
        (a.status === "overdue" ? 0 : 1) - (b.status === "overdue" ? 0 : 1) ||
        String(a.date ?? "").localeCompare(String(b.date ?? "")),
    );
}
export function recordingDraftId(
  captureId,
  sourceWorkspaceId,
  currentWorkspaceId,
) {
  const workspace = positiveId(currentWorkspaceId);
  return workspace && workspace === positiveId(sourceWorkspaceId)
    ? positiveId(captureId)
    : null;
}
export function readyDraftsPage(page, workspaceId) {
  const workspace = workspaceId === undefined ? null : positiveId(workspaceId);
  if ((workspaceId !== undefined && !workspace) || !Array.isArray(page?.items))
    throw dataError();
  const ids = new Set();
  for (const item of page.items) {
    const id = positiveId(item?.id),
      source = positiveId(item?.workspace_id);
    if (
      !id ||
      !source ||
      ids.has(id) ||
      item.status !== "ready_for_review" ||
      (workspace && source !== workspace)
    )
      throw dataError();
    ids.add(id);
  }
  return page;
}
export function parsePaginator(value, page, perPage) {
  if (
    !value ||
    !Array.isArray(value.data) ||
    !Number.isSafeInteger(value.total) ||
    value.total < 0 ||
    !Number.isSafeInteger(value.last_page) ||
    value.last_page !== Math.max(1, Math.ceil(value.total / perPage)) ||
    value.current_page !== page ||
    value.per_page !== perPage
  )
    throw dataError();
  const length = Math.min(
    perPage,
    Math.max(0, value.total - (page - 1) * perPage),
  );
  if (
    value.data.length !== length ||
    (length
      ? value.from !== (page - 1) * perPage + 1 ||
        value.to !== value.from + length - 1
      : value.from != null || value.to != null)
  )
    throw dataError();
  return {
    items: value.data,
    total: value.total,
    page,
    lastPage: value.last_page,
  };
}
export function categoryQuery(category, filters, page = 1) {
  if (
    !positiveId(category?.id) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    ![20, 50, 100].includes(Number(filters.per_page)) ||
    !["", "posted", "reversed", "draft", "pending_review", "failed"].includes(
      filters.status,
    ) ||
    !["asc", "desc"].includes(filters.sort_dir) ||
    (filters.account_id && !positiveId(filters.account_id))
  )
    throw dataError("CATEGORY_FILTER_INVALID");
  if (
    (filters.date_from && !isCalendarDate(filters.date_from)) ||
    (filters.date_to && !isCalendarDate(filters.date_to)) ||
    (filters.date_from &&
      filters.date_to &&
      filters.date_from > filters.date_to)
  )
    throw dataError("ACCOUNT_HISTORY_DATE_INVALID");
  return {
    category_id: String(category.id),
    page,
    per_page: Number(filters.per_page),
    sort_by: "occurred_at",
    sort_dir: filters.sort_dir,
    ...Object.fromEntries(
      ["account_id", "status", "date_from", "date_to"]
        .filter((key) => filters[key])
        .map((key) => [key, filters[key]]),
    ),
  };
}
export function parseCategoryPage(response, category, query) {
  if (response?.status !== true) throw dataError();
  const result = parsePaginator(
      response.data?.transactions,
      query.page,
      query.per_page,
    ),
    ids = new Set();
  for (const row of result.items) {
    if (
      !positiveId(row?.id) ||
      !positiveId(row.workspace_id) ||
      ids.has(String(row.id)) ||
      String(row.category_id) !== String(category.id) ||
      (category.workspace_id != null &&
        String(row.workspace_id) !== String(category.workspace_id)) ||
      !/^[A-Z]{3}$/.test(row.currency_code ?? "") ||
      !["posted", "reversed", "draft", "pending_review", "failed"].includes(
        row.status,
      )
    )
      throw dataError();
    movementUnits(row.amount);
    if (
      query.account_id &&
      !row.ledger_entries?.some(
        (entry) => String(entry.account_id) === query.account_id,
      )
    )
      throw dataError();
    ids.add(String(row.id));
  }
  return result;
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
