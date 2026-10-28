import assert from "node:assert/strict";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { CATEGORY_WRITES, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { PRESENTATION_KEY, TOKEN_A, TOKEN_B, USER_A, USER_B, dom, goBack, location, mountMobile, otherTabWrote, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { categoriesBackend, category } from "./helpers/categoryFixture.mjs";
import { change, click } from "./helpers/dom.mjs";
import { setWriteApprovalsForTests } from "../src/mobile/data/writeGate.js";

// These suites test the category writes themselves, so they open the two (closed in the product; see mobileWriteGate.test.mjs).
setWriteApprovalsForTests(["category.create", "category.update"]);

/*
 * Unsaved-changes protection on the category forms. The Mobile tree runs on a
 * data router here, as it does in the app (src/main.jsx), so the form's guard is
 * React Router's own blocker. Every way of leaving is tried: the bottom bar, the
 * compact menu, in-page links, Cancel, the browser's Back and Forward, a
 * keyboard-activated link, the automatic presentation switch, and a change of
 * identity. Fictional data only.
 */

after(() => dom.window.close());

let api;
let view;

const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const dialog = () => q("[role='dialog']");
const nameInput = () => q("main input[type='text']");
const navLink = (label) => qa("nav.sm-nav a").find((item) => item.textContent.trim() === label);
const mainLink = (label) => qa("a", q("main")).find((item) => item.textContent.trim().startsWith(label));
const stay = () => q("[data-sm-action='stay']");
const discard = () => q("[data-sm-action='discard']");
const writes = () => api.calls.filter((call) => call.method !== "GET");
const hold = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release: (value) => release(value) };
};

const open = async (entry, hooks) => {
  api = installFakeApi(categoriesBackend(undefined, hooks), { allowWrites: CATEGORY_WRITES });
  view = await mountMobile({ entry });
};
const dirtyNew = async (entry = "/m/planning/categories/new") => {
  await open(entry);
  nameInput().focus();
  await change(nameInput(), "Half-typed draft");
};
const tap = async (element) => {
  await click(element);
  await settle();
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
  window.innerWidth = 390;
});

describe("a form with unsaved edits holds every way out", () => {
  it("the bottom bar: held and asked; Keep editing keeps the text, the page and the focus", async () => {
    await dirtyNew();
    await tap(navLink("Home"));

    assert.equal(location(), "/m/planning/categories/new");
    assert.match(text(dialog()), /Discard your changes\?.*hasn't been sent/);
    assert.equal(dialog().getAttribute("aria-modal"), "true");
    assert.equal(q("[data-sm-action='stay']").className.includes("sm-button-quiet"), false, "the safe choice is the emphasised one");

    await tap(stay());
    assert.equal(dialog(), null);
    assert.equal(location(), "/m/planning/categories/new");
    assert.equal(nameInput().value, "Half-typed draft");
    assert.equal(document.activeElement, nameInput(), "focus is back where the person was");
  });

  it("Discard changes continues to exactly where the person was going", async () => {
    await dirtyNew();
    await tap(navLink("Activity"));
    await tap(discard());

    assert.equal(location(), "/m/activity");
    assert.equal(dialog(), null);
  });

  it("the compact menu: choosing a destination closes the menu, then the form asks", async () => {
    window.innerWidth = 260;
    await dirtyNew();
    assert.equal(q(".sm-root").dataset.smNav, "compact");

    await tap(qa("nav.sm-nav button").find((item) => item.textContent.trim() === "Menu"));
    await tap(qa("a", dialog()).find((item) => item.textContent.trim() === "Home"));

    assert.equal(location(), "/m/planning/categories/new");
    assert.equal(qa("[role='dialog']").length, 1, "only the question is open, not the menu under it");
    assert.match(text(dialog()), /Discard your changes/);
    await tap(discard());
    assert.equal(location(), "/m");
  });

  it("an in-page Back link and Cancel ask the same question", async () => {
    await dirtyNew();
    await tap(mainLink("Back to categories"));
    assert.match(text(dialog()), /Discard your changes/);
    await tap(stay());

    await tap(qa("button", q("main")).find((item) => item.textContent.trim() === "Cancel"));
    assert.match(text(dialog()), /Discard your changes/);
    await tap(discard());
    assert.equal(location(), "/m/planning/categories");
  });

  it("the browser's Back and Forward are held too", async () => {
    await open("/m/planning/categories");
    await tap(mainLink("New category"));
    await change(nameInput(), "Draft");

    await goBack();
    await settle();
    assert.equal(location(), "/m/planning/categories/new");
    assert.match(text(dialog()), /Discard your changes/);
    await tap(stay());
    assert.equal(nameInput().value, "Draft");

    await goBack();
    await settle();
    await tap(discard());
    assert.equal(location(), "/m/planning/categories");

    // Forward into the form is free (nothing to lose there yet); a new draft then holds Forward/Back again.
    await goBack(1);
    await settle();
    assert.equal(location(), "/m/planning/categories/new");
    assert.equal(nameInput().value, "", "a discarded draft is not brought back");
  });

  it("Forward away from a draft is held as well", async () => {
    await open("/m/planning/categories");
    await tap(mainLink("New category"));
    await tap(navLink("Home"));
    assert.equal(location(), "/m");

    await goBack();
    await settle();
    assert.equal(location(), "/m/planning/categories/new");
    await change(nameInput(), "Second draft");

    await goBack(1);
    await settle();
    assert.equal(location(), "/m/planning/categories/new");
    assert.match(text(dialog()), /Discard your changes/);
    await tap(discard());
    assert.equal(location(), "/m");
  });

  it("a link activated from the keyboard is held like a tap, and Escape is Keep editing", async () => {
    await dirtyNew();
    const home = navLink("Home");
    home.focus();
    // A keyboard press on a focused link reaches the page as a click.
    await tap(home);
    assert.ok(dialog());

    await act(async () => {
      dialog().dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await settle();
    assert.equal(dialog(), null);
    assert.equal(location(), "/m/planning/categories/new");
    assert.equal(nameInput().value, "Half-typed draft");
  });

  it("the automatic presentation switch waits while the form has a draft", async () => {
    await dirtyNew();

    window.localStorage.setItem(PRESENTATION_KEY, "desktop");
    otherTabWrote(PRESENTATION_KEY, "desktop");
    await settle();

    assert.equal(location(), "/m/planning/categories/new", "not redirected to the full version under the draft");
    assert.equal(nameInput().value, "Half-typed draft");
    assert.equal(q("#desktop"), null);
  });

  it("a rename with a draft is held the same way", async () => {
    await open("/m/planning/categories/1/edit");
    await change(nameInput(), "Food shopping");
    await tap(navLink("Planning"));

    assert.equal(location(), "/m/planning/categories/1/edit");
    assert.ok(dialog());
    await tap(discard());
    assert.equal(location(), "/m/planning");
  });

  it("a decision is taken once: two taps on Discard are one navigation", async () => {
    await open("/m/planning/categories");
    await tap(mainLink("New category"));
    await change(nameInput(), "Draft");
    await tap(navLink("Home"));

    await act(async () => {
      discard().click();
      discard()?.click();
    });
    await settle();
    assert.equal(location(), "/m");

    await goBack();
    await settle();
    assert.equal(location(), "/m/planning/categories/new", "exactly one entry was added");
  });
});

describe("nothing is held when there is nothing to lose", () => {
  it("a clean form navigates at once", async () => {
    await open("/m/planning/categories/new");
    await tap(navLink("Home"));
    assert.equal(location(), "/m");
    assert.equal(dialog(), null);
  });

  it("a rename whose name was typed back to the original is clean", async () => {
    await open("/m/planning/categories/1/edit");
    await change(nameInput(), "Other");
    await change(nameInput(), "Groceries ");
    await tap(navLink("Home"));
    assert.equal(location(), "/m");
  });

  it("after a confirmed create, leaving is free", async () => {
    await open("/m/planning/categories/new");
    await change(nameInput(), "Rent");
    await click(q("main input[value='expense']"));
    await tap(q("[data-sm-action='submit']"));
    assert.ok(q("[data-sm-outcome='confirmed']"));

    await tap(navLink("Home"));
    assert.equal(location(), "/m");
  });

  it("after an unknown outcome, leaving is free, and coming back sends nothing", async () => {
    await open("/m/planning/categories/new", { onCreate: () => failure(503, "") });
    await change(nameInput(), "Rent");
    await click(q("main input[value='expense']"));
    await tap(q("[data-sm-action='submit']"));
    assert.ok(q("[data-sm-outcome='unknown']"));

    await tap(navLink("Home"));
    await goBack();
    await settle();
    assert.equal(location(), "/m/planning/categories/new");
    assert.equal(nameInput().value, "", "a fresh, empty form: nothing remembered, nothing resent");
    assert.equal(writes().length, 1);
  });
});

describe("while the request is on its way", () => {
  it("leaving is held with a different question: it won't stop the request", async () => {
    const held = hold();
    await open("/m/planning/categories/new", { onCreate: () => held.promise });
    await change(nameInput(), "Rent");
    await click(q("main input[value='expense']"));
    await click(q("[data-sm-action='submit']"));

    await tap(navLink("Home"));
    assert.match(text(dialog()), /This is still being sent.*Leaving won't stop it/);
    assert.equal(stay().textContent.trim(), "Stay and wait");

    await tap(stay());
    held.release({ status: 201, body: envelope({ category: category(100, { name: "Rent" }) }) });
    await settle();
    assert.ok(q("[data-sm-outcome='confirmed']"));
    assert.equal(writes().length, 1);
  });

  it("if the answer arrives while the question is open, the question is withdrawn and the outcome shown", async () => {
    const held = hold();
    await open("/m/planning/categories/new", { onCreate: () => held.promise });
    await change(nameInput(), "Rent");
    await click(q("main input[value='expense']"));
    await click(q("[data-sm-action='submit']"));
    await tap(navLink("Home"));
    assert.ok(dialog());

    held.release({ status: 201, body: envelope({ category: category(100, { name: "Rent" }) }) });
    await settle();
    assert.equal(dialog(), null);
    assert.equal(location(), "/m/planning/categories/new");
    assert.ok(q("[data-sm-outcome='confirmed']"));
  });
});

describe("identity and the guard", () => {
  it("another tab signs in as B while the question is open: the form, its draft and the question all go", async () => {
    await dirtyNew();
    await tap(navLink("Home"));
    assert.ok(dialog());

    storeSession({ token: TOKEN_B, user: USER_B });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();

    assert.equal(q("[data-sm-identity]").dataset.smIdentity, "changed-elsewhere");
    assert.equal(dialog(), null);
    assert.doesNotMatch(document.body.textContent, /Half-typed draft/);
    assert.equal(q("input"), null);
  });

  it("a 401 while saving ends the session; nothing is claimed, and the old form is not shown", async () => {
    await open("/m/planning/categories/new", { onCreate: () => failure(401, "Unauthenticated.") });
    await change(nameInput(), "Rent");
    await click(q("main input[value='expense']"));
    await tap(q("[data-sm-action='submit']"));

    assert.equal(q("[data-sm-identity]").dataset.smIdentity, "signed-out-elsewhere");
    assert.equal(q("[data-sm-outcome]"), null);
    assert.doesNotMatch(document.body.textContent, /Category created|Nothing was saved/);
    assert.equal(writes().length, 1);
  });

  it("the workspace changes while the request is on its way: its answer is not presented as this screen's result", async () => {
    const held = hold();
    await open("/m/planning/categories/new", { onCreate: () => held.promise });
    await change(nameInput(), "Rent");
    await click(q("main input[value='expense']"));
    await click(q("[data-sm-action='submit']"));

    window.localStorage.setItem("workspace", JSON.stringify({ id: 2 }));
    otherTabWrote("workspace", JSON.stringify({ id: 2 }));
    held.release({ status: 201, body: envelope({ category: category(100, { name: "Rent" }) }) });
    await settle();

    const outcome = q("[data-sm-outcome='changed']");
    assert.ok(outcome);
    assert.match(text(outcome), /Your workspace changed.*isn't shown here/);
    assert.doesNotMatch(text(q("main")), /Category created/);
    assert.equal(qa("button", outcome).length, 0);
    assert.equal(writes().length, 1);
  });
});
