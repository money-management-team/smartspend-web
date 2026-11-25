import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click } from "./helpers/dom.mjs";
import { CATEGORY_WRITES, FORM_WRITES, envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const { sendWorkflowWrite } = await import("../src/mobile/data/writeApi.js");
const { sendCategoryCreate, sendCategoryUpdate } = await import("../src/mobile/data/writeApi.js");
const { classifyWriteOutcome } = await import("../src/mobile/forms/useWorkflowSubmit.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
const { CATEGORY_COLORS, CATEGORY_ICONS, buildCreatePayload, buildUpdatePayload, classifyOutcome, confirmArchive, confirmCreate, confirmUpdate } = await import("../src/mobile/models/categoryForm.js");
const { eligibleToArchiveCategory } = await import("../src/mobile/forms/workflows.js");

/*
 * Phase 2E: category management from Mobile. The backend has exactly three category writes (CategoryController, the three actions
 * and the requests are identical on develop @ fd87531 and 6b696d72): create (POST /categories), update (PUT|PATCH /categories/{id})
 * and archive (POST /categories/{id}/archive, DELETE is its alias). There is NO restore, GET /categories lists ACTIVE ones only,
 * and no write takes a parent (CreateCategoryAction sets parent_id null).
 *
 *   create   refused as a duplicate (422 on `name`) when the workspace already has that name for that type, case and spacing
 *            ignored, ARCHIVED ones included (the unique index has no is_active): never a replay of the first
 *   update   name, colour, icon (and a type, refused once any transaction uses the category); a system, archived or another
 *            workspace's category is refused
 *   archive  refused for a system category and an already archived one; it only sets is_active false: transactions and budgets
 *            keep the category and it stays readable
 *
 * All three are CLOSED in the product (APPROVED is empty). These tests open them only through the test runner's switch.
 */

after(() => dom.window.close());

const OPS = ["category.create", "category.update", "category.archive"];
let api;
let view;
let server;

const action = (name) => q(`[data-sm-action='${name}']`);
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (node) => node.textContent.replace(/\s+/g, " ");
const nameInput = () => q("main input[type='text']");
const refuse = (message, status = 422, errors = {}) => ({ status, body: { status: false, message, errors } });
const norm = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();

/* A backend that answers the way CategoryController and its three actions do. */
function categoryServer({ onWrite, afterApply } = {}) {
  const base = (over) => ({ workspace_id: 1, parent_id: null, slug: "x", icon: null, color: null, is_system: false, is_active: true, sort_order: 0, created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", ...over });
  const rows = [
    base({ id: 1, name: "Groceries", type: "expense", color: "#10B981", icon: "utensils" }),
    base({ id: 2, name: "Salary", type: "income" }),
    base({ id: 3, name: "Food & drink", type: "expense", workspace_id: null, is_system: true }),
    base({ id: 4, name: "Old", type: "expense", is_active: false }),
    base({ id: 5, name: "Not mine", type: "expense", workspace_id: 77 }),
  ];
  const usedByTransactions = new Set([1]);
  const log = { created: 0, updated: 0, archived: 0 };
  let nextId = 30;
  const find = (id) => rows.find((row) => row.id === Number(id));
  const visible = (row) => row && row.workspace_id !== 77;
  const duplicate = (name, type, except) => rows.some((row) => row.id !== except && row.workspace_id === 1 && row.type === type && norm(row.name) === norm(name));
  const dupeError = () => refuse("The provided data is invalid.", 422, { name: ["A category with this name and type already exists in this workspace."] });

  const create = (call) => {
    const body = call.body ?? {};
    const errors = {};
    if (typeof body.name !== "string" || !body.name.trim()) errors.name = ["The name field is required."];
    if (!["income", "expense"].includes(body.type)) errors.type = ["The selected type is invalid."];
    if (body.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) errors.color = ["The color field format is invalid."];
    if (Object.keys(errors).length > 0) return refuse("The provided data is invalid.", 422, errors);
    if (duplicate(body.name, body.type)) return dupeError();
    const row = base({ id: ++nextId, name: body.name.trim(), type: body.type, color: body.color ?? null, icon: body.icon ?? null });
    rows.push(row);
    log.created += 1;
    return { status: 201, body: envelope({ category: row }) };
  };

  const update = (call) => {
    const row = find(call.path.split("/")[2]);
    const body = call.body ?? {};
    if (!visible(row)) return refuse("Not found", 404);
    if (row.is_system) return refuse("The provided data is invalid.", 422, { category: ["System categories cannot be modified."] });
    if (!row.is_active) return refuse("The provided data is invalid.", 422, { category: ["Archived categories cannot be modified."] });
    const targetName = body.name ?? row.name;
    const targetType = body.type ?? row.type;
    if (duplicate(targetName, targetType, row.id)) return dupeError();
    if (Object.hasOwn(body, "type") && body.type !== row.type && usedByTransactions.has(row.id)) return refuse("The provided data is invalid.", 422, { type: ["Category type cannot be changed after it has been used in financial transactions."] });
    for (const key of ["name", "type", "color", "icon"]) if (Object.hasOwn(body, key)) row[key] = body[key];
    log.updated += 1;
    return { status: 200, body: envelope({ category: row }) };
  };

  const archive = (call) => {
    const row = find(call.path.split("/")[2]);
    if (!visible(row)) return refuse("Not found", 404);
    if (row.is_system) return refuse("The provided data is invalid.", 422, { category: ["System categories cannot be archived."] });
    if (!row.is_active) return refuse("The provided data is invalid.", 422, { category: ["This category is already archived."] });
    row.is_active = false;
    log.archived += 1;
    return { status: 200, body: envelope({ category: row }) };
  };

  const handler = (call) => {
    if (call.method === "GET") {
      if (call.path === "/categories") {
        const type = call.query.type;
        return { body: envelope({ categories: rows.filter((row) => row.is_active && (row.workspace_id === null || row.workspace_id === 1) && (!type || row.type === type)) }) };
      }
      const one = /^\/categories\/(\d+)$/.exec(call.path);
      if (one) return visible(find(one[1])) ? { body: envelope({ category: find(one[1]) }) } : refuse("Not found", 404);
      return refuse("Not found", 404);
    }
    const write = call.method === "POST" && call.path === "/categories" ? create : call.method === "PATCH" ? update : /\/archive$/.test(call.path) ? archive : null;
    if (!write) return refuse("Not found", 404);
    if (onWrite) return onWrite(call, () => write(call));
    const answer = write(call);
    return afterApply ? afterApply(answer, call) : answer;
  };
  return { handler, rows, log, find };
}

async function open(entry, serverOptions = {}, { approve = OPS, language } = {}) {
  if (language) {
    await resetEnvironment(language);
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
  }
  server = serverOptions.server ?? categoryServer(serverOptions);
  api?.restore();
  api = installFakeApi(server.handler, { allowWrites: [...CATEGORY_WRITES, FORM_WRITES.categoryArchive] });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry });
}

const reload = async (entry) => {
  await view.unmount();
  const shared = server;
  view = await mountMobile({ entry });
  server = shared;
};

const sendForm = async () => {
  await click(action("submit"));
  if (action("confirm")) await click(action("confirm"));
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
  it("create is unique-index (no replay), update is unchanged, archive is once-only; none moves money; all closed", () => {
    assert.deepEqual({ ...gate.MOBILE_WRITES["category.create"] }, { endpoint: "POST /categories", moves: false, key: "none", serverDedup: "unique-index" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["category.update"] }, { endpoint: "PATCH /categories/{id}", moves: false, key: "none", serverDedup: "unique-index" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["category.archive"] }, { endpoint: "POST /categories/{id}/archive", moves: false, key: "none", serverDedup: "once-only" });
    for (const operation of OPS) assert.equal(gate.isWriteOpen(operation), false);
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("there is no restore operation, because the backend has none", () => {
    assert.deepEqual(Object.keys(gate.MOBILE_WRITES).filter((name) => name.startsWith("category.")).sort(), ["category.archive", "category.create", "category.update"]);
  });

  it("the senders refuse without a request while closed", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: [...CATEGORY_WRITES, FORM_WRITES.categoryArchive] });
    assert.throws(() => sendCategoryCreate({ workspace_id: 1, name: "x", type: "expense" }), (error) => error.name === "WriteClosedError");
    assert.throws(() => sendCategoryUpdate("1", { name: "x" }), (error) => error.name === "WriteClosedError");
    assert.throws(() => sendWorkflowWrite({ operation: "category.archive", ids: { categoryId: "1" }, input: {} }), (error) => error.name === "WriteClosedError");
    assert.deepEqual(api.calls, []);
  });
});

describe("gate closed (the product)", () => {
  it("the create and edit pages offer no form and send nothing; the archive form can be reviewed but Confirm is disabled", async () => {
    await open("/m/planning/categories/new", {}, { approve: null });
    assert.ok(q("[data-sm-note='write-closed'], [data-sm-closed], .sm-closed") ?? q("main"));
    assert.equal(nameInput(), null);
    await view.unmount();
    api.restore();

    await open("/m/planning/categories/1/edit", {}, { approve: null });
    assert.equal(nameInput(), null);
    await view.unmount();
    api.restore();

    await open("/m/planning/categories/1/archive", {}, { approve: null });
    if (!q("[data-sm-step='review']")) await click(action("review"));
    assert.equal(action("send").disabled, true);
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='category.archive']"));
    await click(action("send"));
    await settle();
    assert.deepEqual(writes(), []);
  });

  it("a category's page offers Archive only for your own, active category", async () => {
    for (const [id, expected] of [[1, "category-archive"], [3, null], [4, null]]) {
      api?.restore();
      server = categoryServer();
      api = installFakeApi(server.handler);
      gate.setWriteApprovalsForTests(null);
      view = await mountMobile({ entry: `/m/planning/categories/${id}` });
      assert.equal(q("[data-sm-draft-links]")?.dataset.smDraftLinks ?? null, expected, `#${id}`);
      await view.unmount();
      view = null;
    }
  });
});

describe("expense and income categories are kept apart", () => {
  it("the list says which is which, with a heading for each type, and the type filter is the backend's", async () => {
    server = categoryServer();
    api = installFakeApi(server.handler);
    view = await mountMobile({ entry: "/m/planning/categories" });
    const custom = q("[data-sm-section='sm-cat-custom']");
    assert.equal(qa("[data-sm-type-group]", custom).map((node) => node.dataset.smTypeGroup).join(), "expense,income");
    assert.match(text(q("[data-sm-category='1']")), /Expense/);
    assert.match(text(q("[data-sm-category='2']")), /Income/);
    assert.equal(q("[data-sm-category='4']"), null, "an archived category is not listed: the backend lists active ones only");
    await view.unmount();
    api.restore();
    server = categoryServer();
    api = installFakeApi(server.handler);
    view = await mountMobile({ entry: "/m/planning/categories?type=income" });
    assert.ok(api.calls.some((call) => call.path === "/categories" && call.query.type === "income"));
    assert.ok(q("[data-sm-category='2']"));
    assert.equal(q("[data-sm-category='1']"), null);
  });
});

describe("a new category", () => {
  it("offers a colour and an icon (optional), no parent, and reviews before anything is sent", async () => {
    await open("/m/planning/categories/new");
    assert.equal(qa("main [data-sm-field='color'] input[type='radio']").length, CATEGORY_COLORS.length + 1);
    assert.equal(qa("main [data-sm-field='icon'] option").length, CATEGORY_ICONS.length + 1);
    assert.equal(q("main [name*='parent'], main [data-sm-field='parent']"), null);
    await change(nameInput(), "  Pets ");
    await click(q("main input[value='expense']"));
    await click(q("main [data-sm-field='color'] input[value='#8B5CF6']"));
    await change(q("main [data-sm-field='icon'] select"), "gift");
    await click(action("submit"));
    const review = q("[data-sm-step='review']");
    assert.match(text(review), /Pets/);
    assert.match(text(review), /Expense/);
    assert.match(text(review), /#8B5CF6/);
    assert.match(text(review), /gift/);
    assert.match(text(q("[data-sm-effect='categoryCreateEffect']")), /archived category keeps its name/);
    assert.deepEqual(writes(), [], "nothing is sent by the form itself");

    await click(action("confirm"));
    await settle();
    assert.equal(writes().length, 1);
    assert.deepEqual(writes()[0].body, { workspace_id: 1, name: "Pets", type: "expense", color: "#8B5CF6", icon: "gift" });
    assert.equal(Object.hasOwn(writes()[0].headers, "Idempotency-Key"), false);
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "confirmed");
    assert.match(text(q("[data-sm-outcome]")), /Pets/);
    assert.equal(server.log.created, 1);
  });

  it("without a colour or an icon the payload is the same three fields as before; Back to edit returns with the draft", async () => {
    await open("/m/planning/categories/new");
    await change(nameInput(), "Rent");
    await click(q("main input[value='income']"));
    await click(action("submit"));
    await click(action("edit"));
    assert.equal(nameInput().value, "Rent");
    await sendForm();
    await settle();
    assert.deepEqual(writes()[0].body, { workspace_id: 1, name: "Rent", type: "income" });
  });

  it("a colour or icon the server doesn't echo back is not 'created': an unknown outcome", async () => {
    await open("/m/planning/categories/new", { afterApply: (answer) => ({ status: 201, body: envelope({ category: { ...answer.body.data.category, color: "#3366FF" } }) }) });
    await change(nameInput(), "Pets");
    await click(q("main input[value='expense']"));
    await click(q("main [data-sm-field='color'] input[value='#8B5CF6']"));
    await sendForm();
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
  });

  it("duplicate names: the same name and type is refused whatever its case or spacing, archived ones included; another type is fine", async () => {
    await open("/m/planning/categories/new");
    for (const [name, type, refused] of [["  groceries ", "expense", true], ["Old", "expense", true], ["Groceries", "income", false]]) {
      const before = writes().length;
      await change(nameInput(), name);
      await click(q(`main input[value='${type}']`));
      await sendForm();
      await settle();
      assert.equal(writes().length, before + 1);
      if (refused) {
        assert.equal(q("[data-sm-summary^='rejected']")?.dataset.smSummary, "rejected:VALIDATION_ERROR", name);
        assert.match(text(q("[data-sm-summary^='rejected']")), /already exists in this workspace/);
        await change(nameInput(), "");
      } else {
        assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "confirmed");
      }
    }
    assert.equal(server.log.created, 1);
  });

  it("a double tap on Confirm sends one request; a lost answer is unknown and sends nothing more; a retry after a reload is refused as a duplicate (no replay)", async () => {
    let release;
    await open("/m/planning/categories/new", { onWrite: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await change(nameInput(), "Pets");
    await click(q("main input[value='expense']"));
    await click(action("submit"));
    await act(async () => {
      action("confirm").click();
      action("confirm")?.click();
    });
    assert.equal(writes().length, 1);
    await act(async () => release());
    await settle();
    assert.equal(server.log.created, 1);
    await view.unmount();
    api.restore();

    let first = true;
    await open("/m/planning/categories/new", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await change(nameInput(), "Gifts");
    await click(q("main input[value='expense']"));
    await sendForm();
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(action("submit"), null);
    assert.equal(writes().length, 1);
    await reload("/m/planning/categories/new");
    await change(nameInput(), "Gifts");
    await click(q("main input[value='expense']"));
    await sendForm();
    await settle();
    assert.equal(q("[data-sm-summary^='rejected']").dataset.smSummary, "rejected:VALIDATION_ERROR", "a copy is refused, never answered with the first category");
    assert.equal(server.rows.filter((row) => row.name === "Gifts").length, 1);
  });

  it("invalid payloads never reach review or the server", async () => {
    await open("/m/planning/categories/new");
    await click(action("submit"));
    assert.equal(q("[data-sm-step='review']"), null);
    await change(nameInput(), "x".repeat(256));
    await click(q("main input[value='expense']"));
    await click(action("submit"));
    assert.equal(q("[data-sm-step='review']"), null);
    assert.deepEqual(writes(), []);
  });

  it("speaks Arabic", async () => {
    await open("/m/planning/categories/new", {}, { language: "ar" });
    await change(nameInput(), "حيوانات");
    await click(q("main input[value='expense']"));
    await click(action("submit"));
    assert.match(text(q("[data-sm-step='review']")), /راجع الفئة الجديدة/);
    await click(action("confirm"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "confirmed");
  });
});

describe("editing a category", () => {
  it("starts from the category (name, colour, icon), locks the type, and reviews what each change was", async () => {
    await open("/m/planning/categories/1/edit");
    assert.equal(nameInput().value, "Groceries");
    assert.equal(q("main [data-sm-field='color'] input:checked").value, "#10B981");
    assert.equal(q("main [data-sm-field='icon'] select").value, "utensils");
    assert.ok(q("[data-sm-locked='type']"));
    assert.equal(q("main input[value='income']"), null, "the type is not editable");

    await change(nameInput(), "Food shopping");
    await click(q("main [data-sm-field='color'] input[value='#EF4444']"));
    await change(q("main [data-sm-field='icon'] select"), "");
    await click(action("submit"));
    const review = q("[data-sm-step='review']");
    assert.match(text(q("[data-sm-was='name']", review)), /Was:.*Groceries/);
    assert.match(text(q("[data-sm-was='color']", review)), /Was:.*#10B981/);
    assert.match(text(q("[data-sm-was='icon']", review)), /Was:.*utensils/);
    assert.match(text(q("[data-sm-effect='categoryEditEffect']")), /keep it and show its new name/);
    assert.deepEqual(writes(), []);

    await click(action("confirm"));
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].method, "PATCH");
    assert.equal(writes()[0].path, "/categories/1");
    assert.deepEqual(writes()[0].body, { name: "Food shopping", color: "#EF4444", icon: null });
    assert.equal(Object.hasOwn(writes()[0].body, "type"), false, "the type is never sent");
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "confirmed");
    assert.match(text(q("[data-sm-outcome]")), /Food shopping/);
  });

  it("sends only what changed: a colour alone is { color }; no change opens no review", async () => {
    await open("/m/planning/categories/1/edit");
    assert.equal(action("submit").disabled, true);
    await click(q("main [data-sm-field='color'] input[value='#3366FF']"));
    await sendForm();
    await settle();
    assert.deepEqual(writes()[0].body, { color: "#3366FF" });
  });

  it("a duplicate name (an archived category's included) is refused with a 422 and the draft stays; the server's other refusals are certain too", async () => {
    await open("/m/planning/categories/1/edit");
    await change(nameInput(), " old ");
    await sendForm();
    await settle();
    assert.equal(q("[data-sm-summary^='rejected']").dataset.smSummary, "rejected:VALIDATION_ERROR");
    assert.match(text(q("[data-sm-summary^='rejected']")), /already exists in this workspace/);
    assert.equal(nameInput().value, " old ", "the draft stays");
    assert.equal(server.find(1).name, "Groceries");
    await view.unmount();
    api.restore();

    server = categoryServer();
    api = installFakeApi(server.handler, { allowWrites: [...CATEGORY_WRITES, FORM_WRITES.categoryArchive] });
    gate.setWriteApprovalsForTests(OPS);
    // The type of a category that transactions use can't change: refused with the server's words, nothing changes.
    const direct = await sendCategoryUpdate("1", { type: "income" }).then(() => null, (failure) => failure);
    assert.equal(direct.status, 422);
    assert.match(direct.errors.type[0], /cannot be changed after it has been used in financial transactions/);
    assert.equal(classifyOutcome(direct, "update").kind, "rejected");
    assert.equal(server.find(1).type, "expense");
    const system = await sendCategoryUpdate("3", { name: "x" }).then(() => null, (failure) => failure);
    assert.match(system.errors.category[0], /System categories cannot be modified/);
    const archived = await sendCategoryUpdate("4", { name: "x" }).then(() => null, (failure) => failure);
    assert.match(archived.errors.category[0], /Archived categories cannot be modified/);
  });

  it("a system, an archived or another workspace's category has no edit form", async () => {
    for (const id of [3, 4, 5]) {
      await open(`/m/planning/categories/${id}/edit`);
      assert.equal(nameInput(), null, `#${id}`);
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
  });

  it("with an unknown outcome nothing is claimed or resent", async () => {
    await open("/m/planning/categories/1/edit", { afterApply: () => new TypeError("Failed to fetch") });
    await change(nameInput(), "Food shopping");
    await sendForm();
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(writes().length, 1);
    assert.equal(action("submit"), null);
  });
});

describe("archiving a category", () => {
  const reviewIt = async () => {
    if (!q("[data-sm-step='review']")) await click(action("review"));
  };

  it("says what archiving means before asking: history stays, no restore, the name stays taken", async () => {
    await open("/m/planning/categories/1/archive");
    assert.match(text(q("[data-sm-summary='record']")), /Groceries/);
    assert.match(text(q("[data-sm-summary='record']")), /Expense/);
    await reviewIt();
    const effect = text(q("[data-sm-effect='categoryArchiveEffect']"));
    assert.match(effect, /keep it/);
    assert.match(effect, /name stays taken/);
    assert.match(effect, /can't restore/);
  });

  it("sends a POST with no body and no key, then shows the archived category as the server answered, and the list no longer has it", async () => {
    await open("/m/planning/categories/1/archive");
    await reviewIt();
    await click(action("send"));
    await settle();
    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.method, "POST");
    assert.equal(call.path, "/categories/1/archive");
    assert.equal(Object.hasOwn(call.headers, "Idempotency-Key"), false);
    const result = q("[data-sm-category-result]");
    assert.equal(result.dataset.smCategoryResult, "1");
    assert.match(text(result), /Category archived/);
    assert.match(text(q("[data-sm-result='name']")), /Groceries/);
    assert.match(text(q("[data-sm-result='status']")), /Archived/);
    assert.equal(action("open-category").getAttribute("href"), "/m/planning/categories/1");
    assert.equal(server.find(1).is_active, false);
    assert.equal(server.find(1).name, "Groceries", "nothing is deleted");

    // The list is read again and no longer shows it; its own page still reads it, as archived.
    await view.unmount();
    api.restore();
    api = installFakeApi(server.handler);
    view = await mountMobile({ entry: "/m/planning/categories" });
    assert.equal(q("[data-sm-category='1']"), null);
    await view.unmount();
    api.restore();
    api = installFakeApi(server.handler);
    view = await mountMobile({ entry: "/m/planning/categories/1" });
    assert.equal(q("[data-sm-note='archived']") !== null, true);
  });

  it("a system, an archived or another workspace's category, and an invalid id, have no archive form", async () => {
    for (const [id, reason] of [[3, "systemCategory"], [4, "categoryArchived"]]) {
      await open(`/m/planning/categories/${id}/archive`);
      assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, reason, `#${id}`);
      await view.unmount();
      api.restore();
    }
    for (const id of ["5", "abc", "0"]) {
      await open(`/m/planning/categories/${id}/archive`);
      assert.equal(q("form.sm-draft-form"), null, id);
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
  });

  it("the server's refusals are certain: 422 (system, already archived), 403, 404; a 409 stays unknown", async () => {
    server = categoryServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.categoryArchive] });
    gate.setWriteApprovalsForTests(OPS);
    for (const [id, message] of [[3, /System categories cannot be archived/], [4, /already archived/]]) {
      const error = await sendWorkflowWrite({ operation: "category.archive", ids: { categoryId: String(id) }, input: {} }).then(() => null, (failure) => failure);
      assert.equal(error.status, 422);
      assert.match(error.errors.category[0], message);
      assert.equal(classifyWriteOutcome(error).kind, "rejected");
    }
    const missing = await sendWorkflowWrite({ operation: "category.archive", ids: { categoryId: "5" }, input: {} }).then(() => null, (failure) => failure);
    assert.equal(classifyWriteOutcome(missing).kind, "rejected");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 403, code: "FORBIDDEN" })).kind, "rejected");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 409, code: "CONFLICT" })).kind, "unknown");
    assert.equal(server.log.archived, 0);
  });

  it("a double tap sends one request; a lost answer is unknown and a reload shows it archived (no second archive); a copy is refused", async () => {
    let release;
    await open("/m/planning/categories/2/archive", { onWrite: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await reviewIt();
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    await act(async () => release());
    await settle();
    assert.equal(server.log.archived, 1);
    await view.unmount();
    api.restore();

    let first = true;
    await open("/m/planning/categories/1/archive", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await reviewIt();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-category-result]"), null, "nothing is claimed");
    assert.equal(server.log.archived, 1);
    await reload("/m/planning/categories/1/archive");
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "categoryArchived");
    const again = await sendWorkflowWrite({ operation: "category.archive", ids: { categoryId: "1" }, input: {} }).then(() => null, (failure) => failure);
    assert.equal(again.status, 422);
    assert.equal(server.log.archived, 1);
  });

  it("a 2xx that isn't provably this category archived is acknowledged generically", async () => {
    for (const body of [{ id: 1, is_active: true, name: "Groceries", type: "expense", is_system: false }, { id: 9, is_active: false, name: "Groceries", type: "expense", is_system: false }]) {
      await open("/m/planning/categories/1/archive", { onWrite: () => ({ status: 200, body: envelope({ category: body }) }) });
      await reviewIt();
      await click(action("send"));
      await settle();
      assert.equal(q("[data-sm-category-result]"), null, JSON.stringify(body));
      assert.match(text(q("[data-sm-outcome]")), /Recorded/);
      await view.unmount();
      api.restore();
      window.localStorage.clear();
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    }
  });

  it("speaks Arabic", async () => {
    await open("/m/planning/categories/1/archive", {}, { language: "ar" });
    await reviewIt();
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-category-result]")), /تمت أرشفة الفئة/);
  });
});

describe("the rules the screens share", () => {
  it("who may archive: yours and active only", () => {
    assert.equal(eligibleToArchiveCategory({ system: false, active: true, manageable: true }), null);
    assert.equal(eligibleToArchiveCategory({ system: true, active: true, manageable: false }), "systemCategory");
    assert.equal(eligibleToArchiveCategory({ system: false, active: false, manageable: false }), "categoryArchived");
    assert.equal(eligibleToArchiveCategory({ system: null, active: true, manageable: false }), "notManageable");
  });

  it("payload builders: colour and icon only when chosen; an edit sends only what changed, a cleared one as null", () => {
    assert.deepEqual(buildCreatePayload({ workspaceId: 1, name: " A ", type: "income", color: "#8b5cf6", icon: "tag" }), { workspace_id: 1, name: "A", type: "income", color: "#8B5CF6", icon: "tag" });
    assert.deepEqual(buildCreatePayload({ workspaceId: 1, name: "A", type: "income" }), { workspace_id: 1, name: "A", type: "income" });
    const original = { name: "A", color: "#10B981", icon: "gift" };
    assert.deepEqual(buildUpdatePayload({ name: " A ", color: "#10b981", icon: "gift" }, original), {});
    assert.deepEqual(buildUpdatePayload({ name: "B", color: "", icon: "gift" }, original), { name: "B", color: null });
    assert.deepEqual(buildUpdatePayload({ name: "A", color: "#10B981", icon: "" }, original), { icon: null });
  });

  it("proofs: a created category carries what was sent; an update, the changed fields; an archive, the same id and inactive", () => {
    const cat = (over = {}) => ({ id: 7, name: "Pets", type: "expense", workspace_id: 1, is_system: false, is_active: true, color: "#8B5CF6", icon: "gift", ...over });
    const sent = { name: "Pets", type: "expense", workspaceId: 1, color: "#8B5CF6", icon: "gift" };
    assert.equal(confirmCreate({ category: cat() }, sent).id, "7");
    assert.equal(confirmCreate({ category: cat({ color: "#3366FF" }) }, sent), null);
    assert.equal(confirmCreate({ category: cat({ icon: null }) }, sent), null);
    assert.equal(confirmUpdate({ category: cat() }, "7", { color: "#8B5CF6" }).id, "7");
    assert.equal(confirmUpdate({ category: cat({ color: null }) }, "7", { color: "#8B5CF6" }), null);
    assert.equal(confirmUpdate({ category: cat({ icon: "gift" }) }, "7", { icon: null }), null, "a cleared icon must come back cleared");
    assert.equal(confirmUpdate({ category: cat({ is_active: false }) }, "7", { name: "Pets" }), null);
    assert.equal(confirmArchive({ category: cat({ is_active: false }) }, "7").active, false);
    assert.equal(confirmArchive({ category: cat() }, "7"), null);
    assert.equal(confirmArchive({ category: cat({ is_active: false, id: 8 }) }, "7"), null);
    assert.equal(confirmArchive({}, "7"), null);
  });
});
