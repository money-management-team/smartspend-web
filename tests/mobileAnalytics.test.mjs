import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { envelope, failure, healthyBackend, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";

const { DEFAULT_HUB_PRESET, buildAnalytics, buildBudgetPerformance, defaultGroup, hasActivity, presetRange, readHubRange } = await import("../src/mobile/models/analytics.js");
const { buildTrend } = await import("../src/mobile/models/trend.js");
const { bucketLabel } = await import("../src/mobile/reports/bucketLabel.js");

/*
 * The Reports analytics: models first (pure), then the screen. Every fixture has the shape the backend really
 * sends (ReportService at fix/financial-idempotency-p0): trend rows with `labels` and `series: [{ name, data }]`,
 * top_expense_categories as `[{ currency_code, categories }]`, comparison entries as `{ current, previous,
 * change_percentage }`. Fictional data, GET only.
 */

after(() => dom.window.close());

const series = (name, data) => ({ name, data });
const overview = (overrides = {}) => ({
  report: "overview",
  period: { date_from: "2026-06-01", date_to: "2026-11-05", timezone: "UTC" },
  summary_by_currency: [
    { currency_code: "ILS", total_income: "13350.0000", total_expense: "4020.5000", net_income: "9329.5000", budgets_total: "2700.0000", budgets_spent: "1793.0000" },
    { currency_code: "USD", total_income: "100.0000", total_expense: "40.0000", net_income: "60.0000" },
  ],
  analytics: {
    comparison_by_currency: [{ currency_code: "ILS", total_income: { current: "13350.0000", previous: "11000.0000", change_percentage: "21.36" }, total_expense: { current: "4020.5000", previous: "4240.0000", change_percentage: "-5.20" }, net_income: { current: "9329.5000", previous: "6760.0000", change_percentage: null } }],
    trend_by_currency: [
      { currency_code: "ILS", granularity: "month", labels: ["2026-09", "2026-10", "2026-11"], series: [series("total_income", ["4000.0000", "6000.0000", "3350.0000"]), series("total_expense", ["1000.0000", "2020.5000", "1000.0000"]), series("net_income", ["3000.0000", "3979.5000", "2350.0000"])] },
      { currency_code: "USD", granularity: "month", labels: ["2026-10"], series: [series("total_income", ["100.0000"]), series("total_expense", ["40.0000"])] },
    ],
    top_expense_categories: [{ currency_code: "ILS", categories: [{ category_id: 4, name: "Food", color: null, icon: null, total: "1548.0000", percentage: "38.50" }, { category_id: null, name: "Uncategorized", color: null, icon: null, total: "200.0000", percentage: "5.00" }] }],
  },
  items: [],
  ...overrides,
});
const budgetRow = (id, extra = {}) => ({ budget_id: id, name: `Budget ${id}`, currency_code: "ILS", amount_limit: "1000.0000", spent: "250.0000", progress_percentage: "25.0000", progress_status: "safe", ...extra });
const budgets = (items = [budgetRow(1, { name: "Food", amount_limit: "1800.0000", spent: "1548.0000", progress_percentage: "86.0000", progress_status: "warning" }), budgetRow(2, { name: "Transport", progress_status: "near_limit", progress_percentage: "27.1900" })]) => ({
  report: "budgets",
  summary_by_currency: [{ currency_code: "ILS", total_budget: "2700.0000", total_spent: "1793.0000" }],
  analytics: { utilization_by_currency: [{ currency_code: "ILS", percentage_used: "66.4100" }], status_distribution: [{ status: "safe", count: 1 }] },
  items,
  pagination: { current_page: 1, per_page: 10, total: items.length, last_page: 1 },
});

describe("Analytics models", () => {
  const today = new Date(2026, 10, 5);

  it("the backend's own trend shape (labels and named series) is read", () => {
    const [trend] = buildTrend(overview().analytics.trend_by_currency);
    assert.equal(trend.currency, "ILS");
    assert.deepEqual(trend.series, ["total_income", "total_expense", "net_income"]);
    assert.deepEqual(trend.points.map((point) => point.label), ["2026-09", "2026-10", "2026-11"]);
    assert.equal(trend.points[1].values.total_expense, "2020.5000");
  });

  it("presets are whole calendar months ending today, and the year starts in January", () => {
    assert.deepEqual(presetRange("month", today), { from: "2026-11-01", to: "2026-11-05" });
    assert.deepEqual(presetRange("last-month", today), { from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(presetRange("3-months", today), { from: "2026-09-01", to: "2026-11-05" });
    assert.deepEqual(presetRange("6-months", today), { from: "2026-06-01", to: "2026-11-05" });
    assert.deepEqual(presetRange("year", today), { from: "2026-01-01", to: "2026-11-05" });
    assert.deepEqual(presetRange("6-months", new Date(2026, 1, 10)), { from: "2025-09-01", to: "2026-02-10" }, "across a year boundary");
  });

  it("the range in the address is used only when it is two real dates in order, and a preset is recognised", () => {
    assert.equal(DEFAULT_HUB_PRESET, "6-months");
    assert.deepEqual(readHubRange("", today), { from: "2026-06-01", to: "2026-11-05", preset: "6-months" });
    assert.deepEqual(readHubRange("from=2026-10-01&to=2026-10-31", today), { from: "2026-10-01", to: "2026-10-31", preset: "last-month" });
    assert.deepEqual(readHubRange("from=2026-10-03&to=2026-10-09", today), { from: "2026-10-03", to: "2026-10-09", preset: "custom" });
    assert.equal(readHubRange("from=2026-10-09&to=2026-10-03", today).preset, "6-months", "a reversed range is not used");
    assert.equal(readHubRange("from=2026-02-30&to=2026-03-01", today).preset, "6-months", "not a real date");
  });

  it("the trend's bucket follows the range: days for a month, weeks for a few months, months beyond", () => {
    assert.equal(defaultGroup("2026-11-01", "2026-11-05"), "day");
    assert.equal(defaultGroup("2026-10-01", "2026-11-04"), "day");
    assert.equal(defaultGroup("2026-09-01", "2026-11-05"), "week");
    assert.equal(defaultGroup("2026-06-01", "2026-11-05"), "month");
  });

  it("the overview is mapped per currency from the backend's figures; nothing is added and a missing figure is not zero", () => {
    const result = buildAnalytics(overview());
    assert.deepEqual(result.currencies.map((row) => row.currency), ["ILS", "USD"]);
    const [ils, usd] = result.currencies;
    assert.deepEqual([ils.income, ils.expense, ils.net], ["13350.0000", "4020.5000", "9329.5000"]);
    assert.deepEqual(ils.budgets, { total: "2700.0000", spent: "1793.0000" });
    assert.equal(usd.budgets, null, "no budget figures, so none");
    assert.deepEqual(ils.change.income, { text: "21.3", negative: false, zero: false });
    assert.deepEqual(ils.change.expense, { text: "−5.2", negative: true, zero: false });
    assert.equal(ils.change.net, null, "no previous figure to compare with, so no change is invented");
    assert.equal(usd.change, null);
    assert.deepEqual(ils.chart.points.map((point) => [point.label, point.income, point.expense]), [["2026-09", "4000.0000", "1000.0000"], ["2026-10", "6000.0000", "2020.5000"], ["2026-11", "3350.0000", "1000.0000"]]);
    assert.deepEqual(ils.categories.map((category) => [category.name, category.total, category.percent.text]), [["Food", "1548.0000", "38.5"], ["Uncategorized", "200.0000", "5"]]);
    assert.deepEqual(usd.categories, []);
    const missing = buildAnalytics({ report: "overview", summary_by_currency: [{ currency_code: "EUR", total_income: "5.0000" }] });
    assert.deepEqual([missing.currencies[0].expense, missing.currencies[0].net], [null, null]);
  });

  it("a chart needs both an income and an expense series; categories without a decimal total are left out", () => {
    const one = buildAnalytics(overview({ analytics: { trend_by_currency: [{ currency_code: "ILS", labels: ["2026-10"], series: [series("total_income", ["1.0000"])] }], top_expense_categories: [{ currency_code: "ILS", categories: [{ category_id: 1, name: "A", total: "x", percentage: "5.00" }, { category_id: 2, name: "B", total: "3.0000", percentage: "oops" }] }] } }));
    assert.equal(one.currencies[0].chart, null);
    assert.deepEqual(one.currencies[0].categories.map((category) => [category.name, category.percent]), [["B", null]]);
  });

  it("an answer about another report, or with no summary at all, is refused; a duplicate or unknown currency is dropped", () => {
    assert.throws(() => buildAnalytics({ report: "debts", summary_by_currency: [] }), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildAnalytics({ report: "overview" }), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildAnalytics(null), { code: "MALFORMED_RESPONSE" });
    const cleaned = buildAnalytics({ report: "overview", summary_by_currency: [{ currency_code: "ILS", total_income: "1.0000" }, { currency_code: "ILS", total_income: "9.0000" }, { currency_code: "nope", total_income: "2.0000" }] });
    assert.deepEqual(cleaned.currencies.map((row) => [row.currency, row.income]), [["ILS", "1.0000"]]);
  });

  it("activity is any income or expense that is not zero", () => {
    assert.equal(hasActivity({ income: "0.0000", expense: "0.0000" }), false);
    assert.equal(hasActivity({ income: null, expense: null }), false);
    assert.equal(hasActivity({ income: "0.0000", expense: "0.0100" }), true);
  });

  it("budget performance keeps the backend's own percentages, states and order, per currency, first five", () => {
    const rows = Array.from({ length: 7 }, (_, index) => budgetRow(index + 1));
    rows.push(budgetRow(8, { currency_code: "USD", progress_status: "mystery" }));
    const result = buildBudgetPerformance(budgets(rows));
    const ils = result.currencies.find((row) => row.currency === "ILS");
    assert.deepEqual(ils.budgets.map((budget) => budget.id), ["1", "2", "3", "4", "5"]);
    assert.deepEqual([ils.total, ils.spent, ils.utilization.text], ["2700.0000", "1793.0000", "66.4"]);
    assert.equal(ils.budgets[0].known, true);
    assert.equal(result.more, true);
    const usd = result.currencies.find((row) => row.currency === "USD");
    assert.deepEqual([usd.budgets[0].status, usd.budgets[0].known], ["mystery", false], "an unknown state is shown as sent, not mapped");
    assert.throws(() => buildBudgetPerformance({ report: "overview" }), { code: "MALFORMED_RESPONSE" });
  });

  it("trend labels are shown for people, with Latin digits; anything else as sent", () => {
    assert.equal(bucketLabel("2026-10", "en"), "Oct 26");
    assert.equal(bucketLabel("2026-10-05", "en"), "Oct 5");
    assert.match(bucketLabel("2026-10-05", "ar"), /5/, "Latin digits in Arabic");
    assert.equal(bucketLabel("2026-W41", "en"), "2026-W41");
    assert.equal(bucketLabel(null, "en"), "");
  });
});

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
// What is on screen: without the words said for assistive technology, and without the Unicode isolates around digits.
const visible = (root) => {
  const copy = root.cloneNode(true);
  copy.querySelectorAll(".sm-sr").forEach((node) => node.remove());
  return copy.textContent.replace(/[⁦⁩]/g, "").replace(/\s+/g, " ");
};
const reportCalls = () => api.calls.filter((call) => call.path.startsWith("/reports/"));
const handler = ({ ov = overview(), bg = budgets(), ovFail = false, bgFail = false } = {}) => (call) => {
  if (call.path === "/reports/overview") return ovFail ? failure(500, "boom") : { body: envelope(ov) };
  if (call.path === "/reports/budgets") return bgFail ? failure(500, "boom") : { body: envelope(bg) };
  return healthyBackend()(call);
};
const open = async (entry, options) => {
  api?.restore();
  api = installFakeApi(handler(options));
  view = await mountMobile({ entry });
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});
afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("Reports screen", () => {
  it("reads the overview and the budgets report for the last six months, and nothing else", async () => {
    await open("/m/reports");
    const range = presetRange("6-months");
    assert.deepEqual(reportCalls().map((call) => call.path).sort(), ["/reports/budgets", "/reports/overview"]);
    assert.deepEqual(reportCalls().find((call) => call.path === "/reports/overview").query, range);
    assert.deepEqual(reportCalls().find((call) => call.path === "/reports/budgets").query, { ...range, per_page: "10" });
    assert.ok(api.calls.every((call) => call.method === "GET"));
    assert.equal(q("[data-sm-screen='reports']").dataset.smState, "ready");
  });

  it("leads with the net result, then income and expenses with the backend's own comparison", async () => {
    await open("/m/reports");
    const hero = q("[data-sm-section='overview']");
    assert.equal(hero.dataset.smCurrency, "ILS");
    assert.match(text(hero), /Net result/);
    assert.match(text(hero), /9,329\.50/);
    assert.match(visible(q("[data-sm-field='income']", hero)), /13,350\.00.*\+21\.3% vs the previous period/);
    assert.match(visible(q("[data-sm-field='expense']", hero)), /4,020\.50.*−5\.2% vs the previous period/);
    assert.equal(qa("[data-sm-change]", hero).length, 2, "no change is invented where the backend had nothing to compare");
    assert.doesNotMatch(text(q("main")), /13,450|13,350\.00.*100\.00/, "currencies are never added");
  });

  it("shows one currency at a time and switches without adding them", async () => {
    await open("/m/reports");
    assert.deepEqual(qa("[data-sm-currency-choice]").map((button) => button.dataset.smCurrencyChoice), ["ILS", "USD"]);
    await click(q("[data-sm-currency-choice='USD']"));
    const hero = q("[data-sm-section='overview']");
    assert.equal(hero.dataset.smCurrency, "USD");
    assert.match(text(hero), /60\.00/);
    assert.doesNotMatch(text(hero), /9,329/);
    assert.equal(q("[data-sm-chart='USD']").dataset.smPoints, "1");
    assert.equal(qa("[data-sm-category]").length, 0, "USD has no categories");
    assert.ok(q("[data-sm-empty='categories']"));
  });

  it("draws paired income and expense bars from the figures, with the figures as a table", async () => {
    await open("/m/reports");
    const chart = q("[data-sm-chart='ILS']");
    assert.equal(chart.dataset.smPoints, "3");
    assert.equal(qa("[data-sm-bucket]", chart).length, 3);
    const heights = qa("[data-sm-bucket]", chart).map((bucket) => qa("rect", bucket).map((rect) => Number(rect.getAttribute("height"))));
    assert.deepEqual(heights.map(([income]) => income), [66, 100, 55], "whole percentages of the largest figure (6,000), from the decimal strings");
    assert.deepEqual(heights.map(([, expense]) => expense), [16, 33, 16]);
    assert.ok(heights.every(([income, expense]) => income > expense), "income is higher than expenses in every bucket");
    assert.match(text(q(".sm-an-legend", chart)), /Income.*Expenses/);
    assert.equal(qa("tbody tr", chart).length, 3);
    assert.match(text(q("tbody tr:nth-child(2)", chart)), /Oct 26.*6,000\.00.*2,020\.50.*3,979\.50/);
    assert.equal(q("svg", chart).getAttribute("aria-hidden"), "true", "the drawing is decoration; the table is the text");
  });

  it("a bucket with a negative figure draws no bar for it (its figure stays in the table)", async () => {
    const trend = [{ currency_code: "ILS", labels: ["2026-09", "2026-10"], series: [series("total_income", ["100.0000", "50.0000"]), series("total_expense", ["-5.0000", "20.0000"]), series("net_income", ["105.0000", "30.0000"])] }];
    await open("/m/reports", { ov: overview({ analytics: { trend_by_currency: trend } }) });
    const [first] = qa("[data-sm-bucket]");
    assert.equal(qa("rect", first)[1].getAttribute("height"), "0");
    assert.match(text(q("[data-sm-chart='ILS'] tbody tr")), /−5\.00/);
  });

  it("spending by category: names, the backend's share and amount, and a link to the categories report for the same range", async () => {
    await open("/m/reports");
    const food = q("[data-sm-category='4']");
    assert.match(visible(food), /Food.*1,548\.00.*38\.5% of spending/);
    assert.equal(q(".sm-an-cat-fill", food).style.inlineSize, "38.5%");
    assert.ok(q("[data-sm-category='uncategorized'], [data-sm-category='row-1']"));
    const range = presetRange("6-months");
    assert.equal(q("[data-sm-action='open-categories']").getAttribute("href"), `/m/reports/categories?from=${range.from}&to=${range.to}`);
  });

  it("budget performance: the totals, the backend's percentage and state for each budget, and a link to each", async () => {
    await open("/m/reports");
    const card = q("[data-sm-section='budgets']");
    assert.equal(card.dataset.smState, "ready");
    assert.match(visible(q("[data-sm-budget-total]", card)), /Spent 1,793\.00 ?ILS of 2,700\.00 ?ILS.*66\.4%/);
    assert.match(text(q("[data-sm-budget-total] .sm-progress .sm-sr", card)).replace(/[⁦⁩]/g, ""), /66\.4% of the budgets used/, "said in words for assistive technology");
    const [food, transport] = qa("[data-sm-budget]", card);
    assert.match(visible(food), /Food.*Warning.*1,548\.00 ?ILS of 1,800\.00/);
    assert.match(text(transport), /Transport.*Near the limit/);
    assert.equal(q("a", food).getAttribute("href"), "/m/planning/budgets/1");
    assert.equal(q(".sm-progress-fill", food).style.inlineSize, "86%");
  });

  it("a long budgets list shows the first five and says so", async () => {
    await open("/m/reports", { bg: budgets(Array.from({ length: 9 }, (_, index) => budgetRow(index + 1))) });
    assert.equal(qa("[data-sm-budget]").length, 5);
    assert.match(text(q("[data-sm-section='budgets']")), /Showing the first 5 budgets/);
  });

  it("the ten reports are one tap away, opened for the same period", async () => {
    await open("/m/reports");
    const links = qa("[data-sm-report]");
    assert.equal(links.length, 10);
    const range = presetRange("6-months");
    assert.equal(q("[data-sm-report='income-expense']").getAttribute("href"), `/m/reports/income-expense?from=${range.from}&to=${range.to}`);
    assert.equal(qa("a[href='/m/exports']").length, 1);
  });

  it("choosing a period changes the address and asks for those dates", async () => {
    await open("/m/reports");
    await change(q("[data-sm-period-picker] select"), "last-month");
    await settle();
    const last = presetRange("last-month");
    assert.equal(location(), `/m/reports?from=${last.from}&to=${last.to}`);
    const call = reportCalls().filter((item) => item.path === "/reports/overview").at(-1);
    assert.deepEqual(call.query, { ...last, group_by: "day" }, "a month of data is drawn by day");
    assert.match(q("[data-sm-range]").dataset.smRange, new RegExp(`^${last.from}:${last.to}$`));

    await change(q("[data-sm-period-picker] select"), "6-months");
    await settle();
    assert.equal(location(), "/m/reports", "the default period is not written to the address");
  });

  it("a custom range needs two real dates in order, then is sent as typed", async () => {
    await open("/m/reports");
    await change(q("[data-sm-period-picker] select"), "custom");
    const [from, to] = qa("[data-sm-section='period'] input[type='date']");
    await change(from, "2026-10-09");
    await change(to, "2026-10-01");
    await submit(q("[data-sm-section='period'] form"));
    assert.ok(q("[data-sm-section='period'] [role='alert']"), "a reversed range is refused locally");
    assert.equal(location(), "/m/reports");
    await change(from, "2026-10-01");
    await change(to, "2026-10-09");
    await submit(q("[data-sm-section='period'] form"));
    await settle();
    assert.equal(location(), "/m/reports?from=2026-10-01&to=2026-10-09");
    assert.deepEqual(reportCalls().filter((item) => item.path === "/reports/overview").at(-1).query, { from: "2026-10-01", to: "2026-10-09", group_by: "day" });
  });

  it("the trend's grouping is the address's, and choosing one asks the backend for it", async () => {
    await open("/m/reports");
    assert.equal(q("[data-sm-group='month']").getAttribute("aria-pressed"), "true");
    await click(q("[data-sm-group='week']"));
    await settle();
    assert.match(location(), /group_by=week/);
    assert.equal(reportCalls().filter((item) => item.path === "/reports/overview").at(-1).query.group_by, "week");
  });

  it("nothing in the period is said plainly, and the budgets and the reports are still offered", async () => {
    await open("/m/reports", { ov: overview({ summary_by_currency: [], analytics: {} }) });
    assert.ok(q("[data-sm-report-state='empty']"));
    assert.equal(qa("[data-sm-section='overview']").length, 0);
    assert.equal(qa("[data-sm-report]").length, 10);
  });

  it("a currency with only zero figures and nothing to draw is an empty state, not a screen of zeros", async () => {
    const zero = overview({ summary_by_currency: [{ currency_code: "ILS", total_income: "0.0000", total_expense: "0.0000", net_income: "0.0000" }], analytics: { top_expense_categories: [{ currency_code: "ILS", categories: [] }] } });
    await open("/m/reports", { ov: zero });
    assert.ok(q("[data-sm-report-state='empty']"));
  });

  it("when the overview cannot be read there is an error with Retry; the rest of the screen is not pretended", async () => {
    await open("/m/reports", { ovFail: true });
    assert.equal(q("[data-sm-screen='reports']").dataset.smState, "error");
    assert.ok(q(".sm-error"));
    assert.equal(qa("[data-sm-section='overview']").length, 0);
    assert.equal(qa("[data-sm-report]").length, 10, "the reports are still reachable");
  });

  it("when only the budgets cannot be read, the overview still shows and the budgets card has its own error", async () => {
    await open("/m/reports", { bgFail: true });
    assert.ok(q("[data-sm-section='overview']"));
    assert.equal(q("[data-sm-section='budgets']").dataset.smState, "error");
    assert.ok(q("[data-sm-section='budgets'] .sm-error"));
  });

  it("an answer about another report is an error, not a screen of someone else's figures", async () => {
    await open("/m/reports", { ov: { ...overview(), report: "debts" } });
    assert.equal(q("[data-sm-screen='reports']").dataset.smState, "error");
  });

  it("with amounts hidden the bars are not drawn (their heights would show the figures) and the amounts are masked", async () => {
    api?.restore();
    api = installFakeApi(handler());
    view = await mountMobile({ entry: "/m" });
    await click(q("[data-sm-action='toggle-amounts']"));
    await click(qa("nav.sm-nav a").find((link) => link.textContent.trim() === "More"));
    await settle();
    await click(q("a[href='/m/reports']"));
    await settle();
    assert.ok(q("[data-sm-chart='hidden']"));
    assert.equal(qa("[data-sm-bucket]").length, 0);
    assert.doesNotMatch(text(q("[data-sm-section='overview']")), /9,329/);
  });

  it("a report opened from here shows the same range and is a screen of its own", async () => {
    await open("/m/reports");
    await click(q("[data-sm-report='budgets']"));
    await settle();
    const range = presetRange("6-months");
    assert.equal(location(), `/m/reports/budgets?from=${range.from}&to=${range.to}`);
    assert.equal(q("[data-sm-screen='report']").dataset.smReport, "budgets");
  });
});
