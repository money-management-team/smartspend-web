import assert from "node:assert/strict";
import { test } from "node:test";
import { isFormDirty } from "../src/components/UnsavedChanges/unsavedChanges.js";

const saved = { name: "Sara", phone: null, tags: ["a"], active: true };

test("an unchanged form is clean", () => {
  assert.equal(isFormDirty({ ...saved }, saved), false);
});

test("formatting alone is not a change", () => {
  assert.equal(isFormDirty({ ...saved, name: "  Sara " }, saved), false);
  assert.equal(isFormDirty({ ...saved, phone: "" }, saved), false);
  assert.equal(isFormDirty({ ...saved, phone: undefined }, saved), false);
  assert.equal(isFormDirty({ ...saved, tags: ["a"] }, saved), false);
});

test("a real edit is dirty", () => {
  assert.equal(isFormDirty({ ...saved, name: "Sarah" }, saved), true);
  assert.equal(isFormDirty({ ...saved, phone: "0599" }, saved), true);
  assert.equal(isFormDirty({ ...saved, tags: ["a", "b"] }, saved), true);
  assert.equal(isFormDirty({ ...saved, active: false }, saved), true);
});

test("editing back to the saved value makes it clean again", () => {
  assert.equal(isFormDirty({ ...saved, name: "Sarah" }, saved), true);
  assert.equal(isFormDirty({ ...saved, name: "Sara" }, saved), false);
});

test("only the listed fields are compared", () => {
  assert.equal(
    isFormDirty({ ...saved, name: "Other" }, saved, ["phone", "active"]),
    false,
  );
});

test("numbers compare as the text the input shows", () => {
  assert.equal(isFormDirty({ amount: 5 }, { amount: "5" }), false);
  assert.equal(isFormDirty({ amount: "5.00" }, { amount: "5" }), true);
});
