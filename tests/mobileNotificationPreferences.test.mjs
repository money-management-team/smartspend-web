import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { FORM_WRITES, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { click } from "./helpers/dom.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const writeApi = await import("../src/mobile/data/writeApi.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
const { preferenceMessageKey, preferenceWriteOutcome, preferencesAnswer } = await import("../src/mobile/models/preferenceWrites.js");

/*
 * Phase 1B of the Mobile write integration: the savings reminder preference (PATCH /notifications/preferences), the
 * only notification preference the backend has. Registered "same-result" and CLOSED in the product (APPROVED is
 * empty); opened here only through the test runner's switch, against a fake backend with fictional data.
 */

after(() => dom.window.close());

const OPERATION = "notifications.preferences";
const WORKSPACE = { id: 1, name: "Home budget", base_currency_code: "ILS", timezone: "Asia/Hebron" };
const PERSON = { ...USER_A, email: "alex@example.test", phone: "0500000000" };
let api;
let view;

const writes = () => api.calls.filter((call) => call.method !== "GET");
const reads = () => api.calls.filter((call) => call.method === "GET" && call.path === "/notifications/preferences");
const box = () => q("[data-sm-pref='savings_installment_reminders']");
const outcome = () => q("[data-sm-pref-outcome]");
const answer = (reminders, available = true) => ({ body: envelope({ preferences: { savings_installment_reminders: reminders }, channels: ["in_app"], savings_installment_reminders_available: available }) });

/* A backend that keeps the preference, answering the way NotificationController does. */
function server(state = { reminders: true, available: true }, { onPatch } = {}) {
  return (call) => {
    if (call.path !== "/notifications/preferences") return { status: 404, body: { status: false, message: "Not found" } };
    if (call.method === "GET") return answer(state.reminders, state.available);
    if (onPatch) return onPatch(call, state);
    const wanted = call.body?.savings_installment_reminders;
    if (typeof wanted !== "boolean") return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { savings_installment_reminders: ["The field must be true or false."] } } };
    state.reminders = wanted;
    return answer(state.reminders, state.available);
  };
}

const open = async (handler, { approve = [OPERATION] } = {}) => {
  storeSession({ token: TOKEN_A, user: PERSON, workspace: WORKSPACE });
  api?.restore();
  api = installFakeApi(handler, { allowWrites: [FORM_WRITES.notificationPreferences] });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry: "/m/profile", auth: { isAuthenticated: true, initializing: false, token: TOKEN_A, user: PERSON, workspace: WORKSPACE } });
  await settle();
};

beforeEach(async () => {
  await resetEnvironment();
});

afterEach(async () => {
  gate.setWriteApprovalsForTests(null);
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
});

describe("the registration", () => {
  it("is same-result, moves no money, takes no key, and is closed by default", () => {
    const write = gate.MOBILE_WRITES[OPERATION];
    assert.deepEqual({ ...write }, { endpoint: "PATCH /notifications/preferences", moves: false, key: "none", serverDedup: "same-result" });
    assert.equal(gate.isWriteOpen(OPERATION), false);
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("the sender refuses before any request exists while the gate is closed", () => {
    api = installFakeApi(() => answer(true));
    assert.throws(() => writeApi.sendNotificationPreferences({ savings_installment_reminders: false }), (error) => error.name === "WriteClosedError" && error.operation === OPERATION);
    assert.deepEqual(api.calls, []);
  });

  it("only an explicit true or false is ever sent, even with the gate open", () => {
    api = installFakeApi(() => answer(true), { allowWrites: [FORM_WRITES.notificationPreferences] });
    gate.setWriteApprovalsForTests([OPERATION]);
    for (const bad of [undefined, null, "true", "false", 1, 0, {}]) {
      assert.throws(() => writeApi.sendNotificationPreferences({ savings_installment_reminders: bad }), { code: "INVALID_VALUE" }, String(bad));
    }
    assert.throws(() => writeApi.sendNotificationPreferences(), { code: "INVALID_VALUE" });
    assert.deepEqual(api.calls, []);
  });

  it("sends the wanted value itself, so the same request twice leaves the same setting", async () => {
    const state = { reminders: true, available: true };
    api = installFakeApi(server(state), { allowWrites: [FORM_WRITES.notificationPreferences] });
    gate.setWriteApprovalsForTests([OPERATION]);
    const first = await writeApi.sendNotificationPreferences({ savings_installment_reminders: false });
    const second = await writeApi.sendNotificationPreferences({ savings_installment_reminders: false });
    assert.deepEqual(writes().map((call) => call.body), [{ savings_installment_reminders: false }, { savings_installment_reminders: false }]);
    assert.deepEqual(second.data, first.data);
    assert.equal(state.reminders, false, "still off, not switched back");
  });
});

describe("what an answer proves", () => {
  it("accepts only the preferences envelope with a saved true or false", () => {
    assert.equal(preferencesAnswer(answer(false).body.data).reminders, false);
    assert.equal(preferencesAnswer(answer(true, false).body.data).reminders, true);
    assert.equal(preferencesAnswer({ preferences: { savings_installment_reminders: "yes" } }), null);
    assert.equal(preferencesAnswer({ preferences: {} }), null);
    assert.equal(preferencesAnswer(null), null);
  });

  it("classifies failures: 422/403/429 refused, 401 identity, timeout and network unknown", () => {
    const api = (status, code) => new ApiError("x", { status, code });
    assert.equal(preferenceWriteOutcome(api(422, "VALIDATION_ERROR")).kind, "rejected");
    assert.equal(preferenceWriteOutcome(api(403, "FORBIDDEN")).kind, "rejected");
    assert.equal(preferenceWriteOutcome(api(429, "RATE_LIMITED")).kind, "rejected");
    assert.equal(preferenceWriteOutcome(api(401, "UNAUTHENTICATED")).kind, "identity");
    for (const error of [new ApiError("", { code: "TIMEOUT" }), new ApiError("", { code: "NETWORK_ERROR" }), api(500, "SERVER_ERROR"), new ApiError("", { status: 200, code: "MALFORMED_RESPONSE" })]) {
      assert.equal(preferenceWriteOutcome(error).kind, "unknown", error.code);
    }
    assert.equal(preferenceMessageKey({ kind: "rejected", code: "VALIDATION_ERROR" }), "invalid");
    assert.equal(preferenceMessageKey({ kind: "rejected", code: "FORBIDDEN" }), "forbidden");
    assert.equal(preferenceMessageKey({ kind: "confirmed" }), "saved");
    assert.equal(preferenceMessageKey({ kind: "unknown", code: "TIMEOUT" }), "unknown");
  });
});

describe("Profile and settings, gate closed (the product)", () => {
  it("the switch is a draft whose Save is disabled, and nothing is sent", async () => {
    await open(server(), { approve: null });
    await click(box());
    const closed = q("[data-sm-note='write-closed'][data-sm-write='notifications.preferences']");
    assert.ok(closed);
    assert.equal(q("[data-sm-action='save-preferences']").disabled, true);
    await click(q("[data-sm-action='save-preferences']"));
    await settle();
    assert.deepEqual(writes(), []);
    assert.equal(box().dataset.smSaved, "true", "the saved value is still the server's");
  });
});

describe("Profile and settings, the preference write opened by the test switch", () => {
  it("saves the explicit value with one request and shows the server's answer as saved", async () => {
    const state = { reminders: true, available: true };
    await open(server(state));
    assert.equal(box().checked, true);

    await click(box());
    assert.ok(q("[data-sm-section='preference-draft']"));
    assert.equal(q("[data-sm-note='write-closed']"), null, "no closed note once approved");
    await click(q("[data-sm-action='save-preferences']"));
    await settle();

    assert.deepEqual(writes().map((call) => `${call.method} ${call.path}`), ["PATCH /notifications/preferences"]);
    assert.deepEqual(writes()[0].body, { savings_installment_reminders: false });
    assert.equal(writes()[0].headers["Idempotency-Key"], undefined);
    assert.equal(box().dataset.smSaved, "false");
    assert.equal(box().checked, false);
    assert.equal(q("[data-sm-section='preference-draft']"), null, "the draft is done");
    assert.equal(outcome().dataset.smPrefOutcome, "confirmed");
    assert.equal(outcome().getAttribute("role"), "status");
    assert.match(outcome().textContent, /Saved/);
  });

  it("what the server says is what is shown, including its global switch", async () => {
    await open(server({ reminders: true, available: true }, { onPatch: () => answer(false, false) }));
    assert.equal(q("[data-sm-note='reminders-off']"), null);
    await click(box());
    await click(q("[data-sm-action='save-preferences']"));
    await settle();
    assert.equal(box().dataset.smSaved, "false");
    assert.ok(q("[data-sm-note='reminders-off']"), "the server's answer said reminders are off for everyone");
  });

  it("a second tap while saving sends nothing more", async () => {
    let release;
    const state = { reminders: true, available: true };
    await open(server(state, { onPatch: (call) => new Promise((resolve) => { release = () => { state.reminders = call.body.savings_installment_reminders; resolve(answer(state.reminders)); }; }) }));
    await click(box());
    const save = q("[data-sm-action='save-preferences']");
    await click(save);
    await settle(5);
    assert.equal(save.disabled, true);
    assert.equal(save.getAttribute("aria-busy"), "true");
    assert.equal(box().disabled, true, "the switch waits too");
    assert.equal(q("[data-sm-action='undo-preferences']").disabled, true);
    await click(save);
    assert.equal(writes().length, 1);
    release();
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(box().dataset.smSaved, "false");
  });

  it("a 422 is refused: the saved value stays the server's and the draft stays a draft", async () => {
    await open(server(undefined, { onPatch: () => ({ status: 422, body: { status: false, message: "The provided data is invalid.", errors: { savings_installment_reminders: ["Invalid."] } } }) }));
    const before = reads().length;
    await click(box());
    await click(q("[data-sm-action='save-preferences']"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(box().dataset.smSaved, "true", "not saved");
    assert.equal(box().checked, false, "the draft is still what the person chose");
    assert.ok(q("[data-sm-section='preference-draft']"));
    assert.equal(outcome().dataset.smPrefCode, "VALIDATION_ERROR");
    assert.equal(outcome().getAttribute("role"), "alert");
    assert.match(outcome().textContent, /didn't accept that value/);
    assert.equal(reads().length, before, "nothing to re-read after a refusal");
    assert.equal(q("[data-sm-action='save-preferences']").disabled, false, "may be saved again by hand");
  });

  it("a 403 is refused and nothing is shown as saved", async () => {
    await open(server(undefined, { onPatch: () => failure(403, "Your account is inactive.") }));
    await click(box());
    await click(q("[data-sm-action='save-preferences']"));
    await settle();
    assert.equal(box().dataset.smSaved, "true");
    assert.equal(outcome().dataset.smPrefCode, "FORBIDDEN");
    assert.match(outcome().textContent, /refused this change for your account/);
  });

  it("a network failure is unknown: never resent by itself, and the saved value is read again from the server", async () => {
    let attempts = 0;
    await open(server({ reminders: true, available: true }, { onPatch: () => { attempts += 1; return new TypeError("Failed to fetch"); } }));
    const before = reads().length;
    await click(box());
    await click(q("[data-sm-action='save-preferences']"));
    await settle();
    assert.equal(attempts, 1);
    assert.equal(outcome().dataset.smPrefOutcome, "unknown");
    assert.equal(outcome().dataset.smPrefCode, "NETWORK_ERROR");
    assert.match(outcome().textContent, /didn't confirm the change/);
    assert.ok(reads().length > before, "read again");
    assert.equal(box().dataset.smSaved, "true", "the server's value, not the draft");
    await settle();
    assert.equal(attempts, 1, "still once");
  });

  it("an answer naming the other value is shown as saved (it is the server's) but not called confirmed", async () => {
    await open(server(undefined, { onPatch: () => answer(true) }));
    await click(box());
    await click(q("[data-sm-action='save-preferences']"));
    await settle();
    assert.equal(box().dataset.smSaved, "true");
    assert.equal(outcome().dataset.smPrefOutcome, "unknown");
    assert.equal(outcome().dataset.smPrefCode, "DIFFERENT_VALUE");
  });

  it("Undo returns to the saved value and sends nothing", async () => {
    await open(server());
    await click(box());
    await click(q("[data-sm-action='undo-preferences']"));
    assert.equal(box().checked, true);
    assert.equal(q("[data-sm-section='preference-draft']"), null);
    assert.deepEqual(writes(), []);
  });

  it("speaks Arabic", async () => {
    await resetEnvironment("ar");
    await open(server());
    await click(box());
    assert.match(q("[data-sm-section='preference-draft']").textContent, /لم يُحفظ هذا التغيير بعد/);
    await click(q("[data-sm-action='save-preferences']"));
    await settle();
    assert.match(outcome().textContent, /حُفظ/);
  });
});
