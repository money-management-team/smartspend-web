import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { envelope, failure, healthyBackend, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { moreBackend } from "./helpers/moreFixture.mjs";
import { paginator } from "./helpers/planningFixture.mjs";

const { buildTrend } = await import("../src/mobile/models/trend.js");
const { mobileDestination } = await import("../src/mobile/auth/destination.js");

/*
 * Mobile sign-in and registration (through the app's AuthProvider, faked here),
 * AI feedback and the delete review, report trends, and the PDF download name.
 * The fake backend refuses anything but GET.
 */

after(() => dom.window.close());

let api;
let view;
const text = (root = document.body) => root.textContent.replace(/\s+/g, " ");
const action = (name, root = document) => root.querySelector(`[data-sm-action='${name}']`);
const SIGNED_OUT = { isAuthenticated: false, initializing: false, token: null, user: null };
const SIGNED_IN = { isAuthenticated: true, initializing: false, token: TOKEN_A, user: USER_A, workspace: { id: 1, base_currency_code: "ILS", timezone: "UTC" } };

beforeEach(async () => {
  await resetEnvironment();
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("Mobile sign-in", () => {
  const mountSignedOut = async (entry, extra = {}) => {
    api = installFakeApi(healthyBackend());
    const calls = [];
    const auth = { ...SIGNED_OUT, ...extra, login: async (credentials, options) => { calls.push({ credentials, options }); if (extra.fail) throw extra.fail; await view.setAuth(SIGNED_IN); return USER_A; }, register: async (payload) => { calls.push({ payload }); if (extra.fail) throw extra.fail; await view.setAuth(SIGNED_IN); return USER_A; } };
    view = await mountMobile({ entry, auth });
    return calls;
  };

  it("a signed-out Mobile visit goes to Mobile sign-in, then back to the page asked for, through the app's own login", async () => {
    const calls = await mountSignedOut("/m/activity?type=expense");
    assert.equal(location(), "/m/signin");
    assert.equal(q("[data-sm-screen='signin']") !== null, true);
    await change(q("input[autocomplete='username']"), " alex@example.test ");
    await change(q("input[autocomplete='current-password']"), "secret-1");
    assert.equal(q("[data-sm-form='signin'] input[type='checkbox']").checked, true, "Remember me is on, as on the full version");
    await submit(q("[data-sm-form='signin']"));
    await settle();
    assert.deepEqual(calls[0], { credentials: { identifier: "alex@example.test", password: "secret-1" }, options: { remember: true } });
    assert.equal(location(), "/m/activity?type=expense");
    assert.equal(Object.keys(window.localStorage).filter((key) => /token/i.test(key) && key !== "ACCESS_TOKEN").length, 0, "Mobile stores no token of its own");
  });

  it("empty fields are said before anything is asked; a wrong password is said without saying which part was wrong", async () => {
    const calls = await mountSignedOut("/m/signin", { fail: Object.assign(new Error("Unauthenticated."), { name: "ApiError", code: "UNAUTHENTICATED", status: 401 }) });
    await submit(q("[data-sm-form='signin']"));
    assert.equal(calls.length, 0);
    assert.match(text(q("[data-sm-auth-error]")), /need attention/);
    await change(q("input[autocomplete='username']"), "alex@example.test");
    await change(q("input[autocomplete='current-password']"), "wrong");
    await submit(q("[data-sm-form='signin']"));
    await settle();
    assert.equal(document.activeElement, q("[data-sm-auth-error]"));
    assert.match(text(q("[data-sm-auth-error]")), /don't match an account/);
    assert.equal(location(), "/m/signin");
  });

  it("the password can be shown, the reset and Google links go to the full version's pages, and a signed-in visitor is not shown sign-in", async () => {
    await mountSignedOut("/m/signin");
    const password = q("input[autocomplete='current-password']");
    assert.equal(password.type, "password");
    await click(action("toggle-password"));
    assert.equal(password.type, "text");
    assert.equal(qa("a").find((link) => /Forgot/.test(link.textContent)).getAttribute("href"), "/forgot-password");
    assert.ok(q("[data-sm-google]"), "Google sign-in uses the app's own mechanism (Decision C); unconfigured in tests");
    await view.unmount();
    api.restore();
    storeSession({ token: TOKEN_A, user: USER_A });
    api = installFakeApi(healthyBackend());
    view = await mountMobile({ entry: "/m/signin" });
    assert.equal(location(), "/m");
  });

  it("registration: the full version's fields and consent, checked first, then the app's register, then Profile for verification", async () => {
    const calls = await mountSignedOut("/m/register");
    await submit(q("[data-sm-form='register']"));
    assert.equal(calls.length, 0);
    const form = q("[data-sm-form='register']");
    await change(q("input[autocomplete='name']", form), "Alex Example");
    await change(q("input[autocomplete='username']", form), "alex@example.test");
    const [password, confirmation] = qa("input[autocomplete='new-password']", form);
    await change(password, "secret-12");
    await change(confirmation, "secret-13");
    await submit(form);
    assert.match(text(form), /don't match/);
    await change(confirmation, "secret-12");
    await click(q("input[type='checkbox']", form));
    await submit(form);
    await settle();
    assert.deepEqual(calls[0].payload, { name: "Alex Example", identifier: "alex@example.test", password: "secret-12", password_confirmation: "secret-12", terms_accepted: true, privacy_accepted: true });
    assert.equal(location(), "/m/profile");
  });

  it("after sign-in goes only to a safe Mobile address, never back to sign-in", () => {
    assert.equal(mobileDestination({ from: "/m/planning/goals/1" }), "/m/planning/goals/1");
    assert.equal(mobileDestination({ from: "//evil.example" }), "/m");
    assert.equal(mobileDestination({ from: "/dashboard" }), "/m");
    assert.equal(mobileDestination({ from: "/m/signin" }), "/m");
    assert.equal(mobileDestination(null), "/m");
  });
});

describe("AI feedback and deleting a conversation", () => {
  const backend = (call) => {
    if (call.path === "/ai/conversations/5") return { body: envelope({ messages: paginator([{ id: 51, role: "user", content: "Q" }, { id: 52, role: "assistant", content: "A", sources: [] }], { perPage: 50 }) }) };
    return failure(404);
  };

  it("feedback needs a rating, keeps a comment within 1,000 characters, and is never sent", async () => {
    storeSession({ token: TOKEN_A, user: USER_A });
    api = installFakeApi(backend);
    view = await mountMobile({ entry: "/m/assistant/conversations/5" });
    assert.equal(qa("[data-sm-role='user'] [data-sm-action='rate']").length, 0, "only answers are rated");
    await click(q("[data-sm-role='assistant'] [data-sm-action='rate']"));
    const form = q("[data-sm-form='ai-feedback']");
    await submit(form);
    assert.match(text(form), /Choose a rating/);
    await click(qa("input[type='radio']", form)[1]);
    await change(q("textarea", form), "x".repeat(1001));
    await submit(form);
    assert.match(text(form), /at most 1000/);
    await change(q("textarea", form), "Missed my rent");
    await submit(form);
    assert.ok(q("[data-sm-note='feedback-ready']", form));
    assert.equal(action("send", form).disabled, true);
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });

  it("delete review: what it means from the source, nothing removed, last button disabled", async () => {
    storeSession({ token: TOKEN_A, user: USER_A });
    api = installFakeApi(backend);
    view = await mountMobile({ entry: "/m/assistant/conversations/5" });
    await click(action("delete-conversation"));
    const dialog = q("[role='dialog']");
    assert.match(text(dialog), /not affected/);
    assert.equal(action("confirm-delete", dialog).disabled, true);
    await click(action("keep-conversation", dialog));
    assert.equal(qa("[data-sm-role]").length, 2, "the conversation is still shown");
  });
});

describe("report trends", () => {
  it("reads the documented shapes per currency, in date order, with gaps and negatives as sent, never combined", () => {
    const trend = buildTrend([
      { currency_code: "ILS", points: [{ period: "2026-10", income: "100.0000", expense: "-50.2500", transaction_count: 3 }, { period: "2026-09", income: "0.0000" }] },
      { currency_code: "USD", points: [{ period: "2026-10", income: "123456789012.5000" }] },
      { currency_code: null, points: [{ period: "2026-10", income: "1" }] },
    ]);
    assert.deepEqual(trend.map((row) => row.currency), ["ILS", "USD"]);
    assert.deepEqual(trend[0].series, ["income", "expense"], "a count is not a series");
    assert.deepEqual(trend[0].points.map((point) => point.label), ["2026-09", "2026-10"]);
    assert.equal(trend[0].points[0].values.expense, null, "a missing figure stays missing");
    assert.equal(trend[0].points[1].values.expense, "-50.2500");
    assert.deepEqual(buildTrend({ EUR: [{ date: "2026-10-01", net: "5" }] })[0].currency, "EUR");
    assert.deepEqual(buildTrend("nonsense"), []);
  });

  it("the report page draws one trend per currency with a table of the backend's figures, and asks for the chosen bucket", async () => {
    storeSession({ token: TOKEN_A, user: USER_A });
    api = installFakeApi((call) => {
      if (call.path === "/reports/income-expense") return { body: envelope({ report: "income-expense", summary_by_currency: [], analytics: { trend_by_currency: [{ currency_code: "ILS", points: [{ period: "2026-09", income: "10.0000", expense: "-4.0000" }, { period: "2026-10", income: "0.0000" }] }, { currency_code: "USD", points: [{ period: "2026-10", income: "7.0000" }] }] } }) };
      return moreBackend({})(call);
    });
    view = await mountMobile({ entry: "/m/reports/income-expense" });
    assert.deepEqual(qa("[data-sm-trend]").map((node) => node.dataset.smTrend), ["ILS", "USD"]);
    const ils = q("[data-sm-trend='ILS']");
    assert.equal(qa("[data-sm-series='expense'] rect.sm-trend-neg", ils).length, 1);
    assert.match(text(q("table", ils)), /No figure/);
    await click(q("[data-sm-group='week']"));
    await settle();
    assert.equal(location(), "/m/reports/income-expense?group_by=week");
    assert.equal(api.calls.filter((call) => call.path === "/reports/income-expense").at(-1).query.group_by, "week");
  });
});
