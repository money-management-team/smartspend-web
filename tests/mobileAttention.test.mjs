import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { click } from "./helpers/dom.mjs";
import { envelope, failure, healthyBackend, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { event, moreBackend } from "./helpers/moreFixture.mjs";
import { paginator } from "./helpers/planningFixture.mjs";

const { addDays, comingUp, monthOf } = await import("../src/mobile/models/attention.js");
const { todayIn } = await import("../src/mobile/forms/validation.js");

/*
 * Needs your attention (/m/attention): the full version's Attention Center on
 * Mobile, read-only. Fictional data; the fake backend refuses anything but GET.
 */

after(() => dom.window.close());

const today = todayIn("UTC");
const capture = (id, source, over = {}) => ({ id, status: "ready_for_review", source_type: source, review_version: 2, review_values: { merchant_name: `Shop ${id}`, amount: "12.5000", currency_code: "ILS" }, created_at: "2026-11-01T09:00:00Z", ...over });
const draft = (id, over = {}) => ({ id, status: "ready_for_review", review_version: 1, review_values: { description: `Taxi ${id}`, amount: "18.0000" }, account: { id: 1, name: "Wallet", currency_code: "ILS" }, created_at: "2026-11-01T09:00:00Z", ...over });

function backend({ alerts = [], receipts = [], voice = [], drafts = [], events = [], fail = {} } = {}) {
  const more = moreBackend({ events });
  return (call) => {
    if (fail[call.path]) return failure(fail[call.path], "boom");
    if (call.path === "/financial-alerts") return { body: envelope({ alerts }) };
    if (call.path === "/ai/expense-captures") return { body: envelope({ captures: paginator(receipts) }) };
    if (call.path === "/ai/voice-expense-captures") return { body: envelope({ captures: paginator(voice), voice_quota: { limit: 10, used: 0, remaining: 10, reset_at: "2026-12-01T00:00:00Z" } }) };
    if (call.path === "/integrations/whatsapp/expense-drafts") return { body: envelope({ drafts: paginator(drafts) }) };
    if (call.path === "/calendar") return more(call);
    return healthyBackend()(call);
  };
}

let api;
let view;
const text = (root = q("main")) => root.textContent.replace(/\s+/g, " ");
const open = async (options) => {
  api = installFakeApi(backend(options));
  view = await mountMobile({ entry: "/m/attention" });
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("models/attention.js", () => {
  it("moves calendar days across month and year ends, and refuses a malformed day", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("not a day", 1), null);
    assert.deepEqual(monthOf("2026-11-05"), { year: 2026, month: 11 });
  });

  it("keeps unsettled items that are overdue or due within the window, in date order", () => {
    const month = { year: 2026, month: 11 };
    const data = { period: { from: "2026-11-01" }, events: [
      event(1, "2026-11-03"), event(2, "2026-11-12"), event(3, "2026-11-06", { status: "paid" }), event(4, "2026-11-28"), event(5, "2026-11-10"),
    ], summary: { total: 5 } };
    const result = comingUp([{ data, month }], "2026-11-05", 14);
    assert.deepEqual(result.overdue.map((item) => item.date), ["2026-11-03"]);
    assert.deepEqual(result.soon.map((item) => item.date), ["2026-11-10", "2026-11-12"], "the paid one is settled; the 28th is beyond 14 days");
  });

  it("refuses a month whose response does not validate (never shows a partial list as the whole)", () => {
    assert.throws(() => comingUp([{ data: { events: "nope" }, month: { year: 2026, month: 11 } }], "2026-11-05"));
  });
});

describe("Needs your attention", () => {
  it("reads only: alerts, the three review lists filtered to ready_for_review, and this month and next of the calendar", async () => {
    await open();
    const paths = api.calls.map((call) => call.path).sort();

    assert.ok(api.calls.every((call) => call.method === "GET"));
    assert.deepEqual(paths, ["/ai/expense-captures", "/ai/voice-expense-captures", "/calendar", "/calendar", "/financial-alerts", "/integrations/whatsapp/expense-drafts"]);
    for (const path of ["/ai/expense-captures", "/ai/voice-expense-captures", "/integrations/whatsapp/expense-drafts"]) {
      assert.equal(api.calls.find((call) => call.path === path).query.status, "ready_for_review", path);
    }
    const months = api.calls.filter((call) => call.path === "/calendar").map((call) => `${call.query.year}-${call.query.month}`);
    assert.equal(new Set(months).size, 2, "this month and next");
  });

  it("lists what waits for review, each opening its own review page (where confirming is a separate step)", async () => {
    await open({ receipts: [capture(3, "receipt"), capture(4, "receipt", { status: "processing" })], voice: [capture(7, "voice")], drafts: [draft(9)] });

    const hrefs = qa("[data-sm-review]").map((row) => row.getAttribute("href"));
    assert.deepEqual(hrefs, ["/m/captures/receipts/3", "/m/captures/voice/7", "/m/whatsapp/drafts/9"], "a capture still processing is not listed");
    assert.match(text(q("[data-sm-section='review']")), /Shop 3.*Receipt.*Shop 7.*Voice note.*Taxi 9.*WhatsApp draft/);
    assert.match(text(q("[data-sm-section='review']")), /Nothing is recorded until you confirm it there/);

    await click(q("[data-sm-review='receipt:3']"));
    await settle();
    assert.equal(location(), "/m/captures/receipts/3");
  });

  it("one failing list does not hide the others, and says so in its own place", async () => {
    await open({ receipts: [capture(3, "receipt")], drafts: [draft(9)], fail: { "/ai/voice-expense-captures": 500 } });

    assert.ok(q("[data-sm-review='receipt:3']"));
    assert.ok(q("[data-sm-review='whatsapp:9']"));
    assert.ok(q("[data-sm-source-error='voice'] [data-sm-error]"));
  });

  it("a WhatsApp drafts list that is refused (no WhatsApp) is not an error worth showing", async () => {
    await open({ receipts: [capture(3, "receipt")], fail: { "/integrations/whatsapp/expense-drafts": 404 } });

    assert.equal(q("[data-sm-source-error]"), null);
    assert.ok(q("[data-sm-review='receipt:3']"));
  });

  it("shows unsettled items due soon (and overdue ones), never settled or far-off ones", async () => {
    const soon = addDays(today, 3);
    const later = addDays(today, 20);
    const monthStart = `${today.slice(0, 8)}01`;
    const overdue = today > monthStart ? monthStart : null;
    const events = [event(1, soon, { title: "Rent due" }), event(2, soon, { title: "Paid already", status: "paid" }), event(3, later, { title: "Far away" }), ...(overdue ? [event(4, overdue, { title: "Card bill" })] : [])];
    await open({ events });
    const section = q("[data-sm-section='coming-up']");

    assert.match(text(section), /Rent due/);
    assert.doesNotMatch(text(section), /Paid already|Far away/);
    if (overdue) assert.match(text(section), /Card bill.*Overdue/);
  });

  it("says plainly when nothing needs attention", async () => {
    await open();

    assert.equal(q("[data-sm-screen='attention']").dataset.smState, "clear");
    assert.match(text(), /You're all caught up/);
    assert.equal(q("[data-sm-section='review']"), null);
  });

  it("is reachable from More and from Home's alerts, and More stays current inside it", async () => {
    api = installFakeApi(backend({ alerts: [{ severity: "warning", message: "Food budget near its limit" }] }));
    view = await mountMobile({ entry: "/m" });
    assert.equal(q("[data-sm-action='open-attention']").getAttribute("href"), "/m/attention");

    await click(q("[data-sm-action='open-attention']"));
    await settle();
    assert.equal(location(), "/m/attention");
    assert.equal(q("h1").textContent, "Needs your attention");
    assert.deepEqual(qa("nav.sm-nav [aria-current]").map((item) => item.getAttribute("aria-current")), ["true"]);
    await view.unmount();
    api.restore();

    api = installFakeApi(backend());
    view = await mountMobile({ entry: "/m/more" });
    assert.equal(qa("main a[href='/m/attention']").length, 1);
  });
});
