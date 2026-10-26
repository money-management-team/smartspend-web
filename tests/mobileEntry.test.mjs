import assert from "node:assert/strict";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { TOKEN_A, USER_A, dom, goBack, location, mountMobile, PRESENTATION_KEY, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { healthyBackend, installFakeApi } from "./helpers/mobileApi.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * The part of Mobile that is in the main bundle when the flag is on: the gate
 * and the entry. A Desktop visitor must see exactly what a flag-off build
 * shows: the Desktop route table, no Mobile loading state, no Mobile element,
 * no request. (A real browser run of the same claims, including that the
 * Mobile chunk is never requested, is recorded in docs/mobile/S04B1.)
 */

after(() => dom.window.close());

let api;
let view;
let appeared;
let observer;

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
  api = installFakeApi(healthyBackend());

  // Records every Mobile node that is ever added to the page, however briefly.
  appeared = [];
  observer = new window.MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        for (const found of [node, ...node.querySelectorAll("*")]) {
          if (typeof found.className === "string" && /\bsm-/.test(found.className)) appeared.push(found.className);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

afterEach(async () => {
  observer.disconnect();
  await view?.unmount();
  view = null;
  api.restore();
});

const text = () => document.body.textContent;

describe("a Desktop visitor, flag on", () => {
  for (const [name, preference] of [["the full version chosen", "desktop"], ["automatic on a computer", "auto"], ["nothing stored", null]]) {
    it(`sees the Desktop page, with no Mobile element or loading state at any moment (${name})`, async () => {
      for (const entry of ["/dashboard", "/dashboard/accounts?x=1", "/dashboard/accounts/7", "/", "/verify-email/1/abc?expires=1&signature=a%2Bb"]) {
        view = await mountMobile({ entry, preference });
        assert.ok(q("#desktop-page"), entry);
        assert.equal(location(), entry);
        await view.unmount();
        view = null;
      }

      assert.deepEqual(appeared, [], "no sm- element was ever added to the page");
      assert.deepEqual(api.calls, [], "no request");
    });
  }

  it("has no loading state of its own: the Desktop tree is on screen as soon as the entry renders", async () => {
    view = await mountMobile({ entry: "/dashboard", preference: "desktop" });
    assert.ok(q("#desktop-page"));
    assert.equal(q(".sm-boot"), null);
    assert.equal(q("[aria-busy='true']"), null);
  });

  it("a signed-out visitor is left alone on every address, Mobile address included until the guard sends them to sign-in", async () => {
    view = await mountMobile({ entry: "/dashboard", preference: "mobile", auth: { isAuthenticated: false, initializing: false, token: null, user: null } });
    assert.equal(location(), "/dashboard");
    assert.ok(q("#desktop-page"));
    assert.equal(appeared.length, 0);
  });

  it("while the session is still being restored, nothing is decided and the Desktop page's own loading state is what shows", async () => {
    view = await mountMobile({ entry: "/dashboard", preference: "mobile", auth: { isAuthenticated: false, initializing: true, token: TOKEN_A, user: null } });
    assert.equal(location(), "/dashboard");
    assert.equal(appeared.length, 0);
  });
});

describe("a Mobile visitor", () => {
  it("goes straight from a canonical Home address to /m by replacement, never showing the Desktop page", async () => {
    view = await mountMobile({ entry: "/dashboard?x=1#h", preference: "mobile" });

    assert.equal(location(), "/m?x=1#h");
    assert.equal(q("#desktop-page"), null);
    assert.equal(q("[data-sm-screen='home']") !== null, true);
  });

  it("is the only one who sees the Mobile loading state", async () => {
    view = await mountMobile({ entry: "/m/more", preference: "mobile" });
    assert.ok(appeared.some((name) => /\bsm-boot\b/.test(name)) || appeared.some((name) => /\bsm-root\b/.test(name)));
  });
});

describe("/m/enter: the explicit way into Mobile", () => {
  it("asks first, and does not change the stored choice just by being opened", async () => {
    view = await mountMobile({ entry: "/m/enter", preference: "desktop" });

    assert.equal(location(), "/m/enter", "the resolver leaves it alone in Desktop mode");
    assert.equal(q("h1").textContent, "Open the Mobile version?");
    assert.equal(window.localStorage.getItem(PRESENTATION_KEY), "desktop");
    assert.deepEqual(qa("button, a", q("main")).map((item) => item.textContent), ["Open Mobile", "Stay on the full version"]);
    assert.deepEqual(api.calls, []);
  });

  it("one tap on Open Mobile stores the choice and lands on Mobile Home, replacing the entry", async () => {
    view = await mountMobile({ entry: "/m/enter", preference: "desktop" });
    await click(qa("button", q("main")).find((button) => button.textContent === "Open Mobile"));
    await settle();

    assert.equal(window.localStorage.getItem(PRESENTATION_KEY), "mobile");
    assert.equal(location(), "/m");
    assert.ok(q("[data-sm-screen='home']"));
  });

  it("Stay leaves the stored choice as it was and goes to the Desktop dashboard", async () => {
    view = await mountMobile({ entry: "/m/enter", preference: "desktop" });
    await click(qa("a", q("main")).find((link) => link.textContent === "Stay on the full version"));
    await settle();

    assert.equal(window.localStorage.getItem(PRESENTATION_KEY), "desktop");
    assert.equal(location(), "/dashboard");
    assert.ok(q("#desktop-page"));
  });

  it("works from automatic on a computer too, and someone already in Mobile is simply taken Home", async () => {
    view = await mountMobile({ entry: "/m/enter", preference: null });
    assert.equal(q("h1").textContent, "Open the Mobile version?");
    await view.unmount();
    view = null;

    view = await mountMobile({ entry: "/m/enter", preference: "mobile" });
    assert.equal(location(), "/m");
  });

  it("makes no automatic switch and no loop: after Open Mobile the Desktop choice is gone, and choosing Desktop again in More is respected", async () => {
    view = await mountMobile({ entry: "/m/enter", preference: "desktop" });
    await click(qa("button", q("main")).find((button) => button.textContent === "Open Mobile"));
    await settle();
    await click(qa("a", q("nav.sm-nav")).find((link) => link.textContent.trim() === "More"));
    await settle();
    await click(qa("input[name='sm-presentation']").find((radio) => radio.value === "desktop"));
    await settle();

    assert.equal(window.localStorage.getItem(PRESENTATION_KEY), "desktop");
    assert.equal(location(), "/dashboard/settings");
    assert.ok(q("#desktop-page"), "Desktop is shown and stays shown");

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    assert.equal(location(), "/dashboard/settings", "no automatic return to Mobile");
  });

  it("a signed-out visitor is sent to sign-in and the address is remembered for afterwards", async () => {
    view = await mountMobile({ entry: "/m/enter", preference: "desktop", auth: { isAuthenticated: false, initializing: false, token: null, user: null } });
    assert.equal(location(), "/signin");
  });
});

describe("Desktop-mode mappings of the new Mobile addresses, in the router", () => {
  it("/m/accounts and an account's page go to the Desktop pages, keeping query and hash", async () => {
    view = await mountMobile({ entry: "/m/accounts/7?a=1#h", preference: "desktop" });
    assert.equal(location(), "/dashboard/accounts/7?a=1#h");
    assert.deepEqual(api.calls, [], "no Mobile read was started on the way");
    await view.unmount();
    view = null;

    view = await mountMobile({ entry: "/m/accounts", preference: "desktop" });
    assert.equal(location(), "/dashboard/accounts");
  });

  it("in Mobile mode, the Desktop Accounts page is left alone", async () => {
    view = await mountMobile({ entry: "/dashboard/accounts?x=1", preference: "mobile" });
    assert.equal(location(), "/dashboard/accounts?x=1");
    assert.ok(q("#desktop-page"));
  });

  it("the Accounts links inside Mobile stay in Mobile", async () => {
    view = await mountMobile({ entry: "/m", preference: "mobile" });
    await click(q("a[href='/m/accounts']", q("main")));
    await settle();
    assert.equal(location(), "/m/accounts");
    assert.ok(text().includes("Everyday wallet"));
  });
});

describe("history", () => {
  it("Back from an account returns to the list, then Home; the redirect that brought the visitor to Home left no entry behind", async () => {
    view = await mountMobile({ entry: "/dashboard", preference: "mobile" });
    assert.equal(location(), "/m");

    await click(q("a[href='/m/accounts']", q("main")));
    await settle();
    await click(q("a[href='/m/accounts/1']", q("main")));
    await settle();
    assert.equal(location(), "/m/accounts/1");

    await goBack();
    await settle();
    assert.equal(location(), "/m/accounts");

    await goBack();
    await settle();
    assert.equal(location(), "/m", "Home, not the canonical /dashboard that was redirected");
    assert.ok(q("[data-sm-screen='home']"));
  });

  it("the Back link on an account's page goes to the list", async () => {
    view = await mountMobile({ entry: "/m/accounts/1", preference: "mobile" });
    await click(q("a.sm-back"));
    await settle();
    assert.equal(location(), "/m/accounts");
  });
});
