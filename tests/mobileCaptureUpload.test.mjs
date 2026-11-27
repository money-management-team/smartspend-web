import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { click } from "./helpers/dom.mjs";
import { FORM_WRITES, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const { setVoiceRecorderForTests } = await import("../src/mobile/assist/voiceRecorderFactory.js");

/*
 * Phase 6UI.3: the receipt and voice upload writes (data/writeGate.js's
 * "receipt.upload" / "voice.upload") now have send code, through
 * assist/useCaptureUpload.js and the two api clients Mobile already reuses
 * for confirm (data/writeApi.js). Both stay closed in the shipped product
 * (APPROVED, unchanged); every test here that sends one opens it for the
 * test only (gate.setWriteApprovalsForTests) and the gate test below reads
 * the gate exactly as the product ships it.
 *
 * Neither write ever posts an expense: AiExpenseCaptureController::store /
 * AiVoiceExpenseCaptureController::store only ever create a non-financial
 * capture row, queued for the AI to read (fix/financial-idempotency-p0 @
 * 6b696d72). Confirming one is the separate, independently-gated
 * "receipt.confirm" / "voice.confirm" write, already covered by
 * tests/mobileAssist.test.mjs; this file does not re-test that review step,
 * only that a successful upload lands on it without sending anything else.
 */

/*
 * jsdom's own FormData (domSetup.mjs makes it globalThis.FormData, for every
 * Mobile test) only accepts its OWN Blob/File as a value — Node's native
 * Blob fails its webidl conversion. aiVoiceExpenseCapturesApi.create's bare
 * `instanceof Blob` then needs that SAME identity, so scoped to this file
 * only (every other test either skips jsdom entirely or never constructs a
 * Blob), the bare Blob/File globals become jsdom's.
 */
const realBlob = globalThis.Blob;
const realFile = globalThis.File;
globalThis.Blob = window.Blob;
globalThis.File = window.File;

after(() => {
  globalThis.Blob = realBlob;
  globalThis.File = realFile;
  dom.window.close();
});

const action = (name) => q(`[data-sm-action='${name}']`);
const text = (root = q("main")) => root.textContent.replace(/\s+/g, " ");
const writes = () => api.calls.filter((call) => call.method !== "GET");

/** A minimal fake of createVoiceRecorder()'s public shape (voiceRecorderFactory.js), driven directly by the test. */
function fakeRecorder() {
  let snapshot = Object.freeze({ status: "idle", elapsedMs: 0, level: 0, result: null, error: null, stopReason: null, support: Object.freeze({ supported: true, code: null }) });
  const listeners = new Set();
  const set = (changes) => {
    snapshot = Object.freeze({ ...snapshot, ...changes });
    listeners.forEach((listener) => listener());
  };
  let urls = 0;
  let failNextStop = null;
  let failNextStart = null;

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
      urls += 1;
      set({ status: "ready", result: { blob: new Blob([new Uint8Array(44)], { type: "audio/wav" }), durationMs: 1200, byteLength: 44, wasTrimmed: false, previewUrl: `blob:test-${urls}` } });
      return Promise.resolve();
    },
    cancel: () => set({ status: "idle", elapsedMs: 0, level: 0, result: null, error: null, stopReason: null }),
    failNextStop: (code) => {
      failNextStop = code;
    },
    failNextStart: (code) => {
      failNextStart = code;
    },
  };
}

/** GET /ai/{expense,voice-expense}-captures/{id} (for the page an upload lands on) + POST .../{expense-captures,voice-expense-captures} (the upload itself, answered by `onCreate`). */
function captureBackend(source, id, onCreate) {
  const segment = source === "voice" ? "voice-expense-captures" : "expense-captures";
  return (call) => {
    if (call.method === "GET" && call.path === `/ai/${segment}/${id}`) {
      return { body: envelope({ capture: { id, status: "uploaded", source_type: source, review_version: 0, review_values: {}, account: null, category: null }, ...(source === "voice" ? { voice_quota: { limit: 10, used: 1, remaining: 9, reset_at: "2026-10-30T00:00:00Z" } } : {}) }) };
    }
    if (call.method === "POST" && call.path === `/ai/${segment}`) return onCreate(call);
    return failure(404, "Not found");
  };
}

let api;
let view;

async function openReceipt(onCreate) {
  api = installFakeApi(captureBackend("receipt", 9, onCreate), { allowWrites: [FORM_WRITES.receiptUpload] });
  view = await mountMobile({ entry: "/m/captures/receipts/new" });
}

async function openVoice(onCreate, { recorder = fakeRecorder() } = {}) {
  setVoiceRecorderForTests(() => recorder);
  api = installFakeApi(captureBackend("voice", 9, onCreate), { allowWrites: [FORM_WRITES.voiceUpload] });
  view = await mountMobile({ entry: "/m/captures/voice/new" });
  return recorder;
}

const pickFile = async (bytes = 2048, name = "receipt.png", type = "image/png") => {
  const input = q("[data-sm-input='receipt']");
  const file = new window.File([new Uint8Array(bytes)], name, { type });
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  return file;
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  gate.setWriteApprovalsForTests(null);
  setVoiceRecorderForTests(null);
  assert.deepEqual(api?.violations ?? [], [], "only the opened write");
  api?.restore();
  api = null;
});

describe("receipt.upload / voice.upload: the write gate", () => {
  it("both stay closed by default", () => {
    assert.equal(gate.isWriteOpen("receipt.upload"), false);
    assert.equal(gate.isWriteOpen("voice.upload"), false);
  });

  it("the shipped APPROVED list is still empty (source audit)", () => {
    const source = readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8");
    assert.match(source, /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("Upload stays disabled and truthful for a receipt while the gate is closed, even with a chosen file", async () => {
    await openReceipt(() => failure(500, "must not be called"));
    await pickFile();
    assert.equal(action("upload").disabled, true);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "receipt.upload");
    assert.equal(writes().length, 0);
  });

  it("Upload stays disabled and truthful for a recording while the gate is closed, even once one is ready", async () => {
    const recorder = await openVoice(() => failure(500, "must not be called"));
    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    assert.ok(q("[data-sm-clip='recorded']"));
    assert.equal(action("upload").disabled, true);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "voice.upload");
    assert.equal(writes().length, 0);
  });
});

describe("receipt upload: gate opened for the test only", () => {
  it("uploads the chosen file once and goes straight to the capture's review page, never a confirm", async () => {
    gate.setWriteApprovalsForTests(["receipt.upload"]);
    await openReceipt(() => ({ status: 201, body: envelope({ capture: { id: 9, status: "uploaded", source_type: "receipt", review_version: 0, review_values: {} } }) }));
    const file = await pickFile(3000, "lunch.jpg", "image/jpeg");
    await click(action("upload"));
    await settle();

    assert.deepEqual(writes().map((call) => call.path), ["/ai/expense-captures"]);
    assert.equal(location(), "/m/captures/receipts/9");
    const [upload] = writes();
    assert.equal(upload.body.get("file").name, file.name);
    assert.equal(upload.body.get("file").size, file.size);
    assert.equal(upload.body.get("workspace_id"), "1");
    assert.match(upload.headers["Idempotency-Key"], /^mobile-receipt-upload-/);
  });

  it("a rejected file (422) shows the server's own refusal and sends nothing further", async () => {
    gate.setWriteApprovalsForTests(["receipt.upload"]);
    await openReceipt(() => failure(422, "Only valid JPEG, PNG, and WEBP receipt images are accepted."));
    await pickFile();
    await click(action("upload"));
    await settle();

    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected");
    assert.equal(q("[data-sm-outcome]").dataset.smCode, "VALIDATION_ERROR");
    assert.match(text(), /Only valid JPEG, PNG, and WEBP/);
    assert.equal(writes().length, 1, "no retry by itself");
  });

  it("a quota refusal (429) is also certain, not ambiguous: no retry button is offered", async () => {
    gate.setWriteApprovalsForTests(["receipt.upload"]);
    await openReceipt(() => ({ status: 429, body: { status: false, message: "Too many receipts today.", code: "ai_daily_limit_reached" }, headers: { "Retry-After": "60" } }));
    await pickFile();
    await click(action("upload"));
    await settle();

    assert.equal(q("[data-sm-outcome]").dataset.smCode, "RATE_LIMITED");
    assert.equal(action("retry-upload"), null);
  });

  it("an ambiguous answer (503) keeps the SAME key; Try again resends it, and a clean success then moves on", async () => {
    gate.setWriteApprovalsForTests(["receipt.upload"]);
    let attempt = 0;
    await openReceipt(() => {
      attempt += 1;
      if (attempt === 1) return { status: 503, body: { status: false, message: "SmartSpend had a problem." } };
      return { status: 201, body: envelope({ capture: { id: 9, status: "uploaded", source_type: "receipt", review_version: 0, review_values: {} } }) };
    });
    await pickFile();
    await click(action("upload"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");

    const firstKey = writes()[0].headers["Idempotency-Key"];
    await click(action("retry-upload"));
    await settle();

    assert.equal(location(), "/m/captures/receipts/9");
    assert.equal(writes().length, 2);
    assert.equal(writes()[1].headers["Idempotency-Key"], firstKey, "the exact same key, never a fresh one");
  });

  it("a generic 409 (the key still processing, or reused with a different file) is the same unknown outcome, never treated as a success", async () => {
    gate.setWriteApprovalsForTests(["receipt.upload"]);
    await openReceipt(() => ({ status: 409, body: { status: false, message: "This operation is currently being processed." } }));
    await pickFile();
    await click(action("upload"));
    await settle();

    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.notEqual(location(), "/m/captures/receipts/9");
  });

  it("choosing a different file after an ambiguous answer mints a fresh key, never the stale one", async () => {
    gate.setWriteApprovalsForTests(["receipt.upload"]);
    await openReceipt(() => ({ status: 503, body: { status: false, message: "SmartSpend had a problem." } }));
    await pickFile(2048, "first.png");
    await click(action("upload"));
    await settle();
    const firstKey = writes()[0].headers["Idempotency-Key"];

    await pickFile(2048, "second.png");
    await click(action("upload"));
    await settle();

    assert.equal(writes().length, 2);
    assert.notEqual(writes()[1].headers["Idempotency-Key"], firstKey);
  });

  it("cancelling an in-flight upload aborts it and returns to idle, with nothing shown and the file still there to try again", async () => {
    gate.setWriteApprovalsForTests(["receipt.upload"]);
    await openReceipt(() => new Promise(() => {}));
    await pickFile();
    await click(action("upload"));
    await settle();

    assert.ok(action("cancel-upload"));
    await click(action("cancel-upload"));
    await settle();

    assert.equal(q("[data-sm-outcome]"), null);
    assert.equal(action("upload").disabled, false);
    assert.ok(q("[data-sm-file='chosen']"), "the chosen file is kept");
  });
});

describe("voice upload: gate opened for the test only", () => {
  it("uploads the recorded WAV once and goes straight to the capture's review page, never a confirm", async () => {
    gate.setWriteApprovalsForTests(["voice.upload"]);
    const recorder = await openVoice(() => ({ status: 201, body: envelope({ capture: { id: 9, status: "uploaded", source_type: "voice", review_version: 0, review_values: {} } }) }));

    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    assert.ok(q("[data-sm-clip='recorded']"));
    const recordedBlob = recorder.getSnapshot().result.blob;

    await click(action("upload"));
    await settle();

    assert.deepEqual(writes().map((call) => call.path), ["/ai/voice-expense-captures"]);
    assert.equal(location(), "/m/captures/voice/9");
    const [upload] = writes();
    const sent = upload.body.get("file");
    assert.equal(sent.size, recordedBlob.size);
    assert.equal(sent.type, recordedBlob.type);
    assert.match(upload.headers["Idempotency-Key"], /^mobile-voice-upload-/);
  });

  it("an unsupported browser never asks to upload: the recorder reports it before anything is sent", async () => {
    gate.setWriteApprovalsForTests(["voice.upload"]);
    const recorder = fakeRecorder();
    recorder.failNextStart("VOICE_UNSUPPORTED");
    await openVoice(() => failure(500, "must not be called"), { recorder });
    await click(action("record"));
    await settle();
    assert.equal(q("[data-sm-status]").dataset.smStatus, "VOICE_UNSUPPORTED");
    assert.equal(writes().length, 0);
  });

  it("a recording rejected as too short can be re-recorded and then uploaded", async () => {
    gate.setWriteApprovalsForTests(["voice.upload"]);
    const recorder = await openVoice(() => ({ status: 201, body: envelope({ capture: { id: 9, status: "uploaded", source_type: "voice", review_version: 0, review_values: {} } }) }));

    recorder.failNextStop("VOICE_TOO_SHORT");
    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    assert.equal(q("[data-sm-status]").dataset.smStatus, "VOICE_TOO_SHORT");
    assert.equal(q("[data-sm-clip='recorded']"), null);

    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    assert.ok(q("[data-sm-clip='recorded']"));

    await click(action("upload"));
    await settle();
    assert.equal(location(), "/m/captures/voice/9");
  });

  it("an ambiguous answer keeps the SAME key; Try again resends the SAME recording", async () => {
    gate.setWriteApprovalsForTests(["voice.upload"]);
    let attempt = 0;
    const recorder = await openVoice(() => {
      attempt += 1;
      if (attempt === 1) return { status: 503, body: { status: false, message: "SmartSpend had a problem." } };
      return { status: 201, body: envelope({ capture: { id: 9, status: "uploaded", source_type: "voice", review_version: 0, review_values: {} } }) };
    });

    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    await click(action("upload"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");

    const firstKey = writes()[0].headers["Idempotency-Key"];
    await click(action("retry-upload"));
    await settle();

    assert.equal(location(), "/m/captures/voice/9");
    assert.equal(writes().length, 2);
    assert.equal(writes()[1].headers["Idempotency-Key"], firstKey);
  });

  it("discarding the recording after an ambiguous answer clears it: nothing can be resent", async () => {
    gate.setWriteApprovalsForTests(["voice.upload"]);
    const recorder = await openVoice(() => ({ status: 503, body: { status: false, message: "SmartSpend had a problem." } }));

    await click(action("record"));
    await settle();
    await act(async () => recorder.stop());
    await settle();
    await click(action("upload"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");

    await click(action("discard-recording"));
    await click(action("confirm-discard"));
    assert.equal(q("[data-sm-clip='recorded']"), null);
    assert.equal(action("retry-upload"), null);
  });
});
