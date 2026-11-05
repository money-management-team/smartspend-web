import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { act } from "react";

import { change, click, submit } from "./helpers/dom.mjs";
import { account, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { paginator } from "./helpers/planningFixture.mjs";

const { CAPTURE_UPLOAD_MAX_BYTES, CAPTURE_UPLOAD_TYPES } = await import("../src/features/Dashboards/User/AiExpenseCaptures/captureConstants.js");
const { VOICE_RECORDING_POLICY } = await import("../src/features/Dashboards/User/FinancialOperations/voiceCaptureContract.js");
const rules = await import("../src/mobile/assist/captureRules.js");

/*
 * The assistant, receipt and voice captures, WhatsApp and Profile on Mobile,
 * against a fake backend with fictional data that refuses anything but GET.
 */

after(() => dom.window.close());

const settings = (over = {}) => ({ settings: { consent: { active: true }, insights_enabled: true, forecast_enabled: true, retention_days: 90, preferred_language: "en", ...over } });
const capture = (id, over = {}) => ({ id, status: "ready_for_review", source_type: "receipt", review_version: 2, review_values: { account_id: 1, category_id: 4, merchant_name: "Corner café", amount: "25.5000", currency_code: "ILS", transaction_date: "2026-10-27", description: "Lunch" }, created_at: "2026-10-27T12:00:00Z", ...over });
const draft = (id, over = {}) => ({ id, status: "ready_for_review", review_version: 3, can_edit: true, can_confirm: true, can_discard: true, review_values: { account_id: 1, category_id: 4, amount: "18.0000", description: "Taxi", transaction_date: "2026-10-28", transaction_time: "09:15" }, confirmation: { ready: true, issues: [] }, account: { id: 1, name: "Everyday wallet", currency_code: "ILS" }, created_at: "2026-10-28T09:16:00Z", ...over });
const quotas = { quotas: { voice: { limit: 10, used: 3, remaining: 7, reset_at: "2026-10-30T00:00:00Z" }, receipt: { limit: 10, used: 10, remaining: 0, reset_at: "2026-10-30T00:00:00Z" } } };

function assistBackend({ ai = settings(), whatsapp = { enabled: true, state: "linked", capabilities: { can_link: true, can_manage_link: true, can_review_drafts: true }, integration: { phone_last_digits: "4321", linked_at: "2026-09-01T10:00:00Z" } }, drafts = [draft(8), draft(9, { status: "expired" })], captures = [capture(3), capture(6, { status: "processing", review_version: 0 })], prefs = { preferences: { savings_installment_reminders: true }, channels: ["in_app"], savings_installment_reminders_available: true } } = {}) {
  return (call) => {
    const p = call.path;
    if (p === "/ai/settings") return { body: envelope(ai) };
    if (p === "/ai/conversations") return { body: envelope({ conversations: paginator([{ id: 5, title: "October spending", updated_at: "2026-10-20T10:00:00Z" }]) }) };
    if (p === "/ai/conversations/5") return { body: envelope({ messages: paginator([{ id: 51, role: "user", content: "Where did my money go?" }, { id: 52, role: "assistant", content: "Mostly on food.", sources: [{ type: "category", id: 4, label: "Food" }, { type: "report", label: "Overview" }] }], { perPage: 50 }) }) };
    if (p === "/ai/insights") return { body: envelope({ insights: paginator([{ id: 7, type: "budget", status: "active", title: "Food budget nearly used", summary: "90% used with 5 days left.", currency_code: "ILS", sources: [] }]) }) };
    if (p === "/ai/forecast") return { body: envelope({ forecast: { status: "ready", period: { start: "2026-10-29", end: "2026-11-27" }, explanation: "Based on your recurring items.", assumptions: ["Salary arrives on the 1st"], currencies: [{ currency_code: "ILS", current_balance: "1234.5000", expected_inflow: "4000.0000", expected_outflow: "3100.0000", projected_balance: "2134.5000", minimum_projected_balance: "-50.0000", pressure_days: ["2026-10-31"], timeline: [{ date: "2026-10-31", expected_inflow: "0.0000", expected_outflow: "1300.0000", closing_balance: "-50.0000" }] }] } }) };
    if (p === "/ai/input-quotas") return { body: envelope(quotas) };
    if (p === "/ai/expense-captures") return { body: envelope({ captures: paginator(captures) }) };
    if (/^\/ai\/expense-captures\/\d+$/.test(p)) {
      const found = captures.find((row) => p.endsWith(`/${row.id}`));
      return found ? { body: envelope({ capture: found }) } : failure(404);
    }
    if (p === "/ai/voice-expense-captures") return { body: envelope({ captures: paginator([capture(4, { source_type: "voice" })]), voice_quota: quotas.quotas.voice }) };
    if (p === "/ai/voice-expense-captures/4") return { body: envelope({ capture: capture(4, { source_type: "voice", transcript: "Twenty five shekels for lunch" }) }) };
    if (p === "/integrations/whatsapp") return { body: envelope(whatsapp) };
    if (p === "/integrations/whatsapp/expense-drafts") return { body: envelope({ drafts: paginator(call.query.status ? drafts.filter((row) => row.status === call.query.status) : drafts) }) };
    if (/^\/integrations\/whatsapp\/expense-drafts\/\d+$/.test(p)) {
      const found = drafts.find((row) => p.endsWith(`/${row.id}`));
      return found ? { body: envelope({ draft: found }) } : failure(404);
    }
    if (p === "/notifications/preferences") return { body: envelope(prefs) };
    if (p === "/accounts") return { body: envelope({ accounts: [account({ id: 1 }), account({ id: 3, name: "Dollar account", currency_code: "USD" })] }) };
    if (p === "/categories") return { body: envelope({ categories: [{ id: 4, name: "Food", type: "expense", is_system: false, is_active: true }] }) };
    return failure(404);
  };
}

let api;
let view;
const text = (root = q("main")) => root.textContent.replace(/\s+/g, " ");
const action = (name) => q(`[data-sm-action='${name}']`);
const paths = () => api.calls.map((call) => call.path);
const PERSON = { ...USER_A, email: "alex@example.test", phone: "0500000000" };
const open = async (entry, backend = assistBackend()) => {
  api = installFakeApi(backend);
  view = await mountMobile({ entry, auth: { isAuthenticated: true, initializing: false, token: TOKEN_A, user: PERSON, workspace: { id: 1, name: "Home", base_currency_code: "ILS", timezone: "UTC" } } });
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: PERSON });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("the assistant", () => {
  it("with consent: insights labelled as generated, conversations, quotas, and a composer whose Send never sends", async () => {
    await open("/m/assistant");
    assert.equal(q("[data-sm-screen='assistant']").dataset.smConsent, "true");
    assert.match(text(q("[data-sm-insight='7']")), /AI-generated.*Food budget nearly used/);
    assert.ok(q("[data-sm-conversation='5']"));
    assert.match(text(q("[data-sm-quota='receipt']")), /0 of 10 left/);
    assert.equal(paths().includes("/ai/forecast"), false, "the forecast is read only when asked for");

    await click(q("[data-sm-prompt='budgets']"));
    assert.equal(q("[data-sm-section='composer'] textarea").value, "Which budgets am I close to?");
    const send = action("send-message");
    assert.equal(qa(".sm-prompt", q("[data-sm-section='composer']")).length, 4, "four suggestions, as rows");
    assert.ok(send.closest(".sm-composer-foot"), "Send sits in the composer's foot, beside the count");
    assert.ok(q("#" + send.closest(".sm-composer-box").querySelector("textarea").id), "the field is inside the composer box");
    assert.equal(q("[data-sm-note='write-closed'][data-sm-write='ai.message']").classList.contains("sm-draft-note"), true);
    assert.equal(q("[data-sm-section='conversations'] .sm-row-title, [data-sm-section='conversations'] [data-sm-conversation]") !== null, true, "nothing is invented: conversations are only the backend's");
    assert.equal(send.disabled, true);
    await click(send);
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });

  it("the forecast: per currency, the backend's figures, negative balances shown as negative, an estimate", async () => {
    await open("/m/assistant");
    await click(action("load-forecast"));
    await settle();
    const forecast = q("[data-sm-section='forecast']");
    assert.match(text(forecast), /Lowest projected balance/);
    assert.match(text(forecast), /−50\.00|-50\.00/);
    assert.match(text(forecast), /not a guarantee/);
    assert.equal(qa("[data-sm-currency]", forecast).length, 1);
    assert.equal(q("tr[data-sm-pressure='true']", forecast) !== null, true);
  });

  it("without consent: says so, and reads no insights, forecast or conversations", async () => {
    await open("/m/assistant", assistBackend({ ai: settings({ consent: { active: false } }) }));
    assert.equal(q("[data-sm-screen='assistant']").dataset.smConsent, "false");
    assert.equal(q("[data-sm-section='composer']"), null);
    assert.deepEqual(paths().filter((path) => /insights|forecast|conversations/.test(path)), []);
  });

  it("a conversation: the messages, the assistant's labelled, its sources linked only to Mobile pages", async () => {
    await open("/m/assistant/conversations/5");
    assert.equal(qa("[data-sm-role]").length, 2);
    const reply = q("[data-sm-role='assistant']");
    assert.match(text(reply), /AI-generated/);
    assert.equal(q("a", reply).getAttribute("href"), "/m/planning/categories/4");
    assert.match(text(reply), /Overview/, "a source with no Mobile page is named, not linked");
    assert.equal(qa("a", reply).length, 1);
  });
});

describe("the assistant: a conversation as a chat (real backend shapes)", () => {
  // AiMessageResource: the time is timestamps.created_at; a failed reply has status "failed" and a safe failure message.
  const chat = (messages, extra = {}) => (call) => (call.path === "/ai/conversations/5" ? { body: envelope({ messages: paginator(messages, { perPage: 50 }) }) } : assistBackend(extra)(call));
  const message = (id, role, content, more = {}) => ({ id, conversation_id: 5, role, status: "completed", content, sources: [], timestamps: { created_at: "2026-10-20T10:00:00Z" }, ...more });

  it("yours and the assistant's messages are bubbles with the time the backend gave, the assistant's labelled", async () => {
    await open("/m/assistant/conversations/5", chat([message(51, "user", "Where did my money go?"), message(52, "assistant", "Mostly on food.", { timestamps: { created_at: "2026-10-20T10:00:05Z" } })]));
    assert.ok(q("[data-sm-chat]"));
    const [mine, theirs] = qa(".sm-turn");
    assert.equal(mine.dataset.smRole, "user");
    assert.equal(theirs.dataset.smRole, "assistant");
    assert.ok(q(".sm-bubble", mine) && q(".sm-bubble", theirs));
    assert.match(text(mine), /Where did my money go?/);
    assert.match(text(q(".sm-bubble-time", mine)), /Oct 20, 2026/, "the time is timestamps.created_at, not a top-level created_at");
    assert.match(text(q(".sm-bubble-head", theirs)), /Assistant.*AI-generated/);
    assert.ok(q("[data-sm-action='continue-full']"), "a way on, in the full version");
  });

  it("a reply that failed says so with the backend's safe message; one still being prepared says that; neither shows a fake answer", async () => {
    await open("/m/assistant/conversations/5", chat([message(51, "user", "Hi"), message(52, "assistant", "", { status: "failed", failure: { code: "ai_failed", message: "We couldn't answer that just now." } }), message(53, "user", "Again"), message(54, "assistant", "", { status: "processing" })]));
    const [, failed, , pending] = qa(".sm-turn");
    assert.equal(failed.dataset.smState, "failed");
    assert.match(text(q("[data-sm-note='reply-failed']", failed)), /We couldn't answer that just now./);
    assert.equal(q("[data-sm-action='send-message']"), null);
    assert.equal(pending.dataset.smState, "pending");
    assert.ok(q("[data-sm-note='reply-pending']", pending));
    assert.equal(qa(".sm-ai-content", failed).length + qa(".sm-ai-content", pending).length, 0, "no answer text is made up");
    assert.equal(qa("button", failed).length + qa("button", pending).length, 0, "no feedback on a reply that was not made");
  });

  it("replying and deleting stay closed: the notes say so, and nothing is sent", async () => {
    await open("/m/assistant/conversations/5", chat([message(51, "user", "Hi"), message(52, "assistant", "Hello.")]));
    const note = q("[data-sm-note='write-closed'][data-sm-write='ai.message']");
    assert.match(text(note), /Replying isn't available in Mobile yet/);
    assert.equal(qa("textarea").length, 0, "no input that looks like it would send");
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });

  it("the assistant lists conversations with the backend's message count and last activity, and offers the full version to ask in", async () => {
    await open("/m/assistant", (call) => (call.path === "/ai/conversations" ? { body: envelope({ conversations: paginator([{ id: 5, title: "October spending", status: "active", message_count: 4, last_message_at: "2026-10-21T08:30:00Z", updated_at: "2026-10-20T10:00:00Z" }]) }) } : assistBackend()(call)));
    const row = q("[data-sm-conversation='5']");
    assert.match(text(row), /October spending/);
    assert.match(text(row), /4 messages.*Oct 21, 2026/);
    const ask = q("[data-sm-action='ask-full']");
    assert.equal(ask.getAttribute("href"), "/dashboard/ai-assistant");
    assert.equal(action("send-message").disabled, true);
  });

  it("the models read the real shapes and refuse nothing silently", async () => {
    const { normalizeConversation, normalizeMessage } = await import("../src/mobile/models/assist.js");
    assert.deepEqual(normalizeMessage(message(1, "assistant", "x", { status: "failed", failure: { message: "No." } })).state, "failed");
    assert.equal(normalizeMessage(message(1, "assistant", "x")).createdAt, "2026-10-20T10:00:00Z");
    assert.equal(normalizeMessage({ id: 1, role: "assistant", content: "x", created_at: "2026-10-01T00:00:00Z" }).createdAt, "2026-10-01T00:00:00Z", "the older flat shape still reads");
    assert.equal(normalizeMessage(message(1, "system", "x")), null);
    assert.deepEqual(normalizeConversation({ id: 3, message_count: 2, last_message_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }), { id: "3", title: null, updatedAt: "2026-10-02T00:00:00Z", messageCount: 2 });
    assert.equal(normalizeConversation({ id: 3, message_count: -1 }).messageCount, null);
  });
});

describe("receipts and voice", () => {
  it("lists both, and a capture ready for review opens its review with what SmartSpend read, never sending", async () => {
    await open("/m/captures");
    assert.ok(q("[data-sm-capture='receipt:3']"));
    assert.ok(q("[data-sm-capture='voice:4']"));
    await click(q("[data-sm-capture='receipt:3']"));
    await settle();
    assert.equal(location(), "/m/captures/receipts/3");
    assert.equal(q("[data-sm-field='merchant_name'] input").value, "Corner café");
    assert.equal(q("[data-sm-field='amount'] input").value, "25.5");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "receipt.confirm");
    assert.equal(action("send").disabled, true);
  });

  it("a capture still being read can't be reviewed yet", async () => {
    await open("/m/captures/receipts/6");
    assert.equal(q("form"), null);
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "captureProcessing");
  });

  it("a voice capture shows what was heard", async () => {
    await open("/m/captures/voice/4");
    assert.match(text(q(".sm-transcript")), /Twenty five shekels for lunch/);
  });

  it("the receipt and voice limits are the full version's", () => {
    assert.deepEqual([...rules.RECEIPT_TYPES], CAPTURE_UPLOAD_TYPES);
    assert.equal(rules.RECEIPT_MAX_BYTES, CAPTURE_UPLOAD_MAX_BYTES);
    assert.equal(rules.VOICE_MAX_SECONDS, VOICE_RECORDING_POLICY.maxDurationSeconds);
    assert.equal(rules.VOICE_MIN_MS, VOICE_RECORDING_POLICY.minDurationMs);
    assert.equal(rules.VOICE_MAX_BYTES, VOICE_RECORDING_POLICY.maxBytes);
    assert.equal(rules.receiptFileError({ size: 0, type: "image/png" }), "empty");
    assert.equal(rules.receiptFileError({ size: 10, type: "application/pdf", name: "a.pdf" }), "type");
    assert.equal(rules.receiptFileError({ size: 10, type: "", name: "IMG_1.HEIC" }), null, "a HEIC sent with no type is judged by its extension");
    assert.equal(rules.receiptFileError({ size: rules.RECEIPT_MAX_BYTES + 1, type: "image/jpeg" }), "size");
  });

  it("a receipt photo: refused when too large, shown when right, removable; Upload never sends", async () => {
    await open("/m/captures/receipts/new");
    const input = q("[data-sm-input='receipt']");
    const pick = (file) => act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await pick(new window.File([new Uint8Array(rules.RECEIPT_MAX_BYTES + 1)], "big.jpg", { type: "image/jpeg" }));
    assert.equal(q("[data-sm-error]").dataset.smError, "size");
    await pick(new window.File([new Uint8Array(2048)], "receipt.png", { type: "image/png" }));
    assert.equal(q("[data-sm-screen='receipt-new']").dataset.smState, "chosen");
    assert.match(text(q("[data-sm-file='chosen']")), /receipt\.png/);
    assert.equal(action("upload").disabled, true);
    await click(action("remove"));
    assert.equal(q("[data-sm-file='chosen']"), null);
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });
});

describe("recording an expense by voice", () => {
  /*
   * MobileVoiceNew.jsx now records through the full version's own recorder
   * and WAV conversion (FinancialOperations/voiceRecorder.js, reused rather
   * than duplicated — see assist/voiceRecorderFactory.js and
   * tests/mobileBoundaries.test.mjs's reviewed exception for it). jsdom has
   * no Web Audio API to drive that engine with, so this file replaces it
   * outright (setVoiceRecorderForTests) with a minimal fake of the same
   * public shape; the engine's own byte-level correctness is
   * tests/voiceRecording.test.mjs's job, not this one's.
   */
  let setVoiceRecorderForTests;
  let recorder;

  function fakeRecorder() {
    let snapshot = Object.freeze({ status: "idle", elapsedMs: 0, level: 0, result: null, error: null, stopReason: null, support: Object.freeze({ supported: true, code: null }) });
    const listeners = new Set();
    const set = (changes) => {
      snapshot = Object.freeze({ ...snapshot, ...changes });
      listeners.forEach((listener) => listener());
    };
    let failNextStart = null;
    let failNextStop = null;

    return {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      start: () => {
        if (failNextStart) {
          const code = failNextStart;
          failNextStart = null;
          set({ status: "error", error: { code }, result: null });
          return Promise.reject(Object.assign(new Error(code), { code }));
        }
        set({ status: "recording", elapsedMs: 0, error: null, result: null, stopReason: null });
        return Promise.resolve();
      },
      stop: () => {
        if (failNextStop) {
          const code = failNextStop;
          failNextStop = null;
          set({ status: "error", error: { code }, result: null });
          return Promise.resolve();
        }
        set({ status: "ready", result: { blob: new Blob([new Uint8Array(44)], { type: "audio/wav" }), durationMs: 1200, byteLength: 44, wasTrimmed: false, previewUrl: "blob:test-1" } });
        return Promise.resolve();
      },
      cancel: () => set({ status: "idle", elapsedMs: 0, level: 0, result: null, error: null, stopReason: null }),
      failNextStart: (code) => {
        failNextStart = code;
      },
      failNextStop: (code) => {
        failNextStop = code;
      },
    };
  }

  beforeEach(async () => {
    ({ setVoiceRecorderForTests } = await import("../src/mobile/assist/voiceRecorderFactory.js"));
    recorder = fakeRecorder();
    setVoiceRecorderForTests(() => recorder);
  });
  afterEach(() => setVoiceRecorderForTests(null));

  it("asks for the microphone only on Record, records, stops, and plays back here", async () => {
    await open("/m/captures/voice/new");
    assert.equal(q("[data-sm-screen='voice-new']").dataset.smPhase, "idle");
    await click(action("record"));
    await settle();
    assert.equal(q("[data-sm-screen='voice-new']").dataset.smPhase, "recording");
    await act(async () => recorder.stop());
    await settle();
    assert.equal(q("[data-sm-screen='voice-new']").dataset.smPhase, "ready");
    assert.ok(q("[data-sm-clip='recorded']"));
    assert.equal(action("upload").disabled, true);
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });

  it("a refused microphone explains how to allow it", async () => {
    recorder.failNextStart("VOICE_PERMISSION_DENIED");
    await open("/m/captures/voice/new");
    await click(action("record"));
    await settle();
    assert.equal(q("[data-sm-status]").dataset.smStatus, "VOICE_PERMISSION_DENIED");
    assert.match(text(), /Microphone access was refused/);
  });

  it("a recording that is too short is not kept; discarding one asks first", async () => {
    await open("/m/captures/voice/new");
    recorder.failNextStop("VOICE_TOO_SHORT");
    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    assert.equal(q("[data-sm-status]").dataset.smStatus, "VOICE_TOO_SHORT");
    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    await click(action("discard-recording"));
    assert.ok(q("[role='dialog']"));
    await click(action("confirm-discard"));
    assert.equal(q("[data-sm-clip='recorded']"), null);
  });
});

describe("WhatsApp", () => {
  it("linked: the number's last digits, drafts, and a disconnect confirmation whose last step is disabled", async () => {
    await open("/m/whatsapp");
    assert.equal(q("[data-sm-screen='whatsapp']").dataset.smWhatsapp, "linked");
    assert.match(text(), /4321/);
    assert.ok(q("[data-sm-note='legal-pending']"));
    await click(action("disconnect"));
    assert.equal(action("confirm-disconnect").disabled, true);
    await click(action("keep-linked"));
    assert.equal(q("[role='dialog']"), null);
  });

  it("not linked: how linking works, and that it starts in the full version; no token is asked for", async () => {
    await open("/m/whatsapp", assistBackend({ whatsapp: { enabled: true, state: "not_linked", capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true }, integration: null } }));
    assert.ok(q("[data-sm-section='linking']"));
    assert.deepEqual(paths().filter((path) => /link-challenges/.test(path)), []);
  });

  it("drafts: filtered by status in the address; an expired draft can't be reviewed; a ready one opens its review", async () => {
    await open("/m/whatsapp/drafts");
    assert.equal(qa("[data-sm-draft]").length, 2);
    await click(qa("button").find((button) => button.textContent.trim() === "Expired"));
    await settle();
    assert.equal(location(), "/m/whatsapp/drafts?status=expired");
    assert.equal(qa("[data-sm-draft]").length, 1);
    await view.unmount();
    api.restore();
    await open("/m/whatsapp/drafts/9");
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "draftExpired");
    await view.unmount();
    api.restore();
    await open("/m/whatsapp/drafts/8");
    assert.equal(q("[data-sm-screen='whatsapp-draft']").dataset.smVersion, "3");
    assert.equal(q("[data-sm-field='amount'] input").value, "18");
  });
});

describe("profile and settings", () => {
  it("shows who is signed in, the workspace, and a notification preference that can be changed here but not saved", async () => {
    await open("/m/profile");
    assert.match(text(), /Alex Example/);
    const prefs = q("[data-sm-section='notification-preferences']");
    const box = q("input[type='checkbox']", prefs);
    assert.equal(box.checked, true);
    await click(box);
    assert.equal(q("[data-sm-note='write-closed']", prefs).dataset.smWrite, "notifications.preferences");
    assert.equal(action("save-preferences").disabled, true);
    await click(action("undo-preferences"));
    assert.equal(q("input[type='checkbox']", prefs).checked, true);
  });

  it("the password form: the full version's rules, and the review never shows a password", async () => {
    await open("/m/profile/password");
    await change(q("[data-sm-field='current_password'] input"), "old-pass-1");
    await change(q("[data-sm-field='password'] input"), "short1");
    await change(q("[data-sm-field='password_confirmation'] input"), "short1");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-summary='local']")), /at least 8 characters/);
    await change(q("[data-sm-field='password'] input"), "new-pass-22");
    await change(q("[data-sm-field='password_confirmation'] input"), "new-pass-23");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-summary='local']")), /don't match/);
    await change(q("[data-sm-field='password_confirmation'] input"), "new-pass-22");
    await submit(q("form.sm-draft-form"));
    const review = q("[data-sm-step='review']");
    assert.doesNotMatch(review.textContent, /new-pass-22|old-pass-1/);
    assert.match(text(review), /Entered \(not shown\)/);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "profile.password");
  });

  it("the profile form starts from the signed-in person and needs a real change", async () => {
    await open("/m/profile/edit");
    assert.equal(q("[data-sm-field='name'] input").value, "Alex Example");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-summary='local']")), /Nothing has changed yet/);
    await change(q("[data-sm-field='email'] input"), "not-an-email");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-summary='local']")), /email address like/);
  });
});
