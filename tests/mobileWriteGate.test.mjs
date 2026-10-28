import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { CATEGORY_WRITES, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, storeSession } from "./helpers/mobileHarness.mjs";
import { categoriesBackend, category } from "./helpers/categoryFixture.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const writeApi = await import("../src/mobile/data/writeApi.js");
const { classifyOutcome } = await import("../src/mobile/models/categoryForm.js");

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
    assert.deepEqual(Object.keys(gate.MOBILE_WRITES).sort(), ["category.create", "category.update"]);
    for (const operation of Object.keys(gate.MOBILE_WRITES)) {
      assert.equal(gate.isWriteOpen(operation), false, operation);
      assert.equal(gate.MOBILE_WRITES[operation].serverDedup, "unverified");
    }
    assert.equal(gate.isWriteOpen("transaction.expense"), false, "an unknown write is closed");
    assert.equal(gate.isWriteOpen("toString"), false);
  });

  it("has no switch outside its source: no environment, storage, address or global is read", () => {
    const source = readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.match(source, /const APPROVED = Object\.freeze\(\[\]\);/, "APPROVED is empty: opening a write is a visible change to this line");
    assert.doesNotMatch(source, /import\.meta|process\.env|localStorage|sessionStorage|location|window|globalThis|document/);
  });

  it("the test switch cannot open an unknown write", () => {
    gate.setWriteApprovalsForTests(["transaction.expense"]);
    assert.equal(gate.isWriteOpen("transaction.expense"), false);
    gate.setWriteApprovalsForTests(null);
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
