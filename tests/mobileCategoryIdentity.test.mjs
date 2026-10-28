import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { CATEGORY_WRITES, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, TOKEN_B, USER_A, USER_B, clearSessionStorage, dom, location, mountMobile, otherTabWrote, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { categoriesBackend, category } from "./helpers/categoryFixture.mjs";
import { change, click } from "./helpers/dom.mjs";

/*
 * A category write under a changing identity. The rules: a write is never sent
 * with another identity's token, an answer that arrives after the identity
 * changed is never shown (as success or anything else), nothing is sent again
 * when the person comes back, and leaving the form while it is sending neither
 * claims a result nor repeats it.
 */

after(() => dom.window.close());

let api;
let view;
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const identityScreen = () => q("[data-sm-identity]");
const nameInput = () => q("main input[type='text']");
const submit = () => q("[data-sm-action='submit']");
const hold = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release: (value) => release(value) };
};
const created = (body) => ({ status: 201, body: envelope({ category: category(100, body) }) });
const SECRETS = /Alpha private|Groceries|Salary|Fresh produce/;

const setup = async (entry, hooks) => {
  const backend = categoriesBackend(undefined, hooks);
  api = installFakeApi(backend, { allowWrites: CATEGORY_WRITES });
  view = await mountMobile({ entry });
};
const fillCreate = async (name = "Alpha private category") => {
  await change(nameInput(), name);
  await click(q("main input[value='expense']"));
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
  window.localStorage.setItem("workspace", JSON.stringify({ id: 1 }));
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api.restore();
});

describe("a category write under a changing identity", () => {
  it("another tab signs out before the person taps Create: nothing is sent", async () => {
    await setup("/m/planning/categories/new");
    await fillCreate();

    clearSessionStorage();
    await click(submit());
    await settle();

    assert.deepEqual(writes(), []);
    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
  });

  it("another tab signed in as B without this tab hearing it: the tap is refused, B's token is never used", async () => {
    await setup("/m/planning/categories/new");
    await fillCreate();

    // Storage changed, but no `storage` event reached this tab (it could have been missed).
    storeSession({ token: TOKEN_B, user: USER_B });
    await click(submit());
    await settle();

    assert.deepEqual(writes(), []);
    assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false);
    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
  });

  it("another tab signs out while the request is on its way: its answer is not shown, nothing is claimed", async () => {
    const held = hold();
    await setup("/m/planning/categories/new", { onCreate: () => held.promise });
    await fillCreate();
    await click(submit());
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].auth, `Bearer ${TOKEN_A}`);

    clearSessionStorage();
    otherTabWrote("ACCESS_TOKEN", null);
    await settle();
    held.release(created({ name: "Alpha private category" }));
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
    assert.equal(q("[data-sm-outcome]"), null);
    assert.doesNotMatch(document.body.textContent, /Category created/);
    assert.doesNotMatch(document.body.textContent, SECRETS);
    assert.equal(writes().length, 1);
  });

  it("another tab signs in as B while the request is on its way: A's answer is never shown, and B's token is never used", async () => {
    const held = hold();
    await setup("/m/planning/categories/new", { onCreate: () => held.promise });
    await fillCreate();
    await click(submit());

    storeSession({ token: TOKEN_B, user: USER_B });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();
    held.release(created({ name: "Alpha private category" }));
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.doesNotMatch(document.body.textContent, /Category created|Alpha private category/);
    assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false);
  });

  it("the answer arrives after the identity changed without any event: the check on arrival refuses it", async () => {
    const held = hold();
    await setup("/m/planning/categories/new", { onCreate: () => held.promise });
    await fillCreate();
    await click(submit());

    storeSession({ token: TOKEN_B, user: USER_B });
    held.release(created({ name: "Alpha private category" }));
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.doesNotMatch(document.body.textContent, /Category created/);
  });

  it("the session expires while saving (401): it is a refusal, the session ends, no resend", async () => {
    await setup("/m/planning/categories/new", { onCreate: () => failure(401, "Unauthenticated.") });
    await fillCreate();
    await click(submit());
    await settle();

    assert.equal(writes().length, 1);
    assert.equal(window.localStorage.getItem("ACCESS_TOKEN"), null, "the app's own 401 flow cleared the session");
    assert.doesNotMatch(document.body.textContent, /Category created/);
  });

  it("blocked storage when the person taps Create: nothing is sent and nothing is shown", async () => {
    await setup("/m/planning/categories/new");
    await fillCreate();
    const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() {}, removeItem() {}, key: () => null, length: 0 };
    const originals = [globalThis.localStorage, globalThis.sessionStorage];

    Object.defineProperty(globalThis, "localStorage", { value: blocked, configurable: true, writable: true });
    Object.defineProperty(globalThis, "sessionStorage", { value: blocked, configurable: true, writable: true });
    try {
      await click(submit());
      await settle();
      assert.deepEqual(writes(), []);
      assert.equal(identityScreen().dataset.smIdentity, "storage-unavailable");
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: originals[0], configurable: true, writable: true });
      Object.defineProperty(globalThis, "sessionStorage", { value: originals[1], configurable: true, writable: true });
    }
  });

  it("the person leaves the form while it is sending: nothing is claimed, nothing is resent, and the list they go to is read fresh", async () => {
    const held = hold();
    await setup("/m/planning/categories", {
      onCreate: (body, call, state) =>
        held.promise.then((answer) => {
          state.rows.push(category(100, body));
          return answer;
        }),
    });
    const listReads = () => api.calls.filter((call) => call.method === "GET" && call.path === "/categories").length;
    await click(qa("a", q("main")).find((item) => item.textContent.trim() === "New category"));
    await settle();
    await fillCreate("Rent");
    await click(submit());

    await click(qa("nav.sm-nav a").find((item) => item.textContent.trim() === "Home"));
    await settle();
    held.release(created({ name: "Rent" }));
    await settle();
    assert.equal(location(), "/m");
    assert.doesNotMatch(document.body.textContent, /Category created|couldn't confirm/);

    const before = listReads();
    await click(qa("nav.sm-nav a").find((item) => item.textContent.trim() === "Planning"));
    await settle();
    await click(qa("a", q("main")).find((item) => item.textContent.trim().startsWith("Categories")));
    await settle();
    assert.equal(listReads(), before + 1, "what was read before the write was forgotten");
    assert.match(text(q("main")), /Rent/);
    assert.equal(writes().length, 1);
  });

  it("a rename's answer for the category the person left is not shown on the next one", async () => {
    const held = hold();
    await setup("/m/planning/categories/1/edit", { onUpdate: () => held.promise });
    await change(nameInput(), "Renamed one");
    await click(submit());

    await click(qa("a", q("main")).find((item) => item.textContent.trim() === "Back to the category"));
    await settle();
    await click(qa("a", q("main")).find((item) => item.textContent.trim() === "Back to categories"));
    await settle();
    await click(q("[data-sm-category='2']"));
    await settle();
    await click(qa("a", q("main")).find((item) => item.textContent.trim() === "Rename category"));
    await settle();
    held.release({ body: envelope({ category: category(1, { name: "Renamed one" }) }) });
    await settle();

    assert.equal(location(), "/m/planning/categories/2/edit");
    assert.equal(q("[data-sm-outcome]"), null);
    assert.equal(nameInput().value, "Salary");
    assert.equal(q("[data-sm-action='submit']").disabled, true, "the other form is untouched and idle");
  });

  it("a new session in this tab starts with none of A's categories", async () => {
    await setup("/m/planning/categories");
    assert.match(text(q("main")), /Groceries/);
    await view.unmount();
    view = null;
    api.restore();

    clearSessionStorage();
    storeSession({ token: TOKEN_B, user: USER_B });
    const bravo = categoriesBackend([category(900, { name: "Bravo only" })]);
    api = installFakeApi(bravo, { allowWrites: CATEGORY_WRITES });
    view = await mountMobile({ entry: "/m/planning/categories", auth: { isAuthenticated: true, initializing: false, token: TOKEN_B, user: USER_B, workspace: { id: 1 } } });

    assert.match(text(q("main")), /Bravo only/);
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });
});
