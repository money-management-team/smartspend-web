import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { change, click, submit } from "./helpers/dom.mjs";
import { account, envelope, failure, installFakeApi, tx } from "./helpers/mobileApi.mjs";
import { TOKEN_A, TOKEN_B, USER_A, USER_B, dom, goBack, location, mountMobile, otherTabWrote, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { debt, payment, transfer } from "./helpers/moreFixture.mjs";
import { budget, goal, paginator, rule } from "./helpers/planningFixture.mjs";

const { ACCOUNT_CURRENCIES } = await import("../src/features/Dashboards/User/Accounts/accountHelpers.js");
const { MOBILE_WRITES, isWriteOpen } = await import("../src/mobile/data/writeGate.js");
const { amountError, compareAmounts, dateError, integerError, normalizeAmount, textError } = await import("../src/mobile/forms/validation.js");
const { DRAFT_ONLY_OPERATIONS, FORM_CURRENCIES, NEW_ENTRY_ORDER, WORKFLOWS, changedFields, validateWorkflow } = await import("../src/mobile/forms/workflows.js");
const { RECORD_ACTIONS, actionPath, workflowAt } = await import("../src/mobile/forms/actionRoutes.js");
const { SENDABLE_OPERATIONS } = await import("../src/mobile/data/writeApi.js");
const { PAYLOAD_WORKFLOWS } = await import("../src/mobile/forms/writePayloads.js");

/*
 * The Mobile forms (src/mobile/forms): every one can be filled in, checked and
 * reviewed, and none can send. The fake backend refuses anything but GET the
 * moment it is attempted, so each journey below also proves that nothing left.
 */

after(() => dom.window.close());

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORMS = path.join(ROOT, "src/mobile/forms");
const code = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("what a form accepts", () => {
  it("amounts: digits with at most 4 decimals, above zero unless zero is allowed, Arabic digits read as digits", () => {
    assert.equal(amountError(""), "required");
    assert.equal(amountError("", { required: false }), null);
    assert.equal(amountError("12.5"), null);
    assert.equal(amountError("0"), "positive");
    assert.equal(amountError("0", { zero: true }), null);
    assert.equal(amountError("1.23456"), "decimals");
    assert.equal(amountError("1,000"), "format", "a thousands separator is ambiguous between languages and refused");
    assert.equal(amountError("-5"), "format");
    assert.equal(amountError("1e3"), "format");
    assert.equal(normalizeAmount(" ١٢٫٥ "), "12.5");
    assert.equal(amountError("١٢٫٥"), null);
    assert.equal(amountError("123456789012345"), "format", "15 digits is above the backend's 14");
  });

  it("compares amounts digit by digit, never as floating-point numbers", () => {
    assert.equal(compareAmounts("0.1", "0.10"), 0);
    assert.equal(compareAmounts("500", "500.0000"), 0);
    assert.equal(compareAmounts("500.0001", "500"), 1);
    assert.equal(compareAmounts("99.99", "100"), -1);
    assert.equal(compareAmounts("12345678901234.9999", "12345678901234.9998"), 1, "beyond what a double can tell apart");
  });

  it("text, dates and whole numbers", () => {
    assert.equal(textError("  ", { required: true }), "required");
    assert.equal(textError("ab", { min: 3 }), "tooShort");
    assert.equal(textError("x".repeat(256), { max: 255 }), "tooLong");
    assert.equal(textError("😀".repeat(255), { max: 255 }), null, "counted in characters");
    assert.equal(dateError("2026-02-30"), "date");
    assert.equal(dateError("2026-02-28"), null);
    assert.equal(integerError("0", { min: 1, max: 60 }), "range");
    assert.equal(integerError("1.5", { min: 1, max: 60 }), "whole");
    assert.equal(integerError("60", { min: 1, max: 60 }), null);
  });

  it("cross-field rules: two different accounts in one currency, an end after its start, a payment within what is owed, a real change", () => {
    const accounts = [{ id: "1", currency: "ILS" }, { id: "2", currency: "ILS" }, { id: "3", currency: "USD" }];
    const ctx = { today: "2026-10-28", accounts, categories: [] };
    const transferValues = { ...WORKFLOWS.transfer.initial(ctx), from_account_id: "1", amount: "5" };
    assert.equal(validateWorkflow(WORKFLOWS.transfer, { ...transferValues, to_account_id: "1" }, ctx).to_account_id, "choice", "the same account is not offered");
    assert.equal(validateWorkflow(WORKFLOWS.transfer, { ...transferValues, to_account_id: "3" }, ctx).to_account_id, "choice", "another currency is not offered");
    assert.deepEqual(validateWorkflow(WORKFLOWS.transfer, { ...transferValues, to_account_id: "2" }, ctx), {});
    assert.equal(validateWorkflow(WORKFLOWS.transfer, { ...transferValues, to_account_id: "2", fee_amount: "1" }, ctx).fee_category_id, "required", "a fee needs an expense category");

    const budgetValues = { ...WORKFLOWS.budget.initial(ctx), name: "Food", currency_code: "ILS", amount_limit: "100", period_start: "2026-10-31", period_end: "2026-10-01" };
    assert.equal(validateWorkflow(WORKFLOWS.budget, budgetValues, ctx).period_end, "endBeforeStart");

    const debtCtx = { ...ctx, record: { id: "3", currency: "ILS", remaining: "500.0000", status: "active", direction: "payable" } };
    const pay = { ...WORKFLOWS["debt-payment"].initial(debtCtx), account_id: "1" };
    assert.equal(validateWorkflow(WORKFLOWS["debt-payment"], { ...pay, amount: "500.0001" }, debtCtx).amount, "aboveRemaining");
    assert.deepEqual(validateWorkflow(WORKFLOWS["debt-payment"], { ...pay, amount: "500" }, debtCtx), {});
    assert.equal(validateWorkflow(WORKFLOWS["debt-payment"], { ...pay, amount: "5", paid_at: "2026-10-29" }, debtCtx).paid_at, "futureDate");

    const record = { id: "1", type: "expense", status: "posted", currency: "ILS", amount: "45.25", accountId: "1", categoryId: "4", description: "Lunch", referenceNumber: "", occurredAt: "2026-10-20" };
    const correctCtx = { ...ctx, record, categories: [{ id: "4", type: "expense", active: true }] };
    const start = WORKFLOWS["transaction-correct"].initial(correctCtx);
    assert.equal(validateWorkflow(WORKFLOWS["transaction-correct"], { ...start, reason: "Wrong amount" }, correctCtx)._form, "noChange");
    assert.deepEqual(changedFields(WORKFLOWS["transaction-correct"], { ...start, amount: "45.2500", reason: "x" }, correctCtx), [], "45.2500 is the same amount as 45.25");
    assert.deepEqual(changedFields(WORKFLOWS["transaction-correct"], { ...start, amount: "46", reason: "Wrong amount" }, correctCtx).map((field) => field.name), ["amount"]);
    assert.equal(validateWorkflow(WORKFLOWS["transaction-correct"], { ...start, amount: "46", reason: "no" }, correctCtx).reason, "tooShort", "a reason of 3 to 500 characters");
  });

  it("offers the full version's currencies", () => {
    assert.deepEqual([...FORM_CURRENCIES], ACCOUNT_CURRENCIES);
  });
});

describe("no form can send", () => {
  it("no file in forms/ has request code, imports an API wrapper, or stores anything; only the submission hook reaches the (closed) write facade", () => {
    const files = readdirSync(FORMS).map((name) => path.join(FORMS, name));
    const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const file of files) {
      const source = withoutComments(code(file));
      assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|apiRequest|Dashboards\/User\/api|Idempotency|toMoneyString|localStorage|sessionStorage|indexedDB|\bmethod\s*:/m, path.basename(file));
      if (path.basename(file) !== "useWorkflowSubmit.js") assert.doesNotMatch(source, /data\/writeApi/, path.basename(file));
    }
    // The forms read through the same loaders as every screen, and use nothing else of the facade but two plain readers.
    const reads = [...code(path.join(FORMS, "MobileWorkflow.jsx")).matchAll(/import\s*\{([^}]*)\}\s*from\s*["']\.\.\/data\/readApi\.js["']/g)].flatMap((match) => match[1].split(",").map((name) => name.trim()));
    assert.deepEqual(reads.sort(), ["isAccountId", "sessionWorkspace"]);
  });

  it("every write a form stands for is registered, has a send path and a payload, and is closed in the gate", () => {
    assert.equal(DRAFT_ONLY_OPERATIONS.length, Object.keys(WORKFLOWS).length);
    for (const operation of DRAFT_ONLY_OPERATIONS) {
      assert.equal(isWriteOpen(operation), false, operation);
      assert.equal(Object.hasOwn(MOBILE_WRITES, operation), true, operation);
      assert.ok(SENDABLE_OPERATIONS.includes(operation), operation);
    }
    assert.deepEqual([...PAYLOAD_WORKFLOWS].sort(), Object.keys(WORKFLOWS).sort());
  });

  it("each form has one address, and each address one form", () => {
    assert.deepEqual(new Set(RECORD_ACTIONS.map((action) => action.workflow)).size, RECORD_ACTIONS.length);
    for (const action of RECORD_ACTIONS) {
      const ids = Object.fromEntries([...action.path.matchAll(/:([A-Za-z]+)/g)].map(([, name]) => [name, "7"]));
      assert.equal(workflowAt(actionPath(action.workflow, ids)), action.workflow);
      assert.ok(WORKFLOWS[action.workflow].record, `${action.workflow} starts from a record`);
    }
    for (const id of NEW_ENTRY_ORDER) assert.equal(WORKFLOWS[id].record, undefined);
    assert.equal(workflowAt("/m/activity/abc/correct"), null, "an id that is not a plain number is not a form address");
  });
});

/* ---------- Journeys ---------- */

const accounts = [
  account({ id: 1, name: "Everyday wallet", currency_code: "ILS" }),
  account({ id: 2, name: "Bank", type: "bank", currency_code: "ILS", current_balance: "9000.0000" }),
  account({ id: 3, name: "Dollar account", type: "bank", currency_code: "USD" }),
  account({ id: 9, name: "Laptop savings", type: "savings_goal", savings_goal: { id: 1 }, currency_code: "ILS" }),
];
const categories = [{ id: 4, name: "Food", type: "expense", is_system: false, is_active: true }, { id: 5, name: "Salary", type: "income", is_system: false, is_active: true }];

function formsBackend({ transactions = [tx(1), tx(2, { status: "reversed" })], debts = [debt(3)], payments = { 3: [payment(11, 3), payment(12, 3, { status: "reversed", is_reversed: true })] } } = {}) {
  return (call) => {
    const one = (pattern, list, key) => {
      const match = pattern.exec(call.path);
      if (!match) return null;
      const found = list.find((row) => String(row.id) === match[1]);
      return found ? { body: envelope({ [key]: found }) } : failure(404, "Not found");
    };
    if (call.path === "/accounts") return { body: envelope({ accounts }) };
    if (call.path === "/categories") return { body: envelope({ categories }) };
    const debtPayments = /^\/debts\/(\d+)\/payments$/.exec(call.path);
    if (debtPayments) return { body: envelope({ payments: paginator(payments[debtPayments[1]] ?? [], { perPage: 10 }) }) };
    return (
      one(/^\/transactions\/(\d+)$/, transactions, "transaction") ??
      one(/^\/accounts\/(\d+)$/, accounts, "account") ??
      one(/^\/transfers\/(\d+)$/, [transfer(7)], "transfer") ??
      one(/^\/budgets\/(\d+)$/, [budget(1)], "budget") ??
      one(/^\/savings-goals\/(\d+)$/, [goal(1, { account: { id: 9, name: "Laptop savings" } })], "savings_goal") ??
      one(/^\/recurring-transactions\/(\d+)$/, [rule(1)], "recurring_transaction") ??
      one(/^\/debts\/(\d+)$/, debts, "debt") ??
      failure(404, "Not found")
    );
  };
}

let api;
let view;
const main = () => q("main");
const text = (root = main()) => root.textContent.replace(/\s+/g, " ");
const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
const action = (name) => q(`[data-sm-action='${name}']`);
const open = async (entry, backend = formsBackend()) => {
  api = installFakeApi(backend);
  view = await mountMobile({ entry });
};
const writes = () => api.calls.filter((call) => call.method !== "GET");

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

describe("a new expense", () => {
  it("offers only accounts money can move with, and only expense categories", async () => {
    await open("/m/add/expense");
    assert.equal(q("[data-sm-screen='workflow']").dataset.smWorkflow, "expense");
    assert.match(text(q("[data-sm-note='draft-only']")), /Mobile doesn't send it yet|nothing is recorded/i);
    assert.deepEqual(qa("option", field("account_id")).map((option) => option.value), ["", "1", "2", "3"], "not the goal's own account");
    assert.deepEqual(qa("option", field("category_id")).map((option) => option.value), ["", "4"]);
    assert.equal(field("occurred_at").value.length, 10, "today, preselected");
  });

  it("shows what is wrong, focuses the summary, and links each problem to its field", async () => {
    await open("/m/add/expense");
    await change(field("amount"), "12.34567");
    await submit(q("form.sm-draft-form"));
    const summary = q("[data-sm-summary='local']");
    assert.ok(summary);
    assert.equal(document.activeElement, summary);
    assert.match(text(summary), /Account: Fill this in/);
    assert.match(text(summary), /Amount: Use at most 4 decimal places/);
    assert.equal(field("amount").getAttribute("aria-invalid"), "true");
    assert.equal(q("[data-sm-step='review']"), null);
  });

  it("reviews a valid entry, ends at a send button that is disabled for good, and sends nothing whatever is tried", async () => {
    await open("/m/add/expense");
    await change(field("account_id"), "2");
    await change(field("category_id"), "4");
    await change(field("amount"), "١٢٫٥");
    await change(field("description"), "Groceries");
    await submit(q("form.sm-draft-form"));

    const review = q("[data-sm-step='review']");
    assert.ok(review);
    assert.match(text(review), /Bank/);
    assert.match(text(review), /Food/);
    assert.match(text(review), /12\.50/);
    assert.match(text(review), /ILS|₪/);
    assert.match(text(review), /Groceries/);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "transaction.expense");
    assert.equal(action("full-version").getAttribute("href"), "/dashboard/financial-operations?new=expense");

    const send = action("send");
    assert.equal(send.disabled, true);
    assert.equal(send.dataset.smOpen, "false");
    // A disabled button, a keyboard Enter on it, a removed `disabled`, and a submit on every form on the page.
    await click(send);
    send.disabled = false;
    await click(send);
    send.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    for (const form of qa("form")) await submit(form);
    await settle();
    assert.deepEqual(writes(), []);
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });

  it("asks before a draft is thrown away: Keep editing stays, Discard leaves", async () => {
    await open("/m/add/expense");
    await change(field("amount"), "5");
    await click(qa("main a").find((link) => link.textContent.trim() === "Back"));
    const sheet = q("[role='dialog']");
    assert.match(text(sheet), /Discard this draft/);
    await click(q("[data-sm-action='stay']"));
    assert.equal(location(), "/m/add/expense");
    assert.equal(field("amount").value, "5");

    await click(qa("main a").find((link) => link.textContent.trim() === "Back"));
    await click(q("[data-sm-action='discard']"));
    await settle();
    assert.equal(location(), "/m");
  });

  it("the browser's Back is held too while there is a draft", async () => {
    await open("/m/more");
    await view.router.navigate("/m/add/income");
    await settle();
    await change(field("amount"), "5");
    await goBack();
    await settle();
    assert.ok(q("[role='dialog']"));
    assert.equal(location(), "/m/add/income");
  });

  it("a draft is not kept anywhere: after another person signs in, the screen is gone and nothing is sent", async () => {
    await open("/m/add/expense");
    await change(field("amount"), "77.77");
    storeSession({ token: TOKEN_B, user: USER_B });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();
    assert.doesNotMatch(document.body.textContent, /77\.77/);
    assert.equal(Object.values(window.localStorage).concat(Object.values(window.sessionStorage)).some((value) => String(value).includes("77.77")), false, "the draft is in no storage");
  });

  it("an unknown form address is not a form", async () => {
    await open("/m/add/payroll");
    assert.equal(q("form"), null);
    assert.equal(q("[data-sm-screen='workflow']"), null);
  });
});

describe("a new transfer", () => {
  it("offers the second account only in the first one's currency, and asks for a fee category only with a fee", async () => {
    await open("/m/add/transfer");
    await change(field("from_account_id"), "1");
    assert.deepEqual(qa("option", field("to_account_id")).map((option) => option.value), ["", "2"]);
    assert.equal(field("fee_category_id"), null);
    await change(field("fee_amount"), "2");
    assert.ok(field("fee_category_id"));
  });
});

describe("a change to a record", () => {
  it("correct: starts from the transaction, marks what changed, and needs a reason", async () => {
    await open("/m/activity/1/correct");
    assert.equal(q("[data-sm-screen='workflow']").dataset.smRecord, "1");
    assert.equal(field("amount").value, "45.25");
    assert.equal(field("account_id").value, "1");

    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-summary='local']")), /Nothing has changed yet|Reason: Fill this in/);

    await change(field("amount"), "46");
    await change(field("reason"), "Typed the wrong amount");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-field='amount'][data-sm-changed='true']") !== null, true);
    assert.equal(q("[data-sm-field='description'][data-sm-changed='true']"), null);
    assert.equal(action("full-version").getAttribute("href"), "/dashboard/financial-operations/1");
    assert.deepEqual(writes(), []);
  });

  it("a reversed transaction can't be corrected or reversed again, and says so instead of showing a form", async () => {
    await open("/m/activity/2/reverse");
    assert.equal(q("form"), null);
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "notReversible");
  });

  it("an answer about another record is refused", async () => {
    await open("/m/activity/1/reverse", (call) => (call.path === "/transactions/1" ? { body: envelope({ transaction: tx(5) }) } : failure(404)));
    assert.equal(q("form"), null);
    assert.equal(q("[data-sm-screen='workflow']").dataset.smState, "error");
  });

  it("a record that can't be read leaves no form, with Retry", async () => {
    await open("/m/planning/budgets/1/edit", () => failure(500, "Server error"));
    assert.equal(q("form"), null);
    assert.ok(qa("button").some((button) => button.textContent.trim() === "Try again"));
  });

  it("debt payment: only accounts in the debt's currency, the remaining amount as a shortcut, never above it", async () => {
    await open("/m/planning/debts/3/payment");
    assert.deepEqual(qa("option", field("account_id")).map((option) => option.value), ["", "1", "2"]);
    await click(action("fill"));
    assert.equal(field("amount").value, "1000");
    await change(field("amount"), "1000.01");
    await change(field("account_id"), "1");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-summary='local']")), /more than what is still owed/);
  });

  it("payment reversal: found in the debt's payments; a reversed one is not offered again", async () => {
    await open("/m/planning/debts/3/payments/11/reverse");
    assert.ok(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-summary='record']")), /500\.00/);
    await view.unmount();
    api.restore();
    await open("/m/planning/debts/3/payments/12/reverse");
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "alreadyReversed");
  });

  it("confirm next occurrence: nothing to fill in, the review says it would record a real transaction, and it is not sent", async () => {
    await open("/m/planning/recurring/1/confirm");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-effect]").dataset.smEffect, "confirmEffect");
    assert.equal(action("send").disabled, true);
    assert.deepEqual(writes(), []);
  });

  it("archive an account: the review explains that history is kept", async () => {
    await open("/m/accounts/2/archive");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-step='review']")), /history is kept/);
  });

  it("a goal's own account can't be edited from Accounts", async () => {
    await open("/m/accounts/9/edit");
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "goalAccount");
  });
});

describe("links to the forms", () => {
  it("record pages link to their forms, with Back returning to the record", async () => {
    await open("/m/activity/1", (call) => (call.path === "/transactions/1" ? { body: envelope({ transaction: tx(1) }) } : formsBackend()(call)));
    assert.deepEqual(qa("[data-sm-draft-links] a").map((link) => link.getAttribute("href")), ["/m/activity/1/correct", "/m/activity/1/reverse"]);
    await click(q("[data-sm-draft-links] a"));
    await settle();
    assert.equal(location(), "/m/activity/1/correct");
    await click(qa("main a").find((link) => link.textContent.trim() === "Back"));
    await settle();
    assert.equal(location(), "/m/activity/1");
  });
});
