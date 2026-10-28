import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { arrangeCategories, buildCategoryDetail, buildCategoryList, normalizeCategory, readCategoryFilters } from "../src/mobile/models/categories.js";
import { buildCreatePayload, buildUpdatePayload, classifyOutcome, confirmCreate, confirmUpdate, fieldErrorsOf, validateName, validateType, workspaceIdForBody } from "../src/mobile/models/categoryForm.js";
import { ApiError } from "../src/features/Dashboards/User/api/apiClient.js";
import { IdentityError } from "../src/mobile/identity/guard.js";
import { category } from "./helpers/categoryFixture.mjs";

/* The category models: what they accept, refuse, and claim. Fictional data only. */

const names = (groups) => groups.map((group) => [group.category.name, group.children.map((child) => child.name)]);

describe("a category", () => {
  it("is read field by field, and a bad field is dropped rather than guessed", () => {
    const model = normalizeCategory(category(4, { name: "  Rent  ", icon: "home", color: "#3366FF", parent_id: "2" }));
    assert.deepEqual([model.id, model.name, model.type, model.icon, model.color, model.parentId, model.manageable], ["4", "Rent", "expense", "home", "#3366FF", "2", true]);

    const odd = normalizeCategory(category(5, { icon: "<script>", color: "red", parent_id: "x", type: "transfer" }));
    assert.deepEqual([odd.icon, odd.color, odd.parentId, odd.type, odd.typeKnown], [null, null, null, "transfer", false]);
    assert.equal(normalizeCategory({ name: "no id" }), null);
  });

  it("is changeable only when it says, clearly, that it is not a system category and is active", () => {
    assert.equal(normalizeCategory(category(1)).manageable, true);
    assert.equal(normalizeCategory(category(1, { is_system: true })).manageable, false);
    assert.equal(normalizeCategory(category(1, { is_system: "yes" })).manageable, false, "an unclear flag is not 'custom'");
    assert.equal(normalizeCategory(category(1, { is_system: undefined })).manageable, false);
    assert.equal(normalizeCategory(category(1, { is_active: false })).manageable, false);
    assert.equal(normalizeCategory(category(1, { is_active: "maybe" })).manageable, false);
    assert.equal(normalizeCategory(category(1, { is_system: "0", is_active: 1 })).manageable, true);
  });

  it("a list is refused whole when a row is unusable or an id repeats", () => {
    assert.equal(buildCategoryList({ categories: [category(1), category(2)] }).length, 2);
    for (const bad of [{}, { categories: "x" }, { categories: [category(1), { name: "no id" }] }, { categories: [category(1), category(1)] }, null]) {
      assert.throws(() => buildCategoryList(bad), (error) => error.code === "MALFORMED_RESPONSE");
    }
  });

  it("a page is refused when it is about another category", () => {
    assert.equal(buildCategoryDetail({ category: category(7) }, "7").id, "7");
    assert.equal(buildCategoryDetail({ category: category(7) }, "8"), null);
    assert.equal(buildCategoryDetail({}, "7"), null);
  });
});

describe("the hierarchy", () => {
  const arrange = (rows) => arrangeCategories(buildCategoryList({ categories: rows }));

  it("puts a category under its parent when the parent is listed, top-level and in the same section", () => {
    const sections = arrange([category(1, { name: "Food" }), category(2, { name: "Fruit", parent_id: 1 }), category(3, { name: "Bread", parent_id: 1 })]);
    assert.deepEqual(names(sections.custom), [["Food", ["Fruit", "Bread"]]]);
  });

  it("lists on their own: a missing parent, a parent pointing at itself, a cycle, anything deeper than one level, a parent in the other section", () => {
    const sections = arrange([
      category(1, { name: "Orphan", parent_id: 99 }),
      category(2, { name: "Self", parent_id: 2 }),
      category(3, { name: "Cycle A", parent_id: 4 }),
      category(4, { name: "Cycle B", parent_id: 3 }),
      category(5, { name: "Top" }),
      category(6, { name: "Middle", parent_id: 5 }),
      category(7, { name: "Deep", parent_id: 6 }),
      category(8, { name: "Under a system one", parent_id: 10 }),
      category(10, { name: "System", is_system: true }),
    ]);

    assert.deepEqual(names(sections.custom), [["Orphan", []], ["Self", []], ["Cycle A", []], ["Cycle B", []], ["Top", ["Middle"]], ["Deep", []], ["Under a system one", []]]);
    assert.deepEqual(names(sections.system), [["System", []]]);
  });

  it("keeps the backend's order and puts an unclear kind with the read-only ones", () => {
    const sections = arrange([category(3, { name: "C" }), category(1, { name: "A", is_system: "?" }), category(2, { name: "B" })]);
    assert.deepEqual(names(sections.custom), [["C", []], ["B", []]]);
    assert.deepEqual(names(sections.system), [["A", []]]);
  });

  it("filters: only income or expense, nothing else is sent", () => {
    assert.deepEqual(readCategoryFilters("type=income"), { type: "income" });
    assert.deepEqual(readCategoryFilters("type=transfer&workspace_id=9"), { type: "" });
  });
});

describe("the form", () => {
  it("validates the name (trimmed, at most 255 characters counted as characters) and the type", () => {
    assert.equal(validateName("  "), "required");
    assert.equal(validateName(undefined), "required");
    assert.equal(validateName("a".repeat(255)), null);
    assert.equal(validateName("a".repeat(256)), "tooLong");
    assert.equal(validateName("😀".repeat(255)), null, "an emoji is one character, not two");
    assert.equal(validateType("income"), null);
    assert.equal(validateType("transfer"), "required");
    assert.equal(validateType(""), "required");
  });

  it("builds exactly the documented payloads, and nothing else", () => {
    assert.deepEqual(buildCreatePayload({ workspaceId: 1, name: "  Rent ", type: "expense" }), { workspace_id: 1, name: "Rent", type: "expense" });
    assert.deepEqual(buildUpdatePayload({ name: " Rent & bills " }), { name: "Rent & bills" });
  });

  it("sends the session workspace only when it is a plain id", () => {
    assert.equal(workspaceIdForBody({ id: 3 }), 3);
    assert.equal(workspaceIdForBody({ id: "3" }), 3);
    for (const bad of [null, {}, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: "03" }, { id: "x" }, { id: "99999999999999999999" }]) assert.equal(workspaceIdForBody(bad), null, JSON.stringify(bad));
  });
});

describe("what counts as proof", () => {
  const sent = { name: "Rent", type: "expense", workspaceId: 1 };

  it("a create is confirmed only by the server's own category with the name, type and workspace that were sent", () => {
    assert.equal(confirmCreate({ category: category(100, { name: "Rent" }) }, sent).id, "100");
    assert.equal(confirmCreate({ category: category(100, { name: "Rent", type: "income" }) }, sent), null);
    assert.equal(confirmCreate({ category: category(100, { name: "Other" }) }, sent), null, "a similarly named one is not proof");
    assert.equal(confirmCreate({ category: category(100, { name: "Rent", workspace_id: 2 }) }, sent), null);
    assert.equal(confirmCreate({ category: category(100, { name: "Rent", is_system: true }) }, sent), null);
    assert.equal(confirmCreate({ category: { name: "Rent" } }, sent), null);
    assert.equal(confirmCreate({}, sent), null);
    assert.equal(confirmCreate(null, sent), null);
  });

  it("a rename is confirmed only by the same category with the new name", () => {
    assert.equal(confirmUpdate({ category: category(4, { name: "New" }) }, "4", " New ").name, "New");
    assert.equal(confirmUpdate({ category: category(5, { name: "New" }) }, "4", "New"), null);
    assert.equal(confirmUpdate({ category: category(4, { name: "Old" }) }, "4", "New"), null);
  });
});

describe("what an error means", () => {
  const api = (status, code) => new ApiError("x", { status, code });

  it("is a refusal only where the documented contract says so: 422 and 403 for both, 404 for a rename", () => {
    for (const operation of ["create", "update"]) {
      assert.equal(classifyOutcome(api(422, "VALIDATION_ERROR"), operation).kind, "rejected", `${operation} 422`);
      assert.equal(classifyOutcome(api(403, "FORBIDDEN"), operation).kind, "rejected", `${operation} 403`);
    }
    assert.equal(classifyOutcome(api(404, "NOT_FOUND"), "update").kind, "rejected");
    assert.equal(classifyOutcome(api(404, "NOT_FOUND"), "create").kind, "unknown", "no 404 is documented for a create");
  });

  it("every other status is unknown, for both operations: 400, 401, 408, 409, 429, 5xx", () => {
    for (const operation of ["create", "update"]) {
      for (const [status, code] of [[400, "REQUEST_FAILED"], [401, "UNAUTHENTICATED"], [405, "REQUEST_FAILED"], [408, "REQUEST_FAILED"], [409, "CONFLICT"], [413, "REQUEST_FAILED"], [429, "RATE_LIMITED"], [500, "SERVER_ERROR"], [502, "SERVER_ERROR"], [503, "SERVER_ERROR"]]) {
        const outcome = classifyOutcome(api(status, code), operation);
        assert.equal(outcome.kind, "unknown", `${operation} ${status}`);
        assert.equal(outcome.status, status);
      }
    }
  });

  it("a status the contract names but with an unexpected code is not taken as that refusal", () => {
    assert.equal(classifyOutcome(api(422, "REQUEST_FAILED"), "create").kind, "unknown");
    assert.equal(classifyOutcome({ name: "Error", status: 422, code: "VALIDATION_ERROR" }, "create").kind, "unknown", "only the API client's own errors count");
    assert.equal(classifyOutcome(api(422, "VALIDATION_ERROR")).kind, "unknown", "no operation, no contract");
  });

  it("no answer, a 5xx, a malformed answer or a failure envelope with a success status is unknown, never a failure", () => {
    for (const error of [new ApiError("", { code: "NETWORK_ERROR" }), new ApiError("", { code: "TIMEOUT" }), api(500, "SERVER_ERROR"), api(503, "SERVER_ERROR"), new ApiError("", { status: 200, code: "MALFORMED_RESPONSE" }), api(200, "REQUEST_FAILED"), Object.assign(new Error("aborted"), { name: "AbortError" }), new Error("anything")]) {
      for (const operation of ["create", "update"]) assert.equal(classifyOutcome(error, operation).kind, "unknown", error.code ?? error.name);
    }
  });

  it("a changed identity claims nothing", () => {
    assert.equal(classifyOutcome(new IdentityError("changed-elsewhere"), "create").kind, "identity");
  });

  it("takes the first server message of each field Mobile has an input for", () => {
    assert.deepEqual(fieldErrorsOf({ errors: { name: ["The name has already been taken.", "x"], type: "Bad type", color: ["ignored"] } }), { name: "The name has already been taken.", type: "Bad type" });
    assert.deepEqual(fieldErrorsOf({ errors: null }), { name: null, type: null });
  });
});
