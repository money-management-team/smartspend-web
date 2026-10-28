import assert from "node:assert/strict";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { CATEGORY_WRITES, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, goBack, location, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { categoriesBackend, category } from "./helpers/categoryFixture.mjs";
import { change, click } from "./helpers/dom.mjs";
import { setWriteApprovalsForTests } from "../src/mobile/data/writeGate.js";

// These suites test the category writes themselves, so they open the two (closed in the product; see mobileWriteGate.test.mjs).
setWriteApprovalsForTests(["category.create", "category.update"]);

/*
 * Mobile Categories: the list, a category's page, a new category and a rename,
 * against a fake backend that allows exactly the two category writes and fails
 * on anything else. Fictional data only.
 */

after(() => dom.window.close());

let api;
let backend;
let view;

const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const button = (label, root = q("main")) => qa("button", root).find((item) => item.textContent.trim() === label);
const link = (label, root = q("main")) => qa("a", root).find((item) => item.textContent.trim().startsWith(label));
const writes = () => api.calls.filter((call) => call.method !== "GET");
const open = async (entry, { rows, hooks, handler } = {}) => {
  api?.restore();
  backend = categoriesBackend(rows, hooks);
  api = installFakeApi(handler ?? backend, { allowWrites: CATEGORY_WRITES });
  view = await mountMobile({ entry });
};
const nameInput = () => q("main input[type='text']");
const radio = (value) => q(`main input[type='radio'][value='${value}']`);
const submitButton = () => q("[data-sm-action='submit']");
const hold = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release: (value) => release(value) };
};
const fillCreate = async (name = "Rent", type = "expense") => {
  await change(nameInput(), name);
  await click(radio(type));
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
  window.localStorage.setItem("workspace", JSON.stringify({ id: 1, name: "Test workspace" }));
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
});

describe("the list", () => {
  it("reads GET /categories for the session workspace and only reads", async () => {
    await open("/m/planning/categories");

    assert.deepEqual(api.summary(), ["GET /categories"]);
    assert.deepEqual(api.calls[0].query, { workspace_id: "1" });
    assert.deepEqual(writes(), []);
  });

  it("shows yours first, then the system ones, with one level of grouping, and no counts or amounts", async () => {
    await open("/m/planning/categories");
    const yours = q("[data-sm-section='sm-cat-custom']");
    const system = q("[data-sm-section='sm-cat-system']");

    assert.match(text(yours), /Your categories.*Groceries.*Expense.*Fresh produce.*Salary.*Income/);
    assert.equal(q(".sm-cat-children [data-sm-category='3']") !== null, true, "Fresh produce is under Groceries");
    assert.match(text(system), /Built in.*Food.*Read-only.*Transport.*Read-only/);
    assert.deepEqual(qa("[data-sm-manageable='true']").map((row) => row.dataset.smCategory), ["1", "3", "2"]);
    assert.equal(qa(".sm-money").length, 0);
    assert.doesNotMatch(text(q("main")), /\d+ (categories|transactions)|ILS|total/i);
  });

  it("the type filter is the backend's and lives in the address", async () => {
    await open("/m/planning/categories");

    await click(button("Income"));
    await settle();

    assert.equal(location(), "/m/planning/categories?type=income");
    assert.equal(api.calls.at(-1).query.type, "income");
    assert.deepEqual(qa("[data-sm-category]").map((row) => row.dataset.smCategory), ["2"]);
  });

  it("empty, filtered-empty, only-system, error, malformed and stale states", async () => {
    await open("/m/planning/categories", { rows: [] });
    assert.equal(q("[data-sm-screen='categories']").dataset.smState, "empty");
    assert.match(text(q("main")), /No categories yet/);

    await view.unmount();
    await open("/m/planning/categories?type=income", { rows: [category(1)] });
    assert.equal(q("[data-sm-screen='categories']").dataset.smState, "empty-filtered");

    await view.unmount();
    await open("/m/planning/categories", { rows: [category(10, { is_system: true })] });
    assert.ok(q("[data-sm-note='only-system']"));

    await view.unmount();
    await open("/m/planning/categories", { handler: () => failure(500, "boom") });
    assert.equal(q("[data-sm-screen='categories']").dataset.smState, "error");
    assert.ok(button("Try again"));

    await view.unmount();
    await open("/m/planning/categories", { handler: () => ({ body: envelope({ categories: [{ name: "no id" }] }) }) });
    assert.equal(q("[data-sm-error]").dataset.smError, "malformed");

    await view.unmount();
    await open("/m/planning/categories", { handler: () => failure(403, "no") });
    assert.equal(q("[data-sm-error]").dataset.smError, "forbidden");
  });

  it("a refresh that fails keeps the earlier list, marked as from earlier", async () => {
    let fail = false;
    const base = categoriesBackend();
    await open("/m/planning/categories", { handler: (call) => (fail ? failure(500, "boom") : base(call)) });

    fail = true;
    await click(button("Refresh"));
    await settle();

    assert.equal(q("[data-sm-screen='categories']").dataset.smState, "stale");
    assert.ok(qa("[data-sm-category]").length > 0);
  });
});

describe("a category's page", () => {
  it("shows what it is and offers a rename only for your own active category", async () => {
    await open("/m/planning/categories/1");

    assert.match(text(q("main")), /Groceries.*Expense.*Yours/);
    assert.match(text(q("main")), /Colour\s*#10B981/);
    assert.equal(link("Rename category").getAttribute("href"), "/m/planning/categories/1/edit");
    assert.equal(link("Open this category in the full version").getAttribute("href"), "/dashboard/categories/1");
    assert.deepEqual(writes(), []);
  });

  it("a system category is read-only, says so, and has no rename", async () => {
    await open("/m/planning/categories/10");

    assert.ok(q("[data-sm-note='system']"));
    assert.equal(link("Rename category"), undefined);
    assert.match(text(q("main")), /can't be changed in Mobile/);
  });

  it("a missing, forbidden or foreign category gets one answer; a bad address reads nothing", async () => {
    await open("/m/planning/categories/999");
    assert.equal(q("[data-sm-error]").dataset.smError, "notFound");

    await view.unmount();
    await open("/m/planning/categories/1", { handler: () => failure(403, "no") });
    assert.equal(q("[data-sm-error]").dataset.smError, "notFound");

    await view.unmount();
    await open("/m/planning/categories/1", { handler: () => ({ body: envelope({ category: category(2) }) }) });
    assert.equal(q("[data-sm-screen='category']").dataset.smState, "error");

    await view.unmount();
    await open("/m/planning/categories/abc");
    assert.equal(api.calls.length, 0);
  });
});

describe("a new category", () => {
  it("needs a name and a type before anything is sent; the summary takes the focus and links to the fields", async () => {
    await open("/m/planning/categories/new");

    await click(submitButton());

    assert.deepEqual(writes(), []);
    const summary = q("[data-sm-summary]");
    assert.equal(document.activeElement, summary);
    assert.match(text(summary), /Name: Enter a name\..*Type: Choose income or expense\./);
    assert.equal(nameInput().getAttribute("aria-invalid"), "true");
    await click(qa("a", summary)[0]);
    assert.equal(document.activeElement, nameInput());
  });

  it("a name over 255 characters is refused here", async () => {
    await open("/m/planning/categories/new");
    await fillCreate("x".repeat(256));
    await click(submitButton());

    assert.deepEqual(writes(), []);
    assert.match(text(q("main")), /Use at most 255 characters/);
  });

  it("sends exactly one POST /categories with exactly { workspace_id, name, type }, and no idempotency key", async () => {
    await open("/m/planning/categories/new");
    await fillCreate("  Rent  ");
    await click(submitButton());
    await settle();

    assert.deepEqual(writes().map((call) => `${call.method} ${call.path}`), ["POST /categories"]);
    assert.deepEqual(writes()[0].body, { workspace_id: 1, name: "Rent", type: "expense" });
    assert.equal(Object.keys(writes()[0].headers).some((name) => /idempotency/i.test(name)), false);
    assert.equal(writes()[0].auth, `Bearer ${TOKEN_A}`);
  });

  it("says 'created' only after the server's answer proves it, shows the server's name, and reads the list again", async () => {
    await open("/m/planning/categories");
    const listReads = () => api.calls.filter((call) => call.method === "GET" && call.path === "/categories").length;
    assert.equal(listReads(), 1);

    await click(link("New category"));
    await settle();
    await fillCreate("Rent");
    await click(submitButton());
    await settle();

    const outcome = q("[data-sm-outcome='confirmed']");
    assert.match(text(outcome), /Category created.*SmartSpend created Rent/);
    assert.equal(document.activeElement, q("#sm-cat-outcome"));

    await click(link("Back to categories", outcome));
    await settle();
    assert.equal(listReads(), 2, "the list was read again, not taken from memory");
    assert.match(text(q("main")), /Rent/);
  });

  it("a double tap sends one request", async () => {
    const held = hold();
    await open("/m/planning/categories/new", { hooks: { onCreate: () => held.promise } });
    await fillCreate("Rent");

    await act(async () => {
      submitButton().click();
      submitButton().click();
      q("form.sm-cat-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    });

    assert.equal(writes().length, 1);
    assert.equal(submitButton().disabled, true);
    assert.equal(q("fieldset.sm-cat-fields").disabled, true);
    assert.match(submitButton().textContent, /Creating/);

    held.release({ status: 201, body: envelope({ category: category(100, { name: "Rent" }) }) });
    await settle();
    assert.equal(writes().length, 1);
    assert.ok(q("[data-sm-outcome='confirmed']"));
  });

  it("a 422 keeps the draft, shows the server's field message under the field and in the summary, and lets the person send again by hand", async () => {
    let first = true;
    await open("/m/planning/categories/new", {
      hooks: {
        onCreate: (body, call, state) => {
          if (first) {
            first = false;
            return { status: 422, body: { status: false, message: "The given data was invalid.", errors: { name: ["The name has already been taken."] } } };
          }
          const created = category(101, body);
          state.rows.push(created);
          return { status: 201, body: envelope({ category: created }) };
        },
      },
    });
    await fillCreate("Groceries");
    await click(submitButton());
    await settle();

    assert.equal(q("[data-sm-summary]").dataset.smSummary, "rejected:VALIDATION_ERROR");
    assert.match(text(q("[data-sm-summary]")), /didn't accept this.*Nothing was saved.*The given data was invalid.*Name: The name has already been taken/);
    assert.equal(nameInput().value, "Groceries");
    assert.equal(radio("expense").checked, true);
    assert.equal(submitButton().disabled, false);
    assert.equal(writes().length, 1, "nothing was sent again by itself");

    await change(nameInput(), "Groceries 2");
    await click(submitButton());
    await settle();
    assert.equal(writes().length, 2);
    assert.ok(q("[data-sm-outcome='confirmed']"));
  });

  it("a 403 is a refusal by the contract: said in words, the draft stays, nothing resent", async () => {
    await open("/m/planning/categories/new", { hooks: { onCreate: () => failure(403, "refused") } });
    await fillCreate();
    await click(submitButton());
    await settle();

    assert.equal(q("[data-sm-summary]").dataset.smSummary, "rejected:FORBIDDEN");
    assert.match(text(q("[data-sm-summary]")), /can't change this category.*Nothing was saved/);
    assert.equal(nameInput().value, "Rent");
    assert.equal(writes().length, 1);
  });

  for (const [status, reason] of [[400, "unclear"], [404, "unclear"], [408, "noAnswer"], [409, "conflict"], [429, "rate"]]) {
    it(`a ${status} on a create is unknown, not a refusal: no "nothing was saved", no resend`, async () => {
      await open("/m/planning/categories/new", { hooks: { onCreate: () => failure(status, "refused") } });
      await fillCreate();
      await click(submitButton());
      await settle();

      const outcome = q("[data-sm-outcome='unknown']");
      assert.ok(outcome, String(status));
      assert.equal(q("[data-sm-reason]").dataset.smReason, reason);
      assert.doesNotMatch(text(outcome), /Nothing was saved|didn't accept/);
      assert.equal(qa("button", outcome).length, 0);
      assert.equal(writes().length, 1);
    });
  }

  for (const [label, response] of [
    ["a network failure", () => new TypeError("Failed to fetch")],
    ["a 500", () => failure(500, "")],
    ["a 503", () => failure(503, "")],
    ["a success that is not JSON", () => ({ status: 201, body: "<html>proxy</html>" })],
    ["a success without the category", () => ({ status: 201, body: envelope({}) })],
    ["a success for a different name", () => ({ status: 201, body: envelope({ category: category(100, { name: "Something else" }) }) })],
    ["a failure envelope with a 200", () => ({ status: 200, body: { status: false, message: "?" } })],
  ]) {
    it(`${label} is unknown: not called a failure, no resend, only checks offered`, async () => {
      await open("/m/planning/categories/new", { hooks: { onCreate: response } });
      await fillCreate();
      await click(submitButton());
      await settle();

      const outcome = q("[data-sm-outcome='unknown']");
      assert.ok(outcome, label);
      assert.match(text(outcome), /couldn't confirm the result.*may or may not have been created.*Check your categories before you try again.*won't send it again by itself/);
      assert.doesNotMatch(text(outcome), /failed|error|wasn't created/i);
      assert.equal(qa("button", outcome).length, 0, "no resend button, no form");
      assert.equal(qa("form, input", q("main")).length, 0);
      assert.deepEqual(qa("a", outcome).map((item) => item.getAttribute("href")), ["/m/planning/categories"]);

      await settle(20);
      assert.equal(writes().length, 1, "nothing is sent again, later either");
      window.dispatchEvent(new window.Event("online"));
      window.dispatchEvent(new window.Event("focus"));
      await settle();
      assert.equal(writes().length, 1, "nor after reconnecting or coming back");
    });
  }

  it("without a stored workspace nothing can be sent, and the page says why", async () => {
    window.localStorage.removeItem("workspace");
    await open("/m/planning/categories/new");

    assert.ok(q("[data-sm-note='no-workspace']"));
    assert.equal(submitButton().disabled, true);
    assert.deepEqual(writes(), []);
  });

  it("Cancel with nothing typed leaves at once; with a draft it asks first, and Keep editing keeps it", async () => {
    await open("/m/planning/categories/new");
    await click(button("Cancel"));
    await settle();
    assert.equal(location(), "/m/planning/categories");

    await click(link("New category"));
    await settle();
    await change(nameInput(), "Draft");
    await click(button("Cancel"));
    await settle();
    const sheet = q("[role='dialog']");
    assert.match(text(sheet), /Discard your changes\?.*hasn't been sent/);

    await click(button("Keep editing", sheet));
    await settle();
    assert.equal(q("[role='dialog']"), null);
    assert.equal(nameInput().value, "Draft");
    assert.equal(location(), "/m/planning/categories/new");

    await click(button("Cancel"));
    await settle();
    await click(button("Discard changes", q("[role='dialog']")));
    await settle();
    assert.equal(location(), "/m/planning/categories");
    assert.deepEqual(writes(), []);
  });

  it("keeps nothing it sent in browser storage", async () => {
    await open("/m/planning/categories/new");
    const before = { local: Object.keys(window.localStorage).sort(), session: Object.keys(window.sessionStorage).sort() };
    await fillCreate("Very private name");
    await click(submitButton());
    await settle();

    const all = [window.localStorage, window.sessionStorage].flatMap((storage) => Object.keys(storage).map((key) => storage.getItem(key))).join(" ");
    assert.doesNotMatch(all, /Very private name/);
    assert.deepEqual(Object.keys(window.sessionStorage).sort(), before.session);
    assert.deepEqual(Object.keys(window.localStorage).sort().filter((key) => !before.local.includes(key)), []);
  });
});

describe("a rename", () => {
  it("starts from the category, locks the type and says why, and Save waits for a real change", async () => {
    await open("/m/planning/categories/1/edit");

    assert.equal(nameInput().value, "Groceries");
    assert.equal(q("main input[type='radio']"), null);
    assert.match(text(q("[data-sm-locked='type']")), /Expense.*can't be changed here/);
    assert.equal(submitButton().disabled, true);

    await change(nameInput(), "Groceries ");
    assert.equal(submitButton().disabled, true, "spaces alone are not a change");
    await change(nameInput(), "Food shopping");
    assert.equal(submitButton().disabled, false);
  });

  it("sends exactly one PATCH with only the name, and confirms with the server's name", async () => {
    await open("/m/planning/categories/1/edit");
    await change(nameInput(), "Food shopping");
    await click(submitButton());
    await settle();

    assert.deepEqual(writes().map((call) => `${call.method} ${call.path}`), ["PATCH /categories/1"]);
    assert.deepEqual(writes()[0].body, { name: "Food shopping" });
    assert.match(text(q("[data-sm-outcome='confirmed']")), /Name saved.*Food shopping/);
  });

  it("what the app read before the write is forgotten, and the outcome on screen is built from the write's own answer", async () => {
    const base = categoriesBackend();
    const handler = (call) => (call.method === "GET" && call.path === "/categories/1" && writes().length ? { body: envelope({ category: category(1, { name: "Renamed again elsewhere" }) }) } : base(call));
    await open("/m/planning/categories/1/edit", { handler });
    await change(nameInput(), "Food shopping");
    await click(submitButton());
    await settle();

    assert.match(text(q("[data-sm-outcome='confirmed']")), /Food shopping/);
    assert.doesNotMatch(text(q("main")), /Renamed again elsewhere/);

    // The next view of the category is a fresh read, which is where a change made elsewhere shows.
    await click(link("View the category"));
    await settle();
    assert.match(text(q("[data-sm-screen='category']")), /Renamed again elsewhere/);
  });

  it("a system category, or one that is not active, gets no form", async () => {
    await open("/m/planning/categories/10/edit");
    assert.ok(q("[data-sm-note='not-manageable']"));
    assert.equal(nameInput(), null);
  });

  it("a 409 on a rename is unknown (no category meaning is documented): nothing claimed either way, no resend", async () => {
    await open("/m/planning/categories/1/edit", { hooks: { onUpdate: () => failure(409, "Changed meanwhile") } });
    await change(nameInput(), "New name");
    await click(submitButton());
    await settle();

    assert.ok(q("[data-sm-outcome='unknown']"));
    assert.equal(q("[data-sm-reason]").dataset.smReason, "conflict");
    assert.equal(writes().length, 1);
  });

  it("a 404 on a rename is a refusal by the contract: the category isn't available, the draft stays", async () => {
    await open("/m/planning/categories/1/edit", { hooks: { onUpdate: () => failure(404, "Not found") } });
    await change(nameInput(), "New name");
    await click(submitButton());
    await settle();

    assert.equal(q("[data-sm-summary]").dataset.smSummary, "rejected:NOT_FOUND");
    assert.equal(nameInput().value, "New name");
  });

  it("the rename page and form say what a rename may change, and claim nothing about balances", async () => {
    await open("/m/planning/categories/1");
    assert.match(text(q("main")), /may also change how existing transactions using it are labelled/);
    await click(link("Rename category"));
    await settle();
    assert.match(text(q("main")), /may also change how existing transactions using this category are labelled/);
    assert.doesNotMatch(text(q("main")), /balance|ledger|no financial/i);
  });

  it("an unknown rename offers to check the category and the list, nothing else", async () => {
    await open("/m/planning/categories/1/edit", { hooks: { onUpdate: () => failure(502, "") } });
    await change(nameInput(), "New name");
    await click(submitButton());
    await settle();

    const outcome = q("[data-sm-outcome='unknown']");
    assert.match(text(outcome), /may or may not have been saved.*Check the category before you change it again/);
    assert.deepEqual(qa("a", outcome).map((item) => item.getAttribute("href")), ["/m/planning/categories/1", "/m/planning/categories"]);
    assert.equal(writes().length, 1);
  });

  it("the page after a confirmed rename shows the new name from a fresh read", async () => {
    await open("/m/planning/categories/1");
    await click(link("Rename category"));
    await settle();
    await change(nameInput(), "Food shopping");
    await click(submitButton());
    await settle();

    await click(link("View the category"));
    await settle();
    assert.match(text(q("[data-sm-screen='category']")), /Food shopping/);
    assert.equal(api.calls.filter((call) => call.method === "GET" && call.path === "/categories/1").length, 2, "read for the page (the form reused it), and again after the write");
  });
});

describe("only the category writes exist", () => {
  it("the fake backend refuses any other write even when category writes are allowed", async () => {
    await open("/m/planning/categories");
    const { apiRequest } = await import("../src/features/Dashboards/User/api/apiClient.js");

    for (const [path, method] of [["/categories/1/archive", "POST"], ["/categories/1", "DELETE"], ["/categories/1", "PUT"], ["/transactions/expense", "POST"], ["/transfers", "POST"], ["/accounts/1", "PATCH"]]) {
      await assert.rejects(() => apiRequest(path, { method, body: {} }), (error) => /FORBIDDEN/.test(error.cause?.message), `${method} ${path}`);
    }
    assert.equal(api.takeViolations().length, 6);
  });

  it("no read-only screen sends a write, and browsing Categories sends none", async () => {
    for (const entry of ["/m", "/m/accounts", "/m/activity", "/m/planning", "/m/planning/budgets", "/m/planning/categories", "/m/planning/categories/1", "/m/planning/categories/1/edit", "/m/planning/categories/new", "/m/more"]) {
      await open(entry);
      assert.deepEqual(writes(), [], entry);
      await view.unmount();
      view = null;
    }
  });
});
