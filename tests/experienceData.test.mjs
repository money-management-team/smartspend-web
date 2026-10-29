import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryQuery, parseCategoryPage, monthRange, previousMonthRange, calendarMonthComparison, hasWorkspaceTransactions, attentionEvents, recordingDraftId } from "../src/features/Dashboards/User/Experience/experienceData.js";

const category = { id: 4, workspace_id: 3 };
const filters = { account_id: "", status: "", date_from: "", date_to: "", sort_dir: "desc", per_page: "20" };
const row = (id, extra = {}) => ({ id, workspace_id: 3, category_id: 4, status: "posted", type: "expense", amount: "25.5001", currency_code: "ILS", ledger_entries: [{ account_id: 10 }], ...extra });
const response = (rows) => ({ status: true, data: { transactions: { data: rows, total: rows.length, current_page: 1, per_page: 20, last_page: 1, from: rows.length ? 1 : null, to: rows.length || null } } });

test("category history locks its category and forwards only the existing read filters", () => {
  const query = categoryQuery(category, { ...filters, account_id: "10", date_from: "2026-10-01", date_to: "2026-10-31", user_id: "9", workspace_id: "4" }, 2);
  assert.deepEqual(query, { category_id: "4", page: 2, per_page: 20, sort_by: "occurred_at", sort_dir: "desc", account_id: "10", date_from: "2026-10-01", date_to: "2026-10-31" });
});
test("all backend transaction lifecycle states remain readable in category history", () => {
  for (const status of ["posted", "reversed", "draft", "pending_review", "failed"]) {
    const query = categoryQuery(category, { ...filters, status });
    assert.equal(parseCategoryPage(response([row(1, { status })]), category, query).items[0].status, status);
  }
});
test("a shared category preserves separate currencies and authorized workspaces without adding totals", () => {
  const result = parseCategoryPage(response([row(1), row(2, { workspace_id: 4, currency_code: "USD" })]), { ...category, workspace_id: null }, categoryQuery(category, filters));
  assert.deepEqual(result.items.map((item) => item.currency_code), ["ILS", "USD"]); assert.equal(result.amount, undefined);
});
test("mismatched category workspace account and duplicate records are rejected", () => {
  const query = categoryQuery(category, { ...filters, account_id: "10" });
  for (const rows of [[row(1, { category_id: 5 })], [row(1, { workspace_id: 4 })], [row(1, { ledger_entries: [{ account_id: 11 }] })], [row(1), row(1)]]) assert.throws(() => parseCategoryPage(response(rows), category, query), { code: "MALFORMED_RESPONSE" });
});
test("invalid category dates identifiers and lifecycle filters fail before requesting data", () => {
  for (const extra of [{ date_from: "2026-02-30" }, { account_id: "../3" }, { status: "confirmed" }, { date_from: "2026-10-10", date_to: "2026-10-01" }]) assert.throws(() => categoryQuery(category, { ...filters, ...extra }));
});
test("a short middle page cannot masquerade as all category records", () => {
  const value = response([row(1)]); value.data.transactions.total = 21; value.data.transactions.last_page = 2;
  assert.throws(() => parseCategoryPage(value, category, categoryQuery(category, filters)), { code: "MALFORMED_RESPONSE" });
});
test("calendar month boundaries include leap years and the actual previous month", () => {
  assert.deepEqual(monthRange("2024-02"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(previousMonthRange("2026-03"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(previousMonthRange("2000-01"), { from: "1999-12-01", to: "1999-12-31" });
  assert.throws(() => monthRange("2026-13")); assert.throws(() => monthRange(""));
});
test("monthly comparisons preserve exact money and never merge currencies or guess unavailable zero values", () => {
  const groups = calendarMonthComparison([{ currency_code: "ILS", income: "9007199254740993.0001" }, { currency_code: "USD", expense: "20.0000" }], [{ currency_code: "ILS", income: "9007199254740993.0000" }], ["income", "expense"]);
  assert.equal(groups[0].metrics[0].change, "0.0001"); assert.equal(groups[1].currency, "USD"); assert.equal(groups[1].metrics[0].previous, null); assert.equal(groups[1].metrics[0].change, null);
});
test("guide completion trusts the dashboard scope rather than inventing workspace ids on summary rows", () => {
  assert.equal(hasWorkspaceTransactions({ data: { scope: { workspace_id: 3 }, recent_transactions: [{ id: 1, amount: "25.0000" }] } }, 3), true);
  assert.equal(hasWorkspaceTransactions({ data: { scope: { workspace_id: 3 }, recent_transactions: [] } }, 3), false);
  assert.throws(() => hasWorkspaceTransactions({ data: { scope: { workspace_id: 4 }, recent_transactions: [{ id: 1 }] } }, 3));
});
test("attention distinguishes actual overdue statuses from completed recurring and paid debt events", () => {
  const events = [{ id: 1, date: "2026-10-01", status: "overdue" }, { id: 2, date: "2026-10-03", status: "due" }, { id: 3, date: "2026-10-01", status: "posted" }, { id: 4, date: "2026-10-04", status: "paid" }];
  assert.deepEqual(attentionEvents(events, "all", "2026-10-02").map((item) => item.id), [1, 2]);
  assert.deepEqual(attentionEvents(events, "overdue", "2026-10-02").map((item) => item.id), [1]);
  assert.deepEqual(attentionEvents(events, "upcoming", "2026-10-02").map((item) => item.id), [2]);
});

 test("voice attention links can open only a valid draft in the selected workspace", () => {
  assert.equal(recordingDraftId("42", "3", 3), "42");
  for (const [id, source, current] of [[42, 4, 3], [42, null, 3], [42, 3, null], ["../42", 3, 3], [Number.MAX_SAFE_INTEGER + 1, 3, 3]]) assert.equal(recordingDraftId(id, source, current), null);
});
test("attention drafts require ready status valid identities and the voice workspace without mixing receipt scope", async () => {
  const { readyDraftsPage } = await import("../src/features/Dashboards/User/Experience/experienceData.js");
  const draft = { id: 42, workspace_id: 3, status: "ready_for_review" }, page = { items: [draft] };
  assert.equal(readyDraftsPage(page, 3), page);
  assert.equal(readyDraftsPage({ items: [draft, { ...draft, id: 43, workspace_id: 4 }] }).items.length, 2);
  for (const items of [[{ ...draft, workspace_id: 4 }], [{ ...draft, status: "processing" }], [draft, draft], [{ ...draft, id: "../42" }]]) assert.throws(() => readyDraftsPage({ items }, 3), { code: "MALFORMED_RESPONSE" });
  assert.throws(() => readyDraftsPage(null, 3));
});
