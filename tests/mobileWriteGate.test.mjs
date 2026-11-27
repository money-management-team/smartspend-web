import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformWithOxc } from "vite";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { CATEGORY_WRITES, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, storeSession } from "./helpers/mobileHarness.mjs";
import { categoriesBackend, category } from "./helpers/categoryFixture.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const writeApi = await import("../src/mobile/data/writeApi.js");
const { classifyOutcome } = await import("../src/mobile/models/categoryForm.js");
const { WORKFLOWS } = await import("../src/mobile/forms/workflows.js");

/*
 * The write gate, in the state the product ships in: every write closed. Nothing
 * Mobile shows can send one, the facade refuses before any request, and the gate
 * has no switch outside its source.
 */

after(() => dom.window.close());

let api;
let view;
const rows = () => [category(1, { name: "Groceries" }), category(2, { name: "Salary", type: "income" }), category(10, { name: "Food", is_system: true, workspace_id: null })];
const open = async (entry) => {
  api = installFakeApi(categoriesBackend(rows()));
  view = await mountMobile({ entry });
};

beforeEach(async () => {
  gate.setWriteApprovalsForTests(null);
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
});

describe("the gate", () => {
  it("knows every write Mobile has code for, and has all of them closed", () => {
    const formWrites = Object.values(WORKFLOWS).map((workflow) => workflow.operation);
    // receipt.upload / voice.upload have no forms/workflows.js entry: assist/MobileReceiptNew.jsx and
    // MobileVoiceNew.jsx send them directly (assist/useCaptureUpload.js), never through DraftForm's review step.
    // notifications.markRead / markAllRead are one tap each on the notifications screen (notifications/useNotificationWrite.js).
    // installment.postpone is the Smart Savings installment review (planning/smart/InstallmentReview.jsx via data/writePlanApi.js).
    assert.deepEqual(Object.keys(gate.MOBILE_WRITES).sort(), ["category.create", "category.update", "receipt.upload", "voice.upload", "notifications.markRead", "notifications.markAllRead", "notifications.preferences", "ai.message", "ai.messageFeedback", "ai.insightFeedback", "ai.insightsRefresh", "ai.insightDismiss", "auth.forgotPassword", "auth.resetPassword", "email.resend", "installment.postpone", ...formWrites].sort());
    const DEDUP = ["unique-index", "key-atomic", "key-fix-pending", "once-only", "same-result", "next-open", "duplicates", "unverified"];
    for (const [operation, write] of Object.entries(gate.MOBILE_WRITES)) {
      assert.equal(gate.isWriteOpen(operation), false, operation);
      assert.ok(DEDUP.includes(write.serverDedup), operation);
      assert.ok(["client", "derived", "none"].includes(write.key), operation);
      // A write that moves money is never registered as "nothing stops a copy".
      if (write.moves) assert.notEqual(write.serverDedup, "duplicates", operation);
    }
    assert.equal(gate.isWriteOpen("transaction.unknown"), false, "an unknown write is closed");
    assert.equal(gate.isWriteOpen("toString"), false);
  });

  it("has no switch outside its source: no environment, storage, address or global is read", () => {
    const source = readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.match(source, /const APPROVED = Object\.freeze\(\[\]\);/, "APPROVED is empty: opening a write is a visible change to this line");
    // The one build constant it may read: whether this is the test runner (see the test-switch tests below).
    const withoutTestMode = source.replace('const TESTING = import.meta.env.MODE === "test";', "");
    assert.equal(source.match(/import\.meta/g).length, 1, "a single import.meta read");
    assert.doesNotMatch(withoutTestMode, /import\.meta|process\.env|localStorage|sessionStorage|location|window|globalThis|document/);
  });

  it("the test switch cannot open an unknown write", () => {
    gate.setWriteApprovalsForTests(["transaction.unknown"]);
    assert.equal(gate.isWriteOpen("transaction.unknown"), false);
    gate.setWriteApprovalsForTests(null);
  });

  /*
   * The test switch exists only under the test runner. The module is compiled here with the build
   * mode a real build reports ("production", "preview", "staging"); there the switch throws and
   * can't open anything.
   */
  for (const mode of ["production", "preview", "staging", "development"]) {
    it(`in a "${mode}" build the test switch throws and every write stays closed`, async () => {
      const file = new URL("../src/mobile/data/writeGate.js", import.meta.url);
      const { code } = await transformWithOxc(readFileSync(file, "utf8"), "writeGate.js", { lang: "js", define: { "import.meta.env": `({ MODE: "${mode}" })` } });
      const built = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
      assert.throws(() => built.setWriteApprovalsForTests(Object.keys(built.MOBILE_WRITES)), /SMARTSPEND_TEST_ONLY_WRITE_GATE/);
      assert.throws(() => built.setWriteApprovalsForTests(null), /SMARTSPEND_TEST_ONLY_WRITE_GATE/);
      for (const operation of Object.keys(built.MOBILE_WRITES)) assert.equal(built.isWriteOpen(operation), false, operation);
      assert.throws(() => built.assertWriteOpen("transaction.expense"), { code: "WRITE_CLOSED" });
    });
  }

  it("under the test runner the switch works, and going back to null closes everything again", () => {
    gate.setWriteApprovalsForTests(["category.create"]);
    assert.equal(gate.isWriteOpen("category.create"), true);
    assert.equal(gate.isWriteOpen("category.update"), false);
    gate.setWriteApprovalsForTests(null);
    assert.equal(gate.isWriteOpen("category.create"), false);
  });
});

/*
 * What the backend source shows about a duplicate of each write (data/writeGate.js header,
 * docs/mobile/WRITE-INTEGRATION.md "Backend status per write"). A change here is a change to a
 * safety claim: it must come with its backend evidence.
 */
const EXPECTED_DEDUP = {
  "category.create": "unique-index",
  "category.update": "unique-index",
  "category.archive": "once-only",
  // The assistant (docs/mobile/AI-ASSISTANT.md): none moves money. A message is replayed by its client_request_id.
  "ai.conversationCreate": "duplicates",
  "ai.message": "same-result",
  "ai.conversationDelete": "once-only",
  "ai.messageFeedback": "same-result",
  "ai.insightFeedback": "same-result",
  "ai.insightsRefresh": "same-result",
  "ai.insightDismiss": "same-result",
  "ai.settings": "same-result",
  "ai.dataDelete": "same-result",
  "transaction.expense": "key-fix-pending",
  "transaction.income": "key-fix-pending",
  "transaction.correct": "key-fix-pending",
  "transaction.reverse": "once-only",
  "transfer.create": "key-atomic",
  "transfer.reverse": "once-only",
  "goal.contribution": "key-atomic",
  "goal.withdrawal": "key-atomic",
  "debt.payment": "key-fix-pending",
  "debt.paymentReverse": "once-only",
  "recurring.confirmNext": "next-open",
  "receipt.confirm": "key-atomic",
  "voice.confirm": "key-atomic",
  "receipt.upload": "key-atomic",
  "voice.upload": "key-atomic",
  "whatsapp.confirm": "key-atomic",
  "account.create": "unique-index",
  "account.update": "same-result",
  "account.archive": "once-only",
  "budget.create": "unique-index",
  "budget.update": "same-result",
  "goal.create": "key-fix-pending",
  "goal.update": "same-result",
  "goal.plannedContribution": "duplicates",
  // Smart Savings (data/writePlanApi.js): both versions are checked under row locks and an applied postpone bumps lock_version, so a copy is a 409.
  "installment.postpone": "once-only",
  "recurring.create": "key-fix-pending",
  "recurring.update": "same-result",
  "recurring.skipNext": "next-open",
  "debt.create": "key-fix-pending",
  "debt.update": "same-result",
  "profile.update": "same-result",
  "profile.password": "unverified",
  // Account recovery (docs/mobile/AUTH-RECOVERY.md): a copy only sends one more email; the reset token is single use.
  "auth.forgotPassword": "same-result",
  "auth.resetPassword": "once-only",
  "email.resend": "same-result",
  "export.create": "duplicates",
  "notifications.markRead": "same-result",
  "notifications.markAllRead": "same-result",
  "notifications.preferences": "same-result",
};

const NEXT_OPEN = ["recurring.confirmNext", "recurring.skipNext"];
const GATE_FILE = new URL("../src/mobile/data/writeGate.js", import.meta.url);
const EMPTY_APPROVED = "const APPROVED = Object.freeze([]);";

/** The shipped gate compiled as a real build would compile it, with APPROVED replaced by `approved`. */
async function buildGateWith(approved, mode = "production") {
  const source = readFileSync(GATE_FILE, "utf8");
  assert.ok(source.includes(EMPTY_APPROVED), "the shipped APPROVED line is present");
  const changed = source.replace(EMPTY_APPROVED, `const APPROVED = Object.freeze(${JSON.stringify(approved)});`);
  const { code } = await transformWithOxc(changed, "writeGate.js", { lang: "js", define: { "import.meta.env": `({ MODE: "${mode}" })` } });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

describe("the safety classification", () => {
  it("records what the backend shows for every write", () => {
    const actual = Object.fromEntries(Object.entries(gate.MOBILE_WRITES).map(([operation, write]) => [operation, write.serverDedup]));
    assert.deepEqual(actual, EXPECTED_DEDUP);
  });

  it("classes recurring confirm-next and skip-next as next-open, and next-open as never approvable", () => {
    assert.deepEqual(gate.NEVER_APPROVABLE, ["next-open"]);
    assert.ok(Object.isFrozen(gate.NEVER_APPROVABLE));
    const nextOpen = Object.entries(gate.MOBILE_WRITES).filter(([, write]) => write.serverDedup === "next-open").map(([operation]) => operation);
    assert.deepEqual(nextOpen.sort(), [...NEXT_OPEN].sort());
    assert.equal(gate.MOBILE_WRITES["recurring.confirmNext"].moves, true, "confirm-next moves money");
  });

  it("the shipped APPROVED names no never-approvable write", () => {
    const source = readFileSync(GATE_FILE, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const literal = source.match(/const APPROVED = Object\.freeze\(\[([^\]]*)\]\);/);
    assert.ok(literal, "APPROVED is a literal list");
    const approved = [...literal[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
    for (const operation of approved) {
      assert.ok(!gate.NEVER_APPROVABLE.includes(gate.MOBILE_WRITES[operation]?.serverDedup), `${operation} is never approvable and must not be in APPROVED`);
    }
  });

  it("a next-open write listed in APPROVED stays closed in a real build, while an ordinary one opens", async () => {
    const built = await buildGateWith([...NEXT_OPEN, "category.create"]);
    assert.equal(built.isWriteOpen("category.create"), true, "the replaced APPROVED took effect");
    for (const operation of NEXT_OPEN) {
      assert.equal(built.isWriteOpen(operation), false, operation);
      assert.throws(() => built.assertWriteOpen(operation), { code: "WRITE_CLOSED" });
    }
  });

  it("the test switch can't open a next-open write either, and nothing is sent", () => {
    api = installFakeApi(() => ({ body: { status: true, data: {} } }));
    gate.setWriteApprovalsForTests([...NEXT_OPEN, "category.create"]);
    assert.equal(gate.isWriteOpen("category.create"), true);
    for (const operation of NEXT_OPEN) {
      assert.equal(gate.isWriteOpen(operation), false, operation);
      assert.throws(() => writeApi.sendWorkflowWrite({ operation, ids: { ruleId: "5" }, input: {} }), (error) => error.name === "WriteClosedError" && error.operation === operation);
    }
    gate.setWriteApprovalsForTests(null);
    assert.deepEqual(api.calls, []);
  });

  it("account and budget creates are unique-index, not keyed, and closed", () => {
    for (const operation of ["account.create", "budget.create"]) {
      assert.equal(gate.MOBILE_WRITES[operation].serverDedup, "unique-index", operation);
      assert.equal(gate.MOBILE_WRITES[operation].key, "none", `${operation} takes no Idempotency-Key: a copy is refused, not replayed`);
      assert.equal(gate.isWriteOpen(operation), false, operation);
    }
  });
});

describe("the facade", () => {
  it("refuses before sending: no request is made at all", async () => {
    api = installFakeApi(() => ({ body: { status: true, data: {} } }), { allowWrites: CATEGORY_WRITES });
    assert.throws(() => writeApi.sendCategoryCreate({ workspace_id: 1, name: "Rent", type: "expense" }), (error) => error.name === "WriteClosedError" && error.code === "WRITE_CLOSED");
    assert.throws(() => writeApi.sendCategoryUpdate("1", { name: "Rent" }), (error) => error.name === "WriteClosedError");
    assert.deepEqual(api.calls, []);
  });

  it("a refusal by the gate is classed as certainly not applied, not as unknown", () => {
    const outcome = classifyOutcome(new gate.WriteClosedError("category.create"), "create");
    assert.equal(outcome.kind, "rejected");
    assert.equal(outcome.code, "WRITE_CLOSED");
  });
});

describe("the screens", () => {
  it("the category list offers no way to add one, says why, and points to the full version", async () => {
    await open("/m/planning/categories");
    assert.equal(q("[data-sm-action='new-category']"), null);
    const note = q("[data-sm-note='write-closed']");
    assert.ok(note);
    assert.equal(note.dataset.smWrite, "category.create");
    assert.ok(qa("a", note).some((link) => link.getAttribute("href") === "/dashboard/categories"));
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });

  it("a custom category's page offers no rename", async () => {
    await open("/m/planning/categories/1");
    assert.equal(q("[data-sm-action='edit-category']"), null);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "category.update");
  });

  it("the new-category address shows the notice and no form", async () => {
    await open("/m/planning/categories/new");
    assert.equal(q("form"), null);
    assert.equal(q("input"), null);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "category.create");
    assert.deepEqual(api.calls, []);
  });

  it("the rename address shows the notice, no form, and reads nothing", async () => {
    await open("/m/planning/categories/1/edit");
    assert.equal(q("form"), null);
    assert.equal(q("[data-sm-screen='category-edit']").dataset.smState, "closed");
    assert.ok(qa("a", q("[data-sm-note='write-closed']")).some((link) => link.getAttribute("href") === "/dashboard/categories/1"));
    assert.deepEqual(api.calls, []);
  });
});
