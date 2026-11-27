import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { moreBackend } from "./helpers/moreFixture.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * The app bar's two quiet actions on the main screens: Notifications (a plain link) and the
 * display sheet (language and theme). Reads only; nothing here may write.
 */

after(() => dom.window.close());

let api;
let view;
const open = async (entry, data = {}) => {
  api?.restore();
  api = installFakeApi(moreBackend(data));
  view = await mountMobile({ entry });
};
const bar = () => q("header.sm-bar");
const bell = () => q("[data-sm-action='bar-notifications']", bar());
const display = () => q("[data-sm-action='bar-display']", bar());

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("App bar actions", () => {
  it("the main screens have both actions, named in words", async () => {
    for (const entry of ["/m", "/m/activity", "/m/planning", "/m/more"]) {
      await open(entry);
      assert.ok(bell(), `${entry} has the bell`);
      assert.ok(display(), `${entry} has the display button`);
      assert.equal(bell().getAttribute("href"), "/m/notifications");
      assert.equal(bell().textContent.trim(), "Notifications");
      assert.equal(display().textContent.trim(), "Language and theme");
      await view.unmount();
      view = null;
    }
  });

  it("pages opened from the main screens keep the bar to its title", async () => {
    for (const entry of ["/m/planning/debts", "/m/transfers", "/m/notifications", "/m/profile", "/m/add/expense"]) {
      await open(entry);
      assert.equal(bell(), null, `${entry}: no bell`);
      assert.equal(display(), null, `${entry}: no display button`);
      await view.unmount();
      view = null;
    }
  });

  it("makes no request of its own: no unread count, no notification endpoint", async () => {
    await open("/m/activity");
    await settle();
    assert.equal(api.calls.some((call) => /notification/.test(call.path)), false);
    assert.equal(q(".sm-bar-dot", bar()), null);
  });

  it("the display button opens a sheet with both choices, and a choice applies at once", async () => {
    await open("/m/more");
    await click(display());
    await settle();
    const sheet = q(".sm-sheet");
    assert.ok(sheet, "the sheet opened");
    assert.equal(sheet.getAttribute("role"), "dialog");
    assert.equal(q(".sm-sheet-title").textContent, "Display");

    const choice = (name) => qa("button", sheet).find((item) => item.textContent.trim() === name);
    assert.equal(choice("Light").getAttribute("aria-pressed"), "true");
    await click(choice("Dark"));
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(choice("Dark").getAttribute("aria-pressed"), "true");

    await click(choice("العربية"));
    await settle();
    assert.equal(document.documentElement.dir, "rtl");
    assert.equal(i18n.language.startsWith("ar"), true);
    assert.equal(bell().textContent.trim(), "الإشعارات", "the bar follows the language");

    await i18n.changeLanguage("en");
  });

  it("the sheet closes with its button and returns focus to the display button", async () => {
    await open("/m/planning");
    await click(display());
    await settle();
    await click(qa("button", q(".sm-sheet")).find((item) => item.textContent.trim() === "Done"));
    await settle();
    assert.equal(q(".sm-sheet"), null);
    assert.equal(document.activeElement, display());
  });

  it("a direct AR/EN switch shows the other language and switches at once", async () => {
    await open("/m/activity");
    const lang = () => q("[data-sm-action='bar-language']", bar());
    assert.equal(q(".sm-bar-lang-mark", lang()).textContent, "ع", "in English it offers Arabic");
    assert.equal(lang().textContent.includes("Switch to Arabic"), true, "named in words");
    await click(lang());
    await settle();
    assert.equal(document.documentElement.dir, "rtl");
    assert.equal(q(".sm-bar-lang-mark", lang()).textContent, "EN", "in Arabic it offers English");
    assert.equal(lang().textContent.includes("التبديل إلى الإنجليزية"), true);
    await click(lang());
    await settle();
    assert.equal(document.documentElement.dir, "ltr");
    await i18n.changeLanguage("en");
  });

  it("the direct switch is left out where the bar has no room; the display sheet still has language", async () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 320, configurable: true, writable: true });
    try {
      await open("/m");
      assert.equal(q("[data-sm-action='bar-language']", bar()), null);
      assert.ok(bell() && display(), "the other two actions stay");
      await click(display());
      await settle();
      assert.ok(qa("button", q(".sm-sheet")).some((item) => item.textContent.trim() === "العربية"));
    } finally {
      Object.defineProperty(window, "innerWidth", { value: original, configurable: true, writable: true });
    }
  });

  it("the bell opens Notifications", async () => {
    await open("/m");
    await click(bell());
    await settle();
    assert.equal(location(), "/m/notifications");
  });
});
