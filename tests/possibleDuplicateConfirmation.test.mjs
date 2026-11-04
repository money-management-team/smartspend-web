import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import { change, click, flush, installDom, render, submit } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

/*
 * smartspend-backend fix/financial-idempotency-p0 @ 6b696d72: income, expense
 * and correction answer 409 `code: "possible_duplicate"` with
 * `data.matched_transaction` when config/finance.php's manual_duplicate_guard
 * is on (off by default — this is forward-looking handling, not a live
 * production behaviour). A resend over the SAME Idempotency-Key, with
 * `confirm_possible_duplicate: true` added to the SAME body, is the only
 * documented way to proceed; no other 409 means this, and the flag is never
 * sent unless the person has actually seen and confirmed the matched entry.
 *
 * Desktop (this file): FinancialOperations.jsx (income/expense) and
 * TransactionDetails.jsx (correction) via PossibleDuplicateDialog, plus the
 * pure recognition/extraction helpers for both platforms.
 * Mobile's own DOM integration (forms/DraftForm.jsx's possible-duplicate step)
 * is tests/mobilePossibleDuplicate.test.mjs: a Desktop and a Mobile jsdom
 * render in the same process collide (two React roots fighting over the same
 * shared document), so each platform gets its own file, like every other test
 * here.
 */

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { isPossibleDuplicateError, possibleDuplicateMatch } = await import(
  "../src/features/Dashboards/User/FinancialOperations/transactionHelpers.js"
);
const mobileDuplicate = await import("../src/mobile/data/possibleDuplicate.js");
const { default: FinancialOperations } = await import("../src/features/Dashboards/User/FinancialOperations/FinancialOperations.jsx");
const { default: TransactionDetails } = await import("../src/features/Dashboards/User/TransactionDetails/TransactionDetails.jsx");
const { AuthContext } = await import("../src/contexts/auth/authContext.js");
const { default: ExperienceProvider } = await import("../src/features/Dashboards/User/Experience/ExperienceProvider.jsx");

// Both pages read the signed-in user/workspace from AuthContext (TransactionDetails
// for its display time zone; FinancialOperations transitively, through
// ExperienceProvider's own useAuthContext() call for the hide-amounts preference).
const AUTH_VALUE = { isAuthenticated: true, initializing: false, token: "t", user: { id: 1, timezone: "UTC" }, workspace: { id: 1, timezone: "UTC" } };
const withAuth = (element) => h(AuthContext.Provider, { value: AUTH_VALUE }, element);

const path = (call) => new URL(call.url, "http://localhost").pathname;

/* ------------------------------------------------------------- the backend's shape, read correctly */

const MATCHED = {
  id: 501,
  type: "income",
  amount: "250.0000",
  currency_code: "ILS",
  occurred_at: "2026-11-01T09:00:00+00:00",
  description: "Salary",
  reference_number: "REF-1",
  source: "manual",
  created_at: "2026-11-01T09:00:00+00:00",
};

/** Exactly bootstrap/app.php's PossibleDuplicateTransactionException render. */
const possibleDuplicateBody = (matched = MATCHED, reason = "recent_description") => ({
  status: 409,
  body: {
    status: false,
    message: "This looks like a payment that is already recorded. If it is a separate payment, send the request again with confirm_possible_duplicate set to true.",
    code: "possible_duplicate",
    data: { reason, matched_transaction: matched },
  },
});

describe("recognizing possible_duplicate (serverCode, not the 409 alone)", () => {
  const otherConflicts = [
    { code: "CONFLICT", serverCode: null },
    { code: "CONFLICT", serverCode: "duplicate_budget" },
    { code: "CONFLICT" }, // a key still processing, or reused with other values: no serverCode at all
  ];

  for (const [name, { isPossibleDuplicateError: is, possibleDuplicateMatch: match }] of [
    ["Desktop", { isPossibleDuplicateError, possibleDuplicateMatch }],
    ["Mobile", mobileDuplicate],
  ]) {
    it(`${name}: true only for serverCode "possible_duplicate"`, () => {
      assert.equal(is({ code: "CONFLICT", serverCode: "possible_duplicate" }), true);
      assert.equal(is(undefined), false);
      assert.equal(is({}), false);
      for (const other of otherConflicts) assert.equal(is(other), false, JSON.stringify(other));
      // The check is the serverCode alone: it never falls back to guessing from
      // the HTTP status (the backend only ever sends this serverCode on a 409,
      // but the function itself must not assume that — requirement #2).
      assert.equal(is({ code: "VALIDATION_ERROR", status: 422, serverCode: "possible_duplicate" }), true);
      assert.equal(is({ code: "REQUEST_FAILED", status: 0, serverCode: "possible_duplicate" }), true);
    });

    it(`${name}: extracts the matched transaction only from the documented body shape`, () => {
      const error = { serverCode: "possible_duplicate", payload: { data: { reason: "recent_description", matched_transaction: MATCHED } } };
      assert.deepEqual(match(error), MATCHED);

      for (const malformed of [
        undefined,
        {},
        { payload: {} },
        { payload: { data: {} } },
        { payload: { data: { matched_transaction: null } } },
        { payload: { data: { matched_transaction: "not an object" } } },
        { payload: { data: { matched_transaction: { id: "not-a-number" } } } },
      ]) {
        assert.equal(match(malformed), null, JSON.stringify(malformed));
      }
    });
  }
});

/* ------------------------------------------------------------- Desktop: income/expense */

describe("Desktop: income and expense", () => {
  let view;
  beforeEach(() => installBrowserStubs());
  afterEach(async () => {
    await view?.unmount();
    view = null;
  });

  const ACCOUNT = { id: 10, name: "Wallet", currency_code: "ILS", status: "active" };

  function serve(answers) {
    return mockFetch((url, init) => {
      const p = path({ url });
      const method = init.method ?? "GET";
      if (p === "/api/dashboard") return { body: envelope({ scope: { workspace_id: 1, primary_currency_code: "ILS" } }) };
      if (p === "/api/accounts" && method === "GET") return { body: envelope({ accounts: [ACCOUNT] }) };
      if (p === "/api/categories" && method === "GET") return { body: envelope({ categories: [] }) };
      if (p === "/api/transactions" && method === "GET") return { body: envelope({ transactions: [] }) };
      if (p === "/api/transactions/income" && method === "POST") return answers.shift();
      throw new Error(`Unexpected request ${method} ${p}`);
    });
  }

  async function openPage() {
    const i18n = await createI18n("en");
    const router = createMemoryRouter([{ path: "/dashboard/financial-operations", element: h(FinancialOperations) }], { initialEntries: ["/dashboard/financial-operations"] });
    view = await render(withI18n(i18n, withAuth(h(ExperienceProvider, null, h(RouterProvider, { router })))));
    for (let i = 0; i < 8; i += 1) await flush();
  }

  /** Fills a minimal income entry (no category required) and opens the review dialog. */
  async function toReview(amount = "250") {
    const typeSelect = document.querySelectorAll(".capture-selector select")[0];
    await change(typeSelect, "income");
    await change(document.querySelector("form.new-operation [name='amount']"), amount);
    await submit(document.querySelector("form.new-operation"));
    for (let i = 0; i < 4; i += 1) await flush();
    assert.ok(document.querySelector(".review-dialog__panel"), "the review dialog is open");
  }

  const confirmReview = async () => {
    const buttons = [...document.querySelectorAll(".review-dialog__actions button")];
    await click(buttons[1]); // [0] is Edit, [1] is Confirm
    for (let i = 0; i < 6; i += 1) await flush();
  };

  const duplicateDialog = () => document.querySelector(".possible-duplicate-dialog");
  const duplicateButtons = () => [...document.querySelectorAll(".possible-duplicate-dialog footer button")];
  const postsTo = (calls, endpoint) => calls.filter((call) => call.method === "POST" && path(call) === endpoint);

  it("shows the matched transaction, not a generic error, and the review dialog closes behind it", async () => {
    serve([possibleDuplicateBody()]);
    await openPage();
    await toReview();
    await confirmReview();

    assert.ok(duplicateDialog(), "the duplicate dialog replaced the review dialog");
    assert.equal(document.querySelector(".review-dialog__panel"), null);
    assert.equal(document.querySelector(".review-dialog__error"), null, "no generic 409 message behind it either");

    const text = duplicateDialog().textContent;
    assert.match(text, /250(\.00)?/, "the matched amount is shown");
    assert.match(text, /Salary/, "the matched description is shown");
  });

  it("Cancel sends nothing, and the review dialog reappears with the same draft", async () => {
    const calls = serve([possibleDuplicateBody()]);
    await openPage();
    await toReview("250");
    await confirmReview();

    const before = calls.length;
    await click(duplicateButtons()[0]); // Cancel
    for (let i = 0; i < 4; i += 1) await flush();

    assert.equal(calls.length, before, "cancelling sends no request");
    assert.equal(duplicateDialog(), null);
    const reopened = document.querySelector(".review-dialog__panel");
    assert.ok(reopened, "the review dialog is back");
    assert.match(reopened.textContent, /250/, "the same draft, not a fresh one");
  });

  it("Confirm resends the SAME Idempotency-Key and the SAME body, only adding the flag", async () => {
    const calls = serve([possibleDuplicateBody(), { status: 201, body: envelope({ transaction: { id: 900, status: "posted" } }) }]);
    await openPage();
    await toReview("250");
    await confirmReview();

    await click(duplicateButtons()[1]); // Confirm
    for (let i = 0; i < 6; i += 1) await flush();

    const [first, resend] = postsTo(calls, "/api/transactions/income");
    assert.equal(postsTo(calls, "/api/transactions/income").length, 2);
    assert.ok(first.headers["Idempotency-Key"], "the first attempt carried a key");
    assert.equal(resend.headers["Idempotency-Key"], first.headers["Idempotency-Key"], "the SAME key, never a fresh one");
    assert.deepEqual(resend.body, { ...first.body, confirm_possible_duplicate: true }, "the unchanged payload plus only the documented flag");
    assert.equal(duplicateDialog(), null, "the dialog closes once recorded");
  });

  it("a second tap on Confirm while the resend is in flight sends only one request", async () => {
    let release;
    const calls = serve([possibleDuplicateBody(), new Promise((resolve) => { release = resolve; })]);
    await openPage();
    await toReview("250");
    await confirmReview();

    await act(async () => {
      duplicateButtons()[1].click();
      duplicateButtons()[1].click();
    });
    for (let i = 0; i < 4; i += 1) await flush();

    // The original send (answered with possibleDuplicateBody) plus exactly one
    // resend: the second click must not add a third request.
    assert.equal(postsTo(calls, "/api/transactions/income").length, 2, "the double tap sent exactly one resend");
    assert.equal(duplicateButtons()[1].disabled, true, "disabled while it is in flight");

    release({ status: 201, body: envelope({ transaction: { id: 901, status: "posted" } }) });
    for (let i = 0; i < 6; i += 1) await flush();
    assert.equal(duplicateDialog(), null);
  });

  it("another 409 (not possible_duplicate) is the ordinary conflict message, never this dialog", async () => {
    serve([{ status: 409, body: { status: false, message: "The idempotency key was previously used with different request data." } }]);
    await openPage();
    await toReview("250");
    await confirmReview();

    assert.equal(duplicateDialog(), null, "not read as a possible duplicate");
    const error = document.querySelector(".review-dialog__error");
    assert.ok(error, "the review dialog shows its own error instead");
    assert.ok(document.querySelector(".review-dialog__panel"), "the review dialog, not replaced");
  });
});

/* ------------------------------------------------------------- Desktop: correction */

describe("Desktop: a correction", () => {
  let view;
  beforeEach(() => installBrowserStubs());
  afterEach(async () => {
    await view?.unmount();
    view = null;
  });

  const TRANSACTION = {
    id: 42,
    type: "expense",
    status: "posted",
    amount: "80.0000",
    currency_code: "ILS",
    occurred_at: "2026-11-01T10:00:00+00:00",
    description: "Groceries",
    category: { id: 4, name: "Food", type: "expense" },
    category_id: 4,
    ledger_entries: [{ account: { id: 10, name: "Wallet", currency_code: "ILS" }, entry_role: "expense" }],
  };

  function serve(answers) {
    return mockFetch((url, init) => {
      const p = path({ url });
      const method = init.method ?? "GET";
      if (p === "/api/transactions/42" && method === "GET") return { body: envelope({ transaction: TRANSACTION }) };
      if (p === "/api/accounts" && method === "GET") return { body: envelope({ accounts: [{ id: 10, name: "Wallet", currency_code: "ILS", status: "active" }] }) };
      if (p === "/api/categories" && method === "GET") return { body: envelope({ categories: [{ id: 4, name: "Food", type: "expense", status: "active" }] }) };
      if (p === "/api/transactions/42" && method === "PATCH") return answers.shift();
      throw new Error(`Unexpected request ${method} ${p}`);
    });
  }

  async function openPage() {
    const i18n = await createI18n("en");
    const router = createMemoryRouter([{ path: "/dashboard/transactions/:transactionId", element: h(TransactionDetails) }], { initialEntries: ["/dashboard/transactions/42"] });
    view = await render(withI18n(i18n, withAuth(h(RouterProvider, { router }))));
    for (let i = 0; i < 8; i += 1) await flush();
  }

  const openCorrectForm = async () => {
    await click([...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Correct"));
    for (let i = 0; i < 4; i += 1) await flush();
  };

  const submitCorrection = async () => {
    await change(document.querySelector(".correct-transaction-form [name='amount']"), "95");
    await change(document.querySelector(".correct-transaction-form textarea"), "Wrong amount entered");
    await submit(document.querySelector(".correct-transaction-form form"));
    for (let i = 0; i < 4; i += 1) await flush();
  };

  const duplicateDialog = () => document.querySelector(".possible-duplicate-dialog");
  const duplicateButtons = () => [...document.querySelectorAll(".possible-duplicate-dialog footer button")];
  const postsTo = (calls) => calls.filter((call) => call.method === "PATCH" && path(call) === "/api/transactions/42");

  it("a possible-duplicate correction shows the dialog; Confirm reuses the same key and body plus the flag", async () => {
    const calls = serve([possibleDuplicateBody({ ...MATCHED, type: "expense" }), { status: 200, body: envelope({ transaction: { id: 43 } }) }]);
    await openPage();
    await openCorrectForm();
    await submitCorrection();

    assert.ok(duplicateDialog(), "the duplicate dialog is shown for a correction too");
    assert.equal(document.querySelector(".correct-transaction-form"), null, "the correction form is replaced, not stacked");

    await click(duplicateButtons()[1]);
    for (let i = 0; i < 6; i += 1) await flush();

    const [first, resend] = postsTo(calls);
    assert.equal(postsTo(calls).length, 2);
    assert.equal(resend.headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
    assert.deepEqual(resend.body, { ...first.body, confirm_possible_duplicate: true });
    assert.equal(duplicateDialog(), null);
  });

  it("Cancel on a correction's duplicate dialog sends nothing and returns to the form", async () => {
    const calls = serve([possibleDuplicateBody({ ...MATCHED, type: "expense" })]);
    await openPage();
    await openCorrectForm();
    await submitCorrection();
    assert.ok(duplicateDialog());

    // Reopening the correction form legitimately refetches its own options
    // (accounts/categories, both GET); only a second PATCH would mean a retry.
    const before = postsTo(calls).length;
    await click(duplicateButtons()[0]);
    for (let i = 0; i < 4; i += 1) await flush();

    assert.equal(postsTo(calls).length, before, "cancelling sends no PATCH");
    assert.equal(duplicateDialog(), null);
    assert.ok(document.querySelector(".correct-transaction-form"), "the correction form is back");
  });
});
