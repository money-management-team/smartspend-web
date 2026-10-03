import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  aiInputQuotasApi, getAiInputLimitError, parseAiInputQuota, parseAiInputQuotas,
} from "../src/features/Dashboards/User/api/aiInputQuotasApi.js";
import { aiVoiceExpenseCapturesApi as voiceApi } from "../src/features/Dashboards/User/api/aiVoiceExpenseCapturesApi.js";
import { ApiError } from "../src/features/Dashboards/User/api/apiClient.js";
import {
  VOICE_RECORDING_POLICY, buildVoiceConfirmPayload, buildVoiceReviewPayload, createVoiceAttempt,
  getVoiceCapabilities, getVoiceCaptureProgress, normalizeVoiceAmount, parseVoiceCaptureResponse, parseVoiceCapturesPage,
} from "../src/features/Dashboards/User/FinancialOperations/voiceCaptureContract.js";

// Tests exercise the real shared apiRequest with fetch replaced in memory.
// No server, microphone, credentials, extra packages or AI calls are used.
const originals = Object.fromEntries(["fetch", "localStorage", "sessionStorage"].map(
  (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)],
));
let requests, reply, storage;
const key = "voice-test-12345678";
const quota = (used = 0) => ({ limit: 10, used, remaining: 10 - used, reset_at: "2026-10-02T00:00:00+00:00" });
const capture = (extra = {}) => ({
  id: 17, workspace_id: 3, source_type: "voice", status: "queued", review_version: 0,
  review_values: { account_id: null, category_id: null, amount: null, currency_code: null, transaction_date: null },
  capabilities: { can_edit: false, can_confirm: false, can_retry: false, can_discard: true },
  ...extra,
});
const envelope = (value = capture()) => ({ status: true, data: { capture: value, voice_quota: quota(1) } });
const jsonResponse = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json", ...headers },
});
const recording = () => new Blob(["audio test bytes"], { type: "audio/wav" });
const invalidInput = (field) => (error) => error instanceof ApiError && error.code === "VOICE_INPUT_INVALID" && Boolean(error.errors[field]);

beforeEach(() => {
  requests = [];
  storage = new Map([["ACCESS_TOKEN", "test-session-token"]]);
  const memoryStorage = {
    getItem: (name) => storage.get(name) ?? null,
    setItem: (name, value) => storage.set(name, String(value)),
    removeItem: (name) => storage.delete(name),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: () => null, setItem: () => {}, removeItem: () => {},
  } });
  reply = () => jsonResponse(envelope());
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return reply(url, init);
  };
});

afterEach(() => {
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

test("allowances use the existing authenticated GET and parse both independent channels", async () => {
  reply = () => jsonResponse({ status: true, data: { quotas: { voice: quota(10), receipt: quota(2) } } });
  const result = parseAiInputQuotas(await aiInputQuotasApi.get());
  assert.equal(requests[0].url, "/api/ai/input-quotas");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.headers.Authorization, "Bearer test-session-token");
  assert.equal(result.voice.remaining, 0);
  assert.equal(result.receipt.remaining, 8);
  assert.equal(result.voice.reset_at, "2026-10-02T00:00:00+00:00");
});

test("missing or inconsistent quota data never becomes a guessed fresh allowance", () => {
  for (const value of [null, {}, { ...quota(), used: "0" }, { ...quota(2), remaining: 10 },
    { ...quota(), limit: 0 }, { ...quota(), used: -1 }, { ...quota(), reset_at: "tomorrow" }]) {
    assert.equal(parseAiInputQuota(value), null);
  }
  assert.equal(parseAiInputQuotas({ status: true, data: { quotas: { voice: quota() } } }), null);
  assert.equal(parseAiInputQuotas({ status: false, data: { quotas: { voice: quota(), receipt: quota() } } }), null);
});

test("only the backend daily code disables its named AI channel", () => {
  const error = { status: 429, retryAfter: "1800", payload: {
    code: "ai_daily_limit_reached", channel: "voice", reset_at: quota().reset_at,
  } };
  assert.deepEqual(getAiInputLimitError(error), {
    kind: "daily", channel: "voice", resetAt: quota().reset_at, retryAfterSeconds: 1800,
  });
  assert.equal(getAiInputLimitError({ ...error, status: 503 }), null);
  assert.equal(getAiInputLimitError({ ...error, payload: { ...error.payload, channel: "unknown" } }), null);
  assert.equal(getAiInputLimitError({ ...error, payload: { code: "RATE_LIMITED" } }), null);
});

test("minute throttling stays temporary and never becomes daily exhaustion", () => {
  assert.deepEqual(getAiInputLimitError({ status: 429, retryAfter: "30", payload: {
    code: "ai_minute_limit_reached", channel: "receipt", reset_at: null,
  } }), { kind: "minute", channel: "receipt", resetAt: null, retryAfterSeconds: 30 });
});

test("each logical voice attempt owns an immutable valid key", () => {
  for (const action of ["upload", "retry", "confirm"]) {
    const attempt = createVoiceAttempt(action);
    assert.equal(attempt.action, action);
    assert.ok(Object.isFrozen(attempt));
    assert.match(attempt.idempotencyKey, /^[A-Za-z0-9._:-]{8,120}$/);
    assert.notEqual(attempt.idempotencyKey, createVoiceAttempt(action).idempotencyKey);
  }
  assert.throws(() => createVoiceAttempt("manual"), invalidInput("action"));
});

test("upload sends one file and explicit workspace with auth and a browser multipart boundary", async () => {
  const result = await voiceApi.create(recording(), { workspaceId: 3, idempotencyKey: key });
  const { url, init } = requests[0];
  assert.equal(result.data.capture.id, 17);
  assert.equal(url, "/api/ai/voice-expense-captures");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Idempotency-Key"], key);
  assert.equal(init.headers.Authorization, "Bearer test-session-token");
  assert.equal(init.headers["Content-Type"], undefined);
  assert.deepEqual([...init.body.keys()], ["file", "workspace_id"]);
  assert.equal(init.body.get("workspace_id"), "3");
  assert.equal(init.body.get("file").name, "voice.wav");
  assert.equal(await init.body.get("file").text(), "audio test bytes");
  assert.equal(requests.length, 1);
});

test("upload can use the backend workspace default without inventing ownership or account fields", async () => {
  await voiceApi.create(recording(), { idempotencyKey: key, account_id: 9, user_id: 1 });
  assert.deepEqual([...requests[0].init.body.keys()], ["file"]);
});

test("replaying an upload retains the caller key bytes and workspace", async () => {
  const file = recording();
  await voiceApi.create(file, { workspaceId: 3, idempotencyKey: key });
  await voiceApi.create(file, { workspaceId: 3, idempotencyKey: key });
  assert.equal(requests.length, 2);
  for (const { init } of requests) {
    assert.equal(init.headers["Idempotency-Key"], key);
    assert.equal(init.body.get("workspace_id"), "3");
    assert.equal(await init.body.get("file").text(), await file.text());
  }
});

test("invalid or missing upload retry and confirm keys are rejected before fetch", async () => {
  for (const badKey of [undefined, "short", "x".repeat(121), "bad key-123", "voice\nkey-123", "voice-key-123\n"]) {
    await assert.rejects(voiceApi.create(recording(), { idempotencyKey: badKey }), invalidInput("idempotency_key"));
    await assert.rejects(voiceApi.retry(17, { idempotencyKey: badKey }), invalidInput("idempotency_key"));
    await assert.rejects(voiceApi.confirm(17, { review_version: 1 }, { idempotencyKey: badKey }), invalidInput("idempotency_key"));
  }
  assert.equal(requests.length, 0);
});

test("empty oversized and non-file uploads are rejected before any request", async () => {
  for (const file of [null, "recording.wav", new Blob([]), new Blob([new Uint8Array(VOICE_RECORDING_POLICY.maxBytes + 1)])]) {
    await assert.rejects(voiceApi.create(file, { idempotencyKey: key }), invalidInput("file"));
  }
  assert.equal(requests.length, 0);
});

test("unsafe capture and workspace identifiers never enter a path or multipart body", async () => {
  for (const id of [undefined, 0, -1, 1.2, "../17", "17?user_id=2", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(voiceApi.get(id), invalidInput("capture_id"));
    await assert.rejects(voiceApi.create(recording(), { workspaceId: id === undefined ? 0 : id, idempotencyKey: key }), invalidInput("workspace_id"));
  }
  assert.equal(requests.length, 0);
});

test("listing sends only backend list filters with one api prefix", async () => {
  await voiceApi.list({ workspace_id: 3, status: "failed", per_page: 20, sort_dir: "desc", page: 2, user_id: 99, transcript: "private" });
  const url = new URL(requests[0].url, "https://example.test");
  assert.equal(url.pathname, "/api/ai/voice-expense-captures");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    workspace_id: "3", status: "failed", per_page: "20", sort_dir: "desc", page: "2",
  });
});

test("detail lookup is a GET and creates no review or financial request", async () => {
  await voiceApi.get("17");
  assert.equal(requests[0].url, "/api/ai/voice-expense-captures/17");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests.length, 1);
});

test("review PATCH carries current version and exact money while excluding protected fields", async () => {
  await voiceApi.update(17, { review_version: 7, amount: "999999999999999.9999", account_id: "4",
    transcript: "must stay server-owned", workspace_id: 999, status: "confirmed", tax_amount: "2.0000", provider_metadata: {} });
  const { url, init } = requests[0];
  assert.equal(url, "/api/ai/voice-expense-captures/17");
  assert.equal(init.method, "PATCH");
  assert.equal(init.headers["Idempotency-Key"], undefined);
  assert.deepEqual(JSON.parse(init.body), { review_version: 7, account_id: 4, amount: "999999999999999.9999" });
  assert.equal(requests.length, 1);
});

test("Arabic and Persian decimals keep exact precision without floating point conversion", () => {
  assert.equal(normalizeVoiceAmount("٢٥٫٥"), "25.5000");
  assert.equal(normalizeVoiceAmount("۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹.۹۹۹۹"), "999999999999999.9999");
  assert.equal(normalizeVoiceAmount("000.0001"), "0.0001");
  assert.equal(normalizeVoiceAmount(" 1 "), "1.0000");
});

test("numbers zero negatives exponent notation and overprecision never become monetary payloads", () => {
  for (const value of [25.5, NaN, Infinity, "0", "0.0000", "-1", "+1", "1e3", "1.00001", "1000000000000000", "1,000", "١٬٠٠٠"]) {
    assert.throws(() => normalizeVoiceAmount(value), invalidInput("amount"));
  }
});

test("partial review omits unchanged inputs and can explicitly clear nullable fields", () => {
  assert.deepEqual(buildVoiceReviewPayload({ amount: null, description: "", merchant_name: undefined, currency_code: "ils" }, 3), {
    review_version: 3, amount: null, currency_code: "ILS", description: null,
  });
  assert.deepEqual(buildVoiceReviewPayload({ category_id: "12", transaction_time: "10:15" }, 3), {
    review_version: 3, category_id: 12, transaction_time: "10:15",
  });
});

test("client payload construction does not guess or override a missing review version", async () => {
  for (const version of [undefined, null, "1", 0, -1, 1.5]) {
    assert.throws(() => buildVoiceConfirmPayload(version), invalidInput("review_version"));
    await assert.rejects(voiceApi.update(17, { amount: "1", review_version: version }), invalidInput("review_version"));
    await assert.rejects(voiceApi.confirm(17, { review_version: version }, { idempotencyKey: key }), invalidInput("review_version"));
  }
  assert.deepEqual(buildVoiceReviewPayload({ review_version: 99, amount: "1" }, 7), { review_version: 7, amount: "1.0000" });
  assert.equal(requests.length, 0);
});

test("calendar dates local times currencies and column bounds match backend constraints", () => {
  for (const [field, value] of [["transaction_date", "2026-02-29"], ["transaction_date", "2026-04-31"],
    ["transaction_date", "0000-01-01"], ["transaction_time", "24:00"], ["transaction_time", "12:60:00"],
    ["currency_code", "USDT"], ["reference_number", "r".repeat(121)], ["merchant_name", "m".repeat(192)],
    ["description", "d".repeat(501)], ["account_id", false]]) {
    assert.throws(() => buildVoiceReviewPayload({ [field]: value }, 1), invalidInput(field));
  }
  assert.deepEqual(buildVoiceReviewPayload({ transaction_date: "2028-02-29", transaction_time: "23:59:59", description: "🌟".repeat(500) }, 1), {
    review_version: 1, transaction_date: "2028-02-29", transaction_time: "23:59:59", description: "🌟".repeat(500),
  });
});

test("confirmation sends only the saved version and caller key without hidden edits", async () => {
  await voiceApi.confirm(17, { review_version: 7, amount: "999", account_id: 4, transaction_date: "2026-01-01" }, { idempotencyKey: key });
  const { url, init } = requests[0];
  assert.equal(url, "/api/ai/voice-expense-captures/17/confirm");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Idempotency-Key"], key);
  assert.deepEqual(JSON.parse(init.body), { review_version: 7 });
  assert.equal(requests.length, 1);
});

test("manual retry preserves its key with no invented body or financial fields", async () => {
  await voiceApi.retry(17, { idempotencyKey: key });
  assert.equal(requests[0].url, "/api/ai/voice-expense-captures/17/retry");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers["Idempotency-Key"], key);
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[0].init.headers["Content-Type"], undefined);
});

test("discard uses DELETE with no transaction reversal or monetary request", async () => {
  await voiceApi.discard(17);
  assert.equal(requests[0].url, "/api/ai/voice-expense-captures/17");
  assert.equal(requests[0].init.method, "DELETE");
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests.length, 1);
});

test("detail parsing retains authorized multilingual speech without filling missing financial values", () => {
  const value = capture({ status: "ready_for_review", review_version: 1, transcript: "دفعت ٢٥ على lunch", review_values: { amount: null, currency_code: null } });
  assert.equal(parseVoiceCaptureResponse(envelope(value), 17), value);
  assert.equal(value.review_values.amount, null);
  assert.equal(value.review_values.currency_code, null);
  assert.equal(parseVoiceCaptureResponse(envelope(value), 18), null);
  assert.equal(parseVoiceCaptureResponse(envelope({ ...value, source_type: "receipt" })), null);
  assert.equal(parseVoiceCaptureResponse({ status: true, data: value }), null);
});

test("malformed status versions and numeric financial values are rejected when parsing", () => {
  for (const extra of [{ id: "17" }, { status: "complete" }, { review_version: -1 }, { review_version: "0" }, { review_version: 0.5 },
    { status: "ready_for_review", review_version: 0 }, { status: "confirmed", review_version: 0 },
    { review_values: { amount: 25.5 } }, { review_values: { amount: "1.00001" } }, { review_values: { amount: "0.0000" } }]) {
    assert.equal(parseVoiceCaptureResponse(envelope(capture(extra))), null);
  }
});

test("the real backend queued version zero is accepted before analysis finishes", () => {
  const value = capture({ review_version: 0 });
  assert.equal(parseVoiceCaptureResponse(envelope(value)), value);
  assert.equal(getVoiceCapabilities(value).isProcessing, true);
  assert.equal(getVoiceCapabilities(value).canEdit, false);
  assert.equal(getVoiceCapabilities(value).canConfirm, false);
});

test("zero versions support uploaded processing failed and discarded snapshots without review access", () => {
  for (const status of ["uploaded", "processing", "failed", "discarded"]) {
    const value = capture({ status, review_version: 0, capabilities: { can_edit: true, can_confirm: true, can_retry: true, can_discard: true } });
    assert.equal(parseVoiceCaptureResponse(envelope(value)), value);
    assert.equal(getVoiceCapabilities(value).canEdit, false);
    assert.equal(getVoiceCapabilities(value).canConfirm, false);
  }
  assert.equal(getVoiceCapabilities(capture({ status: "failed", review_version: 0, capabilities: { can_retry: true } })).canRetry, true);
});

test("version zero never enters a financial review or confirmation request", () => {
  assert.throws(() => buildVoiceReviewPayload({ amount: "25" }, 0), invalidInput("review_version"));
  assert.throws(() => buildVoiceConfirmPayload(0), invalidInput("review_version"));
});

test("progress follows accepted queue and transcript checkpoints without a fabricated percentage", () => {
  assert.deepEqual(getVoiceCaptureProgress(null, "upload"), { stage: 0, phase: "uploading" });
  assert.deepEqual(getVoiceCaptureProgress(capture({ status: "failed" }), "retry"), { stage: 0, phase: "retrying" });
  for (const status of ["uploaded", "queued"]) {
    assert.deepEqual(getVoiceCaptureProgress(capture({ status })), { stage: 1, phase: "queued" });
  }
  assert.deepEqual(getVoiceCaptureProgress(capture({ status: "processing", transcript: null })), { stage: 2, phase: "transcribing" });
  assert.deepEqual(getVoiceCaptureProgress(capture({ status: "processing", transcript: "  " })), { stage: 2, phase: "transcribing" });
  assert.deepEqual(getVoiceCaptureProgress(capture({ status: "processing", transcript: "دفعت خمسة وعشرين" })), { stage: 3, phase: "extracting" });
});

test("completed failed discarded and malformed snapshots never keep the analysis loader running", () => {
  for (const status of ["ready_for_review", "confirmed", "failed", "discarded"]) {
    assert.equal(getVoiceCaptureProgress(capture({ status, review_version: 1 })), null);
  }
  assert.equal(getVoiceCaptureProgress(capture({ review_version: -1 })), null);
  assert.equal(getVoiceCaptureProgress(null), null);
});

test("list parsing accepts summaries without speech and retains the server quota", () => {
  const value = { status: true, data: { captures: {
    data: [capture()], current_page: 1, last_page: 1, per_page: 20, total: 1, from: 1, to: 1,
  }, voice_quota: quota(9) } };
  const page = parseVoiceCapturesPage(value);
  assert.equal(page.items[0].transcript, undefined);
  assert.equal(page.quota.remaining, 1);
  assert.equal(page.page, 1);
  assert.equal(parseVoiceCapturesPage({ ...value, data: { ...value.data, voice_quota: null } }), null);
  assert.equal(parseVoiceCapturesPage({ status: true, data: { captures: [] } }), null);
});

test("empty paginators remain empty even when the requested page exceeds the last page", () => {
  assert.deepEqual(parseVoiceCapturesPage({ status: true, data: { captures: {
    data: [], current_page: 2, last_page: 1, per_page: 20, total: 0, from: null, to: null,
  }, voice_quota: quota() } }), { items: [], page: 2, lastPage: 1, perPage: 20, total: 0, from: 0, to: 0, quota: quota() });
});

test("capabilities require both known lifecycle and explicit backend permission", () => {
  const ready = capture({ status: "ready_for_review", review_version: 1,
    review_values: { account_id: 4, category_id: 12, amount: "15.0000", currency_code: "ILS", transaction_date: "2026-10-01" },
    capabilities: { can_edit: true, can_confirm: true, can_retry: true, can_discard: true } });
  assert.deepEqual(getVoiceCapabilities(ready), { canEdit: true, canConfirm: true, canRetry: false, canDiscard: true, isProcessing: false });
  for (const status of ["processing", "confirmed", "discarded", "failed"]) {
    assert.equal(getVoiceCapabilities({ ...ready, status }).canConfirm, false);
  }
  assert.equal(getVoiceCapabilities({ ...ready, capabilities: {} }).canConfirm, false);
  assert.equal(getVoiceCapabilities({ ...ready, review_values: { ...ready.review_values, amount: null } }).canConfirm, false);
  assert.equal(getVoiceCapabilities(capture({ status: "failed", capabilities: { can_retry: false } })).canRetry, false);
  assert.equal(getVoiceCapabilities(capture({ status: "processing" })).canDiscard, false);
});

test("daily refusal retains backend channel reset and Retry-After for the UI", async () => {
  reply = () => jsonResponse({ status: false, code: "ai_daily_limit_reached", channel: "voice", reset_at: quota().reset_at }, 429, { "Retry-After": "900" });
  await assert.rejects(voiceApi.create(recording(), { idempotencyKey: key }), (error) => {
    assert.equal(error.code, "RATE_LIMITED");
    assert.deepEqual(getAiInputLimitError(error), { kind: "daily", channel: "voice", resetAt: quota().reset_at, retryAfterSeconds: 900 });
    return true;
  });
  assert.equal(requests.length, 1);
});

test("stale review responses preserve validation fields and never trigger a second confirmation", async () => {
  reply = () => jsonResponse({ status: false, message: "Refresh this draft.", errors: { review_version: ["Draft has changed."] } }, 422);
  await assert.rejects(voiceApi.confirm(17, { review_version: 1 }, { idempotencyKey: key }), (error) => {
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.deepEqual(error.errors, { review_version: ["Draft has changed."] });
    return true;
  });
  assert.equal(requests.length, 1);
});

test("network uncertainty never causes automatic replay or a newly generated operation key", async () => {
  reply = () => { throw new TypeError("network unavailable"); };
  const attempt = createVoiceAttempt("confirm");
  await assert.rejects(voiceApi.confirm(17, { review_version: 1 }, attempt), (error) => error.code === "NETWORK_ERROR");
  assert.equal(requests.length, 1);
  reply = () => jsonResponse(envelope(capture({ status: "confirmed", confirmed_transaction_id: 8 })));
  await voiceApi.confirm(17, { review_version: 1 }, attempt);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.headers["Idempotency-Key"], requests[1].init.headers["Idempotency-Key"]);
});

test("server failures and key conflicts stay errors without hidden retries", async () => {
  for (const status of [503, 409]) {
    reply = () => jsonResponse({ status: false, code: "voice_capture_unavailable", message: "Unavailable." }, status);
    await assert.rejects(voiceApi.retry(17, { idempotencyKey: key }), (error) => error.status === status);
  }
  assert.equal(requests.length, 2);
});

test("existing authentication expiry handling remains active for voice requests", async () => {
  reply = () => jsonResponse({ status: false, message: "Unauthenticated." }, 401);
  await assert.rejects(voiceApi.get(17), (error) => error.code === "UNAUTHENTICATED");
  assert.equal(storage.has("ACCESS_TOKEN"), false);
});

test("caller cancellation propagates into the real request signal without retrying", async () => {
  const controller = new AbortController();
  reply = (_url, init) => {
    controller.abort();
    assert.equal(init.signal.aborted, true);
    throw new DOMException("Aborted", "AbortError");
  };
  await assert.rejects(voiceApi.get(17, { signal: controller.signal }), (error) => error.name === "AbortError");
  assert.equal(requests.length, 1);
});

test("successful invalid JSON is rejected through the existing malformed-response path", async () => {
  reply = () => new Response("<html>not JSON</html>", { status: 200 });
  await assert.rejects(voiceApi.get(17), (error) => error.code === "MALFORMED_RESPONSE");
  assert.equal(requests.length, 1);
});
