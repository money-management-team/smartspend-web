import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { account, envelope, healthyBackend, installFakeApi, transactionsBackend, tx } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { event, moreBackend } from "./helpers/moreFixture.mjs";

const { createPreferenceStore, normalizePreferences, preferenceKey } = await import("../src/mobile/preferences/deviceStore.js");
const { parseCsv, previewRows, suggestMapping, importFileKind } = await import("../src/mobile/imports/importPreview.js");
const { preferenceKey: experienceKey } = await import("../src/features/Dashboards/User/Experience/experienceStore.js");

/*
 * Home's period and arrangement, hide amounts, quick-entry templates, saved
 * filters, search, the monthly review, the calendar's status labels and the
 * statement preview. Fictional data; the fake backend refuses anything but GET.
 */

after(() => dom.window.close());

let api;
let view;
const text = (root = q("main")) => root.textContent.replace(/\s+/g, " ");
const action = (name) => q(`[data-sm-action='${name}']`);
const open = async (entry, backend) => {
  api = installFakeApi(backend);
  view = await mountMobile({ entry });
};
const prefKey = preferenceKey(1, 1);

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

describe("Home", () => {
  it("a period changes the address and asks the dashboard for that period; a custom range sends both days", async () => {
    await open("/m", healthyBackend());
    await click(q("[data-sm-period='week']"));
    await settle();
    assert.equal(location(), "/m?period=week");
    assert.equal(api.calls.filter((call) => call.path === "/dashboard").at(-1).query.period, "week");

    await click(q("[data-sm-period='custom']"));
    await change(qa("[data-sm-section='period'] input[type='date']")[0], "2026-10-01");
    await change(qa("[data-sm-section='period'] input[type='date']")[1], "2026-10-15");
    await submit(q("[data-sm-section='period'] form"));
    await settle();
    assert.equal(location(), "/m?period=custom&from=2026-10-01&to=2026-10-15");
    const last = api.calls.filter((call) => call.path === "/dashboard").at(-1).query;
    assert.deepEqual([last.period, last.date_from, last.date_to], ["custom", "2026-10-01", "2026-10-15"]);
  });

  it("an address with an unknown period or a backwards range reads this month", async () => {
    await open("/m?period=decade", healthyBackend());
    assert.equal(api.calls.find((call) => call.path === "/dashboard").query.period, "month");
    await view.unmount();
    api.restore();
    await open("/m?period=custom&from=2026-10-15&to=2026-10-01", healthyBackend());
    assert.equal(api.calls.find((call) => call.path === "/dashboard").query.period, "month");
  });

  it("cards can be hidden and reordered, are kept for this person and workspace, and nothing else is stored", async () => {
    await open("/m", healthyBackend());
    await click(action("arrange"));
    await click(q("[data-sm-arrange='accounts'] input[type='checkbox']"));
    await click(q("[data-sm-arrange='recent'] [data-sm-move='up']"));
    const stored = JSON.parse(window.localStorage.getItem(prefKey));
    assert.deepEqual(stored.homeHidden, ["accounts"]);
    assert.deepEqual(stored.homeOrder.slice(0, 4), ["balances", "summary", "recent", "accounts"]);
    assert.doesNotMatch(JSON.stringify(stored), /1234|Everyday|token/i, "no figure, name or token");
    await click(action("reset-arrange"));
    assert.deepEqual(JSON.parse(window.localStorage.getItem(prefKey)).homeHidden, []);
  });

  it("hide amounts: one tap hides every amount, using the full version's own preference", async () => {
    await open("/m", healthyBackend());
    assert.ok(qa(".sm-money:not(.sm-money-hidden)").length > 0);
    await click(action("toggle-amounts"));
    assert.equal(qa(".sm-money:not(.sm-money-hidden)").length, 0);
    assert.equal(JSON.parse(window.localStorage.getItem(experienceKey(1, 1))).hiddenMoney, true);
    await click(action("toggle-amounts"));
    assert.ok(qa(".sm-money:not(.sm-money-hidden)").length > 0);
  });
});

describe("device preferences", () => {
  it("are keyed by person and workspace, normalized, and survive storage that refuses writes", () => {
    assert.equal(preferenceKey(1, 2), "smartspend:mobile:prefs:v1:u:1:w:2");
    assert.equal(preferenceKey(null, 2), null);
    const clean = normalizePreferences({ version: 1, homeOrder: ["recent", "bogus"], homeHidden: ["recent", "recent"], templates: [{ id: "abcdefgh1", name: " Coffee ", type: "expense", amount: "1.23456" }, { id: "abcdefgh2", name: "Rent", type: "expense", amount: "100", account_id: "7" }], activityViews: [{ id: "abcdefgh3", name: "Food", params: { category_id: "4", evil: "<x>" } }] });
    assert.deepEqual(clean.homeOrder, ["recent", "balances", "summary", "accounts", "attention"]);
    assert.deepEqual(clean.homeHidden, ["recent"]);
    assert.deepEqual(clean.templates.map((item) => item.name), ["Rent"], "a template with a bad amount is dropped");
    assert.deepEqual(clean.activityViews[0].params, { category_id: "4" });

    const refusing = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    const store = createPreferenceStore("k", refusing, null);
    store.change(() => ({ homeHidden: ["summary"] }));
    assert.deepEqual(store.getSnapshot().homeHidden, ["summary"]);
    assert.equal(store.getSnapshot().persisted, false);
  });
});

describe("quick entries", () => {
  const backend = () => transactionsBackend([tx(1)], { accounts: [account({ id: 1 }), account({ id: 2, name: "Bank" })] });

  it("a template is saved on this device, opens the expense form filled in, and the form still sends nothing", async () => {
    await open("/m/templates", backend());
    await click(action("new-template"));
    const form = q("[data-sm-form='template']");
    await change(q("input", form), "Morning coffee");
    await change(qa("select", form)[0], "2");
    await change(qa("select", form)[1], "4");
    await change(qa("input[inputmode='decimal']", form)[0], "12.5");
    await submit(form);
    assert.equal(qa("[data-sm-template]").length, 1);
    assert.equal(JSON.parse(window.localStorage.getItem(prefKey)).templates[0].name, "Morning coffee");

    await click(action("use-template"));
    await settle();
    assert.equal(location(), "/m/add/expense");
    assert.ok(q("[data-sm-note='from-template']"));
    assert.equal(q("[data-sm-field='account_id'] select").value, "2");
    assert.equal(q("[data-sm-field='amount'] input").value, "12.5");
    await submit(q("form.sm-draft-form"));
    assert.equal(action("send").disabled, true);
  });

  it("deleting asks first", async () => {
    window.localStorage.setItem(prefKey, JSON.stringify({ version: 1, templates: [{ id: "abcdefgh9", name: "Rent", type: "expense", amount: "100" }] }));
    await open("/m/templates", backend());
    await click(action("delete-template"));
    assert.ok(q("[role='dialog']"));
    await click(action("confirm-delete"));
    assert.equal(qa("[data-sm-template]").length, 0);
  });
});

describe("saved filters", () => {
  it("Activity's filters can be saved under a name and opened again", async () => {
    await open("/m/activity?type=expense", transactionsBackend([tx(1), tx(2, { type: "income" })]));
    await click(action("name-view"));
    await change(q("[data-sm-saved='activity'] input"), "Spending");
    await submit(q("[data-sm-saved='activity'] form"));
    const saved = q("[data-sm-view]");
    assert.equal(saved.getAttribute("href"), "/m/activity?type=expense");
    assert.deepEqual(JSON.parse(window.localStorage.getItem(prefKey)).activityViews[0].params, { type: "expense" });
  });
});

describe("search", () => {
  it("finds pages and forms in either language, and says it does not search records", async () => {
    await open("/m/search", healthyBackend());
    const input = q("input[type='search']");
    await change(input, "budg");
    assert.ok(q("[data-sm-result='/m/planning/budgets']"));
    await change(input, "الميزانيات");
    assert.ok(q("[data-sm-result='/m/planning/budgets']"), "Arabic finds it while the interface is English");
    await change(input, "مصروف");
    assert.ok(q("[data-sm-result='/m/add/expense']"));
    await change(input, "zzzz");
    assert.ok(q("[data-sm-empty='search']"));
    assert.match(text(), /doesn't search your transactions/);
    assert.deepEqual(api.calls.filter((call) => call.path === "/transactions"), [], "no record search is pretended");
  });
});

describe("monthly review", () => {
  it("reads the four reports for the month in the address, and moves between months", async () => {
    const reports = [];
    await open("/m/review?month=2026-09", (call) => {
      if (call.path.startsWith("/reports/")) {
        reports.push(`${call.path} ${call.query.from} ${call.query.to}`);
        return { body: envelope({ report: call.path.slice(9), summary_by_currency: [] }) };
      }
      return healthyBackend()(call);
    });
    assert.deepEqual(reports.sort(), ["/reports/budgets 2026-09-01 2026-09-30", "/reports/income-expense 2026-09-01 2026-09-30", "/reports/overview 2026-09-01 2026-09-30", "/reports/savings-goals 2026-09-01 2026-09-30"]);
    await click(action("previous-month"));
    await settle();
    assert.equal(location(), "/m/review?month=2026-08");
  });
});

describe("the calendar's statuses", () => {
  it("are the full version's words in Arabic, and an unknown one is labelled, not guessed", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    const today = new Date().toISOString().slice(0, 10);
    await open("/m/planning/calendar", moreBackend({ events: [event(1, today, { status: "overdue" }), event(2, today, { status: "brand_new_state" })] }));
    assert.equal(q("[data-sm-event-status='overdue']").textContent, "متأخر");
    assert.match(q("[data-sm-event-status='brand_new_state']").textContent, /الحالة: brand new state/);
  });
});

describe("statement preview", () => {
  it("reads CSV on this device: quotes, semicolons, a byte-order mark, a guessed mapping, and possible duplicates", () => {
    const csv = `${String.fromCharCode(0xfeff)}Date;Description;Amount\n2026-10-01;"Coffee; large";12.50\n01/10/2026;Coffee; large;12.50\n2026-10-02;"Say ""hi""";\n`;
    const parsed = parseCsv(csv);
    assert.deepEqual(parsed.headers, ["Date", "Description", "Amount"]);
    assert.equal(parsed.rows[0][1], "Coffee; large");
    assert.equal(parsed.rows[2][1], 'Say "hi"');
    const mapping = suggestMapping(parsed.headers);
    assert.deepEqual(mapping, { date: "0", description: "1", amount: "2" });
    const rows = previewRows(parseCsv("Date,Description,Amount\n2026-10-01,Coffee,12.50\n01/10/2026,Coffee,12.5\n2026-10-02,Tea,\n"), mapping);
    assert.deepEqual(rows.map((row) => row.problems), [[], ["duplicate"], ["amount"]], "01/10/2026 and 12.5 read as the same row as the first");
    assert.equal(rows[1].date, "2026-10-01");
    assert.equal(importFileKind({ name: "a.pdf", size: 3 }), "type");
    assert.equal(importFileKind({ name: "a.xlsx", size: 3 }), "xlsx");
  });

  it("the page: choose an account and a CSV, map it, preview it; Upload never sends", async () => {
    await open("/m/imports/new", healthyBackend({ accounts: [account({ id: 1 })] }));
    const input = q("[data-sm-input='statement']");
    const file = new window.File(["Date,Description,Amount\n2026-10-01,Coffee,12.50\n2026-10-01,Coffee,12.50\n"], "october.csv", { type: "text/csv" });
    file.text = async () => "Date,Description,Amount\n2026-10-01,Coffee,12.50\n2026-10-01,Coffee,12.50\n";
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
    assert.equal(q("[data-sm-map='amount']").value, "2");
    assert.equal(q("[data-sm-row='3']").dataset.smProblems, "duplicate");
    assert.equal(action("upload").disabled, true);
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });
});


describe("statement preview amounts", () => {
  it("keeps every digit that matters", () => {
    const rows = previewRows(parseCsv("Date,Amount\n2026-10-01,12.50\n2026-10-02,100\n2026-10-03,0.05\n2026-10-04,1200.000\n"), { date: "0", amount: "1" });
    assert.deepEqual(rows.map((row) => row.amount), ["12.5", "100", "0.05", "1200"]);
  });
});
