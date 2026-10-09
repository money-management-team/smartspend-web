import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError, apiRequest, getApiErrorMessage } from "../../src/features/Dashboards/User/api/apiClient.js";
import { aiVoiceExpenseCapturesApi } from "../../src/features/Dashboards/User/api/aiVoiceExpenseCapturesApi.js";
import { aiExpenseCapturesApi } from "../../src/features/Dashboards/User/api/aiExpenseCapturesApi.js";
import { envelope, installBrowserStubs, mockFetch } from "../helpers/mockFetch.mjs";

beforeEach(() => installBrowserStubs());
const rejects = async (promise) => promise.then(() => assert.fail("expected rejection"), (e) => e);

describe("ApiError.serverCode does not change existing callers", () => {
  it("keeps the status-derived code, message, errors and payload", async () => {
    mockFetch(() => ({ status: 409, body: { status: false, message: "Conflict!", code: "something_else", errors: { a: ["b"] } } }));
    const error = await rejects(apiRequest("/x"));
    assert.equal(error.code, "CONFLICT");
    assert.equal(error.serverCode, "something_else");
    assert.equal(error.message, "Conflict!");
    assert.equal(error.payload.code, "something_else");
    assert.deepEqual(error.errors, { a: ["b"] });
    assert.equal(getApiErrorMessage(error, (k) => k), "Conflict!");
  });

  it("is null without a string code, and on constructed errors", async () => {
    mockFetch(() => ({ status: 422, body: { status: false, message: "m", code: 42 } }));
    assert.equal((await rejects(apiRequest("/x"))).serverCode, null);
    mockFetch(() => ({ status: 404, body: { status: false } }));
    assert.equal((await rejects(apiRequest("/x"))).serverCode, null);
    assert.equal(new ApiError("m", { code: "TIMEOUT" }).serverCode, null);
  });
});

describe("Voice Capture regression", () => {
  it("confirm still sends review_version and Idempotency-Key", async () => {
    const calls = mockFetch(() => ({ status: 201, body: envelope({ capture: { id: 5 } }) }));
    await aiVoiceExpenseCapturesApi.confirm(5, { review_version: 2 }, { idempotencyKey: "voice-confirm-abc12345" });
    assert.equal(calls[0].url, "/api/ai/voice-expense-captures/5/confirm");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, { review_version: 2 });
    assert.equal(calls[0].headers["Idempotency-Key"], "voice-confirm-abc12345");
  });

  it("list and update keep their contract; a missing key is still rejected", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    await aiVoiceExpenseCapturesApi.list({ status: "ready_for_review", bogus: 1 });
    assert.equal(calls[0].url, "/api/ai/voice-expense-captures?status=ready_for_review");
    await aiVoiceExpenseCapturesApi.update(5, { review_version: 2, amount: "5" });
    assert.deepEqual(calls[1].body, { review_version: 2, amount: "5.0000" });
    assert.equal(
      (await rejects(aiVoiceExpenseCapturesApi.confirm(5, { review_version: 2 }, {}))).code,
      "VOICE_INPUT_INVALID",
    );
  });

  it("a backend 409 still maps to CONFLICT", async () => {
    mockFetch(() => ({ status: 409, body: { status: false, message: "stale" } }));
    assert.equal((await rejects(aiVoiceExpenseCapturesApi.get(5))).code, "CONFLICT");
  });
});

describe("Receipt Capture regression", () => {
  it("get and list keep their paths and filters", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    await aiExpenseCapturesApi.get(9);
    await aiExpenseCapturesApi.list({ status: "confirmed", per_page: 5, workspace_id: 3 });
    assert.equal(calls[0].url, "/api/ai/expense-captures/9");
    assert.equal(calls[1].url, "/api/ai/expense-captures?status=confirmed&per_page=5");
  });

  it("retry carries only an optional key and no body", async () => {
    const calls = mockFetch(() => ({ status: 202, body: envelope({ capture: { id: 9 } }) }));
    await aiExpenseCapturesApi.retry(9, { idempotencyKey: "retry-key-12345" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].rawBody, undefined);
    assert.equal(calls[0].headers["Idempotency-Key"], "retry-key-12345");
  });
});
