import "../helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { MemoryRouter } from "react-router-dom";
import WhatsAppPendingProvider from "../../src/contexts/whatsappPending/WhatsAppPendingProvider.jsx";
import { ApiError } from "../../src/features/Dashboards/User/api/apiClient.js";
import { createChallengePoller } from "../../src/features/Dashboards/User/Settings/components/WhatsAppIntegration/whatsappLinking.js";
import { change, click, flush, installDom, render, submit } from "../helpers/dom.mjs";
import { createI18n, withI18n } from "../helpers/i18n.mjs";
import { envelope, installBrowserStubs } from "../helpers/mockFetch.mjs";
import { DISABLED_BODY, TOKEN, availability, challenge, integration } from "../whatsapp/fixtures.mjs";

const dom = installDom();
after(() => dom.window.close());

const { default: WhatsAppIntegration } = await import(
  "../../src/features/Dashboards/User/Settings/components/WhatsAppIntegration/WhatsAppIntegration.jsx"
);
const { default: SettingsTabs } = await import(
  "../../src/features/Dashboards/User/Settings/components/SettingsTabs/SettingsTabs.jsx"
);

/* ------------------------------------------------------------- fixtures */

const DISABLED = { enabled: false, state: "disabled", capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true }, integration: null };
const NOT_LINKED = { enabled: true, state: "not_linked", capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true }, integration: null };
const LINKED = availability();
const inFifteenMinutes = () => new Date(Date.now() + 15 * 60_000).toISOString();
const CREATED = {
  challenge: challenge({ expires_at: inFifteenMinutes() }),
  linking: { token: TOKEN, public_number: "+970 59 000 0000", message: `LINK ${TOKEN}` },
};
const VERIFIED = { challenge: challenge({ expires_at: inFifteenMinutes(), status: "sender_verified", sender_verified: true, phone_last_digits: "5678" }) };

const apiError = (status, code, over = {}) => new ApiError("raw backend text", { status, code, ...over });

/** A scriptable fake of the whatsappApi surface; every call is recorded. */
function makeApi(script = {}) {
  const calls = [];
  const signals = [];
  const queue = (value) => (Array.isArray(value) ? value : [value]);
  const state = { integration: queue(script.integration ?? NOT_LINKED), challenge: queue(script.challenge ?? VERIFIED) };

  const record = (name) => (...args) => {
    calls.push(name);
    const options = args.at(-1);
    if (options && typeof options === "object" && "signal" in options) signals.push(options.signal);
  };
  const next = (list) => {
    const value = list.length > 1 ? list.shift() : list[0];
    if (value instanceof Error) throw value;
    return value;
  };

  const api = {
    calls,
    signals,
    count: (name) => calls.filter((call) => call === name).length,
    getDraftSummary: async () => { calls.push("getDraftSummary"); return envelope({ pending_review_count: script.pending ?? 3 }); },
    getIntegration: async (...a) => { record("getIntegration")(...a); return envelope(next(state.integration)); },
    createLinkChallenge: async (...a) => {
      record("createLinkChallenge")(...a);
      if (script.create instanceof Error) throw script.create;
      return envelope(script.create ?? CREATED);
    },
    getLinkChallenge: async (...a) => { record("getLinkChallenge")(...a); return envelope(next(state.challenge)); },
    confirmLinkChallenge: async (...a) => {
      record("confirmLinkChallenge")(...a);
      if (script.confirm instanceof Error) throw script.confirm;
      await (script.confirmGate ?? Promise.resolve());
      return envelope({ integration: integration() });
    },
    updatePreferences: async (values) => {
      calls.push("updatePreferences");
      api.lastPreferences = values;
      if (script.save instanceof Error) throw script.save;
      return envelope({ integration: integration({ ...values }) });
    },
    unlink: async () => {
      calls.push("unlink");
      if (script.unlink instanceof Error) throw script.unlink;
      await (script.unlinkGate ?? Promise.resolve());
      return envelope({ integration: integration({ linked: false, status: "revoked" }) });
    },
  };
  return api;
}

const ACCOUNTS = [
  { id: 1, workspace_id: 1, name: "Cash", currency_code: "ILS", status: "active", savings_goal: null, current_balance: "10.0000" },
  { id: 2, workspace_id: 1, name: "Bank", currency_code: "ILS", status: "active", savings_goal: null, current_balance: "20.0000" },
  { id: 3, workspace_id: 1, name: "Old", currency_code: "ILS", status: "archived", savings_goal: null },
  { id: 4, workspace_id: 1, name: "Holiday pot", currency_code: "ILS", status: "active", savings_goal: { id: 9, name: "Holiday" } },
  { id: 5, workspace_id: 2, name: "Other workspace", currency_code: "ILS", status: "active", savings_goal: null },
];

function makeAccounts(items = ACCOUNTS) {
  const calls = [];
  return { calls, list: async (query) => { calls.push(query); return envelope({ accounts: items }); } };
}

function fakeClock() {
  let now = Date.now();
  let id = 0;
  const queue = new Map();
  return {
    timers: {
      setTimer: (callback, ms) => { queue.set(++id, { callback, at: now + ms }); return id; },
      clearTimer: (timerId) => queue.delete(timerId),
      now: () => now,
    },
    get pending() { return queue.size; },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...queue.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        queue.delete(next[0]);
        now = next[1].at;
        next[1].callback();
        await flush();
      }
      now = end;
    },
  };
}

let i18n;
let clock;
let view;
let consoleOutput;
const originals = {};

async function mount(api, { lng = "en", accounts = makeAccounts() } = {}) {
  i18n = await createI18n(lng);
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  const createPoller = (options) => createChallengePoller({ ...options, timers: clock.timers });
  view = await render(withI18n(i18n, h(MemoryRouter, null, h(WhatsAppPendingProvider, { api, userId: "u1" }, h(WhatsAppIntegration, { api, accounts, createPoller })))));
  await flush();
  return { api, accounts, container: view.container };
}

const text = () => view.container.textContent;
const button = (label) => [...document.body.querySelectorAll("button")].find((node) => node.textContent.trim() === label);
const t = (key, options) => i18n.t(`dashboard.settings.whatsapp.${key}`, options);

beforeEach(() => {
  installBrowserStubs();
  clock = fakeClock();
  consoleOutput = [];
  for (const method of ["log", "info", "warn", "error", "debug"]) {
    originals[method] = console[method];
    console[method] = (...args) => consoleOutput.push([method, args.map(String).join(" ")]);
  }
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  for (const [method, fn] of Object.entries(originals)) console[method] = fn;
  document.body.innerHTML = "";
});

/** Nothing sensitive may be in storage, the URL, cookies or the console. */
function assertNoTokenLeak() {
  const dump = JSON.stringify([
    globalThis.localStorage.dump(), globalThis.sessionStorage.dump(),
    dom.window.location.href, document.cookie, consoleOutput,
  ]);
  assert.equal(dump.includes(TOKEN), false);
  assert.equal(dump.includes("LINK "), false);
}

/** With WhatsApp off there are no controls; the draft inbox link is the one allowed action. */
function assertOnlyInboxLink() {
  assert.equal(view.container.querySelectorAll("button, input, select").length, 0);
  assert.deepEqual([...view.container.querySelectorAll("a")].map((a) => a.getAttribute("href")), ["/dashboard/whatsapp/drafts"]);
}

/* ---------------------------------------------------------------- tests */

describe("states", () => {
  it("disabled: calm unavailable state with no actions", async () => {
    const { api } = await mount(makeApi({ integration: DISABLED }));
    assert.match(text(), new RegExp(t("disabled.title")));
    assert.match(text(), new RegExp(t("status.disabled")));
    assertOnlyInboxLink();
    assert.equal(button(t("intro.connect")), undefined);
    assert.equal(api.count("getIntegration"), 1);
    assert.equal(api.count("createLinkChallenge"), 0);
  });

  it("disabled with a previously linked number: shown as information only", async () => {
    await mount(makeApi({ integration: availability({
      enabled: false,
      state: "disabled",
      capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true },
    }) }));
    assert.match(text(), /••5678/);
    assert.match(text(), new RegExp(t("disabled.previousNote")));
    assert.doesNotMatch(text(), new RegExp(t("status.linked")));
    assertOnlyInboxLink();
    assert.equal(button(t("unlink.action")), undefined);
    assert.equal(view.container.querySelector("form"), null);
  });

  it("not linked: introduction, the no-auto-post promise and a Connect action", async () => {
    await mount(makeApi({ integration: NOT_LINKED }));
    assert.match(text(), new RegExp(t("intro.title")));
    assert.match(text(), new RegExp(t("intro.points.b")));
    assert.match(text(), new RegExp(t("status.notLinked")));
    assert.ok(button(t("intro.connect")));
  });

  it("not linked without can_link offers no Connect action", async () => {
    await mount(makeApi({ integration: { ...NOT_LINKED, capabilities: { ...NOT_LINKED.capabilities, can_link: false } } }));
    assert.equal(button(t("intro.connect")), undefined);
  });

  it("linked: masked number, language, default account and linked date", async () => {
    await mount(makeApi({ integration: LINKED }));
    assert.match(text(), new RegExp(t("connected.title")));
    assert.match(text(), /••5678/);
    assert.match(text(), /2026/);
    assert.doesNotMatch(text(), /\+\d{6,}/);
    assert.ok(button(t("unlink.action")));
  });

  it("shows a retryable error when the state cannot be loaded, then recovers", async () => {
    const api = makeApi({ integration: [new ApiError("", { code: "NETWORK_ERROR" }), NOT_LINKED] });
    await mount(api);
    const alert = view.container.querySelector("[role=alert]");
    assert.equal(alert.textContent.includes(i18n.t("api.errors.network")), true);
    await click(button(i18n.t("common.retry")));
    await flush();
    assert.match(text(), new RegExp(t("intro.title")));
    assert.equal(api.count("getIntegration"), 2);
  });

  it("401, 403 and 429 on load are reported, not hidden", async () => {
    for (const [error, expected] of [
      [apiError(401, "UNAUTHENTICATED"), "raw backend text"],
      [apiError(403, "FORBIDDEN"), "raw backend text"],
      [apiError(429, "RATE_LIMITED", { retryAfter: "12" }), null],
    ]) {
      await mount(makeApi({ integration: error }));
      const alert = view.container.querySelector("[role=alert]");
      assert.ok(alert, error.code);
      if (expected) assert.match(alert.textContent, new RegExp(expected));
      else assert.match(alert.textContent, /12/);
      await view.unmount();
      view = null;
    }
  });

  it("an old server without the new contract gets an explicit message", async () => {
    await mount(makeApi({ integration: { integration: null } }));
    assert.match(text(), new RegExp(t("errors.unsupported")));
  });
});

describe("linking flow", () => {
  it("creating a challenge shows the exact backend message, number, stepper and a wa.me link", async () => {
    const api = (await mount(makeApi())).api;
    await click(button(t("intro.connect")));
    await flush();

    assert.equal(api.count("createLinkChallenge"), 1);
    assert.equal(view.container.querySelector("code").textContent, `LINK ${TOKEN}`);
    assert.match(text(), /\+970 59 000 0000/);
    assert.equal(view.container.querySelectorAll(".wa-steps__item").length, 4);
    assert.equal(view.container.querySelector("[aria-current=step]").textContent.includes(t("flow.steps.send")), true);
    const link = view.container.querySelector("a.wa-button--whatsapp");
    assert.equal(link.href, `https://wa.me/970590000000?text=${encodeURIComponent(`LINK ${TOKEN}`)}`);
    assert.equal(link.rel, "noopener noreferrer");
    assert.equal(link.target, "_blank");
    assert.equal(button(t("flow.confirm")), undefined); // not verified yet
    assertNoTokenLeak();
  });

  it("a double click on Connect creates one challenge", async () => {
    const api = (await mount(makeApi())).api;
    const connect = button(t("intro.connect"));
    await click(connect);
    await click(connect);
    await flush();
    assert.equal(api.count("createLinkChallenge"), 1);
  });

  it("the copy button copies the message and announces it", async () => {
    await mount(makeApi());
    let copied = null;
    Object.defineProperty(dom.window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { copied = value; } },
    });
    await click(button(t("intro.connect")));
    await flush();
    await click(button(t("flow.copy")));
    await flush();
    assert.equal(copied, `LINK ${TOKEN}`);
    assert.equal(button(t("flow.copied")) !== undefined, true);
    assert.equal(view.container.querySelector(".wa-message__feedback").textContent, t("flow.copiedAnnounce"));
    assertNoTokenLeak();
  });

  it("when the clipboard is unavailable it says so and selects the text", async () => {
    await mount(makeApi());
    Object.defineProperty(dom.window.navigator, "clipboard", { configurable: true, value: undefined });
    await click(button(t("intro.connect")));
    await flush();
    await click(button(t("flow.copy")));
    await flush();
    assert.equal(view.container.querySelector(".wa-message__feedback").textContent, t("flow.copyFailed"));
    assert.equal(dom.window.getSelection().toString(), `LINK ${TOKEN}`);
  });

  it("polls the challenge, shows verification with the masked number and does NOT confirm by itself", async () => {
    const api = (await mount(makeApi({ challenge: [{ challenge: challenge({ expires_at: inFifteenMinutes() }) }, VERIFIED] }))).api;
    await click(button(t("intro.connect")));
    await flush();
    assert.equal(api.count("getLinkChallenge"), 0);

    await clock.advance(4_000);
    assert.equal(api.count("getLinkChallenge"), 1);
    assert.match(text(), new RegExp(t("flow.waiting")));

    await clock.advance(4_000);
    assert.equal(api.count("getLinkChallenge"), 2);
    assert.match(text(), new RegExp(t("flow.verifiedTitle")));
    assert.match(text(), /••5678/);
    assert.equal(clock.pending, 0, "polling stops once verified");

    await clock.advance(60_000);
    assert.equal(api.count("confirmLinkChallenge"), 0, "explicit confirmation is required");
    assert.equal(api.count("getIntegration"), 1);
    assertNoTokenLeak();
  });

  it("explicit confirmation links once (double click is ignored), then shows the connected state", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const api = makeApi({ integration: [NOT_LINKED, LINKED], challenge: VERIFIED, confirmGate: gate });
    await mount(api);
    await click(button(t("intro.connect")));
    await flush();
    await clock.advance(4_000);

    const confirm = button(t("flow.confirm"));
    await click(confirm);
    await click(confirm);
    assert.equal(api.count("confirmLinkChallenge"), 1);
    assert.ok(button(t("flow.confirming")).disabled);

    release();
    await flush();
    await flush();
    assert.equal(api.count("getIntegration"), 2, "state refreshed from the backend");
    assert.match(text(), new RegExp(t("connected.title")));
    assert.match(text(), new RegExp(t("flow.success")));
    assert.equal(view.container.querySelector("code"), null, "transient linking state is gone");
    assertNoTokenLeak();
  });

  it("success is not shown when the backend refuses the confirmation", async () => {
    const api = makeApi({ challenge: VERIFIED, confirm: apiError(409, "CONFLICT") });
    await mount(api);
    await click(button(t("intro.connect")));
    await flush();
    await clock.advance(4_000);
    await click(button(t("flow.confirm")));
    await flush();
    assert.doesNotMatch(text(), new RegExp(t("flow.success")));
    assert.equal(view.container.querySelector("[role=alert]").textContent, t("errors.confirmConflict"));
    assert.doesNotMatch(text(), /raw backend text/);
    assert.ok(button(t("flow.confirm")), "the user may retry");
    assert.equal(api.count("getIntegration"), 1);
  });

  it("an expired challenge shows how to restart and never restarts by itself", async () => {
    const api = (await mount(makeApi({ challenge: { challenge: challenge({ expires_at: inFifteenMinutes(), status: "expired" }) } }))).api;
    await click(button(t("intro.connect")));
    await flush();
    await clock.advance(4_000);
    assert.match(text(), new RegExp(t("flow.expiredTitle")));
    assert.equal(clock.pending, 0);
    await clock.advance(120_000);
    assert.equal(api.count("createLinkChallenge"), 1);

    await click(button(t("flow.restart")));
    await flush();
    assert.equal(api.count("createLinkChallenge"), 2);
  });

  it("a cancelled challenge is reported", async () => {
    await mount(makeApi({ challenge: { challenge: challenge({ expires_at: inFifteenMinutes(), status: "cancelled" }) } }));
    await click(button(t("intro.connect")));
    await flush();
    await clock.advance(4_000);
    assert.match(text(), new RegExp(t("flow.cancelledTitle")));
  });

  it("whatsapp_disabled while polling stops it and switches to the unavailable state", async () => {
    const disabledError = apiError(409, "CONFLICT", { serverCode: "whatsapp_disabled", payload: DISABLED_BODY });
    const api = makeApi({ integration: [NOT_LINKED, DISABLED], challenge: disabledError });
    await mount(api);
    await click(button(t("intro.connect")));
    await flush();
    await clock.advance(4_000);
    await flush();

    assert.equal(api.count("getLinkChallenge"), 1);
    assert.equal(clock.pending, 0);
    await clock.advance(120_000);
    assert.equal(api.count("getLinkChallenge"), 1);
    assert.equal(api.count("getIntegration"), 2);
    assert.match(text(), new RegExp(t("disabled.title")));
    assert.equal(button(t("intro.connect")), undefined);
  });

  it("whatsapp_disabled on creation is explained and not retried", async () => {
    const api = makeApi({ create: apiError(409, "CONFLICT", { serverCode: "whatsapp_disabled" }), integration: [NOT_LINKED, DISABLED] });
    await mount(api);
    await click(button(t("intro.connect")));
    await flush();
    await flush();
    assert.equal(api.count("createLinkChallenge"), 1);
    assert.match(text(), new RegExp(t("disabled.title")));
  });

  it("creation errors are actionable: 429, network, 403", async () => {
    const cases = [
      [apiError(429, "RATE_LIMITED", { retryAfter: "30" }), (message) => /30/.test(message)],
      [new ApiError("", { code: "NETWORK_ERROR" }), (message) => message === i18n.t("api.errors.network")],
      [apiError(403, "FORBIDDEN"), (message) => message === t("errors.forbidden")],
    ];
    for (const [error, matches] of cases) {
      await mount(makeApi({ create: error }));
      await click(button(t("intro.connect")));
      await flush();
      const alert = view.container.querySelector("[role=alert]");
      assert.ok(alert && matches(alert.textContent), error.code);
      assert.ok(button(t("flow.close")));
      await view.unmount();
      view = null;
    }
  });

  it("Cancel aborts polling and returns to the introduction", async () => {
    const api = (await mount(makeApi({ challenge: { challenge: challenge({ expires_at: inFifteenMinutes() }) } }))).api;
    await click(button(t("intro.connect")));
    await flush();
    await clock.advance(4_000);
    await click(button(t("flow.cancel")));
    await flush();
    assert.equal(clock.pending, 0);
    assert.ok(button(t("intro.connect")));
    assert.equal(view.container.querySelector("code"), null);
    await clock.advance(60_000);
    assert.equal(api.count("getLinkChallenge"), 1);
  });

  it("leaving the page cancels the request in flight and the timer", async () => {
    let signal;
    const api = makeApi();
    api.getLinkChallenge = async (_token, options) => {
      api.calls.push("getLinkChallenge");
      signal = options.signal;
      return new Promise(() => {});
    };
    await mount(api);
    await click(button(t("intro.connect")));
    await flush();
    await clock.advance(4_000);
    assert.equal(signal.aborted, false);

    await view.unmount();
    view = null;
    assert.equal(signal.aborted, true);
    assert.equal(clock.pending, 0);
    await clock.advance(120_000);
    assert.equal(api.count("getLinkChallenge"), 1);
  });

  it("unmounting while the challenge is being created aborts that request", async () => {
    let signal;
    const api = makeApi();
    api.createLinkChallenge = async (options) => { signal = options.signal; return new Promise(() => {}); };
    await mount(api);
    await click(button(t("intro.connect")));
    await view.unmount();
    view = null;
    assert.equal(signal.aborted, true);
  });
});

describe("preferences", () => {
  it("lists only eligible accounts of the linked workspace and no balances", async () => {
    const accounts = makeAccounts();
    await mount(makeApi({ integration: LINKED }), { accounts });
    const options = [...view.container.querySelectorAll("select option")].map((o) => o.textContent);
    assert.deepEqual(options, [t("prefs.noDefault"), "Cash · ILS", "Bank · ILS"]);
    assert.deepEqual(accounts.calls, [{ id_workspace: 1 }]);
    assert.doesNotMatch(text(), /10\.0000|20\.0000/);
  });

  it("sends only what changed, then confirms from the backend response", async () => {
    const api = makeApi({ integration: LINKED });
    await mount(api);
    assert.ok(button(t("prefs.save")).disabled, "nothing to save yet");

    await change(view.container.querySelector("select"), "2");
    await submit(view.container.querySelector("form.wa-prefs"));
    await flush();
    assert.deepEqual(api.lastPreferences, { default_account_id: 2 });
    assert.equal(view.container.querySelector(".wa-prefs .wa-feedback").textContent, t("prefs.saved"));
    assert.equal(api.count("getIntegration"), 2, "refreshed quietly");
    assert.match(text(), new RegExp(t("connected.title")));
  });

  it("changes the language with the supported values only", async () => {
    const api = makeApi({ integration: LINKED });
    await mount(api);
    const radios = [...view.container.querySelectorAll("input[type=radio]")];
    assert.deepEqual(radios.map((r) => r.value), ["ar", "en"]);
    await click(radios.find((r) => r.value === "en"));
    await submit(view.container.querySelector("form.wa-prefs"));
    await flush();
    assert.deepEqual(api.lastPreferences, { language: "en" });
  });

  it("clearing the default account sends null", async () => {
    const api = makeApi({ integration: LINKED });
    await mount(api);
    await change(view.container.querySelector("select"), "");
    await submit(view.container.querySelector("form.wa-prefs"));
    await flush();
    assert.deepEqual(api.lastPreferences, { default_account_id: null });
  });

  it("a rejected account (422) is explained and the account list is reloaded", async () => {
    const api = makeApi({ integration: LINKED, save: apiError(422, "VALIDATION_ERROR", { errors: { default_account_id: ["no"] } }) });
    const accounts = makeAccounts();
    await mount(api, { accounts });
    await change(view.container.querySelector("select"), "2");
    await submit(view.container.querySelector("form.wa-prefs"));
    await flush();
    await flush();
    assert.equal(view.container.querySelector("[role=alert]").textContent, t("errors.invalidAccount"));
    assert.equal(accounts.calls.length, 2);
    assert.equal(view.container.querySelector(".wa-prefs .wa-feedback").textContent, "");
  });

  it("a saved default that is no longer eligible stays visible as unavailable", async () => {
    await mount(makeApi({ integration: availability({ integration: integration({ default_account_id: 3 }) }) }));
    const selected = view.container.querySelector("select").selectedOptions[0].textContent;
    assert.equal(selected, t("prefs.unavailableAccount"));
  });

  it("whatsapp_disabled while saving refreshes into the unavailable state", async () => {
    const api = makeApi({ integration: [LINKED, DISABLED], save: apiError(409, "CONFLICT", { serverCode: "whatsapp_disabled" }) });
    await mount(api);
    await change(view.container.querySelector("select"), "2");
    await submit(view.container.querySelector("form.wa-prefs"));
    await flush();
    await flush();
    assert.match(text(), new RegExp(t("disabled.title")));
  });
});

describe("unlinking", () => {
  it("asks first; cancelling changes nothing", async () => {
    const api = makeApi({ integration: LINKED });
    await mount(api);
    await click(button(t("unlink.action")));
    const dialog = document.body.querySelector("[role=alertdialog]");
    assert.ok(dialog);
    assert.match(dialog.textContent, new RegExp(t("unlink.confirmTitle")));
    await click(button(t("unlink.cancel")));
    assert.equal(document.body.querySelector("[role=alertdialog]"), null);
    assert.equal(api.count("unlink"), 0);
  });

  it("confirming unlinks once, closes the dialog and re-reads the state", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const api = makeApi({ integration: [LINKED, NOT_LINKED], unlinkGate: gate });
    await mount(api);
    await click(button(t("unlink.action")));
    const confirm = [...document.body.querySelectorAll(".confirm-dialog button")].find((b) => b.textContent === t("unlink.confirm"));
    await click(confirm);
    await click(button(t("unlink.working")) ?? confirm);
    assert.equal(api.count("unlink"), 1);
    assert.equal(document.body.querySelector("[role=alertdialog]"), null);
    assert.ok(button(t("unlink.working")).disabled);

    release();
    await flush();
    await flush();
    assert.equal(api.count("getIntegration"), 2);
    assert.match(text(), new RegExp(t("intro.title")));
    assert.match(text(), new RegExp(t("unlink.done")));
  });

  it("a concurrent unlink (409) is reported and the state is refreshed", async () => {
    const api = makeApi({ integration: [LINKED, NOT_LINKED], unlink: apiError(409, "CONFLICT") });
    await mount(api);
    await click(button(t("unlink.action")));
    await click([...document.body.querySelectorAll(".confirm-dialog button")].find((b) => b.textContent === t("unlink.confirm")));
    await flush();
    await flush();
    assert.equal(api.count("getIntegration"), 2);
    assert.match(text(), new RegExp(t("errors.alreadyUnlinked")));
    assert.match(text(), new RegExp(t("intro.title")));
  });

  it("whatsapp_disabled on unlink leads to the unavailable state, never a fake success", async () => {
    const api = makeApi({ integration: [LINKED, DISABLED], unlink: apiError(409, "CONFLICT", { serverCode: "whatsapp_disabled" }) });
    await mount(api);
    await click(button(t("unlink.action")));
    await click([...document.body.querySelectorAll(".confirm-dialog button")].find((b) => b.textContent === t("unlink.confirm")));
    await flush();
    await flush();
    assert.doesNotMatch(text(), new RegExp(t("unlink.done")));
    assert.match(text(), new RegExp(t("disabled.title")));
  });
});

describe("Arabic and English", () => {
  for (const lng of ["en", "ar"]) {
    it(`${lng}: a full journey renders with no missing translation and no leaks`, async () => {
      const api = makeApi({ integration: [NOT_LINKED, LINKED, NOT_LINKED, DISABLED], challenge: [{ challenge: challenge({ expires_at: inFifteenMinutes() }) }, VERIFIED] });
      await mount(api, { lng });
      assert.equal(document.documentElement.dir, lng === "ar" ? "rtl" : "ltr");
      assert.match(text(), new RegExp(t("intro.title")));

      await click(button(t("intro.connect")));
      await flush();
      assert.match(text(), new RegExp(t("flow.sendTitle")));
      await clock.advance(4_000);
      await clock.advance(4_000);
      assert.match(text(), new RegExp(t("flow.verifiedTitle")));
      await click(button(t("flow.confirm")));
      await flush();
      await flush();
      assert.match(text(), new RegExp(t("connected.title")));

      await click(button(t("unlink.action")));
      assert.ok(document.body.querySelector("[role=alertdialog]"));
      await click([...document.body.querySelectorAll(".confirm-dialog button")].find((b) => b.textContent === t("unlink.confirm")));
      await flush();
      await flush();
      assert.match(text(), new RegExp(t("intro.title")));

      assert.deepEqual(i18n.missingKeys, []);
      if (lng === "ar") assert.match(text(), /[؀-ۿ]/);
      assertNoTokenLeak();
    });
  }

  it("the phone digits and service number stay left-to-right inside Arabic text", async () => {
    await mount(makeApi({ integration: LINKED }), { lng: "ar" });
    assert.equal(view.container.querySelector("bdi").dir, "ltr");
    await view.unmount();
    view = null;

    await mount(makeApi(), { lng: "ar" });
    await click(button(t("intro.connect")));
    await flush();
    assert.equal(view.container.querySelector("code").dir, "ltr");
    assert.equal(view.container.querySelector(".wa-number bdi").dir, "ltr");
  });
});

describe("accessibility", () => {
  it("status changes are announced and controls are labelled", async () => {
    await mount(makeApi({ challenge: VERIFIED }));
    await click(button(t("intro.connect")));
    await flush();
    assert.ok(view.container.querySelector("[role=status]"));
    assert.ok(view.container.querySelector("ol[aria-label]"));
    assert.equal(view.container.querySelector("code").getAttribute("aria-labelledby"), "wa-message-label");
    await clock.advance(4_000);
    assert.ok(view.container.querySelector(".wa-verified[role=status]"));
  });

  it("form controls have visible labels", async () => {
    await mount(makeApi({ integration: LINKED }));
    const select = view.container.querySelector("select");
    assert.equal(view.container.querySelector(`label[for="${select.id}"]`).textContent, t("prefs.account"));
    assert.ok(view.container.querySelector("fieldset legend"));
    for (const radio of view.container.querySelectorAll("input[type=radio]")) {
      assert.ok(radio.closest("label").textContent.trim());
    }
  });

  it("the confirmation dialog is a modal alertdialog with the safe choice focused first", async () => {
    await mount(makeApi({ integration: LINKED }));
    await click(button(t("unlink.action")));
    const dialog = document.body.querySelector("[role=alertdialog]");
    assert.equal(dialog.getAttribute("aria-modal"), "true");
    assert.ok(dialog.getAttribute("aria-labelledby") && dialog.getAttribute("aria-describedby"));
    assert.equal(dialog.querySelector("button").textContent, t("unlink.cancel"));
  });
});

describe("draft inbox entry point (TASK 06)", () => {
  const entry = () => view.container.querySelector("a.wa-inbox");

  for (const [name, integrationState] of [
    ["disabled", DISABLED],
    ["not linked", NOT_LINKED],
    ["linked", LINKED],
    ["disabled with an old link", availability({ enabled: false, state: "disabled", capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true } })],
  ]) {
    it(`is shown when ${name}, pointing at the canonical inbox route`, async () => {
      const api = await mount(makeApi({ integration: integrationState, pending: 7 })).then((r) => r.api);
      assert.equal(entry().getAttribute("href"), "/dashboard/whatsapp/drafts");
      assert.match(entry().textContent, new RegExp(t("inbox.title")));
      assert.equal(entry().querySelector(".wa-inbox__count bdi").textContent, "7", "the backend's count");
      assert.equal(api.count("getDraftSummary"), 1);
    });
  }

  it("is hidden when the backend says drafts cannot be reviewed", async () => {
    await mount(makeApi({ integration: { ...DISABLED, capabilities: { ...DISABLED.capabilities, can_review_drafts: false } } }));
    assert.equal(entry(), null);
  });

  it("still shows the link, without a number, when the count cannot be read", async () => {
    const api = makeApi({ integration: NOT_LINKED });
    api.getDraftSummary = async () => { throw apiError(500, "SERVER_ERROR"); };
    await mount(api);
    assert.ok(entry());
    assert.equal(entry().querySelector(".wa-inbox__count"), null);
  });

  it("does not disturb linking, preferences or unlinking", async () => {
    await mount(makeApi({ integration: LINKED }));
    assert.ok(button(t("unlink.action")));
    assert.ok(view.container.querySelector("form.wa-prefs"));
    assert.ok(entry());
  });
});

describe("Settings navigation", () => {
  it("the Integrations tab exists and is selectable", async () => {
    i18n = await createI18n("en");
    const changes = [];
    view = await render(withI18n(i18n, h(SettingsTabs, { activeTab: "profile", onChange: (tab) => changes.push(tab) })));
    const tabs = [...view.container.querySelectorAll("button")].map((b) => b.textContent);
    assert.deepEqual(tabs, ["Profile", "Security", "Preferences", "Integrations"]);
    await click(button("Integrations"));
    assert.deepEqual(changes, ["integrations"]);
  });
});
