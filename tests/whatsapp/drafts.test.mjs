import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { whatsappApi } from "../../src/features/Dashboards/User/api/whatsappApi.js";
import {
  classifyWhatsAppError, createWhatsAppConfirmAttempt, isOutcomeUncertain, isWhatsAppDisabledError,
  parseConfirmResponse, parseDraftResponse, parseDraftsPageResponse, parseDraftSummaryResponse,
  parseWhatsAppAvailability, resolveConfirmationOutcome,
} from "../../src/features/Dashboards/User/FinancialOperations/whatsappContract.js";
import { envelope, installBrowserStubs, mockFetch } from "../helpers/mockFetch.mjs";
import { account, draft } from "./fixtures.mjs";

const BASE = "/api/integrations/whatsapp";
let stubs;
beforeEach(() => { stubs = installBrowserStubs(); });

const rejects = async (promise) => promise.then(() => assert.fail("expected rejection"), (e) => e);
const parse = (over) => parseDraftResponse(envelope({ draft: draft(over) }));

describe("draft listing", () => {
  it("parses a paginated page with exact money, dates and timezone", async () => {
    const calls = mockFetch(() => ({ body: envelope({ drafts: {
      current_page: 2, per_page: 5, total: 11, last_page: 3, from: 6, to: 10,
      data: [draft({ account: account({ current_balance: "0.1000" }) })],
    } }) }));
    const page = parseDraftsPageResponse(await whatsappApi.listDrafts({ page: 2, per_page: 5 }));
    assert.equal(calls[0].url, `${BASE}/expense-drafts?per_page=5&page=2`);
    assert.deepEqual(page.pagination, { currentPage: 2, perPage: 5, total: 11, lastPage: 3, from: 6, to: 10 });
    const [d] = page.items;
    assert.equal(d.review_values.amount, "25.2500");
    assert.equal(typeof d.review_values.amount, "string");
    assert.equal(d.account.current_balance, "0.1000");
    assert.equal(d.review_values.transaction_date, "2026-10-06");
    assert.equal(d.review_values.transaction_time, "12:30:00");
    assert.equal(d.review_values.workspace_timezone, "Asia/Gaza");
    assert.equal(d.review_values.currency_code, d.account.currency_code);
  });

  it("serializes only the documented filters", async () => {
    const calls = mockFetch(() => ({ body: envelope({ drafts: { data: [], total: 0 } }) }));
    await whatsappApi.listDrafts({
      status: "confirmed", date: "2026-02-28", account: "4", per_page: 100, page: 1,
      workspace_id: 9, account_id: 4, sort_dir: "asc", q: "x",
    });
    const url = new URL(calls[0].url, "http://x");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      status: "confirmed", date: "2026-02-28", account: "4", per_page: "100", page: "1",
    });
  });

  it("rejects invalid filter values before any request", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    for (const q of [
      { status: "done" }, { date: "2026-02-30" }, { date: "06/10/2026" }, { account: 0 },
      { account: "abc" }, { per_page: 101 }, { per_page: 0 }, { page: -1 },
    ]) {
      assert.equal((await rejects(whatsappApi.listDrafts(q))).code, "WHATSAPP_INPUT_INVALID", JSON.stringify(q));
    }
    assert.equal(calls.length, 0);
  });

  it("an empty list (e.g. no manageable workspace) parses cleanly", async () => {
    mockFetch(() => ({ body: envelope({ drafts: { current_page: 1, data: [], per_page: 20, total: 0 } }) }));
    const page = parseDraftsPageResponse(await whatsappApi.listDrafts());
    assert.deepEqual(page.items, []);
    assert.equal(page.pagination.total, 0);
  });

  it("the adapter has no availability gate: drafts load while WhatsApp is disabled", async () => {
    const calls = mockFetch(() => ({ body: envelope({ drafts: { data: [], total: 0 } }) }));
    await whatsappApi.listDrafts();
    assert.equal(calls.length, 1);
  });

  it("summary count", async () => {
    const calls = mockFetch(() => ({ body: envelope({ pending_review_count: 4 }) }));
    assert.deepEqual(parseDraftSummaryResponse(await whatsappApi.getDraftSummary()), { pendingReviewCount: 4 });
    assert.equal(calls[0].url, `${BASE}/expense-drafts/summary`);
    assert.throws(() => parseDraftSummaryResponse(envelope({ pending_review_count: "4" })), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => parseDraftSummaryResponse(envelope({})), { code: "MALFORMED_RESPONSE" });
  });

  it("keeps no state between requests", async () => {
    mockFetch(() => ({ body: envelope({ drafts: { data: [draft({ id: 1 })], total: 1 } }) }));
    const first = parseDraftsPageResponse(await whatsappApi.listDrafts());
    mockFetch(() => ({ body: envelope({ drafts: { data: [], total: 0 } }) }));
    const second = parseDraftsPageResponse(await whatsappApi.listDrafts());
    assert.equal(first.items.length, 1);
    assert.equal(second.items.length, 0);
  });
});

describe("draft details and readiness", () => {
  it("fetches a draft by numeric id", async () => {
    const calls = mockFetch(() => ({ body: envelope({ draft: draft() }) }));
    const d = parseDraftResponse(await whatsappApi.getDraft("7"));
    assert.equal(calls[0].url, `${BASE}/expense-drafts/7`);
    assert.equal(d.review_version, 3);
    assert.equal(d.canConfirmNow, true);
    for (const bad of [0, -1, "7/confirm", "x", 1.5, null]) {
      assert.equal((await rejects(whatsappApi.getDraft(bad))).code, "WHATSAPP_INPUT_INVALID");
    }
  });

  it("Confirm needs can_confirm AND confirmation.ready", () => {
    assert.equal(parse({}).canConfirmNow, true);
    assert.equal(parse({ can_confirm: false }).canConfirmNow, false);
    assert.equal(parse({ confirmation: { ready: false, issues: [] } }).canConfirmNow, false);
    assert.equal(parse({ can_confirm: false, confirmation: { ready: true, issues: [] } }).canConfirmNow, false);
    assert.equal(parse({ can_confirm: "true" }).canConfirmNow, false);
  });

  it("preserves every issue, including unknown codes and extra keys", () => {
    const issues = [
      { field: "amount", code: "amount_required", message: "Amount is required" },
      { field: "x", code: "future_code_we_do_not_know", message: "?", extra: 1 },
    ];
    const d = parse({ confirmation: { ready: false, issues } });
    assert.deepEqual(d.confirmation.issues, issues);
    assert.equal(d.canConfirmNow, false);
  });

  it("a draft with missing fields keeps them missing", () => {
    const d = parse({
      review_values: {
        account_id: null, category_id: null, amount: null, currency_code: null,
        description: null, workspace_timezone: "Asia/Gaza",
      },
      account: null,
    });
    assert.equal(d.review_values.amount, null);
    assert.equal(d.review_values.transaction_date, null);
    assert.equal(d.review_values.transaction_time, null);
    assert.equal(d.account, null);
  });

  it("a missing balance is null, never zero; '0.0000' and huge values are verbatim", () => {
    assert.equal(parse({ account: { id: 1, currency_code: "ILS" } }).account.current_balance, null);
    assert.equal(parse({ account: account({ current_balance: "0.0000" }) }).account.current_balance, "0.0000");
    assert.equal(
      parse({ account: account({ current_balance: "-9007199254740993.1234" }) }).account.current_balance,
      "-9007199254740993.1234",
    );
    assert.equal(parse({ account: account({ current_balance: 12.5 }) }).account.current_balance, null);
  });

  it("a numeric amount from the server is malformed, not silently accepted", () => {
    assert.throws(
      () => parse({ review_values: { ...draft().review_values, amount: 25.25 } }),
      { code: "MALFORMED_RESPONSE" },
    );
  });

  it("malformed draft payloads", () => {
    for (const body of [
      envelope({}), envelope({ draft: null }), envelope({ draft: { id: 1 } }),
      envelope({ draft: draft({ status: "weird" }) }),
      envelope({ draft: draft({ confirmation: undefined }) }),
      envelope({ draft: draft({ confirmation: { ready: true, issues: "none" } }) }),
      envelope({ draft: draft({ review_version: "3" }) }),
    ]) {
      assert.throws(() => parseDraftResponse(body), { code: "MALFORMED_RESPONSE" });
    }
    assert.throws(() => parseDraftsPageResponse(envelope({ drafts: {} })), { code: "MALFORMED_RESPONSE" });
  });
});

describe("draft editing", () => {
  it("PATCHes a partial exact-decimal body with review_version and exposes the new version", async () => {
    const calls = mockFetch(() => ({ body: envelope({ draft: draft({ review_version: 4 }) }) }));
    const d = parseDraftResponse(await whatsappApi.updateDraft(7, { amount: "12.5", description: "  Dinner " }, 3));
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, `${BASE}/expense-drafts/7`);
    assert.deepEqual(calls[0].body, { review_version: 3, amount: "12.5000", description: "Dinner" });
    assert.equal(calls[0].headers["Idempotency-Key"], undefined);
    assert.equal(d.review_version, 4);
    assert.equal(calls.length, 1); // saving never confirms
  });

  it("keeps large and precise amounts exact", async () => {
    const calls = mockFetch(() => ({ body: envelope({ draft: draft() }) }));
    await whatsappApi.updateDraft(7, { amount: "0007.1" }, 1);
    await whatsappApi.updateDraft(7, { amount: "123456789012345.9999" }, 1);
    assert.equal(calls[0].body.amount, "7.1000");
    assert.equal(calls[1].body.amount, "123456789012345.9999");
  });

  it("refuses numbers and unsafe amounts", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    for (const amount of [12.5, "0", "0.0000", "-1", "1.23456", "1e3", "abc", "1,5", "1234567890123456"]) {
      assert.equal((await rejects(whatsappApi.updateDraft(7, { amount }, 1))).code, "WHATSAPP_INPUT_INVALID", String(amount));
    }
    assert.equal(calls.length, 0);
  });

  it("date can change but never be cleared; time can be cleared", async () => {
    const calls = mockFetch(() => ({ body: envelope({ draft: draft() }) }));
    for (const transaction_date of [null, "", "2026-13-01", "2026-02-29"]) {
      assert.equal((await rejects(whatsappApi.updateDraft(7, { transaction_date }, 1))).code, "WHATSAPP_INPUT_INVALID");
    }
    await whatsappApi.updateDraft(7, { transaction_date: "2024-02-29", transaction_time: null }, 2);
    assert.deepEqual(calls[0].body, { review_version: 2, transaction_date: "2024-02-29", transaction_time: null });
    await whatsappApi.updateDraft(7, { transaction_time: "08:05" }, 2);
    assert.equal(calls[1].body.transaction_time, "08:05");
    for (const transaction_time of ["24:00", "12:60", "7:00", "12:30:61"]) {
      assert.equal((await rejects(whatsappApi.updateDraft(7, { transaction_time }, 1))).code, "WHATSAPP_INPUT_INVALID");
    }
  });

  it("omitted fields stay omitted; null clears an account or category", async () => {
    const calls = mockFetch(() => ({ body: envelope({ draft: draft() }) }));
    await whatsappApi.updateDraft(7, { category_id: null, account_id: "3" }, 5);
    assert.deepEqual(calls[0].body, { review_version: 5, category_id: null, account_id: 3 });
  });

  it("currency and other server-owned fields are not editable", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    for (const field of ["currency_code", "status", "workspace_id", "workspace_timezone", "source"]) {
      assert.equal((await rejects(whatsappApi.updateDraft(7, { [field]: "x" }, 1))).code, "WHATSAPP_INPUT_INVALID");
    }
    assert.equal(calls.length, 0);
  });

  it("requires a valid review_version and at least one field", async () => {
    mockFetch(() => ({ body: envelope({}) }));
    for (const v of [undefined, 0, "3", 1.5, null]) {
      assert.equal((await rejects(whatsappApi.updateDraft(7, { amount: "1" }, v))).code, "WHATSAPP_INPUT_INVALID");
    }
    assert.equal((await rejects(whatsappApi.updateDraft(7, {}, 1))).code, "WHATSAPP_INPUT_INVALID");
  });

  it("a stale review version is a conflict the caller can recognise", async () => {
    mockFetch(() => ({ status: 409, body: { status: false, message: "The draft was changed. Refresh and try again." } }));
    const error = await rejects(whatsappApi.updateDraft(7, { amount: "1" }, 1));
    assert.equal(error.status, 409);
    assert.equal(classifyWhatsAppError(error), "conflict");
    assert.equal(isWhatsAppDisabledError(error), false);
  });

  it("discards with DELETE", async () => {
    const calls = mockFetch(() => ({ body: envelope({ draft: draft({
      status: "discarded", can_edit: false, can_confirm: false, can_discard: false,
      confirmation: { ready: false, issues: [] },
    }) }) }));
    const d = parseDraftResponse(await whatsappApi.discardDraft(7));
    assert.equal(calls[0].method, "DELETE");
    assert.equal(d.status, "discarded");
    assert.equal(d.canConfirmNow, false);
  });
});

describe("confirmation and idempotency", () => {
  const key = "wa-draft-7-confirm-v1";
  const transaction = { id: 50, type: "expense", status: "posted", amount: "25.2500", currency_code: "ILS", source: "whatsapp" };
  const confirmed = () => ({ status: 201, body: envelope({ draft: draft({ status: "confirmed", confirmed_transaction_id: 50 }), transaction }) });

  it("sends the Idempotency-Key header and exactly {review_version}", async () => {
    const calls = mockFetch(confirmed);
    const result = parseConfirmResponse(await whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey: key }));
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${BASE}/expense-drafts/7/confirm`);
    assert.equal(calls[0].headers["Idempotency-Key"], key);
    assert.equal(calls[0].rawBody, '{"review_version":3}');
    assert.deepEqual(result.transaction, transaction);
    assert.equal(result.draft.status, "confirmed");
    assert.equal(result.draft.confirmed_transaction_id, 50);
  });

  it("refuses to run without a valid key or version, and never invents a key", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    for (const idempotencyKey of [undefined, "", "short", "has space 12345", "x".repeat(256), 12345678]) {
      assert.equal(
        (await rejects(whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey }))).code,
        "WHATSAPP_INPUT_INVALID",
      );
    }
    assert.equal((await rejects(whatsappApi.confirmDraft(7, { idempotencyKey: key }))).code, "WHATSAPP_INPUT_INVALID");
    assert.equal((await rejects(whatsappApi.confirmDraft(7))).code, "WHATSAPP_INPUT_INVALID");
    assert.equal(calls.length, 0);
  });

  it("a confirm attempt is frozen and its key passes the backend's rule", () => {
    const attempt = createWhatsAppConfirmAttempt(7, 3);
    assert.equal(Object.isFrozen(attempt), true);
    assert.match(attempt.idempotencyKey, /^[A-Za-z0-9._:-]{8,255}$/);
    assert.notEqual(createWhatsAppConfirmAttempt(7, 3).idempotencyKey, attempt.idempotencyKey);
  });

  it("a timeout is an uncertain outcome: one request, no retry, then the draft is re-read", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = mockFetch((url, init) => (url.endsWith("/confirm")
      ? new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("a"), { name: "AbortError" })));
      })
      : { body: envelope({ draft: draft({ status: "confirmed" }) }) }));
    const pending = rejects(whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey: key }));
    await new Promise((r) => setImmediate(r));
    t.mock.timers.tick(20_000);
    const error = await pending;
    t.mock.timers.reset();

    assert.equal(error.code, "TIMEOUT");
    assert.equal(isOutcomeUncertain(error), true);
    assert.equal(classifyWhatsAppError(error), "timeout");
    assert.equal(calls.filter((c) => c.url.endsWith("/confirm")).length, 1);

    const reread = parseDraftResponse(await whatsappApi.getDraft(7));
    assert.equal(resolveConfirmationOutcome(reread), "confirmed");
  });

  it("releases the in-flight guard after a failure so the same key can be resent deliberately", async () => {
    let attempts = 0;
    const calls = mockFetch(() => {
      attempts += 1;
      return attempts === 1 ? { status: 500, body: { status: false, message: "" } } : confirmed();
    });
    const first = await rejects(whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey: key }));
    assert.equal(isOutcomeUncertain(first), true);
    await whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey: key });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].headers["Idempotency-Key"], calls[0].headers["Idempotency-Key"]);
  });

  it("never sends two confirmations for one draft at once", async () => {
    let release;
    const calls = mockFetch(() => new Promise((resolve) => { release = () => resolve(confirmed()); }));
    const a = whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey: key });
    const b = whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey: key });
    const c = await rejects(whatsappApi.confirmDraft(7, { reviewVersion: 3, idempotencyKey: "another-key-1234" }));
    assert.equal(c.code, "WHATSAPP_CONFIRM_IN_FLIGHT");
    await new Promise((r) => setTimeout(r, 5));
    release();
    await Promise.all([a, b]);
    assert.equal(calls.length, 1);
  });

  it("different drafts confirm independently", async () => {
    const calls = mockFetch(confirmed);
    await Promise.all([
      whatsappApi.confirmDraft(7, { reviewVersion: 1, idempotencyKey: key }),
      whatsappApi.confirmDraft(8, { reviewVersion: 1, idempotencyKey: "wa-draft-8-confirm-v1" }),
    ]);
    assert.equal(calls.length, 2);
  });

  it("a confirmation response without a transaction is malformed", () => {
    assert.throws(() => parseConfirmResponse(envelope({ draft: draft() })), { code: "MALFORMED_RESPONSE" });
  });

  it("a reused key / stale version is a conflict; a 422 keeps the domain message", async () => {
    mockFetch(() => ({ status: 409, body: { status: false, message: "Idempotency key already used." } }));
    assert.equal(
      classifyWhatsAppError(await rejects(whatsappApi.confirmDraft(7, { reviewVersion: 1, idempotencyKey: key }))),
      "conflict",
    );
    mockFetch(() => ({ status: 422, body: { status: false, message: "Insufficient balance.", errors: { amount: ["x"] } } }));
    const e = await rejects(whatsappApi.confirmDraft(7, { reviewVersion: 1, idempotencyKey: key }));
    assert.equal(e.message, "Insufficient balance.");
    assert.deepEqual(e.errors, { amount: ["x"] });
    assert.equal(isOutcomeUncertain(e), false);
  });

  it("resolveConfirmationOutcome", () => {
    assert.equal(resolveConfirmationOutcome({ status: "confirmed" }), "confirmed");
    assert.equal(resolveConfirmationOutcome({ status: "ready_for_review" }), "still_open");
    assert.equal(resolveConfirmationOutcome({ status: "discarded" }), "closed");
    assert.equal(resolveConfirmationOutcome(null), "closed");
  });
});

describe("HTTP errors and transport", () => {
  const cases = [
    [401, "UNAUTHENTICATED", "unauthenticated"],
    [403, "FORBIDDEN", "forbidden"],
    [404, "NOT_FOUND", "not_found"],
    [409, "CONFLICT", "conflict"],
    [422, "VALIDATION_ERROR", "validation"],
    [429, "RATE_LIMITED", "rate_limited"],
    [500, "SERVER_ERROR", "server"],
  ];
  for (const [status, code, kind] of cases) {
    it(`${status} maps to ${code}`, async () => {
      mockFetch(() => ({
        status, body: { status: false, message: "m" }, headers: status === 429 ? { "Retry-After": "7" } : {},
      }));
      const error = await rejects(whatsappApi.getDraft(7));
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(classifyWhatsAppError(error), kind);
      if (status === 429) assert.equal(error.retryAfter, "7");
    });
  }

  it("401 ends the session through the shared client", async () => {
    let expired = 0;
    globalThis.dispatchEvent = () => { expired += 1; return true; };
    mockFetch(() => ({ status: 401, body: { status: false, message: "" } }));
    await rejects(whatsappApi.getIntegration());
    delete globalThis.dispatchEvent;
    assert.equal(expired, 1);
    assert.equal(stubs.localStorage.getItem("ACCESS_TOKEN"), null);
  });

  it("network failure", async () => {
    globalThis.fetch = () => Promise.reject(new TypeError("fetch failed"));
    const error = await rejects(whatsappApi.getIntegration());
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(isOutcomeUncertain(error), true);
    assert.equal(classifyWhatsAppError(error), "network");
  });

  it("malformed or missing responses", async () => {
    for (const body of ["<html>", "", { message: "no status flag" }]) {
      mockFetch(() => ({ body }));
      assert.equal((await rejects(whatsappApi.getIntegration())).code, "MALFORMED_RESPONSE");
    }
    mockFetch(() => ({ body: { status: true, message: "ok" } }));
    const noData = await whatsappApi.getIntegration();
    assert.throws(() => parseWhatsAppAvailability(noData), { code: "MALFORMED_RESPONSE" });
  });

  it("an aborted list request is reported as an abort, not a failure", async () => {
    mockFetch((url, init) => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("a"), { name: "AbortError" })));
    }));
    const controller = new AbortController();
    const pending = rejects(whatsappApi.listDrafts({}, { signal: controller.signal }));
    controller.abort();
    assert.equal((await pending).name, "AbortError");
  });

  it("uses the shared API base and never a hardcoded host", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    await whatsappApi.getIntegration();
    assert.equal(calls[0].url.startsWith("/api/"), true);
    assert.equal(/https?:/.test(calls[0].url), false);
  });
});

