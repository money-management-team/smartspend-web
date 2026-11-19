import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { FORM_WRITES, account, envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const { sendWorkflowWrite } = await import("../src/mobile/data/writeApi.js");
const { classifyWriteOutcome } = await import("../src/mobile/forms/useWorkflowSubmit.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
const { createExperienceStore } = await import("../src/features/Dashboards/User/Experience/experienceStore.js");
const { buildAccountArchived, buildAccountCreated, buildAccountUpdated } = await import("../src/mobile/models/accountResult.js");
const { ACCOUNT_NAME_MAX, ACCOUNT_TYPES, WORKFLOWS } = await import("../src/mobile/forms/workflows.js");

/*
 * Phase 2D: account management from Mobile. The backend has exactly three account writes (AccountController, identical on
 * develop @ fd87531 and 6b696d72 apart from the create's unique-name translation): create (POST /accounts), update
 * (PATCH /accounts/{id}) and archive (POST /accounts/{id}/archive). There is NO restore and NO "make default" endpoint, so
 * Mobile has neither.
 *
 *   create   has NO replay (unique-index): a copy is refused with 422 on `name`, never answered with the first account
 *   update   sets the sent values (same-result); refused for an archived account, a goal's account (type, currency, opening
 *            balance, negative setting), and, once the account has ledger entries, its opening balance and currency
 *   archive  once-only (a copy is a 422 "already archived"); refused for a goal's account (422) and for an account an active
 *            savings plan is funded from (409 account_funds_active_savings_plan); the ledger and history are untouched
 *
 * All three are CLOSED in the product (APPROVED is empty): these tests open them only through the test runner's switch.
 */

after(() => dom.window.close());

const OPS = { create: "account.create", update: "account.update", archive: "account.archive" };
let api;
let view;
let server;

const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
const action = (name) => q(`[data-sm-action='${name}']`);
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (node) => node.textContent.replace(/\s+/g, " ");
const choose = async (name, value) => click(q(`[data-sm-field='${name}'] input[value='${value}']`));
const options = (name) => qa("option", field(name)).map((option) => option.value);
const refuse = (message, status = 422, errors = {}, extra = {}) => ({ status, body: { status: false, message, errors, ...extra } });

const fixed = (value) => {
  const [whole, fraction = ""] = String(value).split(".");
  return `${whole}.${fraction.padEnd(4, "0").slice(0, 4)}`;
};

/* A backend that answers the way AccountController, the Store/UpdateAccountRequest rules and the account actions do. */
function accountServer({ onWrite, afterApply } = {}) {
  const accounts = [
    account({ id: 1, name: "Wallet", type: "cash", currency_code: "ILS", opening_balance: "100.0000", current_balance: "1000.0000" }),
    account({ id: 2, name: "Bank", type: "bank", currency_code: "ILS", opening_balance: "0.0000", current_balance: "9000.0000" }),
    account({ id: 3, name: "Dollar account", type: "bank", currency_code: "USD", current_balance: "500.0000" }),
    account({ id: 4, name: "Laptop savings", type: "savings", savings_goal: { id: 1, name: "Laptop" }, currency_code: "ILS", current_balance: "300.0000" }),
    account({ id: 5, name: "Old card", type: "bank", currency_code: "ILS", current_balance: "20.0000", status: "archived", archived_at: "2026-10-01T10:00:00Z" }),
    account({ id: 6, name: "Plan funding", type: "bank", currency_code: "ILS", current_balance: "700.0000" }),
    account({ id: 7, name: "Fresh", type: "cash", currency_code: "ILS", opening_balance: "50.0000", current_balance: "50.0000" }),
  ];
  const withLedger = new Set([1, 2, 3, 4, 6]);
  const fundsPlan = new Set([6]);
  const log = { created: 0, updated: 0, archived: 0 };
  let nextId = 20;
  const find = (id) => accounts.find((row) => row.id === Number(id));
  const taken = (name, except) => accounts.some((row) => row.id !== except && row.name.toLowerCase() === name.toLowerCase());
  const nameErrors = (name, except) => {
    if (typeof name !== "string" || name.length === 0) return ["The name field is required."];
    if ([...name].length > 150) return ["The name field must not be greater than 150 characters."];
    if (taken(name, except)) return ["The name has already been taken."];
    return null;
  };
  const money = (value) => /^\d+(\.\d{1,4})?$/.test(String(value));

  const create = (call) => {
    const body = call.body ?? {};
    const errors = {};
    const name = typeof body.name === "string" ? body.name.trim() : body.name;
    const nameError = nameErrors(name);
    if (nameError) errors.name = nameError;
    if (!ACCOUNT_TYPES.includes(body.type)) errors.type = ["The selected type is invalid."];
    if (!/^[A-Za-z]{3}$/.test(body.currency_code ?? "")) errors.currency_code = ["The currency code field must be 3 characters."];
    if (!money(body.opening_balance)) errors.opening_balance = ["The opening balance must be a non-negative decimal with up to 4 decimal places."];
    if (!Number.isSafeInteger(body.workspace_id)) errors.workspace_id = ["The workspace id field is required."];
    if (Object.keys(errors).length > 0) return refuse("The provided data is invalid.", 422, errors);
    const row = account({ id: ++nextId, name, type: body.type, currency_code: body.currency_code.toUpperCase(), opening_balance: fixed(body.opening_balance), current_balance: fixed(body.opening_balance), allow_negative_balance: body.allow_negative_balance ?? false });
    accounts.push(row);
    log.created += 1;
    return { status: 201, body: envelope({ account: row }) };
  };

  const update = (call) => {
    const row = find(call.path.split("/")[2]);
    const body = call.body ?? {};
    if (!row) return refuse("Not found", 404);
    if (row.id === 99) return refuse("You are not authorized to manage this account.", 403);
    if (row.status !== "active") return refuse("The provided data is invalid.", 422, { account: ["Archived accounts cannot be updated."] });
    if (row.savings_goal && ["type", "currency_code", "opening_balance", "allow_negative_balance"].some((key) => Object.hasOwn(body, key))) return refuse("The provided data is invalid.", 422, { account: ["The financial settings of a savings goal account cannot be changed directly."] });
    if (withLedger.has(row.id) && Object.hasOwn(body, "opening_balance")) return refuse("The provided data is invalid.", 422, { opening_balance: ["Opening balance cannot be changed after financial transactions exist."] });
    if (Object.hasOwn(body, "name")) {
      const trimmed = String(body.name).trim();
      const nameError = nameErrors(trimmed, row.id);
      if (nameError) return refuse("The provided data is invalid.", 422, { name: nameError });
      row.name = trimmed;
    }
    if (Object.hasOwn(body, "type")) row.type = body.type;
    if (Object.hasOwn(body, "opening_balance")) {
      row.opening_balance = fixed(body.opening_balance);
      row.current_balance = fixed(body.opening_balance);
    }
    if (Object.hasOwn(body, "allow_negative_balance")) row.allow_negative_balance = body.allow_negative_balance;
    log.updated += 1;
    return { status: 200, body: envelope({ account: row }) };
  };

  const archive = (call) => {
    const row = find(call.path.split("/")[2]);
    if (!row) return refuse("Not found", 404);
    if (row.status === "archived") return refuse("The provided data is invalid.", 422, { account: ["This account is already archived."] });
    if (row.savings_goal) return refuse("The provided data is invalid.", 422, { account: ["Archive this account through its savings goal."] });
    if (fundsPlan.has(row.id)) return refuse("An active savings plan is funded from this account. Change the plan's funding accounts or discontinue the plan first.", 409, {}, { code: "account_funds_active_savings_plan" });
    row.status = "archived";
    row.archived_at = "2026-11-16T09:00:00Z";
    log.archived += 1;
    return { status: 200, body: envelope({ account: row }) };
  };

  const handler = (call) => {
    if (call.method === "GET") {
      if (call.path === "/accounts") return { body: envelope({ accounts: accounts.filter((row) => row.status === "active") }) };
      const one = /^\/accounts\/(\d+)$/.exec(call.path);
      if (one) return find(one[1]) ? { body: envelope({ account: find(one[1]) }) } : refuse("Not found", 404);
      return refuse("Not found", 404);
    }
    const write = call.method === "POST" && call.path === "/accounts" ? create : call.method === "PATCH" ? update : /\/archive$/.test(call.path) ? archive : null;
    if (!write) return refuse("Not found", 404);
    if (onWrite) return onWrite(call, () => write(call));
    const answer = write(call);
    return afterApply ? afterApply(answer, call) : answer;
  };
  return { handler, accounts, log, find };
}

async function open(path, kind, serverOptions = {}, { approve = [OPS[kind]], language } = {}) {
  if (language) {
    await resetEnvironment(language);
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
  }
  server = serverOptions.server ?? accountServer(serverOptions);
  api?.restore();
  api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES[`account${kind[0].toUpperCase()}${kind.slice(1)}`]] });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry: path });
}

const reload = async (path) => {
  await view.unmount();
  const shared = server;
  view = await mountMobile({ entry: path });
  server = shared;
};

async function fillCreate({ name = "Savings box", type = "savings", currency = "USD", opening = "250", negative = false } = {}) {
  if (name !== null) await change(field("name"), name);
  if (type !== null) await choose("type", type);
  if (currency !== null) await change(field("currency_code"), currency);
  if (opening !== null) await change(field("opening_balance"), opening);
  if (negative) await click(field("allow_negative_balance"));
  await submit(q("form.sm-draft-form"));
}

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  gate.setWriteApprovalsForTests(null);
  assert.deepEqual(api?.violations ?? [], [], "only the opened write");
  api?.restore();
  api = null;
});

describe("the registration", () => {
  it("create has no replay (unique-index), update is same-result, archive is once-only; none moves money; all closed", () => {
    assert.deepEqual({ ...gate.MOBILE_WRITES["account.create"] }, { endpoint: "POST /accounts", moves: false, key: "none", serverDedup: "unique-index" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["account.update"] }, { endpoint: "PATCH /accounts/{id}", moves: false, key: "none", serverDedup: "same-result" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["account.archive"] }, { endpoint: "POST /accounts/{id}/archive", moves: false, key: "none", serverDedup: "once-only" });
    for (const operation of Object.values(OPS)) assert.equal(gate.isWriteOpen(operation), false);
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("there is no restore and no default-account operation, because the backend has none", () => {
    assert.deepEqual(Object.keys(gate.MOBILE_WRITES).filter((name) => name.startsWith("account.")).sort(), ["account.archive", "account.create", "account.update"]);
    assert.ok(!Object.keys(gate.MOBILE_WRITES).some((name) => /restore|unarchive|default/i.test(name)));
  });

  it("the sender refuses without a request while closed", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: [FORM_WRITES.accountCreate, FORM_WRITES.accountUpdate, FORM_WRITES.accountArchive] });
    assert.throws(() => sendWorkflowWrite({ operation: OPS.create, ids: {}, input: { workspace_id: 1, name: "x" } }), (error) => error.name === "WriteClosedError");
    assert.throws(() => sendWorkflowWrite({ operation: OPS.update, ids: { accountId: "1" }, input: { name: "x" } }), (error) => error.name === "WriteClosedError");
    assert.throws(() => sendWorkflowWrite({ operation: OPS.archive, ids: { accountId: "1" }, input: {} }), (error) => error.name === "WriteClosedError");
    assert.deepEqual(api.calls, []);
  });
});

describe("gate closed (the product)", () => {
  it("create, edit and archive can be filled in and reviewed, but Confirm is disabled and nothing is sent", async () => {
    await open("/m/add/account", "create", {}, { approve: null });
    await fillCreate();
    assert.ok(q("[data-sm-step='review']"));
    assert.equal(action("send").disabled, true);
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='account.create']"));
    await click(action("send"));
    await view.unmount();
    api.restore();

    await open("/m/accounts/1/edit", "update", {}, { approve: null });
    await change(field("name"), "Pocket");
    await submit(q("form.sm-draft-form"));
    assert.equal(action("send").disabled, true);
    await click(action("send"));
    await view.unmount();
    api.restore();

    await open("/m/accounts/2/archive", "archive", {}, { approve: null });
    await submit(q("form.sm-draft-form")); // no fields: the review comes from the button
    if (!q("[data-sm-step='review']")) await click(action("review"));
    assert.equal(action("send").disabled, true);
    await click(action("send"));
    await settle();
    assert.deepEqual(writes(), []);
  });

  it("the Accounts screen offers Add an account, and says sending is done in the full version", async () => {
    server = accountServer();
    api = installFakeApi(server.handler);
    view = await mountMobile({ entry: "/m/accounts" });
    assert.equal(action("add-account").getAttribute("href"), "/m/add/account");
    assert.match(text(q("[data-sm-screen='accounts']")), /Sending is done in the full version/);
  });
});

describe("a new account, with its write opened by the test switch", () => {
  it("offers every account type the backend has, with the currency beside the opening balance", async () => {
    await open("/m/add/account", "create");
    assert.deepEqual(qa("[data-sm-field='type'] input").map((input) => input.value), ["cash", "bank", "wallet", "savings", "custom"]);
    assert.deepEqual(options("currency_code").filter(Boolean), ["ILS", "USD", "EUR", "JOD", "SAR", "AED"]);
    assert.match(text(q("[data-sm-field='opening_balance']")), /—/, "no currency chosen yet");
    await change(field("currency_code"), "EUR");
    assert.match(text(q("[data-sm-field='opening_balance']")), /EUR/);
  });

  it("sends the backend's fields (no key, no replay claimed), then shows the account the server created", async () => {
    await open("/m/add/account", "create");
    await fillCreate({ name: "  Savings box ", opening: "250.5", negative: true });
    const review = text(q("[data-sm-step='review']"));
    assert.match(review, /Savings box/);
    assert.match(review, /Savings/);
    assert.match(review, /USD/);
    assert.match(review, /250\.50/);

    await click(action("send"));
    await settle();

    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.method, "POST");
    assert.equal(call.path, "/accounts");
    assert.equal(Object.hasOwn(call.headers, "Idempotency-Key"), false, "the backend takes none: it has no replay");
    assert.deepEqual(call.body, { workspace_id: 1, name: "Savings box", type: "savings", currency_code: "USD", opening_balance: "250.5000", allow_negative_balance: true });

    const result = q("[data-sm-account-result]");
    assert.ok(result);
    assert.equal(result.dataset.smResultKind, "created");
    assert.match(text(result), /Account added/);
    assert.match(text(q("[data-sm-result-amount]")), /250\.50/);
    assert.match(text(q("[data-sm-result='name']")), /Savings box/);
    assert.match(text(q("[data-sm-result='type']")), /Savings/);
    assert.match(text(q("[data-sm-result='currency']")), /USD/);
    assert.match(text(q("[data-sm-result='negative']")), /Yes/);
    assert.equal(action("open-account").getAttribute("href"), `/m/accounts/${server.accounts.at(-1).id}`);
    assert.equal(server.log.created, 1);
  });

  it("the name is at most 150 characters, like the backend (the full version's 255 would be refused)", async () => {
    assert.equal(ACCOUNT_NAME_MAX, 150);
    await open("/m/add/account", "create");
    await fillCreate({ name: "x".repeat(151) });
    assert.equal(q("[data-sm-step='review']"), null);
    assert.ok(q("[data-sm-summary='local']"));
    await change(field("name"), "y".repeat(150));
    await submit(q("form.sm-draft-form"));
    assert.ok(q("[data-sm-step='review']"));
    assert.deepEqual(writes(), []);
  });

  it("an empty name, no type, no currency, a negative, over-precise or malformed opening balance never reach review or the server", async () => {
    await open("/m/add/account", "create");
    await fillCreate({ name: "", type: null, currency: null, opening: "0" });
    assert.equal(q("[data-sm-step='review']"), null);
    const summary = text(q("[data-sm-summary='local']"));
    assert.match(summary, /Name/);
    assert.match(summary, /Account type/);
    assert.match(summary, /Currency/);
    for (const opening of ["-1", "1.23456", "abc", "1,000", ""]) {
      await fillCreate({ name: "Valid", type: "cash", currency: "ILS", opening });
      assert.equal(q("[data-sm-step='review']"), null, `"${opening}"`);
    }
    assert.deepEqual(writes(), []);
  });

  it("an opening balance of zero is allowed", async () => {
    await open("/m/add/account", "create");
    await fillCreate({ name: "Empty wallet", type: "wallet", currency: "ILS", opening: "0" });
    await click(action("send"));
    await settle();
    assert.equal(writes()[0].body.opening_balance, "0.0000");
    assert.ok(q("[data-sm-account-result]"));
  });

  it("a name that is taken is refused by the server, with what to check, and the lists are read again", async () => {
    await open("/m/add/account", "create");
    await fillCreate({ name: "Wallet", type: "cash", currency: "ILS", opening: "10" });
    const before = api.calls.length;
    await click(action("send"));
    await settle();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.match(text(outcome), /already exists/);
    assert.match(text(outcome), /may be the account you added/);
    assert.match(text(outcome), /The name has already been taken/);
    assert.equal(q("[data-sm-account-result]"), null);
    assert.equal(server.log.created, 0);
    assert.equal(action("send").disabled, false, "it may be changed and sent again");
    assert.ok(api.calls.slice(before).some((call) => call.method === "POST"));
  });

  it("a double tap sends one request and claims nothing before the answer", async () => {
    let release;
    await open("/m/add/account", "create", { onWrite: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await fillCreate();
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    assert.equal(q("[data-sm-account-result]"), null);
    assert.equal(action("send").disabled, true);
    await act(async () => release());
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(server.log.created, 1);
    assert.ok(q("[data-sm-account-result]"));
  });

  it("a lost answer is an unknown outcome and sends nothing more; retyping it after a reload is refused (no replay): one account exists", async () => {
    let first = true;
    await open("/m/add/account", "create", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await fillCreate();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-account-result]"), null, "nothing is claimed");
    assert.equal(action("send"), null, "this form sends nothing more by itself");
    assert.equal(writes().length, 1);
    assert.equal(server.log.created, 1, "the server did create it");

    await reload("/m/add/account");
    await fillCreate();
    await click(action("send"));
    await settle();
    // A second copy is refused for its name, never answered with the first account: the screen says the first may be the one.
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected");
    assert.match(text(q("[data-sm-outcome]")), /may be the account you added/);
    assert.equal(server.log.created, 1);
    assert.equal(server.accounts.filter((row) => row.name === "Savings box").length, 1);
  });

  it("a timeout, a dropped connection and a 5xx are unknown outcomes", async () => {
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "TIMEOUT" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "NETWORK_ERROR" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 500, code: "SERVER_ERROR" })).kind, "unknown");
    await open("/m/add/account", "create", { onWrite: () => ({ status: 504, body: { status: false, message: "Gateway Timeout" } }) });
    await fillCreate();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(action("send"), null);
  });

  it("a 403 (another workspace) is a certain refusal", async () => {
    await open("/m/add/account", "create", { onWrite: () => refuse("You are not authorized to manage this account.", 403) });
    await fillCreate();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected");
    assert.match(text(q("[data-sm-outcome]")), /not authorized/);
  });

  it("a 2xx that isn't provably this account is acknowledged generically, with no figures", async () => {
    const wrong = (over) => ({ status: 201, body: envelope({ account: { id: 77, name: "Savings box", type: "savings", currency_code: "USD", opening_balance: "250.0000", current_balance: "250.0000", allow_negative_balance: false, status: "active", ...over } }) });
    for (const over of [{ name: "Other" }, { type: "cash" }, { currency_code: "EUR" }, { opening_balance: "999.0000" }, { allow_negative_balance: true }, { status: "archived" }]) {
      await open("/m/add/account", "create", { onWrite: () => wrong(over) });
      await fillCreate();
      await click(action("send"));
      await settle();
      assert.equal(q("[data-sm-account-result]"), null, JSON.stringify(over));
      assert.match(text(q("[data-sm-outcome]")), /Recorded/);
      await view.unmount();
      api.restore();
      window.localStorage.clear();
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    }
  });

  it("with amounts hidden the result masks the balance", async () => {
    createExperienceStore({ userId: USER_A.id, workspaceId: 1, storage: window.localStorage, eventTarget: window }).update({ hiddenMoney: true });
    await open("/m/add/account", "create");
    await fillCreate();
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-result-amount] .sm-money-hidden"));
    assert.doesNotMatch(text(q("[data-sm-account-result]")), /250/);
  });

  it("speaks Arabic", async () => {
    await open("/m/add/account", "create", {}, { language: "ar" });
    await fillCreate();
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-account-result]")), /تمت إضافة الحساب/);
  });
});

describe("editing an account", () => {
  it("loads the account; the currency is shown, not editable; a goal's, an archived or another workspace's account has no form", async () => {
    await open("/m/accounts/1/edit", "update");
    assert.equal(field("name").value, "Wallet");
    assert.equal(field("opening_balance").value, "100");
    assert.equal(q("[data-sm-field='currency_code'][data-sm-locked='true']") !== null, true);
    await view.unmount();
    api.restore();
    for (const [id, reason] of [[4, "goalAccount"], [5, "archived"]]) {
      await open(`/m/accounts/${id}/edit`, "update");
      assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, reason);
      assert.equal(q("form.sm-draft-form"), null);
      await view.unmount();
      api.restore();
    }
    await open("/m/accounts/99/edit", "update");
    assert.equal(q("form.sm-draft-form"), null, "a 404 (another workspace's account) is not a form");
    assert.deepEqual(writes(), []);
  });

  it("reviews the original beside the proposal, sends only what changed, then shows the account as the server saved it", async () => {
    await open("/m/accounts/1/edit", "update");
    await change(field("name"), " Pocket money ");
    await choose("type", "wallet");
    await click(field("allow_negative_balance"));
    await submit(q("form.sm-draft-form"));
    const review = q("[data-sm-step='review']");
    assert.match(text(q("[data-sm-was='name']", review)), /Was:.*Wallet/);
    assert.match(text(q("[data-sm-was='type']", review)), /Was:.*Cash/);
    assert.ok(q("[data-sm-was='allow_negative_balance']", review));
    assert.equal(q("[data-sm-was='opening_balance']", review), null);

    await click(action("send"));
    await settle();
    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.method, "PATCH");
    assert.equal(call.path, "/accounts/1");
    assert.deepEqual(call.body, { name: "Pocket money", type: "wallet", allow_negative_balance: true });
    assert.equal(Object.hasOwn(call.body, "currency_code"), false);
    assert.equal(Object.hasOwn(call.headers, "Idempotency-Key"), false);

    const result = q("[data-sm-account-result]");
    assert.equal(result.dataset.smResultKind, "updated");
    assert.match(text(q("[data-sm-result='name']")), /Pocket money/);
    assert.match(text(q("[data-sm-result='type']")), /Wallet/);
    assert.match(text(q("[data-sm-result-amount]")), /1,000\.00/, "the balance is the server's");
    assert.equal(server.log.updated, 1);
  });

  it("nothing changed, or an empty or over-long name, never reaches review or the server", async () => {
    await open("/m/accounts/1/edit", "update");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null);
    await change(field("name"), "");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null);
    await change(field("name"), "z".repeat(151));
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null);
    await change(field("name"), "Wallet");
    await change(field("opening_balance"), "-5");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null);
    assert.deepEqual(writes(), []);
  });

  it("the opening balance after money has moved is refused by the server with its words; nothing changes", async () => {
    await open("/m/accounts/1/edit", "update");
    await change(field("opening_balance"), "500");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.match(text(outcome), /Opening balance cannot be changed after financial transactions exist/);
    assert.equal(server.find(1).opening_balance, "100.0000");
    assert.equal(q("[data-sm-account-result]"), null);
  });

  it("a duplicate name is refused (422); an account with no activity can change its opening balance", async () => {
    await open("/m/accounts/1/edit", "update");
    await change(field("name"), "Bank");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected");
    assert.match(text(q("[data-sm-outcome]")), /already been taken/);
    await view.unmount();
    api.restore();
    await open("/m/accounts/7/edit", "update");
    await change(field("opening_balance"), "75");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.deepEqual(writes()[0].body, { opening_balance: "75.0000" });
    assert.match(text(q("[data-sm-result-amount]")), /75\.00/);
  });

  it("a double tap sends one request", async () => {
    let release;
    await open("/m/accounts/1/edit", "update", { onWrite: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await change(field("name"), "Pocket");
    await submit(q("form.sm-draft-form"));
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    await act(async () => release());
    await settle();
    assert.equal(server.log.updated, 1);
  });

  it("the same update sent twice leaves the same state (same-result), and a lost answer claims nothing", async () => {
    server = accountServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.accountUpdate] });
    gate.setWriteApprovalsForTests([OPS.update]);
    const write = { operation: OPS.update, ids: { accountId: "1" }, input: { name: "Pocket", allow_negative_balance: true } };
    const first = await sendWorkflowWrite(write);
    const again = await sendWorkflowWrite(write);
    assert.deepEqual(again.data.account, first.data.account);
    assert.equal(server.accounts.filter((row) => row.name === "Pocket").length, 1);
    api.restore();

    let lose = true;
    await open("/m/accounts/1/edit", "update", { afterApply: (answer) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : answer) });
    await change(field("name"), "Pocket");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-account-result]"), null);
    assert.equal(action("send"), null);
    assert.equal(writes().length, 1);
  });

  it("with amounts hidden and in Arabic", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    createExperienceStore({ userId: USER_A.id, workspaceId: 1, storage: window.localStorage, eventTarget: window }).update({ hiddenMoney: true });
    await open("/m/accounts/1/edit", "update");
    await change(field("name"), "جيب");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-was='name']")), /كان/);
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-account-result]")), /تم تحديث الحساب/);
    assert.ok(q("[data-sm-result-amount] .sm-money-hidden"));
  });
});

describe("archiving an account", () => {
  const reviewIt = async () => {
    if (!q("[data-sm-step='review']")) await submit(q("form.sm-draft-form"));
    if (!q("[data-sm-step='review']")) await click(action("review"));
  };

  it("says what archiving means and shows the account and its closing balance before asking", async () => {
    await open("/m/accounts/2/archive", "archive");
    assert.match(text(q("[data-sm-summary='record']")), /Bank/);
    assert.match(text(q("[data-sm-summary='record']")), /9,000\.00/);
    await reviewIt();
    const effect = text(q("[data-sm-effect='archiveEffect']"));
    assert.match(effect, /history is kept/);
    assert.match(effect, /can't restore/);
    assert.match(effect, /savings plan/);
  });

  it("sends a POST with no body and no key, then shows the archived account and its closing balance as the server answered", async () => {
    await open("/m/accounts/2/archive", "archive");
    await reviewIt();
    await click(action("send"));
    await settle();
    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.method, "POST");
    assert.equal(call.path, "/accounts/2/archive");
    assert.equal(Object.hasOwn(call.headers, "Idempotency-Key"), false);
    const result = q("[data-sm-account-result]");
    assert.equal(result.dataset.smResultKind, "archived");
    assert.match(text(result), /Account archived/);
    assert.match(text(result), /can't be restored/);
    assert.match(text(q("[data-sm-result-amount]")), /9,000\.00/);
    assert.match(text(q("[data-sm-result='status']")), /Archived/);
    assert.ok(q("[data-sm-result='archivedAt']"));
    assert.equal(server.find(2).status, "archived");
    assert.equal(server.find(2).current_balance, "9000.0000", "nothing about the money changed");
  });

  it("a goal's account and an archived one have no archive form", async () => {
    for (const [id, reason] of [[4, "goalAccount"], [5, "archived"]]) {
      await open(`/m/accounts/${id}/archive`, "archive");
      assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, reason);
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
  });

  it("an account an active savings plan is funded from is refused with a clear reason: certain, nothing changed", async () => {
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 409, code: "CONFLICT", serverCode: "account_funds_active_savings_plan" })).kind, "rejected");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 409, code: "CONFLICT", serverCode: "something_else" })).kind, "unknown", "any other 409 stays unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 409, code: "CONFLICT" })).kind, "unknown");

    await open("/m/accounts/6/archive", "archive");
    await reviewIt();
    await click(action("send"));
    await settle();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.match(text(outcome), /active savings plan is funded from this account/);
    assert.match(text(outcome), /Nothing was changed/);
    assert.equal(server.find(6).status, "active");
    assert.equal(action("send").disabled, false);
  });

  it("another workspace's account is a 404 with no form; a 403 is a certain refusal; an invalid id reaches nothing", async () => {
    await open("/m/accounts/99/archive", "archive");
    assert.equal(q("form.sm-draft-form"), null);
    await view.unmount();
    api.restore();
    for (const id of ["abc", "0", "-1"]) {
      await open(`/m/accounts/${id}/archive`, "archive");
      assert.equal(q("form.sm-draft-form"), null, id);
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
    await open("/m/accounts/2/archive", "archive", { onWrite: () => refuse("You are not authorized to manage this account.", 403) });
    await reviewIt();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected");
  });

  it("a double tap sends one request; a lost answer is unknown, and after a reload the account is archived (no second archive)", async () => {
    let release;
    await open("/m/accounts/2/archive", "archive", { onWrite: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await reviewIt();
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    await act(async () => release());
    await settle();
    assert.equal(server.log.archived, 1);
    await view.unmount();
    api.restore();

    let first = true;
    await open("/m/accounts/2/archive", "archive", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await reviewIt();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-account-result]"), null);
    assert.equal(server.log.archived, 1);
    await reload("/m/accounts/2/archive");
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "archived");
    assert.equal(writes().length, 1);
    // A second archive, if one were sent, is refused rather than repeated.
    const again = await sendWorkflowWrite({ operation: OPS.archive, ids: { accountId: "2" }, input: {} }).then(() => null, (failure) => failure);
    assert.equal(again.status, 422);
    assert.equal(server.log.archived, 1);
  });

  it("with amounts hidden and in Arabic", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    createExperienceStore({ userId: USER_A.id, workspaceId: 1, storage: window.localStorage, eventTarget: window }).update({ hiddenMoney: true });
    await open("/m/accounts/2/archive", "archive");
    await reviewIt();
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-account-result]")), /تمت أرشفة الحساب/);
    assert.ok(q("[data-sm-result-amount] .sm-money-hidden"));
    assert.doesNotMatch(text(q("[data-sm-account-result]")), /9,000/);
  });
});

describe("what an account page offers", () => {
  it("Edit and Archive for an active account only: nothing to restore or to make default for an archived one", async () => {
    for (const [id, expected] of [[1, "account-edit account-archive"], [4, null], [5, null]]) {
      api?.restore();
      server = accountServer();
      api = installFakeApi(server.handler);
      view = await mountMobile({ entry: `/m/accounts/${id}` });
      assert.equal(q("[data-sm-draft-links]")?.dataset.smDraftLinks ?? null, expected, `#${id}`);
      if (id === 5) assert.doesNotMatch(qa("a, button").map((node) => text(node)).join(" | "), /Restore|Unarchive|Make default|Set as default/i, "no such action exists on the backend");
      await view.unmount();
      view = null;
    }
  });
});

describe("what the answers prove", () => {
  const sent = { workspace_id: 1, name: "Savings box", type: "savings", currency_code: "USD", opening_balance: "250.0000", allow_negative_balance: false };
  const raw = (over = {}) => ({ account: { id: 21, name: "Savings box", type: "savings", currency_code: "USD", opening_balance: "250.0000", current_balance: "250.0000", allow_negative_balance: false, status: "active", ...over } });

  it("a created account must be active and be what was sent", () => {
    assert.equal(buildAccountCreated(raw(), sent).id, "21");
    assert.equal(buildAccountCreated(raw({ name: " Savings box " }), sent).name, "Savings box");
    assert.equal(buildAccountCreated(raw({ opening_balance: "250.00" }), sent).openingBalance, "250.00");
    for (const over of [{ name: "x" }, { type: "cash" }, { currency_code: "ILS" }, { opening_balance: "1.0000" }, { allow_negative_balance: true }, { status: "archived" }, { id: null }]) assert.equal(buildAccountCreated(raw(over), sent), null, JSON.stringify(over));
    assert.equal(buildAccountCreated({}, sent), null);
  });

  it("an updated account must be this one, active, with the changed values as sent", () => {
    const record = { id: "21" };
    assert.equal(buildAccountUpdated(raw({ name: "Pocket" }), { name: "Pocket" }, record).name, "Pocket");
    assert.equal(buildAccountUpdated(raw({ id: 22 }), { name: "Savings box" }, record), null);
    assert.equal(buildAccountUpdated(raw({ name: "Other" }), { name: "Pocket" }, record), null);
    assert.equal(buildAccountUpdated(raw({ allow_negative_balance: false }), { allow_negative_balance: true }, record), null);
    assert.equal(buildAccountUpdated(raw({ status: "archived" }), { name: "Savings box" }, record), null);
  });

  it("an archived account must be this one, archived", () => {
    const record = { id: "21" };
    assert.equal(buildAccountArchived(raw({ status: "archived", archived_at: "2026-11-16T09:00:00Z" }), record).archivedAt, "2026-11-16T09:00:00Z");
    assert.equal(buildAccountArchived(raw({ status: "active" }), record), null);
    assert.equal(buildAccountArchived(raw({ status: "archived", id: 5 }), record), null);
  });

  it("the form definitions follow the backend: five types, the currency locked on an edit, no hidden settings", () => {
    assert.deepEqual([...ACCOUNT_TYPES], ["cash", "bank", "wallet", "savings", "custom"]);
    assert.deepEqual(WORKFLOWS.account.fields.map((item) => item.name), ["name", "type", "currency_code", "opening_balance", "allow_negative_balance"]);
    assert.equal(WORKFLOWS["account-edit"].fields.find((item) => item.name === "currency_code").kind, "locked");
    assert.equal(WORKFLOWS["account-edit"].showsOriginal, true);
  });
});
