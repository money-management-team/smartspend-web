import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { FORM_WRITES, envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { paginator } from "./helpers/planningFixture.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const { sendWorkflowWrite } = await import("../src/mobile/data/writeApi.js");
const { classifyWriteOutcome } = await import("../src/mobile/forms/useWorkflowSubmit.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
const { buildConversationCreated, buildDataDeleted, buildFeedbackSaved, buildInsightDismissed, buildMessagePair, buildSettingsSaved } = await import("../src/mobile/models/aiWrites.js");

/*
 * Phase 2F: the AI assistant from Mobile. Identical on develop @ fd87531 and 6b696d72 (AiConversationController, AiMessageController,
 * AiFeedbackController, AiInsightController, AiSettingsController, AiDataController and their services):
 *
 *   POST /ai/conversations                  no key, no dedup: a copy is another (empty) conversation
 *   POST /ai/conversations/{id}/messages    client_request_id (<=100, [A-Za-z0-9._:-]): the question and its reply are stored BEFORE the
 *                                           provider call, and a copy returns the stored pair (200, replayed) without asking the provider
 *                                           again. The replay does not compare the text, and a provider failure is stored (failed) and
 *                                           replayed too. throttle:ai-generate answers 429 before anything runs.
 *   DELETE /ai/conversations/{id}           removes it and its messages; a copy is a 404
 *   POST /ai/messages|insights/{id}/feedback an upsert per (person, answer): a copy sets the same values
 *   POST /ai/insights/refresh               202, queues a unique job: nothing is refreshed yet; 422 when insights are off
 *   POST /ai/insights/{id}/dismiss          sets "dismissed"
 *   PUT /ai/settings                        partial; ai_enabled=true is the consent decision, so Mobile only ever sends it as false
 *   DELETE /ai/data                         confirmation "DELETE_AI_DATA"; deletes the AI data and switches the assistant off
 *
 * Every one is CLOSED in the product (APPROVED is empty); these tests open them only through the test runner's switch.
 */

after(() => dom.window.close());

const OPS = ["ai.conversationCreate", "ai.message", "ai.conversationDelete", "ai.messageFeedback", "ai.insightFeedback", "ai.insightsRefresh", "ai.insightDismiss", "ai.settings", "ai.dataDelete"];
const WRITE_RULES = Object.keys(FORM_WRITES).filter((name) => name.startsWith("ai") && !name.startsWith("aiExpense") && !["receiptUpload", "voiceUpload"].includes(name)).map((name) => FORM_WRITES[name]);
let api;
let view;
let server;

const action = (name) => q(`[data-sm-action='${name}']`);
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (node = q("main")) => node.textContent.replace(/\s+/g, " ");
const pendingKeys = () => Object.keys(window.localStorage).filter((key) => /pending/i.test(key));
const failBody = (status, message, error) => ({ status, body: { status: false, message, ...(error ? { error } : {}) } });

/* A backend that answers the way the assistant's controllers do, with a counter for the provider calls it would have paid for. */
// Holds the FIRST write until released (a later direct call of the sender in the same test goes straight through).
function holdFirst() {
  const gateway = { release: null };
  let held = false;
  gateway.onWrite = (call, apply) => {
    if (held) return apply();
    held = true;
    return new Promise((resolve) => { gateway.release = () => resolve(apply()); });
  };
  return gateway;
}

function aiServer({ consent = true, onWrite, afterApply, dailyLimit = Infinity } = {}) {
  const settings = { ai_enabled: consent, insights_enabled: true, forecast_enabled: true, preferred_language: "en", retention_days: 90, consent: { version: "v1", active: consent } };
  const conversations = [{ id: 5, title: "October spending", status: "active", locale: "en", last_message_at: "2026-10-20T10:00:00Z" }];
  const messages = { 5: [{ id: 51, conversation_id: 5, role: "user", status: "completed", content: "Where did my money go?", sources: [], timestamps: { created_at: "2026-10-20T10:00:00Z" } }, { id: 52, conversation_id: 5, reply_to_message_id: 51, role: "assistant", status: "completed", content: "Mostly on food.", sources: [], timestamps: { created_at: "2026-10-20T10:00:05Z" } }] };
  const insights = [{ id: 7, type: "budget", status: "active", title: "Food budget nearly used", summary: "90% used with 5 days left.", currency_code: "ILS", sources: [] }, { id: 8, type: "spending", status: "active", title: "Unusual coffee spending", summary: "Higher than usual.", sources: [] }];
  const ids = new Map();
  const feedback = new Map();
  const log = { provider: 0, messages: 0, conversations: 0, deleted: 0, feedback: 0, refresh: 0, dismissed: 0, settings: 0, data: 0 };
  const queue = { failNext: null };
  let nextId = 100;
  let sentToday = 0;

  const forbidden = () => (settings.consent.active ? null : failBody(403, "AI consent is required before using SmartSpend AI features."));
  const conv = (id) => conversations.find((row) => row.id === Number(id));

  const sendMessage = (call) => {
    const id = Number(call.path.split("/")[3]);
    const body = call.body ?? {};
    const refused = forbidden();
    if (refused) return refused;
    if (!conv(id)) return failBody(404, "Not found");
    if (typeof body.content !== "string" || body.content.length < 1 || body.content.length > 4000) return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { content: ["The content field is invalid."] } } };
    if (typeof body.client_request_id !== "string" || !/^[A-Za-z0-9._:-]{1,100}$/.test(body.client_request_id)) return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { client_request_id: ["invalid"] } } };

    const known = ids.get(`${id}:${body.client_request_id}`);
    if (known) return { status: 200, body: envelope({ user_message: known.user, assistant_message: known.assistant, replayed: true }) };

    // throttle:ai-generate runs before the controller: nothing is stored.
    sentToday += 1;
    if (sentToday > dailyLimit) return { status: 429, headers: { "Retry-After": "3600" }, body: { status: false, message: "Too Many Attempts." } };

    const user = { id: ++nextId, conversation_id: id, role: "user", status: "completed", content: body.content, sources: [], timestamps: { created_at: "2026-11-16T09:00:00Z" } };
    const assistant = { id: ++nextId, conversation_id: id, reply_to_message_id: user.id, role: "assistant", status: "completed", content: "Mostly on food and transport.", sources: [], timestamps: { created_at: "2026-11-16T09:00:05Z" } };
    log.messages += 1;
    const failure = queue.failNext;
    queue.failNext = null;
    messages[id].push(user, assistant);
    ids.set(`${id}:${body.client_request_id}`, { user, assistant });
    if (failure) {
      // AiChatService::failAssistant: the attempt is stored as failed, then the provider's error is answered.
      assistant.status = "failed";
      assistant.content = "The assistant could not answer.";
      assistant.failure = { code: failure.code, message: "The assistant is temporarily unavailable. Please try again." };
      return failBody(failure.status, failure.message, { code: failure.code, retryable: true });
    }
    log.provider += 1;
    return { status: 201, body: envelope({ user_message: user, assistant_message: assistant, replayed: false }) };
  };

  const handler = (call) => {
    const p = call.path;
    if (call.method === "GET") {
      if (p === "/ai/settings") return { body: envelope({ settings }) };
      if (p === "/ai/conversations") return { body: envelope({ conversations: paginator(conversations.map((row) => ({ ...row, message_count: messages[row.id]?.length ?? 0 }))) }) };
      const one = /^\/ai\/conversations\/(\d+)$/.exec(p);
      if (one) return conv(one[1]) ? { body: envelope({ conversation: { ...conv(one[1]), message_count: messages[one[1]].length }, messages: paginator(messages[one[1]], { perPage: 50 }) }) } : failBody(404, "Not found");
      if (p === "/ai/insights") return { body: envelope({ insights: paginator(insights.filter((row) => row.status === "active")) }) };
      if (p === "/ai/input-quotas") return { body: envelope({ quotas: { voice: { limit: 10, used: 0, remaining: 10, reset_at: "2026-11-17T00:00:00Z" }, receipt: { limit: 10, used: 0, remaining: 10, reset_at: "2026-11-17T00:00:00Z" } } }) };
      return failBody(404, "Not found");
    }

    const apply = () => {
      if (call.method === "POST" && p === "/ai/conversations") {
        const refused = forbidden();
        if (refused) return refused;
        const row = { id: ++nextId, title: null, status: "active", locale: call.body?.locale ?? "ar", last_message_at: null };
        conversations.push(row);
        messages[row.id] = [];
        log.conversations += 1;
        return { status: 201, body: envelope({ conversation: row }) };
      }
      if (/\/messages$/.test(p)) return sendMessage(call);
      if (call.method === "DELETE" && /^\/ai\/conversations\/\d+$/.test(p)) {
        const row = conv(p.split("/")[3]);
        if (!row) return failBody(404, "Not found");
        conversations.splice(conversations.indexOf(row), 1);
        log.deleted += 1;
        return { body: { status: true, message: "AI conversation deleted successfully.", data: null } };
      }
      const fb = /^\/ai\/(messages|insights)\/(\d+)\/feedback$/.exec(p);
      if (fb) {
        const body = call.body ?? {};
        if (!["helpful", "not_helpful", "inaccurate"].includes(body.rating)) return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { rating: ["The selected rating is invalid."] } } };
        const key = `${fb[1]}:${fb[2]}`;
        const row = { rating: body.rating, reason_code: body.reason_code ?? null, comment: body.comment ?? null };
        feedback.set(key, row);
        log.feedback += 1;
        return { body: envelope({ feedback: row }) };
      }
      if (p === "/ai/insights/refresh") {
        if (!settings.insights_enabled) return failBody(422, "AI insights are disabled.");
        log.refresh += 1;
        return { status: 202, body: { status: true, message: "AI insight refresh queued successfully.", data: null } };
      }
      const dismiss = /^\/ai\/insights\/(\d+)\/dismiss$/.exec(p);
      if (dismiss) {
        const row = insights.find((item) => item.id === Number(dismiss[1]));
        if (!row) return failBody(404, "Not found");
        row.status = "dismissed";
        log.dismissed += 1;
        return { body: envelope({ insight: row }) };
      }
      if (call.method === "PUT" && p === "/ai/settings") {
        const body = call.body ?? {};
        if (Object.hasOwn(body, "retention_days") && (!Number.isInteger(body.retention_days) || body.retention_days < 7 || body.retention_days > 365)) return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { retention_days: ["The retention days field must be between 7 and 365."] } } };
        for (const key of ["ai_enabled", "insights_enabled", "forecast_enabled", "preferred_language", "retention_days"]) if (Object.hasOwn(body, key)) settings[key] = body[key];
        settings.consent.active = settings.ai_enabled;
        log.settings += 1;
        return { body: envelope({ settings }) };
      }
      if (call.method === "DELETE" && p === "/ai/data") {
        if (call.body?.confirmation !== "DELETE_AI_DATA") return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { confirmation: ["invalid"] } } };
        const deleted = { conversations_deleted: conversations.length, insights_deleted: insights.length, feedback_deleted: feedback.size, usage_logs_deleted: 4 };
        conversations.length = 0;
        insights.length = 0;
        settings.ai_enabled = false;
        settings.consent.active = false;
        log.data += 1;
        return { body: envelope({ deleted }) };
      }
      return failBody(404, "Not found");
    };

    if (onWrite) return onWrite(call, apply);
    const answer = apply();
    return afterApply ? afterApply(answer, call) : answer;
  };
  return { handler, settings, conversations, messages, insights, ids, feedback, log, queue };
}

async function open(entry, serverOptions = {}, { approve = OPS, language } = {}) {
  if (language) {
    await resetEnvironment(language);
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
  }
  server = serverOptions.server ?? aiServer(serverOptions);
  api?.restore();
  api = installFakeApi(server.handler, { allowWrites: WRITE_RULES });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry });
}

const reload = async (entry) => {
  await view.unmount();
  const shared = server;
  view = await mountMobile({ entry });
  server = shared;
};

const ask = async (question = "Where did my money go in November?") => {
  await change(q("[data-sm-composer='conversation'] textarea"), question);
};
const sendAsk = async () => {
  await click(q("[data-sm-composer='conversation'] [data-sm-action='send-message']"));
  await settle();
};

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
  it("every assistant write is registered, none moves money, all are closed, and the message is keyed", () => {
    const expected = {
      "ai.conversationCreate": ["POST /ai/conversations", "none", "duplicates"],
      "ai.message": ["POST /ai/conversations/{id}/messages", "client", "same-result"],
      "ai.conversationDelete": ["DELETE /ai/conversations/{id}", "none", "once-only"],
      "ai.messageFeedback": ["POST /ai/messages/{id}/feedback", "none", "same-result"],
      "ai.insightFeedback": ["POST /ai/insights/{id}/feedback", "none", "same-result"],
      "ai.insightsRefresh": ["POST /ai/insights/refresh", "none", "same-result"],
      "ai.insightDismiss": ["POST /ai/insights/{id}/dismiss", "none", "same-result"],
      "ai.settings": ["PUT /ai/settings", "none", "same-result"],
      "ai.dataDelete": ["DELETE /ai/data", "none", "same-result"],
    };
    assert.deepEqual(Object.keys(expected).sort(), [...OPS].sort());
    for (const [operation, [endpoint, key, dedup]] of Object.entries(expected)) {
      assert.deepEqual({ ...gate.MOBILE_WRITES[operation] }, { endpoint, moves: false, key, serverDedup: dedup }, operation);
      assert.equal(gate.isWriteOpen(operation), false, operation);
    }
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("the senders refuse without a request while closed, and the message refuses without a key when open", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: WRITE_RULES });
    for (const operation of OPS) assert.throws(() => sendWorkflowWrite({ operation, ids: { conversationId: "5", messageId: "52", insightId: "7" }, input: { content: "x", locale: "en", rating: "helpful" } }, "mobile-ai-12345678"), (error) => error.name === "WriteClosedError", operation);
    assert.deepEqual(api.calls, []);
    gate.setWriteApprovalsForTests(["ai.message"]);
    assert.throws(() => sendWorkflowWrite({ operation: "ai.message", ids: { conversationId: "5" }, input: { content: "x" } }), /needs an Idempotency-Key/);
  });

  it("the new files contain no test switch: only the test runner can open a write", () => {
    const files = ["src/mobile/assist/ConversationComposer.jsx", "src/mobile/assist/InsightActions.jsx", "src/mobile/assist/AiFeedback.jsx", "src/mobile/forms/AiResult.jsx", "src/mobile/models/aiWrites.js"];
    for (const file of files) assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), /setWriteApprovalsForTests|SMARTSPEND_TEST_ONLY/, file);
    assert.ok(readdirSync(new URL("../src/mobile/assist", import.meta.url)).includes("ConversationComposer.jsx"));
  });
});

describe("gate closed (the product): nothing is sent", () => {
  it("the assistant's pages offer no way to send: Send is disabled, there is no box in a conversation, no refresh or dismiss", async () => {
    await open("/m/assistant", {}, { approve: null });
    assert.equal(action("send-message").disabled, true);
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='ai.message']"));
    assert.equal(action("refresh-insights"), null);
    assert.equal(action("dismiss-insight"), null);
    assert.equal(action("new-conversation").getAttribute("href"), "/m/add/ai-new");
    await click(action("send-message"));
    await view.unmount();
    api.restore();
    await open("/m/assistant/conversations/5", {}, { approve: null });
    assert.equal(qa("textarea").length, 0);
    assert.equal(q("[data-sm-composer='conversation']"), null);
    await click(q("[data-sm-role='assistant'] [data-sm-action='rate']"));
    assert.equal(action("send", q("[data-sm-form='ai-feedback']")).disabled, true);
    assert.deepEqual(writes(), []);
  });

  it("the new-conversation, settings, delete and data-deletion forms can be reviewed, but Confirm is disabled", async () => {
    for (const [entry, workflow, fill] of [
      ["/m/add/ai-new", "ai-new", async () => submit(q("form.sm-draft-form"))],
      ["/m/assistant/settings", "ai-settings", async () => { await change(q("[data-sm-field='retention_days'] input"), "30"); await submit(q("form.sm-draft-form")); }],
      ["/m/assistant/conversations/5/delete", "ai-conversation-delete", async () => { if (!q("[data-sm-step='review']")) await click(action("review")); }],
      ["/m/assistant/delete-data", "ai-data-delete", async () => { await click(q("[data-sm-field='understand'] input")); await submit(q("form.sm-draft-form")); }],
    ]) {
      await open(entry, {}, { approve: null });
      await fill();
      assert.ok(q("[data-sm-step='review']"), workflow);
      assert.equal(action("send").disabled, true, workflow);
      assert.ok(q("[data-sm-note='write-closed']"), workflow);
      await click(action("send"));
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
  });
});

describe("starting a conversation", () => {
  it("reviews, then sends only the language, and shows the conversation the server created", async () => {
    await open("/m/add/ai-new");
    assert.equal(q("[data-sm-field='locale'] input:checked").value, "en", "the current language is the default");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-effect='aiNewEffect']")), /new, empty conversation/);
    await click(action("send"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].method, "POST");
    assert.equal(writes()[0].path, "/ai/conversations");
    assert.deepEqual(writes()[0].body, { locale: "en" });
    assert.equal(Object.hasOwn(writes()[0].headers, "Idempotency-Key"), false);
    const result = q("[data-sm-ai-result='created']");
    assert.ok(result);
    assert.equal(action("open-conversation").getAttribute("href"), `/m/assistant/conversations/${result.dataset.smConversationId}`);
    assert.equal(server.log.conversations, 1);
  });

  it("a double tap sends one request; a lost answer is unknown and nothing is resent", async () => {
    const hold = holdFirst();
    await open("/m/add/ai-new", { onWrite: hold.onWrite });
    await submit(q("form.sm-draft-form"));
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    await act(async () => hold.release());
    await settle();
    assert.equal(server.log.conversations, 1);
    await view.unmount();
    api.restore();

    await open("/m/add/ai-new", { afterApply: () => new TypeError("Failed to fetch") });
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-ai-result]"), null, "nothing is claimed");
    assert.equal(writes().length, 1);
    assert.equal(action("send"), null);
  });

  it("a question typed on the assistant's page starts a conversation and arrives in its own box, ready to send", async () => {
    await open("/m/assistant");
    await click(q("[data-sm-prompt='budgets']"));
    await click(action("send-message"));
    await settle();
    assert.equal(q("[data-sm-screen='workflow'][data-sm-workflow='ai-new']") !== null, true, `${window.location.pathname} ${text()}`);
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    await click(action("open-conversation"));
    await settle();
    assert.equal(q("[data-sm-composer='conversation'] textarea").value, "Which budgets am I close to?");
    assert.equal(writes().length, 1, "only the conversation was created: the question is not sent until the person sends it");
  });

  it("in Arabic the language starts as Arabic and the result is in Arabic", async () => {
    await open("/m/add/ai-new", {}, { language: "ar" });
    assert.equal(q("[data-sm-field='locale'] input:checked").value, "ar");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.deepEqual(writes()[0].body, { locale: "ar" });
    assert.match(text(q("[data-sm-ai-result]")), /بدأت المحادثة/);
    assert.equal(document.documentElement.dir, "rtl");
  });
});

describe("sending a message", () => {
  it("sends exactly { content, client_request_id } with the key as the id, shows the server's answer, and empties the box", async () => {
    await open("/m/assistant/conversations/5");
    assert.ok(q("[data-sm-composer='conversation']"), "the conversation is loaded and its box is offered");
    await ask("  Where did my money go in November?  ");
    await sendAsk();
    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.method, "POST");
    assert.equal(call.path, "/ai/conversations/5/messages");
    assert.deepEqual(Object.keys(call.body).sort(), ["client_request_id", "content"]);
    assert.equal(call.body.content, "Where did my money go in November?");
    assert.match(call.body.client_request_id, /^mobile-ai-message-[A-Za-z0-9-]{8,}$/);
    assert.ok(call.body.client_request_id.length <= 100);
    assert.equal(Object.hasOwn(call.headers, "Idempotency-Key"), false, "the id travels in the body, as the backend takes it");
    assert.equal(server.log.provider, 1);
    assert.equal(q("[data-sm-composer='conversation'] textarea").value, "", "an answered question empties the box");
    assert.equal(q("[data-sm-last]").dataset.smLast, "ready");
    assert.match(text(q("[data-sm-chat]")), /Mostly on food and transport/, "the conversation is read again and shows the server's answer");
    assert.deepEqual(pendingKeys(), [], "nothing left to protect after an answer");
  });

  it("shows the asking state, takes one request for a double tap, and never claims an answer before it arrives", async () => {
    const hold = holdFirst();
    await open("/m/assistant/conversations/5", { onWrite: hold.onWrite });
    await ask();
    await act(async () => {
      q("[data-sm-composer='conversation'] [data-sm-action='send-message']").click();
      q("[data-sm-composer='conversation'] [data-sm-action='send-message']").click();
    });
    assert.equal(writes().length, 1);
    assert.ok(q("[data-sm-note='asking']"));
    assert.equal(q("[data-sm-composer='conversation'] textarea").disabled, true);
    assert.equal(q("[data-sm-last]"), null);
    await act(async () => hold.release());
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(server.log.provider, 1);
  });

  it("an empty or over-long question is never sent", async () => {
    await open("/m/assistant/conversations/5");
    assert.equal(q("[data-sm-composer='conversation'] [data-sm-action='send-message']").disabled, true);
    await ask("   ");
    assert.equal(q("[data-sm-composer='conversation'] [data-sm-action='send-message']").disabled, true);
    await ask("x".repeat(4001));
    assert.equal(q("[data-sm-composer='conversation'] [data-sm-action='send-message']").disabled, true);
    await ask("x".repeat(4000));
    assert.equal(q("[data-sm-composer='conversation'] [data-sm-action='send-message']").disabled, false);
    assert.deepEqual(writes(), []);
  });

  it("a lost answer after the server received it: unknown, nothing resent; 'Try sending again' sends the same id and the provider is asked once", async () => {
    let first = true;
    await open("/m/assistant/conversations/5", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await ask("Where did my money go in November?");
    await sendAsk();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(writes().length, 1, "never resent by itself");
    assert.equal(server.log.provider, 1, "the server did answer it");
    assert.equal(q("[data-sm-composer='conversation'] textarea").disabled, true);
    assert.equal(q("[data-sm-last]"), null, "nothing is claimed");
    const firstId = writes()[0].body.client_request_id;
    assert.equal(pendingKeys().length, 1);

    await click(action("try-again"));
    assert.equal(q("[data-sm-composer='conversation'] textarea").value, "Where did my money go in November?", "the question is kept");
    await sendAsk();
    assert.equal(writes().length, 2);
    assert.equal(writes()[1].body.client_request_id, firstId, "the same id");
    assert.equal(server.log.provider, 1, "replayed: the provider is not asked again");
    assert.equal(server.log.messages, 1);
    assert.equal(q("[data-sm-last]").dataset.smReplayed, "true");
    assert.match(text(q("[data-sm-last]")), /already received this question/);
  });

  it("a request the server never saw is sent once after 'Try sending again'; after a reload the same text reuses the id", async () => {
    let lose = true;
    await open("/m/assistant/conversations/5", { onWrite: (call, apply) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : apply()) });
    await ask("First question");
    await sendAsk();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(server.log.messages, 0);
    const firstId = writes()[0].body.client_request_id;

    await reload("/m/assistant/conversations/5");
    await ask("First question");
    await sendAsk();
    assert.equal(writes()[1].body.client_request_id, firstId, "the same question after a reload reuses its id");
    assert.equal(server.log.messages, 1);
    assert.equal(q("[data-sm-last]").dataset.smLast, "ready");
  });

  it("after a reload a different question gets its own id", async () => {
    let first = true;
    await open("/m/assistant/conversations/5", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await ask("First question");
    await sendAsk();
    const firstId = writes()[0].body.client_request_id;
    await reload("/m/assistant/conversations/5");
    await ask("Something else entirely");
    await sendAsk();
    assert.notEqual(writes()[1].body.client_request_id, firstId, "a different question is a different intent");
  });

  it("the same id with different text is never produced: the id is bound to the question", async () => {
    server = aiServer();
    api = installFakeApi(server.handler, { allowWrites: WRITE_RULES });
    gate.setWriteApprovalsForTests(["ai.message"]);
    const id = "mobile-ai-message-bound-1234";
    const first = await sendWorkflowWrite({ operation: "ai.message", ids: { conversationId: "5" }, input: { content: "A" } }, id);
    const copy = await sendWorkflowWrite({ operation: "ai.message", ids: { conversationId: "5" }, input: { content: "B" } }, id);
    assert.equal(copy.data.replayed, true);
    assert.equal(copy.data.user_message.content, "A", "the backend does not compare the text: it returns the first pair");
    assert.equal(first.data.replayed, false);
    assert.equal(server.log.provider, 1);
    assert.equal(buildMessagePair(copy.data, "B", "5"), null, "so Mobile does not accept a pair for other text as the answer");
  });

  it("a timeout and a server error are unknown outcomes, never failures", async () => {
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "TIMEOUT" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "NETWORK_ERROR" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 500, code: "SERVER_ERROR" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 503, code: "SERVER_ERROR", payload: { status: false, message: "Service Unavailable" } })).kind, "unknown", "a 503 without the assistant's error body is not a stored failure");
    await open("/m/assistant/conversations/5", { onWrite: () => ({ status: 504, body: { status: false, message: "Gateway Timeout" } }) });
    await ask();
    await sendAsk();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(writes().length, 1);
  });

  it("a provider failure (503) is a stored, failed attempt: certain, the question stays, and the next send is a NEW question", async () => {
    server = aiServer();
    server.queue.failNext = { status: 503, code: "timeout", message: "AI request timed out. Please try again." };
    await open("/m/assistant/conversations/5", { server });
    await ask("Will I run out of money?");
    await sendAsk();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.equal(outcome.dataset.smCode, "AI_FAILED");
    assert.match(text(outcome), /couldn't answer this time/);
    assert.match(text(outcome), /AI request timed out/);
    assert.equal(q("[data-sm-composer='conversation'] textarea").value, "Will I run out of money?");
    assert.deepEqual(pendingKeys(), [], "a certain outcome releases the key");
    const firstId = writes()[0].body.client_request_id;

    await sendAsk();
    assert.equal(writes().length, 2);
    assert.notEqual(writes()[1].body.client_request_id, firstId, "the same id would only replay the stored failure");
    assert.equal(q("[data-sm-last]").dataset.smLast, "ready");
    assert.equal(server.log.provider, 1);
  });

  it("the other failures the backend names: a provider rate limit (429), an unverifiable answer (502)", async () => {
    for (const [failure, expected] of [[{ status: 429, code: "rate_limited", message: "AI request limit reached. Please try again later." }, /limit was reached/], [{ status: 502, code: "grounding_failed", message: "The AI response could not be verified against SmartSpend financial data." }, /couldn't answer this time/]]) {
      server = aiServer();
      server.queue.failNext = failure;
      await open("/m/assistant/conversations/5", { server });
      await ask();
      await sendAsk();
      assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected", failure.code);
      assert.match(text(q("[data-sm-outcome]")), expected);
      await view.unmount();
      api.restore();
      window.localStorage.clear();
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    }
  });

  it("quota and rate limits (429 before anything ran): said plainly with the wait, nothing recorded, the question kept", async () => {
    await open("/m/assistant/conversations/5", { dailyLimit: 0 });
    await ask("One more question");
    await sendAsk();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.match(text(outcome), /limit was reached/);
    assert.equal(q("[data-sm-retry-after]").dataset.smRetryAfter, "3600");
    assert.match(text(outcome), /about 3600 seconds/);
    assert.equal(server.log.messages, 0);
    assert.equal(q("[data-sm-composer='conversation'] textarea").value, "One more question");
    assert.equal(writes().length, 1, "no automatic retry");
  });

  it("without consent the server refuses (403) and says so; nothing is recorded", async () => {
    await open("/m/assistant/conversations/5", { consent: false });
    await ask();
    await sendAsk();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected");
    assert.match(text(q("[data-sm-outcome]")), /AI consent is required/);
  });

  it("a 2xx that is not provably this question is acknowledged without an answer being claimed", async () => {
    const pair = (over) => ({ status: 201, body: envelope({ user_message: { id: 90, conversation_id: 5, role: "user", content: "Another question" }, assistant_message: { id: 91, conversation_id: 5, reply_to_message_id: 90, role: "assistant", status: "completed", content: "x" }, replayed: false, ...over }) });
    for (const answer of [pair({ user_message: { id: 90, conversation_id: 5, role: "user", content: "Another question" } }), pair({ assistant_message: { id: 91, conversation_id: 6, reply_to_message_id: 90, role: "assistant", content: "x" } })]) {
      await open("/m/assistant/conversations/5", { onWrite: () => answer });
      await ask("The question that was asked");
      await sendAsk();
      assert.equal(q("[data-sm-last]").dataset.smLast, "unverified");
      assert.match(text(q("[data-sm-last]")), /confirmed your question/);
      await view.unmount();
      api.restore();
      window.localStorage.clear();
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    }
  });

  it("speaks Arabic, with the page in RTL", async () => {
    await open("/m/assistant/conversations/5", {}, { language: "ar" });
    assert.equal(document.documentElement.dir, "rtl");
    await ask("أين ذهبت أموالي؟");
    await sendAsk();
    assert.match(text(q("[data-sm-last]")), /أجاب المساعد/);
  });
});

describe("feedback", () => {
  const rate = async (selector) => {
    await click(q(selector));
    const form = q("[data-sm-form='ai-feedback']");
    await click(qa("input[type='radio']", form)[0]);
    await submit(form);
    return form;
  };

  it("on an answer: sends { rating, reason_code?, comment? } to the message, then says it was saved", async () => {
    await open("/m/assistant/conversations/5");
    const form = await rate("[data-sm-role='assistant'] [data-sm-action='rate']");
    await change(q("select", form), "unclear");
    await change(q("textarea", form), "  Missed my rent  ");
    await submit(form);
    await click(action("send", form));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].path, "/ai/messages/52/feedback");
    assert.deepEqual(writes()[0].body, { rating: "helpful", reason_code: "unclear", comment: "Missed my rent" });
    assert.equal(q("[data-sm-note='feedback-saved']").dataset.smProven, "true");
    assert.equal(server.log.feedback, 1);
  });

  it("on an insight: goes to the insight; a copy sets the same values (an upsert)", async () => {
    await open("/m/assistant");
    const form = await rate("[data-sm-insight='7'] [data-sm-action='rate']");
    await click(action("send", form));
    await settle();
    assert.equal(writes()[0].path, "/ai/insights/7/feedback");
    assert.deepEqual(writes()[0].body, { rating: "helpful" });
    const again = await sendWorkflowWrite({ operation: "ai.insightFeedback", ids: { insightId: "7" }, input: { rating: "helpful" } });
    assert.deepEqual(again.data.feedback, { rating: "helpful", reason_code: null, comment: null });
    assert.equal(server.feedback.size, 1);
  });

  it("needs a rating first, a double tap sends one request, a refusal is shown and an unknown outcome claims nothing", async () => {
    const hold = holdFirst();
    await open("/m/assistant/conversations/5", { onWrite: hold.onWrite });
    await click(q("[data-sm-role='assistant'] [data-sm-action='rate']"));
    const form = q("[data-sm-form='ai-feedback']");
    assert.equal(action("send", form).disabled, true, "nothing to send before it is checked");
    await click(qa("input[type='radio']", form)[1]);
    await submit(form);
    await act(async () => {
      action("send", form).click();
      action("send", form)?.click();
    });
    assert.equal(writes().length, 1);
    await act(async () => hold.release());
    await settle();
    assert.equal(server.log.feedback, 1);
    await view.unmount();
    api.restore();

    await open("/m/assistant/conversations/5", { afterApply: () => new TypeError("Failed to fetch") });
    const second = await rate("[data-sm-role='assistant'] [data-sm-action='rate']");
    await click(action("send", second));
    await settle();
    assert.equal(q("[data-sm-outcome]", q("[data-sm-form='ai-feedback']")).dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-note='feedback-saved']"), null);
  });
});

describe("insights: refresh and dismiss", () => {
  it("a refresh is queued, not done: the page says so and offers to look again", async () => {
    await open("/m/assistant");
    await click(action("refresh-insights"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].method, "POST");
    assert.equal(writes()[0].path, "/ai/insights/refresh");
    assert.equal(writes()[0].hasBody, false);
    const note = q("[data-sm-note='refresh-queued']");
    assert.match(text(note), /nothing is refreshed yet/);
    assert.doesNotMatch(text(note), /refreshed\.$/);
    const before = api.calls.filter((call) => call.path === "/ai/insights").length;
    await click(action("check-insights"));
    await settle();
    assert.ok(api.calls.filter((call) => call.path === "/ai/insights").length > before, "looking again reads the insights");
    assert.equal(server.log.refresh, 1);
  });

  it("refresh refusals: insights off (422) and the generation limit (429) are said, nothing queued; unknown claims nothing", async () => {
    server = aiServer();
    server.settings.insights_enabled = false;
    await open("/m/assistant", { server });
    // Insights are off, so the section (and its refresh) is not offered: the page does not invite a call the server refuses.
    assert.equal(action("refresh-insights"), null);
    await view.unmount();
    api.restore();

    await open("/m/assistant", { onWrite: () => ({ status: 429, headers: { "Retry-After": "40" }, body: { status: false, message: "Too Many Attempts." } }) });
    await click(action("refresh-insights"));
    await settle();
    assert.match(text(q("[data-sm-section='insight-refresh']")), /limit was reached/);
    assert.equal(q("[data-sm-retry-after]").dataset.smRetryAfter, "40");
    await view.unmount();
    api.restore();

    await open("/m/assistant", { afterApply: () => new TypeError("Failed to fetch") });
    await click(action("refresh-insights"));
    await settle();
    assert.equal(q("[data-sm-section='insight-refresh'] [data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-note='refresh-queued']"), null);
    assert.equal(writes().length, 1);
  });

  it("dismissing sends a POST to that insight and the list no longer shows it", async () => {
    await open("/m/assistant");
    await click(q("[data-sm-insight='8'] [data-sm-action='dismiss-insight']"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].path, "/ai/insights/8/dismiss");
    assert.equal(server.insights.find((row) => row.id === 8).status, "dismissed");
    assert.equal(q("[data-sm-insight='8']"), null, "read again: a dismissed insight is not active");
    assert.ok(q("[data-sm-insight='7']"));
    const again = await sendWorkflowWrite({ operation: "ai.insightDismiss", ids: { insightId: "8" }, input: {} });
    assert.equal(again.data.insight.status, "dismissed", "a copy leaves the same state");
  });
});

describe("privacy settings", () => {
  it("are edited from the current values, reviewed with what each was, and sent as only what changed", async () => {
    await open("/m/assistant/settings");
    assert.equal(q("[data-sm-field='retention_days'] input").value, "90");
    await click(q("[data-sm-field='insights_enabled'] input"));
    await change(q("[data-sm-field='retention_days'] input"), "30");
    await submit(q("form.sm-draft-form"));
    const review = q("[data-sm-step='review']");
    assert.match(text(q("[data-sm-was='retention_days']", review)), /Was:.*90/);
    assert.ok(q("[data-sm-was='insights_enabled']", review));
    assert.equal(q("[data-sm-was='forecast_enabled']", review), null);
    await click(action("send"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].method, "PUT");
    assert.equal(writes()[0].path, "/ai/settings");
    assert.deepEqual(writes()[0].body, { insights_enabled: false, retention_days: 30 });
    const result = q("[data-sm-ai-result='settings']");
    assert.match(text(q("[data-sm-result='retention']", result)), /30/);
    assert.match(text(q("[data-sm-result='insights']", result)), /Off/);
    assert.equal(server.settings.retention_days, 30);
  });

  it("turning the assistant off is allowed and sent as false; turning it on is never sent (consent is given in the full version)", async () => {
    await open("/m/assistant/settings");
    await click(q("[data-sm-field='ai_enabled'] input"));
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.deepEqual(writes()[0].body, { ai_enabled: false });
    assert.equal(server.settings.consent.active, false);
    await view.unmount();
    api.restore();

    // With the assistant off there is no form at all: it can't be switched on from here.
    await open("/m/assistant/settings", { consent: false });
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "aiOff");
    assert.equal(q("form.sm-draft-form"), null);
    assert.deepEqual(writes(), []);
  });

  it("an out-of-range retention never reaches review; the server's own refusal is shown; nothing changes", async () => {
    await open("/m/assistant/settings");
    for (const days of ["6", "366", "abc", "", "1.5"]) {
      await change(q("[data-sm-field='retention_days'] input"), days);
      await submit(q("form.sm-draft-form"));
      assert.equal(q("[data-sm-step='review']"), null, `"${days}"`);
    }
    assert.deepEqual(writes(), []);
    await view.unmount();
    api.restore();

    const refusal = await (async () => {
      server = aiServer();
      api = installFakeApi(server.handler, { allowWrites: WRITE_RULES });
      gate.setWriteApprovalsForTests(["ai.settings"]);
      return sendWorkflowWrite({ operation: "ai.settings", ids: {}, input: { retention_days: 5 } }).then(() => null, (error) => error);
    })();
    assert.equal(refusal.status, 422);
    assert.match(refusal.errors.retention_days[0], /between 7 and 365/);
    assert.equal(classifyWriteOutcome(refusal).kind, "rejected");
    assert.equal(server.settings.retention_days, 90);
  });

  it("a double tap sends one request; a lost answer is unknown and the same change is safe to repeat", async () => {
    const hold = holdFirst();
    await open("/m/assistant/settings", { onWrite: hold.onWrite });
    await change(q("[data-sm-field='retention_days'] input"), "30");
    await submit(q("form.sm-draft-form"));
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    await act(async () => hold.release());
    await settle();
    assert.equal(server.log.settings, 1);
    const again = await sendWorkflowWrite({ operation: "ai.settings", ids: {}, input: { retention_days: 30 } });
    assert.equal(again.data.settings.retention_days, 30);
    await view.unmount();
    api.restore();

    await open("/m/assistant/settings", { afterApply: () => new TypeError("Failed to fetch") });
    await change(q("[data-sm-field='retention_days'] input"), "30");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-ai-result]"), null);
  });

  it("speaks Arabic", async () => {
    await open("/m/assistant/settings", {}, { language: "ar" });
    await change(q("[data-sm-field='retention_days'] input"), "30");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-was='retention_days']")), /كان/);
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-ai-result='settings']")), /حُفظت الإعدادات/);
  });
});

describe("deleting a conversation", () => {
  it("is reviewed first, sends a DELETE with no body, and the list no longer has it", async () => {
    await open("/m/assistant/conversations/5/delete");
    assert.match(text(q("[data-sm-summary='record']")), /October spending/);
    if (!q("[data-sm-step='review']")) await click(action("review"));
    assert.match(text(q("[data-sm-effect='aiConversationDeleteEffect']")), /can't be undone/);
    assert.match(text(q("[data-sm-effect='aiConversationDeleteEffect']")), /accounts, transactions and budgets are not touched/);
    await click(action("send"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].method, "DELETE");
    assert.equal(writes()[0].path, "/ai/conversations/5");
    assert.equal(writes()[0].hasBody, false);
    assert.ok(q("[data-sm-ai-result='deleted']"));
    assert.equal(server.conversations.length, 0);
    assert.equal(server.log.deleted, 1);
  });

  it("the conversation page reaches the review from its Delete sheet; a double tap sends once; a copy is a 404; a lost answer is unknown", async () => {
    await open("/m/assistant/conversations/5");
    await click(action("delete-conversation"));
    assert.equal(action("review-delete").getAttribute("href"), "/m/assistant/conversations/5/delete");
    await view.unmount();
    api.restore();

    const hold = holdFirst();
    await open("/m/assistant/conversations/5/delete", { onWrite: hold.onWrite });
    if (!q("[data-sm-step='review']")) await click(action("review"));
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    await act(async () => hold.release());
    await settle();
    const copy = await sendWorkflowWrite({ operation: "ai.conversationDelete", ids: { conversationId: "5" }, input: {} }).then(() => null, (error) => error);
    assert.equal(copy.status, 404);
    assert.equal(classifyWriteOutcome(copy).kind, "rejected");
    assert.equal(server.log.deleted, 1);
    await view.unmount();
    api.restore();

    await open("/m/assistant/conversations/5/delete", { afterApply: () => new TypeError("Failed to fetch") });
    if (!q("[data-sm-step='review']")) await click(action("review"));
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-ai-result]"), null);
    assert.equal(server.log.deleted, 1, "the server did delete it");
    await reload("/m/assistant/conversations/5/delete");
    assert.equal(q("form.sm-draft-form"), null, "gone: there is nothing to delete again");
    assert.equal(writes().length, 1);
  });

  it("an invalid or unknown conversation has no form", async () => {
    for (const id of ["abc", "0", "999"]) {
      await open(`/m/assistant/conversations/${id}/delete`);
      assert.equal(q("form.sm-draft-form"), null, id);
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
  });
});

describe("deleting my AI data", () => {
  it("needs an explicit acknowledgement, says what is deleted, sends the backend's confirmation, and shows the server's counts", async () => {
    await open("/m/assistant/delete-data");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null, "not acknowledged: no review");
    assert.ok(q("[data-sm-summary='local']"));
    await click(q("[data-sm-field='understand'] input"));
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-effect='aiDataDeleteEffect']")), /can't be undone/);
    assert.match(text(q("[data-sm-effect='aiDataDeleteEffect']")), /accounts, transactions and budgets are not touched/);
    assert.deepEqual(writes(), []);
    await click(action("send"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].method, "DELETE");
    assert.equal(writes()[0].path, "/ai/data");
    assert.deepEqual(writes()[0].body, { confirmation: "DELETE_AI_DATA" });
    const result = q("[data-sm-ai-result='data']");
    assert.match(text(q("[data-sm-result='conversations']", result)), /1/);
    assert.match(text(q("[data-sm-result='insights']", result)), /2/);
    assert.match(text(q("[data-sm-result='usage']", result)), /4/);
    assert.equal(server.settings.consent.active, false, "the assistant is switched off");
  });

  it("a lost answer is unknown; a reload shows the assistant off; a copy deletes nothing more", async () => {
    let lose = true;
    await open("/m/assistant/delete-data", { afterApply: (answer) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : answer) });
    await click(q("[data-sm-field='understand'] input"));
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(server.log.data, 1);
    await reload("/m/assistant");
    assert.equal(q("[data-sm-screen='assistant']").dataset.smConsent, "false");
    const copy = await sendWorkflowWrite({ operation: "ai.dataDelete", ids: {}, input: {} });
    assert.deepEqual(copy.data.deleted, { conversations_deleted: 0, insights_deleted: 0, feedback_deleted: 0, usage_logs_deleted: 4 });
  });

  it("in Arabic", async () => {
    await open("/m/assistant/delete-data", {}, { language: "ar" });
    await click(q("[data-sm-field='understand'] input"));
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-ai-result='data']")), /حُذفت بيانات المساعد/);
  });
});

describe("what the answers prove", () => {
  it("a conversation, settings, deleted data, a message pair, feedback and a dismissed insight are each checked against what was sent", () => {
    assert.equal(buildConversationCreated({ conversation: { id: 9, status: "active", locale: "ar" } }, { locale: "ar" }).id, "9");
    assert.equal(buildConversationCreated({ conversation: { id: 9, status: "active", locale: "en" } }, { locale: "ar" }), null);
    assert.equal(buildConversationCreated({}, { locale: "ar" }), null);

    const settings = (over = {}) => ({ settings: { ai_enabled: true, insights_enabled: true, forecast_enabled: false, preferred_language: "en", retention_days: 30, ...over } });
    assert.equal(buildSettingsSaved(settings(), { retention_days: 30 }).retentionDays, 30);
    assert.equal(buildSettingsSaved(settings({ retention_days: 90 }), { retention_days: 30 }), null);
    assert.equal(buildSettingsSaved(settings({ ai_enabled: true }), { ai_enabled: false }), null);
    assert.equal(buildSettingsSaved(settings({ insights_enabled: "yes" }), {}), null);

    assert.deepEqual(buildDataDeleted({ deleted: { conversations_deleted: 1, insights_deleted: 2, feedback_deleted: 0, usage_logs_deleted: 3 } }), { conversations: 1, insights: 2, feedback: 0, usage: 3 });
    assert.equal(buildDataDeleted({ deleted: { conversations_deleted: "1" } }), null);

    const pair = (over = {}) => ({ user_message: { id: 1, conversation_id: 5, role: "user", content: "Q" }, assistant_message: { id: 2, conversation_id: 5, reply_to_message_id: 1, role: "assistant", status: "completed" }, replayed: false, ...over });
    assert.equal(buildMessagePair(pair(), "Q", "5").state, "ready");
    assert.equal(buildMessagePair(pair({ replayed: true }), "Q", "5").replayed, true);
    assert.equal(buildMessagePair(pair({ assistant_message: { id: 2, conversation_id: 5, reply_to_message_id: 1, role: "assistant", status: "failed", failure: { message: "Sorry" } } }), "Q", "5").failure, "Sorry");
    assert.equal(buildMessagePair(pair({ assistant_message: { id: 2, conversation_id: 5, reply_to_message_id: 1, role: "assistant", status: "processing" } }), "Q", "5").state, "pending");
    assert.equal(buildMessagePair(pair(), "Other", "5"), null);
    assert.equal(buildMessagePair(pair(), "Q", "6"), null);
    assert.equal(buildMessagePair(pair({ assistant_message: { id: 2, conversation_id: 5, reply_to_message_id: 99, role: "assistant" } }), "Q", "5"), null);

    assert.equal(buildFeedbackSaved({ feedback: { rating: "helpful", reason_code: null } }, { rating: "helpful" }).rating, "helpful");
    assert.equal(buildFeedbackSaved({ feedback: { rating: "inaccurate" } }, { rating: "helpful" }), null);
    assert.equal(buildInsightDismissed({ insight: { id: 8, status: "dismissed" } }, "8").id, "8");
    assert.equal(buildInsightDismissed({ insight: { id: 8, status: "active" } }, "8"), null);
  });

  it("only a stored provider failure is a certain outcome: it needs the assistant's error body and a 429, 502 or 503", () => {
    const body = { status: false, message: "x", error: { code: "timeout", retryable: true } };
    for (const status of [429, 502, 503]) assert.equal(classifyWriteOutcome(new ApiError("x", { status, code: "SERVER_ERROR", payload: body })).code, "AI_FAILED", String(status));
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 500, code: "SERVER_ERROR", payload: body })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 503, code: "SERVER_ERROR", payload: { status: false } })).kind, "unknown");
  });
});
