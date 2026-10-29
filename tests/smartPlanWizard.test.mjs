import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { AuthContext } from "../src/contexts/auth/authContext.js";
import {
  bpsToPercent,
  buildFundingPayload,
  getErrorStep,
  getPreviewInput,
  getPreviewKey,
  percentToBps,
  totalAllocationBps,
  validateFunding,
  validateGoalStep,
} from "../src/features/Dashboards/User/SmartPlanWizard/smartPlanWizardHelpers.js";
import { byText, change, click, flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: SmartPlanWizard } = await import("../src/features/Dashboards/User/SmartPlanWizard/SmartPlanWizard.jsx");
const { userRoutes } = await import("../src/routes/Routes.jsx");

/* ------------------------------------------------------------- fixtures */

const fingerprint = (seed) => seed.repeat(64).slice(0, 64);

const option = (intensity, over = {}) => ({
  intensity,
  basis: "deadline",
  status: "scheduled",
  is_feasible: true,
  installment_amount: { easy: "250.0000", balanced: "400.0000", intensive: "625.0000" }[intensity],
  final_installment_amount: { easy: "250.0000", balanced: "400.0000", intensive: "625.0000" }[intensity],
  installment_count: { easy: 20, balanced: 12, intensive: 8 }[intensity],
  frequency: "monthly",
  interval: 1,
  first_due_date: "2036-11-01",
  expected_completion_date: "2037-10-01",
  target_date: null,
  shortfall_amount: "0.0000",
  affordability: { band: intensity === "intensive" ? "strained" : "comfortable", monthly_equivalent: "400.0000", share_of_capacity_bps: 4000, reasons: [] },
  warnings: [],
  duplicate_of: null,
  options_fingerprint: fingerprint(intensity[0]),
  assessment_fingerprint: fingerprint(intensity[1]),
  installments: [
    { sequence: 1, date: "2036-11-01", amount: "400.0000" },
    { sequence: 2, date: "2036-12-01", amount: "400.0000" },
  ],
  ...over,
});

const planOptions = (over = {}) => ({
  goal: { id: null, currency_code: "ILS", target_amount: "4800.0000", saved_amount: "0.0000", remaining_amount: "4800.0000" },
  schedule: { frequency: "monthly", interval: 1, first_due_date: "2036-11-01", target_date: null },
  capacity: { status: "known", currency_code: "ILS", monthly_amount: "1000.0000", reasons: [], warnings: ["irregular_income"] },
  options: [option("easy"), option("balanced"), option("intensive")],
  recommended_intensity: "balanced",
  recommendation_reason: "fastest_comfortable_option",
  warnings: [],
  ...over,
});

const accounts = [
  { id: 5, name: "Main bank", type: "bank", currency_code: "ILS", status: "active", savings_goal: null },
  { id: 6, name: "Wallet", type: "wallet", currency_code: "ILS", status: "active", savings_goal: null },
  { id: 7, name: "Dollars", type: "bank", currency_code: "USD", status: "active", savings_goal: null },
];

const goal = (over = {}) => ({
  id: 1,
  workspace_id: 3,
  name: "Emergency fund",
  target_amount: "5000.0000",
  currency_code: "ILS",
  target_date: null,
  status: "active",
  account: { id: 101, name: "Emergency fund", type: "savings", currency_code: "ILS" },
  progress: { target_amount: "5000.0000", saved_amount: "200.0000", remaining_amount: "4800.0000", status: "in_progress" },
  ...over,
});

const notFound = { status: 404, body: { status: false, message: "Not found." } };

function serve(routes = {}) {
  const queues = Object.fromEntries(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );

  return mockFetch((url, init) => {
    const method = init.method ?? "GET";
    const path = new URL(url, "http://localhost").pathname.replace(/^\/api/, "");
    const queue = queues[`${method} ${path}`];

    if (queue) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      const answer = typeof next === "function" ? next() : next;
      return answer.status ? answer : { body: envelope(answer) };
    }

    if (method === "GET" && path === "/dashboard") return { body: envelope({ scope: { workspace_id: 3, primary_currency_code: "ILS" } }) };
    if (method === "GET" && path === "/accounts") return { body: envelope({ accounts }) };
    throw new Error(`Unexpected ${method} ${path}`);
  });
}

const calls = (list, method, path) =>
  list.filter((call) => call.method === method && new URL(call.url, "http://localhost").pathname === `/api${path}`);

async function settle(times = 8) {
  for (let i = 0; i < times; i += 1) await flush();
}

function LocationProbe() {
  const location = useLocation();
  return h("output", { "data-path": location.pathname + location.search, "data-created": String(location.state?.smartPlanCreated === true) });
}

async function renderWizard({ path = "/dashboard/savings-goals/smart-plan", language = "en", enabled = true } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const element = h(SmartPlanWizard, { smartSavingsEnabled: enabled });
  const router = createMemoryRouter(
    [
      { path: "/dashboard/savings-goals/smart-plan", element },
      { path: "/dashboard/savings-goals/:savingsGoalId/smart-plan", element },
      { path: "*", element: h(LocationProbe) },
    ],
    { initialEntries: [path] },
  );
  const view = await render(
    withI18n(i18n, h(AuthContext.Provider, { value: { user: { timezone: "UTC" }, workspace: null } }, h(RouterProvider, { router }))),
  );
  await settle();
  return { ...view, i18n, router };
}

const field = (view, name) => view.container.querySelector(`#smart-wizard-${name}`);
const continueButton = (view) => byText(view.container, "Continue");
const probe = (view) => view.container.querySelector("output");

async function fillGoal(view, { name = "New car", amount = "4800" } = {}) {
  await change(field(view, "name"), name);
  await change(field(view, "target_amount"), amount);
}

async function pickIntensity(view, intensity) {
  await click(view.container.querySelector(`input[name="smart-wizard-intensity"][value="${intensity}"]`));
}

beforeEach(() => {
  installBrowserStubs();
  document.body.innerHTML = "";
});

/* ------------------------------------------------------------- helpers */

describe("wizard helpers", () => {
  it("parses percentages to whole basis points without floats", () => {
    assert.equal(percentToBps("60"), 6000);
    assert.equal(percentToBps("33.35"), 3335);
    assert.equal(percentToBps("0.1"), 10);
    assert.equal(percentToBps("100"), 10000);
    assert.equal(percentToBps("12.345"), null);
    assert.equal(percentToBps("-5"), null);
    assert.equal(bpsToPercent(3335), "33.35");
    assert.equal(bpsToPercent(6000), "60");
    assert.equal(totalAllocationBps([{ percent: "33.33" }, { percent: "33.33" }, { percent: "33.34" }]), 10000);
  });

  it("enforces the backend's funding shapes", () => {
    const sources = (...ids) => ids.map((id) => ({ account_id: id, percent: "" }));
    assert.equal(validateFunding({ mode: "at_confirmation", sources: [] }), null);
    assert.equal(validateFunding({ mode: "single", sources: [] }), "chooseOneAccount");
    assert.equal(validateFunding({ mode: "single", sources: sources(5) }), null);
    assert.equal(validateFunding({ mode: "priority", sources: sources(5) }), "chooseTwoAccounts");
    assert.equal(validateFunding({ mode: "priority", sources: sources(5, 5) }), "duplicateAccount");
    assert.equal(validateFunding({ mode: "priority", sources: sources(1, 2, 3, 4, 5, 6) }), "tooManyAccounts");
    assert.equal(
      validateFunding({ mode: "allocated", sources: [{ account_id: 5, percent: "60" }, { account_id: 6, percent: "30" }] }),
      "allocationTotal",
    );
    assert.equal(
      validateFunding({ mode: "allocated", sources: [{ account_id: 5, percent: "60" }, { account_id: 6, percent: "x" }] }),
      "allocationInvalid",
    );
    assert.deepEqual(
      buildFundingPayload({ mode: "allocated", sources: [{ account_id: "6", percent: "40" }, { account_id: 5, percent: "60" }] }),
      { mode: "allocated", sources: [{ account_id: 6, allocation_bps: 4000 }, { account_id: 5, allocation_bps: 6000 }] },
    );
    assert.deepEqual(buildFundingPayload({ mode: "priority", sources: [{ account_id: 6 }, { account_id: 5 }] }).sources, [
      { account_id: 6 },
      { account_id: 5 },
    ]);
  });

  it("ties the preview to every input it depends on", () => {
    const form = { name: "x", target_amount: "4800", currency_code: "ILS", target_date: "", notes: "", rhythm: "monthly", start_date: "" };
    const key = getPreviewKey(getPreviewInput(form, { workspaceId: 3 }));

    assert.notEqual(getPreviewKey(getPreviewInput({ ...form, target_amount: "4801" }, { workspaceId: 3 })), key);
    assert.notEqual(getPreviewKey(getPreviewInput({ ...form, rhythm: "biweekly" }, { workspaceId: 3 })), key);
    assert.notEqual(getPreviewKey(getPreviewInput({ ...form, start_date: "2036-11-05" }, { workspaceId: 3 })), key);
    assert.notEqual(getPreviewKey(getPreviewInput(form, { workspaceId: 3 }), 1), key);
    // The name isn't part of the preview.
    assert.equal(getPreviewKey(getPreviewInput({ ...form, name: "y" }, { workspaceId: 3 })), key);
    assert.deepEqual(getPreviewInput(form, { workspaceId: 3 }).body, {
      workspace_id: 3,
      target_amount: "4800.0000",
      currency_code: "ILS",
      frequency: "monthly",
      interval: 1,
    });
  });

  it("validates the goal stage and maps 422 fields to stages", () => {
    const today = "2036-10-20";
    const empty = { name: "", target_amount: "", currency_code: "ILS", target_date: "2036-01-01", notes: "", rhythm: "monthly", start_date: "" };
    assert.deepEqual(Object.keys(validateGoalStep(empty, { existing: false, today })).sort(), ["name", "target_amount", "target_date"]);
    assert.deepEqual(validateGoalStep({ ...empty, start_date: "2036-10-01" }, { existing: true, today }), { start_date: "dateInPast" });

    assert.equal(getErrorStep({ "plan.funding.sources.0.account_id": ["x"] }), "funding");
    assert.equal(getErrorStep({ options_fingerprint: ["x"] }), "plan");
    assert.equal(getErrorStep({ name: ["x"] }), "goal");
    assert.equal(getErrorStep({}), null);
  });
});

/* ------------------------------------------------------------- gate */

describe("gate", () => {
  it("registers the smart-plan URLs only as redirects to existing savings pages while the flag is off", async () => {
    const all = [];
    const walk = (routes) => routes.forEach((route) => { all.push(route); walk(route.children ?? []); });
    walk(userRoutes);
    const smart = all.filter((route) => /smart-plan/.test(route.path ?? ""));
    assert.equal(smart.length, 3);
    for (const route of smart) {
      assert.notEqual(route.element.type, SmartPlanWizard, `${route.path} never renders the wizard`);
      assert.doesNotMatch(String(route.element.type?.name ?? route.element.type?.displayName ?? ""), /SmartPlan|Lazy/i);
    }

    const landsOn = async (url) => {
      const router = createMemoryRouter([...smart.map(({ path, element }) => ({ path, element })), { path: "*", element: h(LocationProbe) }], { initialEntries: [url] });
      const view = await render(withI18n(await createI18n("en"), h(RouterProvider, { router })));
      await settle();
      const path = probe(view).dataset.path;
      await view.unmount();
      return path;
    };
    const fetchCalls = serve();
    assert.equal(await landsOn("/dashboard/savings-goals/smart-plan"), "/dashboard/savings-goals");
    assert.equal(await landsOn("/dashboard/savings-goals/7/smart-plan"), "/dashboard/savings-goals/7");
    assert.equal(await landsOn("/dashboard/savings-goals/7/smart-plan/revise/funding"), "/dashboard/savings-goals/7");
    assert.equal(fetchCalls.length, 0, "a redirect loads nothing");
  });

  it("redirects away when rendered with the flag off", async () => {
    const fetchCalls = serve();
    const router = createMemoryRouter(
      [
        { path: "/dashboard/savings-goals/smart-plan", element: h(SmartPlanWizard, { smartSavingsEnabled: false }) },
        { path: "*", element: h(LocationProbe) },
      ],
      { initialEntries: ["/dashboard/savings-goals/smart-plan"] },
    );
    const view = await render(withI18n(await createI18n("en"), h(RouterProvider, { router })));
    await settle();

    assert.equal(probe(view).dataset.path, "/dashboard/savings-goals");
    assert.equal(fetchCalls.length, 0);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- new goal */

describe("new goal with a smart plan", () => {
  it("previews, lets the user choose, and creates goal and plan atomically after approval", async () => {
    const fetchCalls = serve({
      "POST /savings-plans/preview": { plan_options: planOptions() },
      "POST /savings-goals/with-plan": { status: 201, body: envelope({ savings_goal: goal({ id: 42 }) }) },
    });
    const view = await renderWizard();

    await fillGoal(view);
    await click(continueButton(view));
    await settle();

    const [preview] = calls(fetchCalls, "POST", "/savings-plans/preview");
    assert.deepEqual(preview.body, { workspace_id: 3, target_amount: "4800.0000", currency_code: "ILS", frequency: "monthly", interval: 1 });
    assert.match(view.container.textContent, /Estimated room to save/);
    assert.match(view.container.textContent, /not a guarantee/);
    assert.match(view.container.querySelector(".plan-option--recommended").textContent, /Balanced.*Recommended/);

    // Continue without a choice asks for one.
    await click(continueButton(view));
    assert.match(view.container.textContent, /Choose one of the plans/);

    await pickIntensity(view, "balanced");
    await click(continueButton(view));
    await settle();

    // Funding: only ILS accounts are offered.
    const radios = [...view.container.querySelectorAll('input[name="smart-wizard-funding-account"]')];
    assert.deepEqual(radios.map((radio) => radio.value), ["5", "6"]);
    await click(continueButton(view));
    assert.match(view.container.textContent, /Choose the account installments come from/);
    await click(radios[0]);
    await click(continueButton(view));

    const create = byText(view.container, "Create goal and plan");
    assert.equal(create.disabled, true, "creation needs the explicit approval");
    assert.match(view.container.textContent, /Accepting a plan moves no money/);
    assert.equal(calls(fetchCalls, "POST", "/savings-goals/with-plan").length, 0);

    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Create goal and plan"));
    await settle();

    const [post] = calls(fetchCalls, "POST", "/savings-goals/with-plan");
    assert.deepEqual(post.body, {
      workspace_id: 3,
      name: "New car",
      target_amount: "4800.0000",
      currency_code: "ILS",
      target_date: null,
      plan: {
        intensity: "balanced",
        frequency: "monthly",
        interval: 1,
        options_fingerprint: fingerprint("b"),
        assessment_fingerprint: fingerprint("a"),
        funding: { mode: "single", sources: [{ account_id: 5 }] },
      },
    });
    assert.match(post.headers["Idempotency-Key"], /^savings-plan-[A-Za-z0-9._:-]+$/);
    assert.equal(probe(view).dataset.path, "/dashboard/savings-goals/42");
    assert.equal(probe(view).dataset.created, "true");
    await view.unmount();
  });

  it("clears the chosen plan when an input changes", async () => {
    const fetchCalls = serve({ "POST /savings-plans/preview": { plan_options: planOptions() } });
    const view = await renderWizard();

    await fillGoal(view);
    await click(continueButton(view));
    await settle();
    await pickIntensity(view, "easy");

    await click(byText(view.container, "Back"));
    await change(field(view, "target_amount"), "6000");
    await click(continueButton(view));
    await settle();

    const previews = calls(fetchCalls, "POST", "/savings-plans/preview");
    assert.equal(previews.length, 2);
    assert.equal(previews[1].body.target_amount, "6000.0000");
    assert.equal(view.container.querySelector('input[name="smart-wizard-intensity"]:checked'), null);
    await view.unmount();
  });

  it("after a stale-option 409 shows the regenerated options and requires a new choice and approval", async () => {
    const fetchCalls = serve({
      "POST /savings-plans/preview": [
        { plan_options: planOptions() },
        { plan_options: planOptions({ options: [option("easy"), option("balanced", { installment_amount: "420.0000", options_fingerprint: fingerprint("c") }), option("intensive")] }) },
      ],
      "POST /savings-goals/with-plan": {
        status: 409,
        body: { status: false, message: "Changed.", code: "savings_plan_option_stale", verdict: "schedule_changed", current_option: option("balanced") },
      },
    });
    const view = await renderWizard();

    await fillGoal(view);
    await click(continueButton(view));
    await settle();
    await pickIntensity(view, "balanced");
    await click(continueButton(view));
    await settle();
    await click(view.container.querySelector('input[name="smart-wizard-funding-account"]'));
    await click(continueButton(view));
    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Create goal and plan"));
    await settle();

    assert.equal(calls(fetchCalls, "POST", "/savings-goals/with-plan").length, 1, "never resent on its own");
    assert.equal(calls(fetchCalls, "POST", "/savings-plans/preview").length, 2);
    assert.match(view.container.textContent, /Your plan changed/);
    assert.match(view.container.textContent, /The schedule changed since you reviewed it/);
    assert.equal(view.container.querySelector('input[name="smart-wizard-intensity"]:checked'), null);
    assert.match(view.container.textContent, /420\.00/);
    await view.unmount();
  });

  it("when the backend gate is off, says so plainly and never resends", async () => {
    const fetchCalls = serve({
      "POST /savings-plans/preview": { plan_options: planOptions() },
      "POST /savings-goals/with-plan": {
        status: 409,
        body: { status: false, message: "Smart savings plans are not available yet.", code: "smart_savings_disabled" },
      },
    });
    const view = await renderWizard();

    await fillGoal(view);
    await click(continueButton(view));
    await settle();
    await pickIntensity(view, "balanced");
    await click(continueButton(view));
    await settle();
    await click(view.container.querySelector('input[name="smart-wizard-funding-account"]'));
    await click(continueButton(view));
    await click(view.container.querySelector(".review-step__accept input"));
    const create = byText(view.container, "Create goal and plan");
    await click(create);
    await settle();

    const failure = view.container.querySelector(".review-step__failure");
    assert.match(failure.textContent, /Smart savings plans aren't available yet, so no plan was created/);
    assert.match(failure.textContent, /balances and transactions are unchanged/);
    assert.doesNotMatch(view.container.textContent, /Your plan changed/, "not a stale-plan conflict");
    assert.equal(calls(fetchCalls, "POST", "/savings-plans/preview").length, 1, "no refreshed options");

    const button = view.container.querySelector(".smart-wizard__button--primary");
    assert.equal(button.disabled, true, "nothing to retry");
    await click(button);
    await settle();
    assert.equal(calls(fetchCalls, "POST", "/savings-goals/with-plan").length, 1, "never resent");
    assert.equal(probe(view), null, "stays on the review step");
    await view.unmount();
  });

  it("retries an unknown outcome with the same key and body", async () => {
    const fetchCalls = serve({
      "POST /savings-plans/preview": { plan_options: planOptions() },
      "POST /savings-goals/with-plan": [
        { status: 503, body: { status: false, message: "" } },
        { status: 201, body: envelope({ savings_goal: goal({ id: 42 }) }) },
      ],
    });
    const view = await renderWizard();

    await fillGoal(view);
    await click(continueButton(view));
    await settle();
    await pickIntensity(view, "balanced");
    await click(continueButton(view));
    await settle();
    await click(view.container.querySelector('input[name="smart-wizard-funding-account"]'));
    await click(continueButton(view));
    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Create goal and plan"));
    await settle();

    assert.match(view.container.textContent, /won't create a second one/);
    await click(byText(view.container, "Try again"));
    await settle();

    const [first, second] = calls(fetchCalls, "POST", "/savings-goals/with-plan");
    assert.equal(first.headers["Idempotency-Key"], second.headers["Idempotency-Key"]);
    assert.deepEqual(first.body, second.body);
    await view.unmount();
  });

  it("sends allocated shares as basis points in the order shown", async () => {
    const fetchCalls = serve({
      "POST /savings-plans/preview": { plan_options: planOptions() },
      "POST /savings-goals/with-plan": { status: 201, body: envelope({ savings_goal: goal({ id: 42 }) }) },
    });
    const view = await renderWizard();

    await fillGoal(view);
    await click(continueButton(view));
    await settle();
    await pickIntensity(view, "easy");
    await click(continueButton(view));
    await settle();

    await click(view.container.querySelector('input[name="smart-wizard-funding-mode"][value="allocated"]'));
    const add = () => view.container.querySelector(".funding-step__add select");
    await change(add(), "6");
    await change(add(), "5");
    const shares = [...view.container.querySelectorAll(".funding-step__percent input")];
    await change(shares[0], "60");
    await change(shares[1], "30");
    await click(continueButton(view));
    assert.match(view.container.textContent, /add up to exactly 100%/);

    await change(shares[1], "40");
    await click(continueButton(view));
    assert.match(view.container.textContent, /Split across accounts/);
    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Create goal and plan"));
    await settle();

    const [post] = calls(fetchCalls, "POST", "/savings-goals/with-plan");
    assert.deepEqual(post.body.plan.funding, {
      mode: "allocated",
      sources: [
        { account_id: 6, allocation_bps: 6000 },
        { account_id: 5, allocation_bps: 4000 },
      ],
    });
    await view.unmount();
  });

  it("shows the backend's reason when no plan is feasible and when capacity is unknown", async () => {
    serve({
      "POST /savings-plans/preview": {
        plan_options: planOptions({
          capacity: { status: "unknown", reasons: ["insufficient_history"], warnings: [] },
          options: [
            option("easy", { is_feasible: false, status: "deadline_before_first_installment", shortfall_amount: "4800.0000" }),
            option("balanced", { duplicate_of: "easy" }),
            option("intensive", { affordability: { band: "unknown", reasons: [] } }),
          ],
          recommended_intensity: null,
          recommendation_reason: "affordability_unknown",
        }),
      },
    });
    const view = await renderWizard();

    await fillGoal(view);
    await click(continueButton(view));
    await settle();

    const text = view.container.textContent;
    assert.match(text, /Not enough history yet/);
    assert.match(text, /no plan is recommended/);
    assert.match(text, /The target date comes before the first installment/);
    assert.match(text, /Falls short by.*4,800\.00/);
    assert.match(text, /Same schedule as Easy/);
    assert.match(text, /Affordability unknown/);
    const inputs = [...view.container.querySelectorAll('input[name="smart-wizard-intensity"]')];
    assert.deepEqual(inputs.map((input) => input.disabled), [true, true, false]);
    await view.unmount();
  });

  it("leaves for the existing free savings form", async () => {
    serve();
    const view = await renderWizard();

    await click(view.container.querySelector("button.goal-step__kind"));
    await settle();
    assert.equal(probe(view).dataset.path, "/dashboard/savings-goals?new=1");
    await view.unmount();
  });

  it("renders every stage in Arabic with all keys translated", async () => {
    serve({ "POST /savings-plans/preview": { plan_options: planOptions() } });
    const view = await renderWizard({ language: "ar" });

    await fillGoal(view, { name: "سيارة" });
    await click(byText(view.container, "متابعة"));
    await settle();
    await pickIntensity(view, "balanced");
    await click(view.container.querySelector(".plan-option__toggle"));
    await click(byText(view.container, "متابعة"));
    await settle();
    for (const mode of ["priority", "allocated", "at_confirmation"]) {
      await click(view.container.querySelector(`input[name="smart-wizard-funding-mode"][value="${mode}"]`));
    }
    await click(byText(view.container, "متابعة"));

    assert.match(view.container.textContent, /قبول الخطة لا يحرّك أي مال/);
    assert.deepEqual(view.i18n.missingKeys, []);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- existing goal */

describe("smart plan for an existing goal", () => {
  it("previews from the goal's ledger and accepts through its own endpoint", async () => {
    const fetchCalls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": notFound,
      "GET /savings-goals/1/plan-options": { plan_options: planOptions() },
      "POST /savings-goals/1/plan": { status: 201, body: envelope({ savings_goal: goal() }) },
    });
    const view = await renderWizard({ path: "/dashboard/savings-goals/1/smart-plan" });

    assert.match(view.container.textContent, /A smart plan for “Emergency fund”/);
    assert.match(view.container.querySelector(".goal-step__existing").textContent, /Remaining.*4,800\.00/);
    assert.equal(field(view, "name"), null, "the goal's own fields aren't editable here");

    await click(view.container.querySelector('input[name="smart-wizard-rhythm"][value="biweekly"]'));
    await click(continueButton(view));
    await settle();

    const [options] = calls(fetchCalls, "GET", "/savings-goals/1/plan-options");
    assert.match(options.url, /frequency=weekly/);
    assert.match(options.url, /interval=2/);

    await pickIntensity(view, "easy");
    await click(continueButton(view));
    await settle();
    await click(view.container.querySelector('input[name="smart-wizard-funding-mode"][value="at_confirmation"]'));
    await click(continueButton(view));
    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Add this plan"));
    await settle();

    const [post] = calls(fetchCalls, "POST", "/savings-goals/1/plan");
    assert.deepEqual(post.body, {
      intensity: "easy",
      frequency: "weekly",
      interval: 2,
      options_fingerprint: fingerprint("e"),
      assessment_fingerprint: fingerprint("a"),
      funding: { mode: "at_confirmation", sources: [] },
    });
    assert.ok(post.headers["Idempotency-Key"]);
    assert.equal(probe(view).dataset.path, "/dashboard/savings-goals/1");
    await view.unmount();
  });

  it("shows the disabled-gate message in Arabic for an existing goal", async () => {
    const fetchCalls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": notFound,
      "GET /savings-goals/1/plan-options": { plan_options: planOptions() },
      "POST /savings-goals/1/plan": {
        status: 409,
        body: { status: false, message: "Smart savings plans are not available yet.", code: "smart_savings_disabled" },
      },
    });
    const view = await renderWizard({ path: "/dashboard/savings-goals/1/smart-plan", language: "ar" });
    const next = () => click(view.container.querySelector(".smart-wizard__button--primary"));

    await next();
    await settle();
    await pickIntensity(view, "easy");
    await next();
    await settle();
    await click(view.container.querySelector('input[name="smart-wizard-funding-mode"][value="at_confirmation"]'));
    await next();
    await click(view.container.querySelector(".review-step__accept input"));
    await next();
    await settle();

    assert.match(view.container.querySelector(".review-step__failure").textContent, /خطط الادخار الذكية غير متاحة بعد/);
    assert.equal(view.container.querySelector(".smart-wizard__button--primary").disabled, true);
    assert.equal(calls(fetchCalls, "POST", "/savings-goals/1/plan").length, 1);
    await view.unmount();
  });

  it("explains why a goal with a plan, or a paused goal, can't take one", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": { savings_plan: {} } });
    let view = await renderWizard({ path: "/dashboard/savings-goals/1/smart-plan" });
    assert.match(view.container.textContent, /already has an active smart plan/);
    await view.unmount();

    serve({ "GET /savings-goals/1": { savings_goal: goal({ status: "paused" }) }, "GET /savings-goals/1/plan": notFound });
    view = await renderWizard({ path: "/dashboard/savings-goals/1/smart-plan" });
    assert.match(view.container.textContent, /Resume it first/);
    await view.unmount();
  });

  it("sends a 422 back to the stage that can fix it", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": notFound,
      "GET /savings-goals/1/plan-options": { plan_options: planOptions() },
      "POST /savings-goals/1/plan": {
        status: 422,
        body: { status: false, message: "That account can't fund this plan.", errors: { "funding.sources.0.account_id": ["Not eligible."] } },
      },
    });
    const view = await renderWizard({ path: "/dashboard/savings-goals/1/smart-plan" });

    await click(continueButton(view));
    await settle();
    await pickIntensity(view, "easy");
    await click(continueButton(view));
    await settle();
    await click(view.container.querySelector('input[name="smart-wizard-funding-account"]'));
    await click(continueButton(view));
    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Add this plan"));
    await settle();

    assert.match(view.container.textContent, /That account can't fund this plan/);
    await click(byText(view.container, "Fix the funding"));
    assert.ok(view.container.querySelector(".funding-step"));
    await view.unmount();
  });
});
