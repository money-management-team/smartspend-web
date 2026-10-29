import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/features/Dashboards/User/api/apiClient.js";
import { createAiInputQuotaStore } from "../src/features/Dashboards/User/api/aiInputQuotaStore.js";
import { createVoiceCaptureFlow, isVoiceDraftDirty, toVoiceReviewDraft, voiceReviewOptions } from "../src/features/Dashboards/User/FinancialOperations/voiceCaptureFlow.js";
import { aiExpenseCapturesApi } from "../src/features/Dashboards/User/api/aiExpenseCapturesApi.js";
import { getVoiceCaptureProgress } from "../src/features/Dashboards/User/FinancialOperations/voiceCaptureContract.js";

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 16; i += 1) await Promise.resolve(); };
const fail = (code, extra = {}) => new ApiError("", { code, ...extra });
const quotaValue = (used = 0) => ({ limit: 10, used, remaining: 10 - used, reset_at: "2026-10-03T00:00:00Z" });
const quotasResponse = (voice = 0, receipt = 0) => ({ status: true, data: { quotas: { voice: quotaValue(voice), receipt: quotaValue(receipt) } } });
const capture = (status = "ready_for_review", patch = {}) => ({
 id: 1, workspace_id: 7, source_type: "voice", status, review_version: ["uploaded", "queued", "processing", "failed"].includes(status) ? 0 : 1,
 transcript: ["uploaded", "queued", "processing"].includes(status) ? null : "دفعت ٢٥ شيكل أمس", audio_duration_ms: 1500,
 review_values: { account_id: ["uploaded", "queued", "processing"].includes(status) ? null : 2,
 category_id: ["uploaded", "queued", "processing"].includes(status) ? null : 3,
 amount: ["uploaded", "queued", "processing"].includes(status) ? null : "25.0000",
 currency_code: ["uploaded", "queued", "processing"].includes(status) ? null : "ILS",
 transaction_date: ["uploaded", "queued", "processing"].includes(status) ? null : "2026-10-01",
 transaction_time: null, merchant_name: null, reference_number: null, description: null },
 capabilities: { can_edit: status === "ready_for_review", can_confirm: status === "ready_for_review", can_retry: status === "failed", can_discard: !["processing", "confirmed"].includes(status) },
 confirmed_transaction_id: status === "confirmed" ? 100 : null, ...patch,
});
const response = (value) => ({ status: true, data: { capture: value, voice_quota: quotaValue(1) } });
class Clock {
 time = 0; index = 0; timers = new Map();
 later = (fn, delay) => { const id = ++this.index; this.timers.set(id, { fn, at: this.time + delay }); return id; };
 clear = (id) => this.timers.delete(id);
 async advance(ms) { const end = this.time + ms; for (;;) { const next = [...this.timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; this.time = next[1].at; this.timers.delete(next[0]); next[1].fn(); await flush(); } this.time = end; }
}
function harness(settings = {}) {
 const calls = [], clock = new Clock(), notifications = [], quotaCalls = [];
 const api = Object.fromEntries(["create", "get", "list", "update", "retry", "confirm", "discard"].map((method) => [method, async (...args) => {
  calls.push({ method, args }); if (settings[method]) return settings[method](...args);
  if (method === "list") return { status: true, data: { captures: { data: [capture()], current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 }, voice_quota: quotaValue(1) } };
  if (method === "create" || method === "retry") return response(capture("queued"));
  if (method === "update") return response(capture("ready_for_review", { review_version: args[1].review_version + 1, review_values: { ...capture().review_values, ...Object.fromEntries(Object.entries(args[1]).filter(([key]) => key !== "review_version")) } }));
  if (method === "confirm") return response(capture("confirmed"));
  if (method === "discard") return response(capture("discarded"));
  return response(capture());
 }]));
 const quota = { canUse: () => settings.allowance !== false, applyResponse: (r) => quotaCalls.push(["apply", r]), handleError: (e) => quotaCalls.push(["error", e]), refresh: async () => quotaCalls.push(["refresh"]) };
 const flow = createVoiceCaptureFlow({ workspaceId: 7, api, quotas: quota, preferredAccountId: settings.preferredAccountId,
 onConfirmed: (c) => notifications.push(c), setTimeout: clock.later, clearTimeout: clock.clear });
 const recording = { blob: new Blob(["wav"], { type: "audio/wav" }) };
 return { flow, api, quota, calls, clock, notifications, quotaCalls, recording };
}

// Quotas remain server-owned across channel admissions, out-of-order reads and midnight.
test("unknown quotas block new admissions without inventing ten remaining", () => {
 const store = createAiInputQuotaStore(); assert.equal(store.canUse("voice"), false); assert.equal(store.canUse("receipt"), false);
});
test("voice and receipt quotas are independent", async () => {
 const store = createAiInputQuotaStore({ api: { get: async () => quotasResponse(10, 2) }, now: () => Date.parse("2026-10-02T12:00:00Z") });
 await store.refresh(); assert.equal(store.canUse("voice"), false); assert.equal(store.canUse("receipt"), true); assert.equal(store.quota("receipt").remaining, 8);
});
test("parallel refresh callers share one HTTP read", async () => {
 const wait = deferred(); let calls = 0; const store = createAiInputQuotaStore({ api: { get: () => { calls += 1; return wait.promise; } } });
 const a = store.refresh(), b = store.refresh(); assert.equal(a, b); wait.resolve(quotasResponse()); await a; assert.equal(calls, 1);
});
test("a stale quota read cannot restore an allowance consumed by a newer response", async () => {
 const wait = deferred(), store = createAiInputQuotaStore({ api: { get: () => wait.promise }, now: () => Date.parse("2026-10-02T12:00:00Z") });
 const pending = store.refresh(); await flush(); store.applyResponse({ data: { voice_quota: quotaValue(10) } }); wait.resolve(quotasResponse(0)); await pending;
 assert.equal(store.quota("voice").remaining, 0);
});
test("daily refusal exhausts only its server-named channel", async () => {
 const store = createAiInputQuotaStore({ api: { get: async () => quotasResponse(3, 4) }, now: () => Date.parse("2026-10-02T12:00:00Z") }); await store.refresh();
 store.handleError(fail("RATE_LIMITED", { status: 429, payload: { code: "ai_daily_limit_reached", channel: "voice", reset_at: "2026-10-03T00:00:00Z" } }));
 assert.equal(store.quota("voice").remaining, 0); assert.equal(store.quota("receipt").remaining, 6);
});
test("minute refusal pauses one channel without changing either daily usage", async () => {
 let now = Date.parse("2026-10-02T12:00:00Z"); const store = createAiInputQuotaStore({ api: { get: async () => quotasResponse(2, 3) }, now: () => now }); await store.refresh();
 store.handleError(fail("RATE_LIMITED", { status: 429, retryAfter: "20", payload: { code: "ai_minute_limit_reached", channel: "voice" } }));
 assert.equal(store.canUse("voice"), false); assert.equal(store.canUse("receipt"), true); assert.equal(store.quota("voice").used, 2);
 now += 20000; await store.refresh(); assert.equal(store.canUse("voice"), true); assert.equal(store.getSnapshot().minuteUntil.voice, 0);
});
test("a generic 429 cannot be interpreted as exhaustion", async () => {
 const store = createAiInputQuotaStore({ api: { get: async () => quotasResponse(1, 2) }, now: () => Date.parse("2026-10-02T12:00:00Z") }); await store.refresh();
 assert.equal(store.handleError(fail("RATE_LIMITED", { status: 429 })), null); assert.equal(store.quota("voice").remaining, 9);
});
test("midnight expires a snapshot without granting a guessed new allowance", async () => {
 let now = Date.parse("2026-10-02T23:59:59Z"); const store = createAiInputQuotaStore({ api: { get: async () => quotasResponse(10, 10) }, now: () => now }); await store.refresh();
 now += 1000; assert.equal(store.quota("voice"), null); assert.equal(store.canUse("voice"), false); assert.equal(store.needsRefresh(), true);
});
test("malformed quota responses fail closed and show a refresh error", async () => {
 const store = createAiInputQuotaStore({ api: { get: async () => ({ status: true, data: { quotas: { voice: { remaining: 10 } } } }) } }); await store.refresh();
 assert.equal(store.getSnapshot().error.code, "MALFORMED_RESPONSE"); assert.equal(store.canUse("voice"), false);
});
test("cancelled quota reads cannot publish after screen cleanup", async () => {
 const wait = deferred(), store = createAiInputQuotaStore({ api: { get: () => wait.promise } }); const pending = store.refresh(); await flush(); store.cancel(); wait.resolve(quotasResponse()); await pending;
 assert.equal(store.getSnapshot().quotas, null); assert.equal(store.getSnapshot().loading, false);
});

// Paid admission, review and monetary posting are independent user actions.
test("upload sends the selected workspace and never posts a transaction", async () => {
 const h = harness(); await h.flow.upload(h.recording); assert.deepEqual(h.calls.map((c) => c.method), ["create"]);
 assert.equal(h.calls[0].args[1].workspaceId, 7); assert.match(h.calls[0].args[1].idempotencyKey, /^voice-upload/); assert.equal(h.notifications.length, 0); h.flow.cancel();
});
test("double upload clicks send one file and one admission key", async () => {
 const wait = deferred(), h = harness({ create: () => wait.promise }); const a = h.flow.upload(h.recording), b = h.flow.upload(h.recording); assert.equal(a, b);
 wait.resolve(response(capture("queued"))); await a; assert.equal(h.calls.length, 1); h.flow.cancel();
});
test("uncertain upload reuses exactly the original blob workspace and key", async () => {
 let first = true; const h = harness({ create: async () => { if (first) { first = false; throw fail("TIMEOUT"); } return response(capture("queued")); } });
 await assert.rejects(h.flow.upload(h.recording)); assert.equal(h.flow.getSnapshot().uncertain, "upload"); await h.flow.replayUpload();
 assert.equal(h.calls[0].args[0], h.calls[1].args[0]); assert.equal(h.calls[0].args[1].idempotencyKey, h.calls[1].args[1].idempotencyKey); h.flow.cancel();
});
test("unknown or exhausted allowance blocks a new upload but permits resolving its existing uncertain intent", async () => {
 const blocked = harness({ allowance: false }); await assert.rejects(blocked.flow.upload(blocked.recording)); assert.equal(blocked.calls.length, 0);
 let first = true; const h = harness({ create: async () => { if (first) { first = false; throw fail("NETWORK_ERROR"); } return response(capture("queued")); } });
 await assert.rejects(h.flow.upload(h.recording)); h.quota.canUse = () => false; await h.flow.replayUpload(); assert.equal(h.calls.length, 2); h.flow.cancel();
});
test("a daily upload refusal is surfaced to the quota store and does not fabricate a draft", async () => {
 const h = harness({ create: async () => { throw fail("RATE_LIMITED", { status: 429, payload: { code: "ai_daily_limit_reached", channel: "voice" } }); } });
 await assert.rejects(h.flow.upload(h.recording)); assert.equal(h.flow.getSnapshot().capture, null); assert.equal(h.flow.getSnapshot().uncertain, null); assert.equal(h.quotaCalls[0][0], "error");
});
test("wrong workspace and malformed upload responses are not accepted as success", async () => {
 const h = harness({ create: async () => response(capture("queued", { workspace_id: 8 })) }); await assert.rejects(h.flow.upload(h.recording)); assert.equal(h.flow.getSnapshot().capture, null); assert.equal(h.flow.getSnapshot().uncertain, "upload");
});
test("opening a reviewed draft preserves missing amount currency and date", async () => {
 const h = harness({ get: async () => response(capture("ready_for_review", { review_values: { account_id: null, category_id: null, amount: null, currency_code: null, transaction_date: null } })) }); await h.flow.open(1);
 assert.equal(h.flow.getSnapshot().draft.amount, ""); assert.equal(h.flow.getSnapshot().draft.currency_code, ""); assert.equal(h.flow.getSnapshot().draft.transaction_date, ""); h.flow.cancel();
});
test("an explicitly selected account can prefill locally but still requires a draft save", async () => {
 const h = harness({ preferredAccountId: 2, get: async () => response(capture("ready_for_review", { review_values: { ...capture().review_values, account_id: null } })) }); await h.flow.open(1);
 assert.equal(h.flow.getSnapshot().draft.account_id, "2"); assert.equal(isVoiceDraftDirty(h.flow.getSnapshot().draft, h.flow.getSnapshot().capture), true); await assert.rejects(h.flow.confirm()); assert.equal(h.calls.length, 1);
});
test("saving sends exact money and the current version without invoking confirmation", async () => {
 const h = harness(); await h.flow.open(1); h.flow.setDraft("amount", "٢٥٫٥"); await h.flow.save();
 const saved = h.calls[1]; assert.equal(saved.method, "update"); assert.equal(saved.args[1].amount, "25.5000"); assert.equal(saved.args[1].review_version, 1);
 assert.equal(h.flow.getSnapshot().capture.review_version, 2); assert.equal(h.notifications.length, 0); assert.equal(isVoiceDraftDirty(h.flow.getSnapshot().draft, h.flow.getSnapshot().capture), false);
});
test("transcript status and ownership fields cannot enter the review draft", async () => {
 const h = harness(); await h.flow.open(1); const before = h.flow.getSnapshot().draft; for (const field of ["transcript", "status", "user_id", "workspace_id", "tax_amount"]) h.flow.setDraft(field, "injected"); assert.equal(h.flow.getSnapshot().draft, before);
});
test("unsaved edits block monetary confirmation", async () => {
 const h = harness(); await h.flow.open(1); h.flow.setDraft("description", "edited"); await assert.rejects(h.flow.confirm()); assert.equal(h.calls.some((c) => c.method === "confirm"), false);
});
test("confirmation posts only the saved version and fires one financial refresh", async () => {
 const h = harness(); await h.flow.open(1); await h.flow.confirm(); const sent = h.calls[1];
 assert.equal(sent.method, "confirm"); assert.deepEqual(sent.args[1], { review_version: 1 }); assert.equal(h.flow.getSnapshot().capture.confirmed_transaction_id, 100); assert.equal(h.notifications.length, 1);
 await h.flow.open(1); assert.equal(h.notifications.length, 1);
});
test("double confirmation clicks hold the same write lock and one request", async () => {
 const wait = deferred(), h = harness({ confirm: () => wait.promise }); await h.flow.open(1); const a = h.flow.confirm(), b = h.flow.confirm(); assert.equal(a, b); wait.resolve(response(capture("confirmed"))); await a;
 assert.equal(h.calls.filter((c) => c.method === "confirm").length, 1);
});
test("uncertain confirmation locks edits discard and switching drafts while preserving key and version", async () => {
 let first = true; const h = harness({ confirm: async () => { if (first) { first = false; throw fail("TIMEOUT"); } return response(capture("confirmed")); } }); await h.flow.open(1); await assert.rejects(h.flow.confirm());
 const draft = h.flow.getSnapshot().draft; h.flow.setDraft("amount", "40"); assert.equal(h.flow.getSnapshot().draft, draft);
 await assert.rejects(h.flow.discard()); await assert.rejects(h.flow.open(2)); assert.equal(h.flow.newRecording(), false);
 await h.flow.confirm(); const sent = h.calls.filter((c) => c.method === "confirm"); assert.equal(sent[0].args[2].idempotencyKey, sent[1].args[2].idempotencyKey); assert.deepEqual(sent[0].args[1], sent[1].args[1]);
});
test("a confirmed status GET resolves an uncertain confirmation without another POST", async () => {
 let confirmed = false; const h = harness({ get: async () => response(capture(confirmed ? "confirmed" : "ready_for_review")), confirm: async () => { confirmed = true; throw fail("NETWORK_ERROR"); } });
 await h.flow.open(1); await assert.rejects(h.flow.confirm()); await h.flow.check(); assert.equal(h.flow.getSnapshot().uncertain, null); assert.equal(h.flow.getSnapshot().capture.status, "confirmed"); assert.equal(h.notifications.length, 1); assert.equal(h.calls.filter((c) => c.method === "confirm").length, 1);
});
test("an unchanged ready status does not settle an uncertain in-flight confirmation", async () => {
 const h = harness({ confirm: async () => { throw fail("SERVER_ERROR"); } }); await h.flow.open(1); await assert.rejects(h.flow.confirm()); await h.flow.check(); assert.equal(h.flow.getSnapshot().uncertain, "confirm");
});
test("an incomplete or unconfirmed confirmation response remains uncertain", async () => {
 const h = harness({ confirm: async () => response(capture()) }); await h.flow.open(1); await assert.rejects(h.flow.confirm()); assert.equal(h.notifications.length, 0); assert.equal(h.flow.getSnapshot().uncertain, "confirm");
});
test("insufficient balance is a definitive refusal and keeps the review draft available", async () => {
 const h = harness({ confirm: async () => { throw fail("VALIDATION_ERROR", { status: 422, errors: { amount: ["Insufficient balance"] } }); } }); await h.flow.open(1); await assert.rejects(h.flow.confirm());
 assert.equal(h.flow.getSnapshot().uncertain, null); assert.equal(h.flow.getSnapshot().capture.status, "ready_for_review"); h.flow.setDraft("amount", "10"); assert.equal(h.flow.getSnapshot().draft.amount, "10");
});
test("stale review versions require GET before another edit or save", async () => {
 const h = harness({ update: async () => { throw fail("VALIDATION_ERROR", { status: 422, errors: { review_version: ["Changed"] } }); } }); await h.flow.open(1); h.flow.setDraft("amount", "30"); await assert.rejects(h.flow.save());
 assert.equal(h.flow.getSnapshot().needsReload, true); const draft = h.flow.getSnapshot().draft; h.flow.setDraft("amount", "50"); assert.equal(h.flow.getSnapshot().draft, draft); await assert.rejects(h.flow.save()); await h.flow.check(); assert.equal(h.flow.getSnapshot().needsReload, false);
});
test("an uncertain PATCH is checked before saving again and is never followed by hidden confirmation", async () => {
 const h = harness({ update: async () => { throw fail("TIMEOUT"); } }); await h.flow.open(1); h.flow.setDraft("amount", "30"); await assert.rejects(h.flow.save()); assert.equal(h.flow.getSnapshot().needsReload, true); assert.equal(h.calls.some((c) => c.method === "confirm"), false);
});
test("review and confirmation remain available after the daily allowance is exhausted", async () => {
 const h = harness({ allowance: false }); await h.flow.open(1); h.flow.setDraft("description", "review"); await h.flow.save(); await h.flow.confirm(); assert.equal(h.notifications.length, 1);
});
test("retry is explicit consumes no second admission on replay and preserves its original key", async () => {
 let first = true; const h = harness({ get: async () => response(capture("failed")), retry: async () => { if (first) { first = false; throw fail("TIMEOUT"); } return response(capture("failed")); } }); await h.flow.open(1); await assert.rejects(h.flow.retry()); h.quota.canUse = () => false; await h.flow.retry();
 const sent = h.calls.filter((c) => c.method === "retry"); assert.equal(sent[0].args[1].idempotencyKey, sent[1].args[1].idempotencyKey); assert.equal(h.flow.getSnapshot().uncertain, null);
});
test("a genuinely new manual retry uses a new admission key", async () => {
 const h = harness({ get: async () => response(capture("failed")), retry: async () => response(capture("failed")) }); await h.flow.open(1); await h.flow.retry(); await h.flow.retry(); const sent = h.calls.filter((c) => c.method === "retry"); assert.notEqual(sent[0].args[1].idempotencyKey, sent[1].args[1].idempotencyKey);
});
test("an expired source or exhausted allowance blocks new analysis retries", async () => {
 for (const settings of [{ allowance: false, get: async () => response(capture("failed")) }, { get: async () => response(capture("failed", { capabilities: { can_retry: false } })) }]) {
  const h = harness(settings); await h.flow.open(1); await assert.rejects(h.flow.retry()); assert.equal(h.calls.some((c) => c.method === "retry"), false);
 }
});
test("discard sends DELETE through the adapter and never refreshes financial data", async () => {
 const h = harness(); await h.flow.open(1); await h.flow.discard(); assert.equal(h.flow.getSnapshot().capture.status, "discarded"); assert.equal(h.notifications.length, 0); assert.equal(h.calls[1].method, "discard");
});
test("confirmed and processing drafts cannot be discarded", async () => {
 for (const status of ["confirmed", "processing"]) { const h = harness({ get: async () => response(capture(status)) }); await h.flow.open(1); await assert.rejects(h.flow.discard()); assert.equal(h.calls.filter((c) => c.method === "discard").length, 0); h.flow.cancel(); }
});
test("polling performs only nonoverlapping GETs and stops when review is ready", async () => {
 const h = harness(); await h.flow.upload(h.recording); await h.clock.advance(2000); assert.equal(h.flow.getSnapshot().capture.status, "ready_for_review"); assert.deepEqual(h.calls.map((c) => c.method), ["create", "get"]); assert.equal(h.clock.timers.size, 0);
});
test("paused polling resumes with one status check without re-admitting the recording", async () => {
 const h = harness(); await h.flow.upload(h.recording); h.flow.pause(); await h.clock.advance(20000); assert.equal(h.calls.length, 1); h.flow.resume(); await h.clock.advance(100); assert.equal(h.calls.length, 2); assert.equal(h.calls[1].method, "get");
});
test("long processing is not fabricated as failure when bounded polling stops", async () => {
 const h = harness({ get: async () => response(capture("processing")) }); await h.flow.upload(h.recording); await h.clock.advance(1000000);
 assert.equal(h.calls.filter((c) => c.method === "get").length, 40); assert.equal(h.flow.getSnapshot().pollStopped, true); assert.equal(h.flow.getSnapshot().capture.status, "processing"); assert.equal(h.clock.timers.size, 0); h.flow.cancel();
});
test("polling obeys Retry-After without retrying a paid request", async () => {
 let first = true; const h = harness({ get: async () => { if (first) { first = false; throw fail("RATE_LIMITED", { status: 429, retryAfter: "30" }); } return response(capture()); } }); await h.flow.upload(h.recording); await h.clock.advance(2000); await h.clock.advance(29000); assert.equal(h.calls.length, 2); await h.clock.advance(1000); assert.equal(h.calls.length, 3); assert.equal(h.calls.filter((c) => c.method === "create").length, 1);
});
test("screen cleanup fences a late successful upload and stops all timers", async () => {
 const wait = deferred(), h = harness({ create: () => wait.promise }); const pending = h.flow.upload(h.recording); await flush(); h.flow.cancel(); wait.resolve(response(capture("queued"))); await pending;
 assert.equal(h.flow.getSnapshot().capture, null); assert.equal(h.clock.timers.size, 0); assert.equal(h.notifications.length, 0);
});
test("history restores authorized server drafts with pagination and validates their workspace", async () => {
 const h = harness(); await h.flow.loadHistory(2); assert.equal(h.calls[0].args[0].workspace_id, 7); assert.equal(h.calls[0].args[0].page, 2); assert.equal(h.flow.getSnapshot().history.items.length, 1);
 await h.flow.open(1); assert.equal(h.flow.getSnapshot().capture.transcript, "دفعت ٢٥ شيكل أمس");
});
test("accounts and categories are filtered to the draft workspace and expense eligibility", () => {
 const result = voiceReviewOptions([{ id: 1, workspace_id: 7, status: "active", savings_goal: null }, { id: 2, workspace_id: 7, status: "archived" }, { id: 3, workspace_id: 8, status: "active" }, { id: 4, workspace_id: 7, status: "active", savings_goal: { id: 5 } }], [{ id: 1, type: "expense", workspace_id: null, is_active: true }, { id: 2, type: "income", workspace_id: 7 }, { id: 3, type: "expense", workspace_id: 8 }, { id: 4, type: "expense", workspace_id: 7, is_active: false }], 7);
 assert.deepEqual(result.accounts.map((a) => a.id), [1]); assert.deepEqual(result.categories.map((c) => c.id), [1]);
});
test("exact equivalent Arabic amount formatting does not count as an unsaved monetary edit", () => {
 const c = capture(), draft = toVoiceReviewDraft(c); draft.amount = "٢٥٫٠"; assert.equal(isVoiceDraftDirty(draft, c), false); draft.amount = "25.00001"; assert.equal(isVoiceDraftDirty(draft, c), true);
});

// Exercise the actual existing receipt adapter rather than inventing a new receipt endpoint.
test("receipt upload carries the selected workspace and keeps its stable header without setting multipart content type", async () => {
 const previous = globalThis.fetch; let request; globalThis.fetch = async (url, options) => { request = { url, options }; return new Response(JSON.stringify({ status: true, data: {} }), { headers: { "Content-Type": "application/json" } }); };
 try {
  await aiExpenseCapturesApi.create(new Blob(["receipt"]), { workspaceId: 7, idempotencyKey: "receipt-upload-stable" });
  assert.equal(request.url, "/api/ai/expense-captures"); assert.equal(request.options.body.get("workspace_id"), "7"); assert.equal(new Headers(request.options.headers).get("Idempotency-Key"), "receipt-upload-stable"); assert.equal(new Headers(request.options.headers).has("Content-Type"), false);
 } finally { globalThis.fetch = previous; }
});

test("a generic polling 429 waits a minute when Retry-After is absent", async () => {
 const h = harness({ get: async () => { throw fail("RATE_LIMITED", { status: 429 }); } }); await h.flow.upload(h.recording); await h.clock.advance(2000); await h.clock.advance(59000); assert.equal(h.calls.length, 2); await h.clock.advance(1000); assert.equal(h.calls.length, 3); h.flow.cancel();
});
test("a late confirmation after screen cleanup cannot refresh a different screen", async () => {
 const wait = deferred(), h = harness({ confirm: () => wait.promise }); await h.flow.open(1); const pending = h.flow.confirm(); await flush(); h.flow.cancel(); wait.resolve(response(capture("confirmed"))); await pending; assert.equal(h.notifications.length, 0); assert.equal(h.flow.getSnapshot().capture.status, "ready_for_review");
});
test("an in-progress key conflict retains the confirmation intent until status is checked", async () => {
 let first = true; const h = harness({ confirm: async () => { if (first) { first = false; throw fail("CONFLICT", { status: 409 }); } return response(capture("confirmed")); } }); await h.flow.open(1); await assert.rejects(h.flow.confirm()); assert.equal(h.flow.getSnapshot().uncertain, "confirm"); await h.flow.confirm(); const sent = h.calls.filter((c) => c.method === "confirm"); assert.equal(sent[0].args[2].idempotencyKey, sent[1].args[2].idempotencyKey);
});

test("the first backend version-zero admission becomes a queued draft instead of an uncertain upload", async () => {
 const h = harness(); await h.flow.upload(h.recording);
 const state = h.flow.getSnapshot();
 assert.equal(state.capture.review_version, 0); assert.equal(state.capture.status, "queued");
 assert.equal(state.uncertain, null); assert.equal(state.error, null);
 assert.equal(isVoiceDraftDirty(state.draft, state.capture), false);
 assert.deepEqual(getVoiceCaptureProgress(state.capture, state.busy), { stage: 1, phase: "queued" });
 await assert.rejects(h.flow.save()); await assert.rejects(h.flow.confirm());
 assert.deepEqual(h.calls.map((c) => c.method), ["create"]); h.flow.cancel();
});

test("a 28-second version-zero worker is followed automatically until review version one without resending", async () => {
 const h = harness({ get: async () => response(h.clock.time < 28000
  ? capture("processing", { transcript: h.clock.time >= 15000 ? "دفعت خمسة وعشرين شيكل اليوم" : null }) : capture()) });
 await h.flow.upload(h.recording);
 await h.clock.advance(10000);
 assert.equal(h.flow.getSnapshot().capture.review_version, 0);
 assert.deepEqual(getVoiceCaptureProgress(h.flow.getSnapshot().capture), { stage: 2, phase: "transcribing" });
 await h.clock.advance(15000);
 assert.equal(h.flow.getSnapshot().capture.status, "processing");
 assert.deepEqual(getVoiceCaptureProgress(h.flow.getSnapshot().capture), { stage: 3, phase: "extracting" });
 assert.equal(h.flow.getSnapshot().error, null); assert.equal(h.flow.getSnapshot().uncertain, null);
 await h.clock.advance(10000);
 const state = h.flow.getSnapshot();
 assert.equal(state.capture.status, "ready_for_review"); assert.equal(state.capture.review_version, 1);
 assert.equal(getVoiceCaptureProgress(state.capture), null); assert.equal(h.clock.timers.size, 0);
 assert.equal(h.calls.filter((c) => c.method === "create").length, 1);
 assert.equal(h.calls.some((c) => ["retry", "update", "confirm"].includes(c.method)), false);
 assert.equal(h.quotaCalls.filter(([action]) => action === "refresh").length, 1);
 assert.equal(h.notifications.length, 0); h.flow.cancel();
});

test("a version-zero provider failure stops the loader and remains an explicit retry rather than a new upload", async () => {
 const h = harness({ get: async () => response(capture("failed", { failure: { code: "no_speech", message: "No speech detected." } })) });
 await h.flow.upload(h.recording); await h.clock.advance(2000);
 assert.equal(h.flow.getSnapshot().capture.status, "failed");
 assert.equal(h.flow.getSnapshot().capture.review_version, 0);
 assert.equal(getVoiceCaptureProgress(h.flow.getSnapshot().capture), null);
 assert.equal(h.flow.getSnapshot().uncertain, null); assert.equal(h.clock.timers.size, 0);
 await h.flow.retry(); assert.equal(h.flow.getSnapshot().capture.status, "queued");
 assert.deepEqual(h.calls.map((c) => c.method), ["create", "get", "retry"]); h.flow.cancel();
});

test("history accepts queued and processing version-zero records alongside a reviewed draft", async () => {
 const items = [capture("queued"), capture("processing", { id: 2 }), capture("ready_for_review", { id: 3 })];
 const h = harness({ list: async () => ({ status: true, data: { captures: { data: items, current_page: 1, last_page: 1, per_page: 10, total: 3, from: 1, to: 3 }, voice_quota: quotaValue(1) } }) });
 await h.flow.loadHistory(); assert.equal(h.flow.getSnapshot().history.items.length, 3);
 assert.equal(h.flow.getSnapshot().historyError, null);
 assert.equal(h.calls.some((c) => c.method !== "list"), false); h.flow.cancel();
});

test("an upload in flight immediately shows the upload phase before the backend returns its capture id", async () => {
 const wait = deferred(), h = harness({ create: () => wait.promise });
 const pending = h.flow.upload(h.recording); await flush();
 assert.deepEqual(getVoiceCaptureProgress(h.flow.getSnapshot().capture, h.flow.getSnapshot().busy), { stage: 0, phase: "uploading" });
 wait.resolve(response(capture("queued"))); await pending;
 assert.deepEqual(getVoiceCaptureProgress(h.flow.getSnapshot().capture, h.flow.getSnapshot().busy), { stage: 1, phase: "queued" });
 h.flow.cancel();
});
