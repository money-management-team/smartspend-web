import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { AuthContext } from "../src/contexts/auth/authContext.js";
import {
  buildConfirmAccountsPayload,
  buildReversePayload,
  canReverseLegs,
  getBreakdownKey,
  isMultiAccountInstallment,
  remainingToAllocate,
  validateDraftLegs,
} from "../src/features/Dashboards/User/SavingsGoals/smartPlanHelpers.js";
import { byText, change, click, flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: SavingsGoalDetails } = await import("../src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx");

/* ------------------------------------------------------------- fixtures */

const INTENT = "a".repeat(64);
const INTENT_2 = "b".repeat(64);

const goal = (over = {}) => ({
  id: 1,
  workspace_id: 1,
  name: "Emergency fund",
  target_amount: "5000.0000",
  currency_code: "ILS",
  target_date: "2037-08-30",
  status: "active",
  account: { id: 101, name: "Emergency fund", type: "savings", currency_code: "ILS" },
  progress: { target_amount: "5000.0000", saved_amount: "1250.0000", remaining_amount: "3750.0000", percentage_funded: "25.0000", status: "in_progress", deadline_passed: false },
  ...over,
});

const installment = (id, over = {}) => ({
  id,
  savings_plan_id: 9,
  sequence: id,
  planned_date: `2037-0${id}-01`,
  original_planned_date: null,
  postponed_count: 0,
  amount: "312.5000",
  status: "planned",
  from_account_id: null,
  fulfilled_amount: null,
  fulfilled_goal_movement_id: null,
  skipped_at: null,
  resolution_reason: null,
  lock_version: 1,
  reversal_state: "none",
  confirmed_amount: null,
  effective_amount: null,
  reversed_amount: null,
  shortfall_amount: null,
  ...over,
});

// 1: paid from two accounts (multi-account); 2: paid from one account; 3–4 open.
const multiPaid = (over = {}) =>
  installment(1, { status: "fulfilled", fulfilled_amount: "312.5000", confirmed_amount: "312.5000", effective_amount: "312.5000", lock_version: 3, ...over });

const planData = ({ mode = "allocated", installments, health = {} } = {}) => ({
  savings_goal: goal(),
  balance: { saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  savings_plan: {
    id: 9,
    savings_goal_id: 1,
    status: "active",
    intensity: "balanced",
    frequency: "monthly",
    interval: 1,
    currency_code: "ILS",
    installment_amount: "312.5000",
    final_installment_amount: "312.5000",
    installment_count: 4,
    start_date: "2037-01-01",
    expected_completion_date: "2037-04-01",
    target_date: "2037-08-30",
    funding_mode: mode,
    plan_version: 3,
    // The backend's permission for the signed-in user (F5.2).
    can_manage: true,
    funding_sources: [
      { account_id: 5, account_name: "Main bank", priority: 1, allocation_bps: mode === "allocated" ? 6000 : null },
      { account_id: 6, account_name: "Wallet", priority: 2, allocation_bps: mode === "allocated" ? 4000 : null },
    ],
    next_installment: { ...installment(3), is_overdue: false },
    installments: installments ?? [
      multiPaid(),
      installment(2, { status: "fulfilled", fulfilled_amount: "312.5000", fulfilled_goal_movement_id: 77, effective_amount: "312.5000", from_account_id: 5 }),
      installment(3, { lock_version: 2 }),
      installment(4),
    ],
  },
  plan_health: { executable: true, outstanding_amount: "625.0000", outstanding_count: 2, overdue: { count: 0 }, reasons: [], ...health },
});

const accounts = [
  { id: 5, name: "Main bank", currency_code: "ILS", available_balance: "900.0000", allows_overdraft: false, covers_suggested_amount: true },
  { id: 6, name: "Wallet", currency_code: "ILS", available_balance: "150.0000", allows_overdraft: false, covers_suggested_amount: false },
];

const fundingPreview = ({ mode = "allocated", legs, problem = null, intent = INTENT, lockVersion = 2, shortfall = "0.0000" } = {}) => ({
  confirmable: problem === null,
  blocker: null,
  warnings: [],
  savings_goal: { id: 1, name: "Emergency fund", remaining_amount: "3750.0000" },
  savings_plan: { id: 9, status: "active", plan_version: 3, funding_mode: mode },
  installment: { id: 3, sequence: 3, status: "planned", planned_date: "2037-03-01", scheduled_amount: "312.5000", lock_version: lockVersion },
  suggested_amount: "312.5000",
  default_account_id: null,
  accounts,
  funding: {
    amount: "312.5000",
    legs: (legs ?? [
      { account_id: 5, amount: "187.5000" },
      { account_id: 6, amount: "125.0000" },
    ]).map((leg) => ({ ...leg, account_name: leg.account_id === 5 ? "Main bank" : "Wallet", currency_code: "ILS", available_balance: leg.account_id === 5 ? "900.0000" : "150.0000" })),
    shortfall_amount: shortfall,
    problem,
  },
  confirmation_intent: problem === null ? intent : null,
});

const legsResponse = (over = {}) => ({
  installment: installment(3, { status: "fulfilled", lock_version: 2 }),
  funding_legs: [
    { id: 41, account_id: 5, account_name: "Main bank", amount: "187.5000", currency_code: "ILS", transfer_id: 501, goal_movement_id: 601, is_effective: true, reversed_at: null },
    { id: 42, account_id: 6, account_name: "Wallet", amount: "125.0000", currency_code: "ILS", transfer_id: 502, goal_movement_id: 602, is_effective: true, reversed_at: null },
  ],
  reversal: { eligible: true, effective_leg_ids: [41, 42], expected_lock_version: 2 },
  savings_goal: goal({ progress: undefined }),
  balance: { saved_amount: "1562.5000", remaining_amount: "3437.5000" },
  plan_health: {},
  ...over,
});

const conflict = (code, extra = {}) => ({ status: 409, body: { status: false, message: "Conflict.", code, ...extra } });

function serve(routes = {}) {
  const queues = Object.fromEntries(Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]));

  return mockFetch((url, init) => {
    const method = init.method ?? "GET";
    const path = new URL(url, "http://localhost").pathname.replace(/^\/api/, "");
    const queue = queues[`${method} ${path}`];

    if (queue) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      const answer = typeof next === "function" ? next() : next;
      return answer.status ? answer : { body: envelope(answer) };
    }
    if (method !== "GET") throw new Error(`Unexpected write ${method} ${path}`);
    return { body: envelope({}) };
  });
}

const callsTo = (calls, method, suffix) =>
  calls.filter((call) => call.method === method && new URL(call.url, "http://localhost").pathname.endsWith(suffix));

async function settle(times = 8) {
  for (let i = 0; i < times; i += 1) await flush();
}

async function renderDetails({ language = "en" } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const router = createMemoryRouter(
    [{ path: "/dashboard/savings-goals/:savingsGoalId", element: h(SavingsGoalDetails, { smartSavingsEnabled: true }) }],
    { initialEntries: ["/dashboard/savings-goals/1"] },
  );
  const view = await render(withI18n(i18n, h(AuthContext.Provider, { value: { user: { timezone: "UTC" }, workspace: null } }, h(RouterProvider, { router }))));
  await settle();
  return { ...view, i18n };
}

const dialog = () => document.querySelector(".plan-dialog");
const rowFor = (view, sequence) =>
  [...view.container.querySelectorAll(".installment-timeline__row")].find((row) =>
    row.querySelector(".installment-timeline__seq")?.textContent.endsWith(` ${sequence}`),
  );
const confirmRow = (view, sequence) => click(rowFor(view, sequence).querySelector(".installment-timeline__action--primary"));

beforeEach(() => {
  installBrowserStubs();
  document.body.innerHTML = "";
});

/* ------------------------------------------------------------- helpers */

describe("funding and reversal helpers", () => {
  it("works out what's left to allocate exactly", () => {
    assert.equal(remainingToAllocate("312.5000", [{ amount: "200.25" }, { amount: "112.25" }]), "0.0000");
    assert.equal(remainingToAllocate("312.5000", [{ amount: "200.2499" }, { amount: "112.25" }]), "0.0001");
    assert.equal(remainingToAllocate("0.3000", [{ amount: "0.1" }, { amount: "0.2" }]), "0.0000", "no float drift");
    assert.equal(remainingToAllocate("312.5000", [{ amount: "abc" }]), null);
  });

  it("validates the user's own split before asking the backend", () => {
    const leg = (account_id, amount) => ({ account_id, amount });
    assert.equal(validateDraftLegs([], "10"), "legsRequired");
    assert.equal(validateDraftLegs([leg("", "10")], "10"), "accountRequired");
    assert.equal(validateDraftLegs([leg("5", "5"), leg("5", "5")], "10"), "duplicateAccount");
    assert.equal(validateDraftLegs([leg("5", "0")], "10"), "amountInvalid");
    assert.equal(validateDraftLegs([leg("5", "1.23456")], "10"), "amountInvalid");
    assert.equal(validateDraftLegs([leg("5", "4"), leg("6", "5")], "10"), "totalMismatch");
    assert.equal(validateDraftLegs([leg("5", "4"), leg("6", "6")], "10"), null);
    assert.equal(validateDraftLegs(Array.from({ length: 6 }, (_, i) => leg(String(i + 1), "1")), "6"), "tooManyLegs");
  });

  it("confirms exactly the previewed breakdown with its intent unchanged", () => {
    assert.deepEqual(buildConfirmAccountsPayload(fundingPreview()), {
      expected_plan_version: 3,
      expected_lock_version: 2,
      amount: "312.5000",
      legs: [
        { account_id: 5, amount: "187.5000" },
        { account_id: 6, amount: "125.0000" },
      ],
      confirmation_intent: INTENT,
    });
    assert.notEqual(getBreakdownKey(null, [{ account_id: 5, amount: "1" }]), getBreakdownKey(null, [{ account_id: 5, amount: "2" }]));
  });

  it("tells multi-account installments apart and builds reversals", () => {
    assert.equal(isMultiAccountInstallment(multiPaid()), true);
    assert.equal(isMultiAccountInstallment(installment(2, { status: "fulfilled", fulfilled_goal_movement_id: 77 })), false);
    assert.equal(canReverseLegs(multiPaid({ effective_amount: "0.0000" })), false);
    assert.deepEqual(buildReversePayload({ reason: "  Wrong account ", lockVersion: 3, legIds: null }), { reason: "Wrong account", expected_lock_version: 3, all: true });
    assert.deepEqual(buildReversePayload({ reason: "Oops", lockVersion: 3, legIds: ["41"] }), { reason: "Oops", expected_lock_version: 3, leg_ids: [41] });
  });
});

/* ------------------------------------------------------------- funding */

describe("multi-account confirmation", () => {
  it("allocated: previews, requires explicit approval, then sends the signed breakdown unchanged", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/3/funding-preview": { funding_preview: fundingPreview() },
      "POST /savings-goals/1/planned-contributions/3/confirm-accounts": { status: 201, body: envelope(legsResponse()) },
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();

    const [preview] = callsTo(calls, "POST", "/funding-preview");
    assert.deepEqual(preview.body, {}, "the backend proposes the allocated breakdown");
    assert.equal(callsTo(calls, "POST", "/confirm-accounts").length, 0, "opening and previewing move nothing");
    assert.match(dialog().textContent, /fixed shares/);
    assert.equal(dialog().querySelector(".funding-breakdown__editor"), null, "allocated shares aren't editable");
    assert.equal(byText(dialog(), "Change the split"), undefined);
    assert.match(dialog().textContent, /Main bank.*187\.50.*Wallet.*125\.00/);
    assert.match(dialog().textContent, /Available ₪900\.00/);
    assert.doesNotMatch(dialog().textContent, /\[object Object\]/);

    await click(byText(dialog(), "Review and approve"));
    assert.match(dialog().textContent, /2 separate transfers/);
    const submit = byText(dialog(), "Confirm and move money");
    assert.equal(submit.disabled, true, "approval is required");

    await click(dialog().querySelector(".funding-breakdown__approve input"));
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    const [post] = callsTo(calls, "POST", "/confirm-accounts");
    assert.deepEqual(post.body, {
      expected_plan_version: 3,
      expected_lock_version: 2,
      amount: "312.5000",
      legs: [
        { account_id: 5, amount: "187.5000" },
        { account_id: 6, amount: "125.0000" },
      ],
      confirmation_intent: INTENT,
    });
    assert.match(post.headers["Idempotency-Key"], /^savings-installment-legs-[A-Za-z0-9._:-]+$/);
    assert.equal(dialog(), null);
    assert.match(view.container.querySelector(".savings-goal-details__notice").textContent, /Installment confirmed/);
    assert.ok(callsTo(calls, "GET", "/plan").length >= 2, "balances and plan health are fetched again");
    await view.unmount();
  });

  it("priority: keeps the single-account dialog and can switch to a checked custom split", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData({ mode: "priority" }),
      "GET /savings-goals/1/planned-contributions/3/confirmation-preview": {
        confirmation: {
          confirmable: true, blocker: null, warnings: [],
          savings_goal: { id: 1, name: "Emergency fund" },
          savings_plan: { id: 9, status: "active", plan_version: 3, funding_mode: "priority" },
          installment: { id: 3, sequence: 3, status: "planned", planned_date: "2037-03-01", scheduled_amount: "312.5000", lock_version: 2 },
          suggested_amount: "312.5000", default_account_id: 5, accounts,
        },
      },
      "POST /savings-goals/1/planned-contributions/3/funding-preview": [
        { funding_preview: fundingPreview({ mode: "priority", legs: [{ account_id: 5, amount: "312.5000" }] }) },
        { funding_preview: fundingPreview({ mode: "priority", legs: [{ account_id: 5, amount: "200.0000" }, { account_id: 6, amount: "112.5000" }], intent: INTENT_2 }) },
      ],
      "POST /savings-goals/1/planned-contributions/3/confirm-accounts": { status: 201, body: envelope(legsResponse()) },
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();
    assert.match(dialog().textContent, /Confirm this installment/, "the single-account dialog is unchanged");

    await click(byText(dialog(), "Pay from several accounts instead"));
    await settle();
    await click(byText(dialog(), "Change the split"));

    await change(dialog().querySelectorAll(".funding-breakdown__field--amount input")[0], "200");
    await click(byText(dialog(), "Add an account"));
    const selects = dialog().querySelectorAll(".funding-breakdown__field--account select");
    await change(selects[1], "6");
    const amounts = dialog().querySelectorAll(".funding-breakdown__field--amount input");
    await change(amounts[1], "100");
    assert.match(dialog().textContent, /Left to allocate:.*12\.50/);

    // Not checked yet: it can't be approved.
    await click(byText(dialog(), "Check this split"));
    assert.match(dialog().textContent, /add up to exactly the amount to move/);
    assert.equal(callsTo(calls, "POST", "/funding-preview").length, 1);

    await change(amounts[1], "112.5");
    assert.match(dialog().textContent, /Fully allocated/);
    await click(byText(dialog(), "Check this split"));
    await settle();

    const previews = callsTo(calls, "POST", "/funding-preview");
    assert.deepEqual(previews[1].body, { legs: [{ account_id: 5, amount: "200.0000" }, { account_id: 6, amount: "112.5000" }] });

    await click(byText(dialog(), "Review and approve"));
    await click(dialog().querySelector(".funding-breakdown__approve input"));
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    const [post] = callsTo(calls, "POST", "/confirm-accounts");
    assert.equal(post.body.confirmation_intent, INTENT_2);
    assert.deepEqual(post.body.legs, [{ account_id: 5, amount: "200.0000" }, { account_id: 6, amount: "112.5000" }]);
    await view.unmount();
  });

  it("an edit after checking makes the signed preview stale", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData({ mode: "at_confirmation" }),
      "GET /savings-goals/1/planned-contributions/3/confirmation-preview": {
        confirmation: {
          confirmable: true, blocker: null, warnings: [],
          savings_goal: { id: 1, name: "Emergency fund" },
          savings_plan: { id: 9, status: "active", plan_version: 3, funding_mode: "at_confirmation" },
          installment: { id: 3, sequence: 3, status: "planned", planned_date: "2037-03-01", scheduled_amount: "312.5000", lock_version: 2 },
          suggested_amount: "312.5000", default_account_id: null, accounts,
        },
      },
      "POST /savings-goals/1/planned-contributions/3/funding-preview": [
        { funding_preview: fundingPreview({ mode: "at_confirmation", legs: [], problem: "breakdown_required" }) },
        { funding_preview: fundingPreview({ mode: "at_confirmation", legs: [{ account_id: 5, amount: "312.5000" }] }) },
      ],
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();
    await click(byText(dialog(), "Pay from several accounts instead"));
    await settle();

    // At-confirmation: no proposal, the user writes the split.
    const select = dialog().querySelector(".funding-breakdown__field--account select");
    assert.deepEqual([...select.options].map((option) => option.value), ["", "5", "6"]);
    await change(select, "5");
    await click(byText(dialog(), "Check this split"));
    await settle();
    assert.equal(byText(dialog(), "Review and approve").disabled, false);

    await change(dialog().querySelector(".funding-breakdown__field--amount input"), "312.50");
    assert.equal(byText(dialog(), "Review and approve"), undefined, "the edited split must be checked again");
    assert.ok(byText(dialog(), "Check this split"));
    await view.unmount();
  });

  it("a failed preview is a read error, never an unknown money outcome", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/3/funding-preview": { status: 503, body: { status: false, message: "" } },
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();
    assert.doesNotMatch(dialog().textContent, /couldn't confirm whether/);
    assert.ok(byText(dialog(), "Try again"));
    assert.equal(byText(dialog(), "Review and approve").disabled, true);
    await view.unmount();
  });

  it("shows the backend's problem and can't be approved", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/3/funding-preview": {
        funding_preview: fundingPreview({ problem: "insufficient_balance", shortfall: "62.5000" }),
      },
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();
    assert.match(dialog().textContent, /doesn't have enough balance.*Short by.*62\.50/);
    assert.equal(byText(dialog(), "Review and approve").disabled, true);
    await view.unmount();
  });

  it("after a stale intent 409 re-checks the same breakdown and needs a new approval and key", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/3/funding-preview": [
        { funding_preview: fundingPreview() },
        { funding_preview: fundingPreview({ lockVersion: 4, intent: INTENT_2 }) },
      ],
      "POST /savings-goals/1/planned-contributions/3/confirm-accounts": [
        conflict("savings_installment_intent_invalid"),
        { status: 201, body: envelope(legsResponse()) },
      ],
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();
    await click(byText(dialog(), "Review and approve"));
    await click(dialog().querySelector(".funding-breakdown__approve input"));
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    assert.equal(callsTo(calls, "POST", "/confirm-accounts").length, 1, "never resent on its own");
    assert.match(dialog().textContent, /isn't the one that was checked/);
    assert.match(dialog().textContent, /Nothing moved/);
    const previews = callsTo(calls, "POST", "/funding-preview");
    assert.equal(previews.length, 2);
    assert.deepEqual(previews[1].body, previews[0].body, "the same breakdown, checked again");

    await click(byText(dialog(), "Review and approve"));
    assert.equal(byText(dialog(), "Confirm and move money").disabled, true, "approval was cleared");
    await click(dialog().querySelector(".funding-breakdown__approve input"));
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    const [first, second] = callsTo(calls, "POST", "/confirm-accounts");
    assert.notEqual(first.headers["Idempotency-Key"], second.headers["Idempotency-Key"]);
    assert.equal(second.body.expected_lock_version, 4);
    assert.equal(second.body.confirmation_intent, INTENT_2);
    await view.unmount();
  });

  it("an unknown outcome resends the identical request with the same key", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/3/funding-preview": { funding_preview: fundingPreview() },
      "POST /savings-goals/1/planned-contributions/3/confirm-accounts": [
        { status: 503, body: { status: false, message: "" } },
        { status: 201, body: envelope(legsResponse()) },
      ],
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();
    await click(byText(dialog(), "Review and approve"));
    await click(dialog().querySelector(".funding-breakdown__approve input"));
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    assert.match(dialog().textContent, /couldn't confirm whether the money moved/);
    await click(byText(dialog(), "Review and approve"));
    await click(dialog().querySelector(".funding-breakdown__approve input"));
    await click(byText(dialog(), "Try again"));
    await settle();

    const [first, second] = callsTo(calls, "POST", "/confirm-accounts");
    assert.equal(first.headers["Idempotency-Key"], second.headers["Idempotency-Key"]);
    assert.deepEqual(first.body, second.body);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- reversal */

// GET …/funding-legs for installment 1, as the backend returns it.
const leg = (id, accountId, name, amount, over = {}) => ({
  id, account_id: accountId, account_name: name, amount, currency_code: "ILS",
  transfer_id: 500 + id, goal_movement_id: 600 + id, is_effective: true, reversed_at: null, ...over,
});

const fundingLegs = ({
  installmentOver = {},
  current = [leg(41, 5, "Main bank", "187.5000"), leg(42, 6, "Wallet", "125.0000")],
  multi = true,
  history = [],
  eligible = true,
  effective,
  lockVersion = 7,
} = {}) => ({
  installment: multiPaid({ lock_version: lockVersion, ...installmentOver }),
  current_confirmation: current
    ? { confirmation_version: 6, confirmation_legs: current.length, is_multi_leg: multi, confirmed_at: "2037-01-01T09:00:00.000000Z", funding_legs: current }
    : null,
  funding_legs: current ?? [],
  history,
  reversal: {
    eligible,
    effective_leg_ids: effective ?? (current ?? []).filter((l) => l.is_effective).map((l) => l.id),
    expected_lock_version: lockVersion,
  },
});

const LEGS_URL = "GET /savings-goals/1/planned-contributions/1/funding-legs";
const REVERSE_URL = "POST /savings-goals/1/planned-contributions/1/reverse-legs";

const openReverse = async (view) => {
  await click(rowFor(view, 1).querySelector(".installment-timeline__action--reverse"));
  await settle();
};
const fillAndAcknowledge = async (reason = "Paid from the wrong account") => {
  await change(dialog().querySelector("#reverse-legs-reason"), reason);
  await click(dialog().querySelector(".reverse-legs__ack input"));
};
const currentRows = () => [...dialog().querySelectorAll(".reverse-legs__section .funding-legs__row")];

describe("reversing a multi-account installment", () => {
  it("offers reversal only for multi-account installments", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData() });
    const view = await renderDetails();

    assert.ok(rowFor(view, 1).querySelector(".installment-timeline__action--reverse"));
    assert.match(rowFor(view, 1).textContent, /Paid from several accounts/);
    assert.equal(rowFor(view, 2).querySelector(".installment-timeline__action--reverse"), null, "single-account keeps its own reversal");
    await view.unmount();
  });

  it("after a reload reads the payments fresh and reverses one chosen leg with the returned version", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs({ lockVersion: 7 }),
      [REVERSE_URL]: { status: 200, body: envelope(legsResponse({ installment: multiPaid({ lock_version: 8 }) })) },
    });
    const view = await renderDetails();

    await openReverse(view);
    assert.equal(callsTo(calls, "GET", "/funding-legs").length, 1, "read on opening, no cached ids");
    assert.match(dialog().textContent, /Current payment/);
    assert.match(dialog().textContent, /Main bank.*187\.50.*Wallet.*125\.00/);

    await click(dialog().querySelector('input[name="reverse-legs-scope"][value="some"]'));
    const boxes = dialog().querySelectorAll(".reverse-legs__section .funding-legs__select input");
    assert.equal(boxes.length, 2);
    await click(boxes[1]);
    assert.match(dialog().querySelector(".reverse-legs__summary").textContent, /1.*125\.00/);

    await fillAndAcknowledge("Wallet was wrong");
    await click(byText(dialog(), "Reverse"));
    await settle();

    const [post] = callsTo(calls, "POST", "/reverse-legs");
    // 7 is the funding-legs version, not the plan's lock_version (3).
    assert.deepEqual(post.body, { reason: "Wallet was wrong", expected_lock_version: 7, leg_ids: [42] });
    assert.match(post.headers["Idempotency-Key"], /^savings-installment-reverse-[A-Za-z0-9._:-]+$/);
    await view.unmount();
  });

  it("a partly reversed installment lists the reversed leg read only and offers only the effective one", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs({
        installmentOver: { reversal_state: "partially_reversed", effective_amount: "125.0000", reversed_amount: "187.5000" },
        current: [leg(41, 5, "Main bank", "187.5000", { is_effective: false, reversed_at: "2037-01-02T10:00:00.000000Z" }), leg(42, 6, "Wallet", "125.0000")],
      }),
      [REVERSE_URL]: { status: 200, body: envelope(legsResponse()) },
    });
    const view = await renderDetails();

    await openReverse(view);
    const text = dialog().textContent;
    assert.match(text, /Still in the goal.*125\.00/);
    assert.match(text, /Already reversed.*187\.50/);
    assert.match(text, /Reversed Jan 2, 2037/);
    assert.equal(dialog().querySelector('input[name="reverse-legs-scope"]'), null, "one effective leg: nothing to choose between");
    assert.ok(currentRows()[0].classList.contains("funding-legs__row--reversed"));
    assert.equal(dialog().querySelectorAll(".funding-legs__select").length, 0);
    assert.match(dialog().querySelector(".reverse-legs__summary").textContent, /125\.00/);

    await fillAndAcknowledge();
    await click(byText(dialog(), "Reverse"));
    await settle();
    assert.deepEqual(callsTo(calls, "POST", "/reverse-legs")[0].body, { reason: "Paid from the wrong account", expected_lock_version: 7, all: true });
    await view.unmount();
  });

  it("a fully reversed installment has nothing to reverse and no submit", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs({
        installmentOver: { status: "planned", effective_amount: null, reversed_amount: null },
        current: null,
        eligible: false,
        history: [{ confirmation_version: 6, confirmation_legs: 2, is_multi_leg: true, confirmed_at: "2037-01-01T09:00:00.000000Z", funding_legs: [
          leg(41, 5, "Main bank", "187.5000", { is_effective: false, reversed_at: "2037-01-03T10:00:00.000000Z" }),
          leg(42, 6, "Wallet", "125.0000", { is_effective: false, reversed_at: "2037-01-03T10:00:00.000000Z" }),
        ] }],
      }),
    });
    const view = await renderDetails();

    await openReverse(view);
    assert.match(dialog().textContent, /Nothing is left to reverse/);
    assert.match(dialog().textContent, /Earlier confirmations/);
    assert.equal(byText(dialog(), "Reverse"), undefined);
    assert.equal(dialog().querySelectorAll("input[type=checkbox]").length, 0);
    assert.equal(callsTo(calls, "POST", "/reverse-legs").length, 0);
    await view.unmount();
  });

  it("keeps earlier confirmation cycles apart and never selectable", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs({
        current: [leg(51, 6, "Wallet", "150.0000"), leg(52, 8, "Salary card", "162.5000")],
        history: [{ confirmation_version: 2, confirmation_legs: 2, is_multi_leg: true, confirmed_at: "2036-12-01T09:00:00.000000Z", funding_legs: [
          leg(41, 5, "Main bank", "187.5000", { is_effective: false, reversed_at: "2036-12-05T10:00:00.000000Z" }),
          leg(42, 6, "Wallet", "125.0000", { is_effective: false, reversed_at: "2036-12-05T10:00:00.000000Z" }),
        ] }],
      }),
      [REVERSE_URL]: { status: 200, body: envelope(legsResponse()) },
    });
    const view = await renderDetails();

    await openReverse(view);
    const history = dialog().querySelector(".reverse-legs__history");
    assert.match(history.textContent, /Earlier confirmations.*can't be chosen/);
    assert.match(history.textContent, /Main bank.*187\.50/);
    assert.equal(history.querySelectorAll("input").length, 0);

    await click(dialog().querySelector('input[name="reverse-legs-scope"][value="some"]'));
    const boxes = dialog().querySelectorAll(".funding-legs__select input");
    assert.equal(boxes.length, 2, "only the current cycle's legs");
    await click(boxes[0]);
    await click(boxes[1]);
    await fillAndAcknowledge();
    await click(byText(dialog(), "Reverse"));
    await settle();

    assert.deepEqual(callsTo(calls, "POST", "/reverse-legs")[0].body.leg_ids, [51, 52]);
    await view.unmount();
  });

  it("explains a single-account confirmation instead of reversing it here", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs({ current: [leg(41, 5, "Main bank", "312.5000")], multi: false, eligible: false }),
    });
    const view = await renderDetails();

    await openReverse(view);
    assert.match(dialog().textContent, /paid from a single account/);
    assert.equal(byText(dialog(), "Reverse"), undefined);
    await view.unmount();
  });

  it("handles 403, 404 and network failures on reading", async () => {
    for (const [answer, message, retry] of [
      [{ status: 403, body: { status: false, message: "x" } }, /Only the person who set up this plan/, false],
      [{ status: 404, body: { status: false, message: "x" } }, /no longer available/, false],
      [{ status: 503, body: { status: false, message: "" } }, /./, true],
    ]) {
      const calls = serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData(), [LEGS_URL]: answer });
      const view = await renderDetails();

      await openReverse(view);
      assert.match(dialog().textContent, message);
      assert.doesNotMatch(dialog().textContent, /couldn't confirm whether/, "a read error isn't an unknown outcome");
      assert.equal(Boolean(byText(dialog(), "Try again")), retry);
      assert.equal(byText(dialog(), "Reverse"), undefined);
      assert.equal(callsTo(calls, "POST", "/reverse-legs").length, 0);
      await view.unmount();
      document.body.innerHTML = "";
    }
  });

  it("a 409 reads the payments again and requires a fresh choice, approval and key", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: [fundingLegs({ lockVersion: 7 }), fundingLegs({ lockVersion: 9 })],
      [REVERSE_URL]: [
        conflict("savings_installment_version_conflict", { current_lock_version: 9 }),
        { status: 200, body: envelope(legsResponse()) },
      ],
    });
    const view = await renderDetails();

    await openReverse(view);
    await click(dialog().querySelector('input[name="reverse-legs-scope"][value="some"]'));
    await click(dialog().querySelectorAll(".funding-legs__select input")[0]);
    await fillAndAcknowledge("Wrong account");
    await click(byText(dialog(), "Reverse"));
    await settle();

    assert.equal(callsTo(calls, "POST", "/reverse-legs").length, 1, "never resent on its own");
    assert.equal(callsTo(calls, "GET", "/funding-legs").length, 2, "the payments are read again");
    assert.match(dialog().textContent, /changed since you opened this/);
    assert.match(dialog().textContent, /nothing was reversed/);
    assert.equal(dialog().querySelector(".reverse-legs__ack input").checked, false, "approval cleared");
    assert.equal(dialog().querySelector('input[name="reverse-legs-scope"][value="all"]').checked, true, "choice cleared");
    assert.equal(byText(dialog(), "Reverse").disabled, true);

    await click(dialog().querySelector(".reverse-legs__ack input"));
    await click(byText(dialog(), "Reverse"));
    await settle();

    const [first, second] = callsTo(calls, "POST", "/reverse-legs");
    assert.equal(second.body.expected_lock_version, 9);
    assert.equal(second.body.all, true);
    assert.notEqual(first.headers["Idempotency-Key"], second.headers["Idempotency-Key"]);
    await view.unmount();
  });

  it("sends one request however often Reverse is pressed", async () => {
    let release;
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs(),
      [REVERSE_URL]: () => new Promise((resolve) => { release = () => resolve({ status: 200, body: envelope(legsResponse()) }); }),
    });
    const view = await renderDetails();

    await openReverse(view);
    await fillAndAcknowledge();
    const button = byText(dialog(), "Reverse");
    await click(button);
    await click(button);
    await click(button);
    assert.equal(callsTo(calls, "POST", "/reverse-legs").length, 1);

    release();
    await settle();
    assert.equal(callsTo(calls, "POST", "/reverse-legs").length, 1);
    await view.unmount();
  });

  it("retries an unknown outcome only with the identical payload and key", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs({ lockVersion: 7 }),
      [REVERSE_URL]: [{ status: 503, body: { status: false, message: "" } }, { status: 200, body: envelope(legsResponse()) }],
    });
    const view = await renderDetails();

    await openReverse(view);
    await fillAndAcknowledge();
    await click(byText(dialog(), "Reverse"));
    await settle();

    assert.match(dialog().textContent, /couldn't confirm whether the reversal happened/);
    assert.equal(callsTo(calls, "GET", "/funding-legs").length, 2, "the installment is checked again");
    await click(byText(dialog(), "Try again"));
    await settle();

    const [first, second] = callsTo(calls, "POST", "/reverse-legs");
    assert.equal(first.headers["Idempotency-Key"], second.headers["Idempotency-Key"]);
    assert.deepEqual(first.body, second.body);
    await view.unmount();
  });

  it("keeps the choice after a 429 and sends nothing more", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs(),
      [REVERSE_URL]: { status: 429, headers: { "Retry-After": "30" }, body: { status: false, message: "Too many." } },
    });
    const view = await renderDetails();

    await openReverse(view);
    await fillAndAcknowledge();
    await click(byText(dialog(), "Reverse"));
    await settle();

    assert.match(dialog().textContent, /30/);
    assert.equal(callsTo(calls, "POST", "/reverse-legs").length, 1);
    assert.equal(callsTo(calls, "GET", "/funding-legs").length, 1, "a rate limit changes nothing to re-read");
    assert.equal(dialog().querySelector(".reverse-legs__ack input").checked, true);
    await view.unmount();
  });

  it("after a reversal refreshes the goal, plan and payment history", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      [LEGS_URL]: fundingLegs(),
      [REVERSE_URL]: { status: 200, body: envelope(legsResponse({ installment: multiPaid({ lock_version: 8 }), previously_effective_amount: "312.5000" })) },
    });
    const view = await renderDetails();

    await openReverse(view);
    await fillAndAcknowledge();
    await click(byText(dialog(), "Reverse"));
    await settle();

    assert.equal(dialog(), null);
    assert.match(view.container.querySelector(".savings-goal-details__notice").textContent, /Payments reversed/);
    assert.ok(callsTo(calls, "GET", "/plan").length >= 2, "plan health and timeline are fetched again");
    assert.ok(callsTo(calls, "GET", "/progress").length >= 1, "the goal's progress is fetched again");

    await openReverse(view);
    assert.equal(callsTo(calls, "GET", "/funding-legs").length, 2, "the history is read fresh again");
    await view.unmount();
  });

  it("confirms from several accounts, then reverses through the fresh payment list", async () => {
    const afterConfirm = planData({
      installments: [installment(3, { status: "fulfilled", confirmed_amount: "312.5000", effective_amount: "312.5000", lock_version: 2, sequence: 3 })],
    });
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": [planData(), afterConfirm],
      "POST /savings-goals/1/planned-contributions/3/funding-preview": { funding_preview: fundingPreview() },
      "POST /savings-goals/1/planned-contributions/3/confirm-accounts": { status: 201, body: envelope(legsResponse()) },
      "GET /savings-goals/1/planned-contributions/3/funding-legs": { ...fundingLegs({ lockVersion: 2 }), installment: installment(3, { status: "fulfilled", confirmed_amount: "312.5000", effective_amount: "312.5000", lock_version: 2 }) },
      "POST /savings-goals/1/planned-contributions/3/reverse-legs": { status: 200, body: envelope(legsResponse({ installment: installment(3, { lock_version: 3 }) })) },
    });
    const view = await renderDetails();

    await confirmRow(view, 3);
    await settle();
    await click(byText(dialog(), "Review and approve"));
    await click(dialog().querySelector(".funding-breakdown__approve input"));
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    await click(rowFor(view, 3).querySelector(".installment-timeline__action--reverse"));
    await settle();
    await click(dialog().querySelector('input[name="reverse-legs-scope"][value="some"]'));
    await click(dialog().querySelectorAll(".funding-legs__select input")[1]);
    await fillAndAcknowledge("Wallet was wrong");
    await click(byText(dialog(), "Reverse"));
    await settle();

    const [post] = callsTo(calls, "POST", "/reverse-legs");
    assert.deepEqual(post.body, { reason: "Wallet was wrong", expected_lock_version: 2, leg_ids: [42] });
    await view.unmount();
  });

  it("renders the funding and reversal dialogs in Arabic with every key translated", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/3/funding-preview": { funding_preview: fundingPreview() },
      [LEGS_URL]: fundingLegs({ history: [{ confirmation_version: 2, confirmation_legs: 2, is_multi_leg: true, confirmed_at: "2036-12-01T09:00:00.000000Z", funding_legs: [
        leg(31, 5, "Main bank", "100.0000", { is_effective: false, reversed_at: "2036-12-05T10:00:00.000000Z" }),
      ] }] }),
    });
    const view = await renderDetails({ language: "ar" });

    await confirmRow(view, 3);
    await settle();
    await click(byText(dialog(), "المراجعة والموافقة"));
    assert.match(dialog().textContent, /الموافقة على هذا التوزيع/);
    await click(byText(dialog(), "رجوع"));
    await click(byText(dialog(), "إلغاء"));
    await openReverse(view);
    assert.match(dialog().textContent, /الدفعة الحالية/);
    assert.match(dialog().textContent, /تأكيدات سابقة/);
    await click(dialog().querySelector(".reverse-legs__ack input"));
    await click(byText(dialog(), "عكس"));
    assert.match(dialog().textContent, /اكتب سببًا من 3 أحرف/);

    assert.deepEqual(view.i18n.missingKeys, []);
    await view.unmount();
  });
});
