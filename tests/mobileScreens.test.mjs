import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { account, currencyRow, dashboard, envelope, failure, healthyBackend, installFakeApi, movement, movementPage, multiCurrencyDashboard } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * Mobile Home, Accounts and an account's page, against a fake backend with
 * fictional data. Every request the screens make is recorded; the fake throws
 * the moment it sees anything but a GET.
 */

after(() => dom.window.close());

let api;
let view;

const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const spoken = (root) => qa(".sm-sr", root).map((node) => node.textContent);
const card = (id) => q(`section[aria-labelledby='${id}']`);
const click$ = (element) => click(element);
const button = (label, root = q("main")) => qa("button", root).find((item) => item.textContent.trim() === label);

async function open(entry, handler = healthyBackend(), options = {}) {
  api = installFakeApi(handler);
  view = await mountMobile({ entry, ...options });
  return view;
}

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

describe("Home: what it reads", () => {
  it("reads only GET /dashboard (this month) and GET /financial-alerts, and nothing else", async () => {
    await open("/m");

    assert.deepEqual(api.summary().sort(), ["GET /dashboard", "GET /financial-alerts"]);
    assert.equal(api.calls.find((call) => call.path === "/dashboard").query.period, "month");
    assert.deepEqual(api.violations, []);
    assert.ok(api.calls.every((call) => call.auth === `Bearer ${TOKEN_A}`));
  });

  it("sends the session's workspace to both endpoints, under the name each one expects", async () => {
    window.localStorage.setItem("workspace", JSON.stringify({ id: 7 }));
    await open("/m");

    assert.equal(api.calls.find((call) => call.path === "/dashboard").query.workspace_id, "7");
    assert.equal(api.calls.find((call) => call.path === "/financial-alerts").query.id_workspace, "7");
    assert.equal(api.calls.find((call) => call.path === "/financial-alerts").query.workspace_id, undefined);
  });

  it("never writes the workspace back to storage, unlike the Desktop dashboard", async () => {
    window.localStorage.setItem("workspace", JSON.stringify({ id: 7, name: "kept" }));
    await open("/m", healthyBackend({ dashboardData: dashboard({ scope: { workspace_id: 99, workspace_ids: [99], is_multi_currency: false, primary_currency_code: "ILS" } }) }));

    assert.equal(window.localStorage.getItem("workspace"), JSON.stringify({ id: 7, name: "kept" }));
  });
});

describe("Home: a normal single-currency day", () => {
  it("shows the balance, this month, the accounts preview and recent activity from the backend's data", async () => {
    await open("/m");
    const main = q("main");

    assert.equal(q("[data-sm-screen='home']").dataset.smState, "ready");
    assert.match(text(card("sm-home-balance")), /Balance/);
    assert.deepEqual(spoken(card("sm-home-balance")), ["1,234.50 Israeli New Shekel"]);
    assert.match(text(main), /Hello, Alex Example/);

    assert.equal(q("[data-sm-period]").dataset.smPeriod, "month");
    assert.match(text(card("sm-home-summary")), /This month/);
    assert.match(text(card("sm-home-summary")), /Oct 1 – Oct 31/);
    assert.deepEqual(spoken(card("sm-home-summary")), ["plus 2,000.00 Israeli New Shekel", "765.50 Israeli New Shekel", "plus 1,234.50 Israeli New Shekel"]);
    assert.match(text(card("sm-home-summary")), /Mobile shows this month\. Choosing another period isn't available yet\./);

    assert.match(text(card("sm-home-accounts")), /Everyday wallet/);
    assert.equal(q("a[href='/m/accounts/1']", card("sm-home-accounts")) !== null, true);
    assert.equal(q("a[href='/m/accounts']", card("sm-home-accounts")) !== null, true);

    const recent = card("sm-home-recent");
    assert.deepEqual(qa(".sm-row-title", recent).map((node) => node.textContent), ["Groceries", "Freelance payment"]);
    assert.deepEqual(spoken(recent), ["minus 45.25 Israeli New Shekel", "plus 300.00 Israeli New Shekel"]);
  });

  it("has no period control that does nothing: the period is a label, not a button, link or input", async () => {
    await open("/m");
    const summary = card("sm-home-summary");

    assert.equal(qa("button, a, input, select, [role='button'], [role='tab']", summary).length, 0);
  });

  it("has one h1 (the app bar), h2 for each section, and no deeper headings", async () => {
    await open("/m");

    assert.deepEqual(qa("h1").map((node) => node.textContent), ["Home"]);
    assert.ok(qa("h2").length >= 4);
    assert.equal(qa("h3, h4, h5, h6").length, 0);
    assert.equal(qa("section[aria-labelledby]").every((section) => q(`#${section.getAttribute("aria-labelledby")}`)), true, "every section is labelled by a heading that exists");
  });

  it("names account rows with their name, type and spoken balance, in that order", async () => {
    await open("/m");
    const link = q("a[href='/m/accounts/1']", card("sm-home-accounts"));

    assert.match(link.textContent, /Everyday wallet.*Cash/);
    assert.deepEqual(spoken(link), ["1,234.50 Israeli New Shekel"]);
  });
});

describe("Home: several currencies", () => {
  beforeEach(() => undefined);

  it("lists each currency on its own, primary first, with no combined total", async () => {
    await open("/m", healthyBackend({ dashboardData: multiCurrencyDashboard() }));
    const hero = card("sm-home-balance");

    assert.match(text(hero), /Balances by currency/);
    assert.deepEqual(qa("[data-sm-currency]", hero).map((row) => row.dataset.smCurrency), ["ILS", "USD", "EUR"]);
    assert.deepEqual(spoken(hero), ["1,234.50 Israeli New Shekel", "500.25 US Dollar", "minus 20.50 Euro"]);
    assert.equal(qa(".sm-chip", hero).map((chip) => chip.textContent).join(), "Primary");
    assert.match(text(hero), /never added together/);

    // 1,234.50 + 500.25 - 20.50: no such figure exists anywhere on the screen.
    assert.doesNotMatch(text(q("main")), /1,714\.25|1,714/);
  });

  it("keeps income and expenses per currency, labelled with the currency", async () => {
    await open("/m", healthyBackend({ dashboardData: multiCurrencyDashboard() }));
    const blocks = qa("[data-sm-currency]", card("sm-home-summary"));

    assert.deepEqual(blocks.map((block) => block.dataset.smCurrency), ["ILS", "USD", "EUR"]);
    assert.deepEqual(blocks.map((block) => q(".sm-subhead", block).textContent), ["ILS", "USD", "EUR"]);
    assert.deepEqual(spoken(blocks[1]), ["plus 900.00 US Dollar", "399.75 US Dollar", "plus 500.25 US Dollar"]);
  });

  it("shows a negative balance with a minus sign in the text, not by colour alone", async () => {
    await open("/m", healthyBackend({ dashboardData: multiCurrencyDashboard() }));
    const euro = q("[data-sm-currency='EUR']", card("sm-home-balance"));

    assert.match(euro.textContent, /−20\.50/);
    assert.ok(q(".sm-money-negative", euro));
  });

  it("shows no balance at all, and says so, when the backend's currency grouping contradicts itself", async () => {
    const data = dashboard({ summary_by_currency: [currencyRow("ILS"), currencyRow("USD")], scope: { is_multi_currency: false, primary_currency_code: "ILS" } });
    await open("/m", healthyBackend({ dashboardData: data }));
    const hero = card("sm-home-balance");

    assert.equal(qa(".sm-money", hero).length, 0);
    assert.match(text(hero), /isn't available right now/);
    assert.match(text(hero), /won't show a figure it can't confirm/);
    assert.doesNotMatch(text(q("main")), /(^|[^\d.,])0\.00/);
  });
});

describe("Home: empty, unavailable and partial", () => {
  it("shows an honest empty state for a user with no accounts, never a zero balance", async () => {
    const data = dashboard({ summary_by_currency: [], accounts: [], totals: { accounts_count: 0 }, recent_transactions: [] });
    await open("/m", healthyBackend({ dashboardData: data }));

    assert.match(text(card("sm-home-balance")), /No accounts yet, so there is no balance to show/);
    assert.equal(qa(".sm-money").length, 0);
    assert.match(text(card("sm-home-accounts")), /No accounts yet/);
    assert.ok(q("a[href='/dashboard/accounts']", card("sm-home-accounts")), "the way to add one is the full version");
    assert.match(text(card("sm-home-recent")), /No recent activity/);
    assert.doesNotMatch(text(q("main")), /(^|[^\d.,])0\.00/);
  });

  it("one bad section does not take the others down", async () => {
    await open("/m", healthyBackend({ dashboardData: dashboard({ accounts: "garbage", recent_transactions: undefined }) }));

    assert.deepEqual(spoken(card("sm-home-balance")), ["1,234.50 Israeli New Shekel"]);
    assert.match(text(card("sm-home-accounts")), /aren't available right now/);
    assert.match(text(card("sm-home-recent")), /isn't available right now/);
  });

  it("shows — and 'Not available' for an amount the backend sent wrongly, never 0.00", async () => {
    const data = dashboard({ summary_by_currency: [currencyRow("ILS", { current_balance: "twelve", income: null })] });
    await open("/m", healthyBackend({ dashboardData: data }));

    assert.deepEqual(spoken(card("sm-home-balance")), ["Not available"]);
    assert.equal(qa(".sm-money-na", card("sm-home-summary")).length >= 1, true);
    assert.doesNotMatch(text(q("main")), /(^|[^\d.,])0\.00/);
  });

  it("shows the budget alerts the backend reports, and nothing when there are none", async () => {
    await open("/m", healthyBackend({ alerts: { alerts: [{ type: "budget_exceeded", severity: "critical", message: "Food budget exceeded", budget_id: 4 }, { type: "budget_near_limit", severity: "warning", message: "Travel budget near its limit" }] } }));
    const attention = card("sm-home-attention");

    assert.match(text(attention), /Budget alerts: 2/);
    assert.deepEqual(qa(".sm-alert", attention).map((alert) => alert.dataset.smSeverity), ["critical", "warning"]);
    assert.match(text(attention), /Food budget exceeded/);

    await view.unmount();
    api.restore();
    await open("/m");
    assert.equal(card("sm-home-attention"), null);
  });

  it("alerts failing is a failure of that section only, with its own Try again", async () => {
    let alertsOk = false;
    await open("/m", (call) => (call.path === "/financial-alerts" && !alertsOk ? failure(500, "boom") : healthyBackend({ alerts: { alerts: [{ severity: "info", message: "Heads up" }] } })(call)));
    const attention = card("sm-home-attention");

    assert.deepEqual(spoken(card("sm-home-balance")), ["1,234.50 Israeli New Shekel"], "the rest of Home is intact");
    assert.equal(q("[data-sm-error]", attention).dataset.smError, "server");

    alertsOk = true;
    await click$(button("Try again", attention));
    await settle();

    assert.match(text(card("sm-home-attention")), /Heads up/);
    assert.equal(api.calls.filter((call) => call.path === "/financial-alerts").length, 2);
  });
});

describe("Home: loading and failing", () => {
  it("shows placeholders without numbers while the first read runs", async () => {
    let release;
    await open("/m", (call) => (call.path === "/dashboard" ? new Promise((resolve) => { release = () => resolve({ body: envelope(dashboard()) }); }) : healthyBackend()(call)));

    const loading = q("[data-sm-screen='home']");
    assert.equal(loading.dataset.smState, "loading");
    assert.equal(loading.getAttribute("aria-busy"), "true");
    assert.match(text(loading), /Loading your balances/);
    assert.equal(qa(".sm-money", loading).length, 0);
    assert.doesNotMatch(text(loading), /\d/);

    release();
    await settle();
    assert.equal(q("[data-sm-screen='home']").dataset.smState, "ready");
  });

  it("a failed first read says what happened and offers only Try again, which sends the same GET", async () => {
    let ok = false;
    await open("/m", (call) => (call.path === "/dashboard" && !ok ? failure(500, "") : healthyBackend()(call)));

    assert.equal(q("[data-sm-screen='home']").dataset.smState, "error");
    assert.equal(q("[data-sm-error]").dataset.smError, "server");
    assert.equal(qa(".sm-money").length, 0);
    assert.doesNotMatch(text(q("main")), /(^|[^\d.,])0\.00/);

    ok = true;
    await click$(button("Try again"));
    await settle();

    assert.equal(q("[data-sm-screen='home']").dataset.smState, "ready");
    assert.deepEqual(api.violations, []);
  });

  it("names each kind of failure in its own words", async () => {
    const cases = [
      [() => failure(500, ""), "server", /had a problem/],
      [() => failure(429, "slow down"), "rate", /Too many requests/],
      [() => failure(403, "no"), "forbidden", /don't have access/],
      [() => failure(404, "no"), "notFound", /may not exist/],
      [() => new Error("down"), "network", /couldn't be reached/],
      [() => ({ body: "<html>not json</html>" }), "malformed", /can't be shown safely/],
    ];

    for (const [respond, kind, words] of cases) {
      await open("/m", (call) => (call.path === "/dashboard" ? respond() : healthyBackend()(call)));
      assert.equal(q("[data-sm-error]").dataset.smError, kind);
      assert.match(text(q("[data-sm-error]")), words);
      await view.unmount();
      api.restore();
    }
  });

  it("is told apart from a server fault when the device is offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    await open("/m", (call) => (call.path === "/dashboard" ? new Error("offline") : healthyBackend()(call)));

    assert.equal(q("[data-sm-error]").dataset.smError, "offline");
    assert.match(text(q("[data-sm-error]")), /You're offline/);
  });

  it("treats a response that is not a dashboard as malformed, not as an empty one", async () => {
    await open("/m", (call) => (call.path === "/dashboard" ? { body: envelope("surprise") } : healthyBackend()(call)));

    assert.equal(q("[data-sm-error]").dataset.smError, "malformed");
    assert.equal(qa(".sm-money").length, 0);
  });
});

describe("Home: refreshing and stale", () => {
  it("keeps the figures on screen while refreshing, and marks the button busy", async () => {
    await open("/m");
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/dashboard" ? new Promise((resolve) => { release = () => resolve({ body: envelope(dashboard({ summary_by_currency: [currencyRow("ILS", { current_balance: "2000.0000" })] })) }); }) : healthyBackend()(call)));

    await click$(button("Refresh"));
    const refreshing = button("Refreshing…");
    assert.equal(refreshing.disabled, true);
    assert.equal(refreshing.getAttribute("aria-busy"), "true");
    assert.deepEqual(spoken(card("sm-home-balance")), ["1,234.50 Israeli New Shekel"], "the earlier read is still shown");

    release();
    await settle();
    assert.deepEqual(spoken(card("sm-home-balance")), ["2,000.00 Israeli New Shekel"]);
  });

  it("when a refresh fails, the earlier figures stay, clearly marked as old, with the time and a way to retry", async () => {
    await open("/m");
    api.restore();
    api = installFakeApi((call) => (call.path === "/dashboard" ? failure(503, "") : healthyBackend()(call)));

    await click$(button("Refresh"));
    await settle();

    const page = q("[data-sm-screen='home']");
    assert.equal(page.dataset.smState, "stale");
    assert.equal(page.dataset.smStale, "true");
    assert.match(text(q("[data-sm-stale]")), /Showing what was loaded at \d\d?:\d\d/);
    assert.match(text(q(".sm-stale")), /may be out of date/);
    assert.deepEqual(spoken(card("sm-home-balance")), ["1,234.50 Israeli New Shekel"]);
    assert.ok(button("Try again", q(".sm-stale")));
  });

  it("the stale figures are only kept in memory: nothing about them is stored", async () => {
    await open("/m");
    const stored = JSON.stringify([window.localStorage, window.sessionStorage].map((storage) => Object.keys(storage).map((key) => storage.getItem(key))));

    assert.doesNotMatch(stored, /1234\.5|Everyday wallet|Groceries/);
  });
});

describe("Home: hiding amounts and language", () => {
  it("respects the 'hide amounts' device preference of the full app, and never writes it", async () => {
    const key = "smartspend:experience:v1:u:1:w:1";
    const preferences = JSON.stringify({ version: 1, hiddenMoney: true });
    window.localStorage.setItem(key, preferences);
    await open("/m");

    assert.ok(qa(".sm-money-hidden").length >= 5);
    assert.deepEqual(spoken(card("sm-home-balance")), ["Amount hidden"]);
    assert.doesNotMatch(text(q("main")), /1,234|2,000|765|45\.25|300\.00/);
    assert.equal(window.localStorage.getItem(key), preferences, "Mobile did not rewrite the preference");
  });

  it("works in Arabic: right-to-left page, Arabic words, Latin digits kept in one left-to-right run", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    await open("/m", healthyBackend({ dashboardData: multiCurrencyDashboard() }));

    assert.equal(document.documentElement.dir, "rtl");
    assert.match(text(card("sm-home-balance")), /الأرصدة حسب العملة/);
    for (const run of qa(".sm-money-run")) {
      assert.equal(run.getAttribute("dir"), "ltr");
      assert.doesNotMatch(run.textContent, /[٠-٩]/);
    }
    assert.match(text(q("main")), /مرحبًا، Alex Example/);
    assert.ok(q(".sm-chevron svg"), "a chevron is drawn");
  });
});

describe("Accounts list", () => {
  it("reads only GET /accounts and groups the accounts by currency, each with its own balance and no totals", async () => {
    const accounts = [account({ id: 3, name: "Dollar savings", type: "savings", currency_code: "USD", current_balance: "500.2500" }), account({ id: 1 }), account({ id: 2, name: "Spare cash", current_balance: "10.0050" })];
    await open("/m/accounts", healthyBackend({ accounts }));

    assert.deepEqual(api.summary(), ["GET /accounts"]);
    assert.equal(q("[data-sm-screen='accounts']").dataset.smState, "ready");
    assert.deepEqual(qa("section[data-sm-currency]").map((group) => group.dataset.smCurrency), ["ILS", "USD"], "the workspace's primary currency first");
    assert.deepEqual(qa("section[data-sm-currency='ILS'] .sm-row-title").map((node) => node.textContent), ["Everyday wallet", "Spare cash"]);
    assert.deepEqual(spoken(q("section[data-sm-currency='ILS']")), ["1,234.50 Israeli New Shekel", "10.005 Israeli New Shekel"]);
    assert.equal(q("[data-sm-count]").dataset.smCount, "3");
    assert.match(text(q("main")), /Accounts: 3/);
    assert.doesNotMatch(text(q("main")), /1,244|total/i);
    assert.ok(q("a[href='/m/accounts/3']"));
  });

  it("shows the account type, status and a link to each account, and states that changes happen in the full version", async () => {
    await open("/m/accounts", healthyBackend({ accounts: [account({ type: "bank" }), account({ id: 2, name: "Old card", status: "archived", archived_at: "2026-06-01T00:00:00Z" })] }));

    assert.match(text(q("a[href='/m/accounts/1']")), /Bank/);
    assert.match(text(q("a[href='/m/accounts/2']")), /Archived/);
    assert.match(text(q("main")), /use the full version/);
    assert.ok(q("a[href='/dashboard/accounts']", q("main")));
    assert.equal(qa("form, input, textarea, select").length, 0);
  });

  it("shows long names without cutting them, and very large balances exactly", async () => {
    const longName = "A very long account name that keeps going and going so that it must wrap on a 320 pixel wide screen";
    await open("/m/accounts", healthyBackend({ accounts: [account({ name: longName, current_balance: "123456789012345.6789" })] }));

    assert.equal(q(".sm-row-title").textContent, longName);
    assert.deepEqual(spoken(q(".sm-row")), ["123,456,789,012,345.6789 Israeli New Shekel"]);
  });

  it("says there are no accounts, and where accounts can be added", async () => {
    await open("/m/accounts", healthyBackend({ accounts: [] }));

    assert.equal(q("[data-sm-screen='accounts']").dataset.smState, "empty");
    assert.match(text(q("main")), /No accounts yet/);
    assert.ok(q("a[href='/dashboard/accounts']"));
    assert.equal(qa(".sm-money").length, 0);
  });

  it("shows placeholders while loading, and an error with Try again when the read fails", async () => {
    let ok = false;
    let release;
    await open("/m/accounts", (call) => (call.path === "/accounts" ? (ok ? healthyBackend()(call) : new Promise((resolve) => { release = () => resolve(failure(500, "")); })) : healthyBackend()(call)));

    assert.equal(q("[data-sm-screen='accounts']").dataset.smState, "loading");
    release();
    await settle();
    assert.equal(q("[data-sm-error]").dataset.smError, "server");

    ok = true;
    await click$(button("Try again"));
    await settle();
    assert.equal(q("[data-sm-screen='accounts']").dataset.smState, "ready");
  });

  it("is reachable from Home and from More, and More stays current while inside it", async () => {
    await open("/m/more");
    assert.ok(q("a[href='/m/accounts']", q("main")));

    await click$(q("a[href='/m/accounts']", q("main")));
    await settle();
    assert.equal(location(), "/m/accounts");
    assert.equal(q("h1").textContent, "Accounts");
    assert.deepEqual(qa("nav.sm-nav [aria-current]").map((item) => [item.textContent.trim(), item.getAttribute("aria-current")]), [["More", "true"]]);
  });
});

describe("Account details", () => {
  const detail = (over = {}) => account({ id: 5, name: "Travel card", type: "bank", current_balance: "-25.5000", opening_balance: "100.0000", allow_negative_balance: true, low_balance_threshold: "20.0000", last_four_digits: "4321", ...over });
  const backend = (over = {}) => healthyBackend({ accounts: [detail(over.account)], movements: over.movements ?? movementPage([movement(1, 5, "-45.2500"), movement(2, 5, "300.0000")]) });

  it("reads GET /accounts/{id} and that account's movements, and nothing else", async () => {
    await open("/m/accounts/5", backend());

    assert.deepEqual(api.summary().sort(), ["GET /accounts/5", "GET /transactions"]);
    assert.deepEqual(api.calls.find((call) => call.path === "/transactions").query, { account_id: "5", page: "1", per_page: "20", sort_by: "occurred_at", sort_dir: "desc" });
    assert.deepEqual(api.violations, []);
  });

  it("shows the confirmed balance exactly, its currency, and the read-only facts", async () => {
    await open("/m/accounts/5", backend());
    const hero = q("section[aria-labelledby='sm-account-name']");

    assert.equal(q("#sm-account-name").textContent, "Travel card");
    assert.deepEqual(spoken(hero), ["minus 25.50 Israeli New Shekel"]);
    assert.match(text(hero), /Confirmed by SmartSpend\. It is not calculated on this device\./);
    const facts = text(q("section[aria-labelledby='sm-account-facts']"));
    assert.match(facts, /Currency.*ILS/);
    assert.match(facts, /Opening balance/);
    assert.match(facts, /Allows a negative balance.*Yes/);
    assert.match(facts, /Low-balance alert/);
    assert.match(facts, /•••• 4321/);
    assert.equal(q("h1").textContent, "Account");
  });

  it("lists movements with the direction and amount of this account's ledger lines", async () => {
    await open("/m/accounts/5", backend());
    const movements = q("section[aria-labelledby='sm-movements-title']");

    assert.deepEqual(qa(".sm-row-title", movements).map((node) => node.textContent), ["Coffee", "Salary"]);
    assert.deepEqual(spoken(movements), ["minus 45.25 Israeli New Shekel", "plus 300.00 Israeli New Shekel"]);
    assert.deepEqual(qa("li[data-sm-direction]", movements).map((row) => row.dataset.smDirection), ["out", "in"]);
  });

  it("loads the next page only when asked, and appends it", async () => {
    const pages = {
      1: movementPage([movement(1, 5, "-1.0000")], { page: 1, perPage: 20, total: 21 }),
      2: movementPage([movement(2, 5, "2.0000")], { page: 2, perPage: 20, total: 21 }),
    };
    await open("/m/accounts/5", (call) => (call.path === "/transactions" ? { body: envelope(pages[call.query.page]) } : healthyBackend({ accounts: [detail()] })(call)));

    assert.equal(api.calls.filter((call) => call.path === "/transactions").length, 1);
    await click$(button("Load more", q("section[aria-labelledby='sm-movements-title']")));
    await settle();

    assert.equal(api.calls.filter((call) => call.path === "/transactions").length, 2);
    assert.equal(api.calls.at(-1).query.page, "2");
    assert.equal(qa("li[data-sm-direction]").length, 2);
    assert.equal(document.activeElement.dataset.smPage, "2", "focus moves to the new rows when the button that had it goes away");
    assert.equal(document.activeElement.getAttribute("aria-label"), "Movements, page 2");
    assert.ok(!button("Load more"), "the last page has no more button");
    assert.equal(qa("[data-sm-more]").length, 0);
    assert.match(text(q("main")), /That's all the movements/);
  });

  it("says when there are no movements", async () => {
    await open("/m/accounts/5", backend({ movements: movementPage([]) }));
    assert.match(text(q("section[aria-labelledby='sm-movements-title']")), /No movements yet/);
  });

  it("a failing movements page is an error in that section only, with its own Try again", async () => {
    let ok = false;
    await open("/m/accounts/5", (call) => (call.path === "/transactions" && !ok ? failure(500, "") : backend()(call)));

    assert.deepEqual(spoken(q("section[aria-labelledby='sm-account-name']")), ["minus 25.50 Israeli New Shekel"], "the account itself is shown");
    const section = q("section[aria-labelledby='sm-movements-title']");
    assert.equal(q("[data-sm-error]", section).dataset.smError, "server");

    ok = true;
    await click$(button("Try again", section));
    await settle();
    assert.equal(qa("li[data-sm-direction]").length, 2);
  });

  it("refuses a movements page that does not hold together, instead of showing part of it", async () => {
    const wrong = movement(1, 5, "5.0000", { ledger_entries: [{ id: 10, workspace_id: 1, transaction_id: 1, account_id: 5, currency_code: "USD", signed_amount: "5.0000", entry_role: "main" }] });
    await open("/m/accounts/5", backend({ movements: movementPage([wrong]) }));

    const section = q("section[aria-labelledby='sm-movements-title']");
    assert.equal(q("[data-sm-error]", section).dataset.smError, "malformed");
    assert.equal(qa("li[data-sm-direction]").length, 0);
  });

  it("says an account isn't available without saying whether it exists or belongs to someone else", async () => {
    await open("/m/accounts/404", healthyBackend({ accounts: [] }));

    assert.equal(q("[data-sm-error]").dataset.smError, "notFound");
    assert.match(text(q("[data-sm-error]")), /may not exist, or you may not have access to it/);
    assert.equal(q("[data-sm-error] button"), null, "no retry for something that is not there");
    assert.ok(q("a[href='/m/accounts']", q("main")));
    assert.equal(api.calls.some((call) => call.path === "/transactions"), false, "no movements were asked for");
  });

  it("reports an access refusal in the same words as not found, so it never confirms that the account exists", async () => {
    await open("/m/accounts/5", (call) => (call.path === "/accounts/5" ? failure(403, "no") : healthyBackend()(call)));
    assert.equal(q("[data-sm-error]").dataset.smError, "notFound");
    assert.doesNotMatch(text(q("[data-sm-error]")), /access to this/);
  });

  it("makes no request for an address that is not an account id", async () => {
    for (const id of ["abc", "0", "-5", "5.5", "5%2F6", "1e3"]) {
      await open(`/m/accounts/${id}`, healthyBackend());
      assert.deepEqual(api.calls, [], id);
      assert.equal(q("[data-sm-error]").dataset.smError, "notFound", id);
      await view.unmount();
      api.restore();
    }
  });

  it("refuses a response about a different account than the one in the address", async () => {
    await open("/m/accounts/5", (call) => (call.path === "/accounts/5" ? { body: envelope({ account: detail({ id: 6, name: "Someone else's" }) }) } : healthyBackend()(call)));

    assert.equal(q("[data-sm-error]").dataset.smError, "malformed");
    assert.doesNotMatch(text(q("main")), /Someone else's|25\.50/);
  });

  it("shows an archived account as archived, and does not offer to change it", async () => {
    await open("/m/accounts/5", backend({ account: { status: "archived", archived_at: "2026-06-01T00:00:00Z" } }));

    assert.match(text(q("section[aria-labelledby='sm-account-name']")), /Archived/);
    assert.match(text(q("main")), /no longer accepts new activity, and its history is kept/);
  });

  it("offers no way to change anything: no form, no input, and the write features are explained, not faked", async () => {
    await open("/m/accounts/5", backend());

    assert.equal(qa("form, input, textarea, select").length, 0);
    assert.deepEqual(qa("button", q("main")).map((item) => item.textContent), [], "no buttons at all on a one-page account");
    const changes = q("section[aria-labelledby='sm-account-changes']");
    assert.match(text(changes), /Editing, archiving and statements aren't available in Mobile yet/);
    assert.ok(q("a[href='/dashboard/accounts/5']", changes), "the way to do it is the full version");
  });

  it("never leaks one account's figures into another's page while it loads", async () => {
    let release;
    await open("/m/accounts/5", backend());
    assert.match(text(q("main")), /Travel card/);

    api.restore();
    api = installFakeApi((call) => (call.path === "/accounts/6" ? new Promise((resolve) => { release = () => resolve({ body: envelope({ account: account({ id: 6, name: "Second account", current_balance: "9.0000" }) }) }); }) : call.path === "/transactions" ? { body: envelope(movementPage([])) } : failure(404, "")));
    window.history.pushState({}, "", "/m/accounts/6");
    await view.unmount();
    view = await mountMobile({ entry: "/m/accounts/6", preference: "mobile" });

    assert.doesNotMatch(text(q("main")), /Travel card|25\.50/);
    release?.();
    await settle();
    assert.match(text(q("main")), /Second account/);
  });

  it("works in Arabic: right-to-left, Arabic labels, Latin digits, mirrored back arrow", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    await open("/m/accounts/5", backend());

    assert.equal(document.documentElement.dir, "rtl");
    assert.match(text(q("main")), /الرصيد الحالي/);
    assert.match(text(q("main")), /الحركات/);
    assert.deepEqual(spoken(q("section[aria-labelledby='sm-account-name']")).map((word) => /^سالب 25\.50 /.test(word)), [true]);
    assert.equal(q(".sm-back .sm-chevron svg") !== null, true);
  });
});

describe("chevrons follow the reading direction", () => {
  it("a forward chevron points right in English and left in Arabic; a back chevron the other way", async () => {
    const icon = (selector) => q(`${selector} svg`).innerHTML;
    const seen = {};

    for (const language of ["en", "ar"]) {
      await resetEnvironment(language);
      storeSession({ token: TOKEN_A, user: USER_A });
      await open("/m/accounts/1", healthyBackend({ accounts: [account()] }));
      seen[`${language}-back`] = icon(".sm-back .sm-chevron");
      seen[`${language}-forward`] = icon("a[href='/dashboard/accounts/1'] .sm-chevron");
      await view.unmount();
      api.restore();
    }

    assert.notEqual(seen["en-forward"], seen["en-back"]);
    assert.equal(seen["en-forward"], seen["ar-back"], "forward in English is the same arrow as back in Arabic (pointing right)");
    assert.equal(seen["en-back"], seen["ar-forward"]);
  });
});

describe("Every Mobile screen reads, and only reads", () => {
  it("made no non-GET request, no request with a body, and no request outside the documented endpoints", async () => {
    const allowed = new Set(["/dashboard", "/financial-alerts", "/accounts", "/transactions"]);
    const seen = [];

    for (const entry of ["/m", "/m/accounts", "/m/accounts/1", "/m/more", "/m/activity", "/m/planning"]) {
      await open(entry, healthyBackend());
      seen.push(...api.calls);
      assert.deepEqual(api.violations, [], entry);
      await view.unmount();
      api.restore();
    }

    // Home 2 (dashboard, alerts) + Accounts 1 + an account 2 (account, movements) + Activity 1 (a page of transactions); More and Planning read nothing.
    assert.equal(seen.length, 6);
    for (const call of seen) {
      assert.equal(call.method, "GET");
      assert.equal(call.hasBody, false);
      assert.ok(allowed.has(call.path) || /^\/accounts\/\d+$/.test(call.path), call.path);
    }
  });

  it("the Add sheet is informational and sends nothing", async () => {
    await open("/m/more", healthyBackend());
    const before = api.calls.length;

    await click$(qa("nav.sm-nav button").find((item) => item.textContent.trim() === "Add"));
    assert.match(text(q("[role='dialog']")), /Nothing can be recorded from here/);
    assert.equal(qa("form, input, textarea, select", q("[role='dialog']")).length, 0);
    assert.equal(api.calls.length, before);
  });
});
