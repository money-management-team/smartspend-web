import { categoriesApi } from "../../features/Dashboards/User/api/categoriesApi.js";
import { assertWriteOpen } from "./writeGate.js";

/*
 * The only two requests Mobile has code for that are not reads, and the only file
 * that makes them. Both are about a category's label, not about money:
 *
 *   POST  /categories        a category: { workspace_id, name, type }
 *   PATCH /categories/{id}   its name: { name }
 *
 * Both are CLOSED by data/writeGate.js: each call checks the gate first and
 * throws WriteClosedError without sending anything. They stay closed until the
 * backend's protection against a request arriving twice is verified (the
 * browser itself can resend a write; see writeGate.js).
 *
 * The payloads are built by models/categoryForm.js and carry nothing else (no
 * amount, account, transaction, parent, status or icon). There is no archive, no
 * delete and no way to change a type: the wrapper's `archive` is not named here.
 * These endpoints take no Idempotency-Key, so none is sent: a repeated POST is a
 * second category, which is why nothing in Mobile ever repeats one by itself
 * (categories/useCategoryMutation.js).
 *
 * The call goes straight through the app's wrapper, so the token is read the
 * moment this function is called; the caller asserts the identity guard in the
 * same turn, immediately before.
 */
export const sendCategoryCreate = (payload) => {
  assertWriteOpen("category.create");
  return categoriesApi.create(payload);
};

export const sendCategoryUpdate = (categoryId, payload) => {
  assertWriteOpen("category.update");
  return categoriesApi.update(categoryId, payload);
};
