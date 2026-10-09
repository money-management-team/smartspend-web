import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../src/features/Dashboards/User/api/apiClient.js";
import { whatsappApi } from "../../src/features/Dashboards/User/api/whatsappApi.js";
import {
  POLL_INTERVAL_MS, buildWhatsAppDeepLink, copyTextToClipboard, createChallengePoller,
  getWhatsAppErrorMessage, initialLinkState, isEligibleDefaultAccount, linkReducer,
} from "../../src/features/Dashboards/User/Settings/components/WhatsAppIntegration/whatsappLinking.js";
import { formatLinkedDate, maskedDigits } from "../../src/features/Dashboards/User/Settings/components/WhatsAppIntegration/whatsappFormat.js";
import { envelope, installBrowserStubs, mockFetch } from "../helpers/mockFetch.mjs";
import { createI18n, locales } from "../helpers/i18n.mjs";
import { DISABLED_BODY, TOKEN, challenge } from "../whatsapp/fixtures.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function fakeClock() {
  let now = 1_000_000;
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
        await tick();
      }
      now = end;
    },
  };
}

const apiError = (status, code, over = {}) => new ApiError("m", { status, code, ...over });
const ok = (over) => envelope({ challenge: challenge(over) });

function setup(fetchChallenge, options = {}) {
  const clock = fakeClock();
  const updates = [];
  const stops = [];
  const poller = createChallengePoller({
    fetchChallenge,
    onUpdate: (c) => updates.push(c),
    onStop: (reason, error) => stops.push([reason, error]),
    timers: clock.timers,
    ...options,
  });
  return { clock, updates, stops, poller };
}

describe("challenge poller", () => {
  it("polls on a bounded interval and stops once the sender is verified", async () => {
    const responses = [ok(), ok(), ok({ status: "sender_verified", sender_verified: true })];
    const calls = [];
    const { clock, updates, stops, poller } = setup(async (token) => { calls.push(token); return responses.shift(); });

    poller.start(TOKEN);
    assert.equal(calls.length, 0); // nothing before the first interval
    await clock.advance(POLL_INTERVAL_MS);
    assert.equal(calls.length, 1);
    await clock.advance(POLL_INTERVAL_MS * 2);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls, [TOKEN, TOKEN, TOKEN]);
    assert.equal(updates.at(-1).status, "sender_verified");
    assert.deepEqual(stops.map(([r]) => r), ["settled"]);
    assert.equal(poller.active, false);
    assert.equal(clock.pending, 0);
    await clock.advance(POLL_INTERVAL_MS * 10);
    assert.equal(calls.length, 3);
  });

  it("never overlaps requests and keeps one timer", async () => {
    let release;
    let calls = 0;
    const { clock, poller } = setup(() => { calls += 1; return new Promise((resolve) => { release = () => resolve(ok()); }); });
    poller.start(TOKEN);
    await clock.advance(POLL_INTERVAL_MS);
    await clock.advance(POLL_INTERVAL_MS * 5); // slow request still in flight
    assert.equal(calls, 1);
    assert.equal(clock.pending, 0);
    release();
    await tick();
    assert.equal(clock.pending, 1);
    poller.stop();
  });

  it("stops immediately on whatsapp_disabled", async () => {
    const { clock, stops, poller } = setup(async () => {
      throw apiError(409, "CONFLICT", { serverCode: "whatsapp_disabled", payload: DISABLED_BODY });
    });
    poller.start(TOKEN);
    await clock.advance(POLL_INTERVAL_MS);
    assert.equal(stops.length, 1);
    assert.equal(stops[0][0], "fatal");
    assert.equal(stops[0][1].serverCode, "whatsapp_disabled");
    assert.equal(clock.pending, 0);
  });

  for (const [status, code] of [[401, "UNAUTHENTICATED"], [403, "FORBIDDEN"], [404, "NOT_FOUND"]]) {
    it(`stops on ${status}`, async () => {
      let calls = 0;
      const { clock, stops } = (() => {
        const s = setup(async () => { calls += 1; throw apiError(status, code); });
        s.poller.start(TOKEN);
        return s;
      })();
      await clock.advance(POLL_INTERVAL_MS * 4);
      assert.equal(calls, 1);
      assert.equal(stops[0][0], "fatal");
    });
  }

  it("an ordinary 409 does not stop it", async () => {
    let calls = 0;
    const { clock, stops, poller } = setup(async () => { calls += 1; throw apiError(409, "CONFLICT"); });
    poller.start(TOKEN);
    await clock.advance(POLL_INTERVAL_MS * 2);
    assert.ok(calls >= 1);
    assert.equal(stops.length, 0);
    poller.stop();
  });

  for (const status of ["expired", "cancelled", "confirmed"]) {
    it(`stops when the challenge is ${status}`, async () => {
      const { clock, updates, stops, poller } = setup(async () => ok({ status }));
      poller.start(TOKEN);
      await clock.advance(POLL_INTERVAL_MS);
      assert.equal(updates[0].status, status);
      assert.deepEqual(stops.map(([r]) => r), ["settled"]);
      assert.equal(clock.pending, 0);
    });
  }

  it("stop() aborts the in-flight request, stays silent and cannot resume", async () => {
    let signal;
    let release;
    const { clock, updates, stops, poller } = setup((token, options) => {
      signal = options.signal;
      return new Promise((resolve) => { release = () => resolve(ok()); });
    });
    poller.start(TOKEN);
    await clock.advance(POLL_INTERVAL_MS);
    poller.stop();
    assert.equal(signal.aborted, true);
    release();
    await tick();
    await clock.advance(POLL_INTERVAL_MS * 5);
    assert.equal(updates.length, 0);
    assert.deepEqual(stops.map(([r]) => r), ["cancelled"]);
    assert.equal(clock.pending, 0);
  });

  it("starting again replaces the previous poll (no duplicate intervals)", async () => {
    let calls = 0;
    const { clock, poller } = setup(async () => { calls += 1; return ok(); });
    poller.start(TOKEN);
    poller.start(TOKEN);
    poller.start(TOKEN);
    assert.equal(clock.pending, 1);
    await clock.advance(POLL_INTERVAL_MS);
    assert.equal(calls, 1);
    poller.stop();
  });

  it("backs off on 429 using Retry-After, then recovers", async () => {
    const times = [];
    let n = 0;
    const clock = fakeClock();
    const poller = createChallengePoller({
      fetchChallenge: async () => {
        times.push(clock.timers.now());
        n += 1;
        if (n === 1) throw apiError(429, "RATE_LIMITED", { retryAfter: "20" });
        return ok();
      },
      timers: clock.timers,
    });
    poller.start(TOKEN);
    await clock.advance(POLL_INTERVAL_MS);
    await clock.advance(19_000);
    assert.equal(times.length, 1);
    await clock.advance(1_000);
    assert.equal(times.length, 2);
    assert.equal(times[1] - times[0], 20_000);
    await clock.advance(POLL_INTERVAL_MS); // interval is back to normal
    assert.equal(times.length, 3);
    poller.stop();
  });

  it("gives up after repeated transient failures, with growing gaps", async () => {
    const times = [];
    const clock = fakeClock();
    const stops = [];
    const poller = createChallengePoller({
      fetchChallenge: async () => { times.push(clock.timers.now()); throw new ApiError("", { code: "NETWORK_ERROR" }); },
      onStop: (reason) => stops.push(reason),
      timers: clock.timers,
    });
    poller.start(TOKEN);
    await clock.advance(5 * 60_000);
    assert.equal(times.length, 5);
    assert.deepEqual(stops, ["transient"]);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    assert.ok(gaps.every((gap, i) => i === 0 || gap >= gaps[i - 1]));
  });

  it("is bounded by the challenge expiry (plus a short grace)", async () => {
    const { clock, stops } = (() => {
      const s = setup(async () => ok());
      s.poller.start(TOKEN, { expiresAt: new Date(s.clock.timers.now() + 30_000).toISOString() });
      return s;
    })();
    await clock.advance(5 * 60_000);
    assert.deepEqual(stops.map(([r]) => r), ["deadline"]);
    assert.equal(clock.pending, 0);
  });

  it("is bounded in total duration even without an expiry", async () => {
    const { clock, stops, poller } = setup(async () => ok(), { maxDurationMs: 60_000 });
    poller.start(TOKEN);
    await clock.advance(10 * 60_000);
    assert.deepEqual(stops.map(([r]) => r), ["deadline"]);
  });

  it("a malformed poll response is treated as transient, not as success", async () => {
    const { clock, updates, stops, poller } = setup(async () => envelope({ nope: true }));
    poller.start(TOKEN);
    await clock.advance(POLL_INTERVAL_MS);
    assert.equal(updates.length, 0);
    assert.equal(stops.length, 0);
    poller.stop();
  });

  it("works with the TASK 04 adapter end to end (token in the path, never the body)", async () => {
    installBrowserStubs();
    const calls = mockFetch(() => ({ body: ok({ status: "sender_verified", sender_verified: true }) }));
    const { clock, updates, poller } = setup((token, options) => whatsappApi.getLinkChallenge(token, options));
    poller.start(TOKEN);
    await clock.advance(POLL_INTERVAL_MS);
    assert.equal(calls[0].url, `/api/integrations/whatsapp/link-challenges/${TOKEN}`);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].rawBody, undefined);
    assert.equal(updates[0].sender_verified, true);
  });
});

describe("link reducer", () => {
  const linking = { token: TOKEN, public_number: "+970 59 000 0000", message: `LINK ${TOKEN}` };

  it("walks idle → creating → waiting → verified → confirming", () => {
    let s = linkReducer(initialLinkState, { type: "create" });
    assert.equal(s.phase, "creating");
    s = linkReducer(s, { type: "created", challenge: challenge(), linking });
    assert.equal(s.phase, "waiting");
    s = linkReducer(s, { type: "challenge", challenge: challenge() });
    assert.equal(s.phase, "waiting");
    s = linkReducer(s, { type: "challenge", challenge: challenge({ status: "sender_verified", sender_verified: true, phone_last_digits: "5678" }) });
    assert.equal(s.phase, "verified");
    assert.equal(s.challenge.phone_last_digits, "5678");
    s = linkReducer(s, { type: "confirm" });
    assert.equal(s.phase, "confirming");
  });

  it("verification alone never reaches confirming; confirm needs the verified phase", () => {
    let s = linkReducer(initialLinkState, { type: "created", challenge: challenge(), linking });
    assert.equal(linkReducer(s, { type: "confirm" }).phase, "waiting");
    s = linkReducer(s, { type: "challenge", challenge: challenge({ status: "sender_verified", sender_verified: true }) });
    assert.notEqual(s.phase, "confirming");
  });

  it("expiry and cancellation drop the token from state", () => {
    const base = linkReducer(initialLinkState, { type: "created", challenge: challenge(), linking });
    for (const status of ["expired", "cancelled"]) {
      const s = linkReducer(base, { type: "challenge", challenge: challenge({ status }) });
      assert.equal(s.phase, status);
      assert.equal(s.linking, null);
      assert.equal(JSON.stringify(s).includes(TOKEN), false);
    }
    const dead = linkReducer(base, { type: "deadline" });
    assert.equal(dead.phase, "expired");
    assert.equal(dead.linking, null);
  });

  it("a created challenge that is already verified skips waiting", () => {
    const s = linkReducer(initialLinkState, { type: "created", challenge: challenge({ sender_verified: true, status: "sender_verified" }), linking });
    assert.equal(s.phase, "verified");
  });

  it("a failed confirmation returns to verified with the error; reset clears everything", () => {
    let s = linkReducer(initialLinkState, { type: "created", challenge: challenge({ status: "sender_verified", sender_verified: true }), linking });
    s = linkReducer(s, { type: "confirm" });
    const error = { context: "confirm", error: apiError(409, "CONFLICT") };
    s = linkReducer(s, { type: "confirm-failed", error });
    assert.equal(s.phase, "verified");
    assert.equal(s.error, error);
    assert.deepEqual(linkReducer(s, { type: "reset" }), initialLinkState);
  });

  it("a late poll result cannot undo confirming", () => {
    let s = linkReducer(initialLinkState, { type: "created", challenge: challenge({ status: "sender_verified", sender_verified: true }), linking });
    s = linkReducer(s, { type: "confirm" });
    s = linkReducer(s, { type: "challenge", challenge: challenge({ status: "expired" }) });
    assert.equal(s.phase, "confirming");
  });
});

describe("helpers", () => {
  it("builds a wa.me link only for a plain service number", () => {
    assert.equal(
      buildWhatsAppDeepLink("+970 59-000 0000", `LINK ${TOKEN}`),
      `https://wa.me/970590000000?text=${encodeURIComponent(`LINK ${TOKEN}`)}`,
    );
    for (const bad of [null, "", "call me", "+1", "javascript:alert(1)", "https://evil.example", "123456789012345678"]) {
      assert.equal(buildWhatsAppDeepLink(bad, "LINK x"), null, String(bad));
    }
    assert.equal(buildWhatsAppDeepLink("+970590000000", ""), null);
  });

  it("copies through the clipboard API and reports failure without throwing", async () => {
    let copied;
    assert.equal(await copyTextToClipboard("hello", { clipboard: { writeText: async (v) => { copied = v; } } }), true);
    assert.equal(copied, "hello");
    assert.equal(await copyTextToClipboard("x", { clipboard: { writeText: async () => { throw new Error("denied"); } } }), false);
    assert.equal(await copyTextToClipboard("x", {}), false);
    assert.equal(await copyTextToClipboard("x", undefined), false);
  });

  it("masks and formats only safe values", () => {
    assert.equal(maskedDigits("5678"), "••5678");
    assert.equal(maskedDigits(null), null);
    assert.equal(maskedDigits("+970500000000"), null); // a full number is never displayed
    assert.equal(maskedDigits("12ab"), null);
    assert.equal(formatLinkedDate("not a date", "en"), null);
    assert.match(formatLinkedDate("2026-10-06T09:00:00.000000Z", "en"), /2026/);
  });

  it("only offers accounts the backend accepts as a default", () => {
    const base = { id: 1, workspace_id: 3, status: "active", savings_goal: null };
    assert.equal(isEligibleDefaultAccount(base, 3), true);
    assert.equal(isEligibleDefaultAccount({ ...base, status: "archived" }, 3), false);
    assert.equal(isEligibleDefaultAccount({ ...base, savings_goal: { id: 1, name: "Trip" } }, 3), false);
    assert.equal(isEligibleDefaultAccount({ ...base, workspace_id: 9 }, 3), false);
    assert.equal(isEligibleDefaultAccount(null, 3), false);
  });
});

describe("error messages", () => {
  const cases = [
    ["409 whatsapp_disabled", apiError(409, "CONFLICT", { serverCode: "whatsapp_disabled" }), "create", "dashboard.settings.whatsapp.errors.disabled"],
    ["403", apiError(403, "FORBIDDEN"), "preferences", "dashboard.settings.whatsapp.errors.forbidden"],
    ["404 on poll", apiError(404, "NOT_FOUND"), "poll", "dashboard.settings.whatsapp.errors.challengeNotFound"],
    ["404 on confirm", apiError(404, "NOT_FOUND"), "confirm", "dashboard.settings.whatsapp.errors.challengeNotFound"],
    ["409 on create", apiError(409, "CONFLICT"), "create", "dashboard.settings.whatsapp.errors.createConflict"],
    ["409 on confirm", apiError(409, "CONFLICT"), "confirm", "dashboard.settings.whatsapp.errors.confirmConflict"],
    ["409 on preferences", apiError(409, "CONFLICT"), "preferences", "dashboard.settings.whatsapp.errors.notLinked"],
    ["409 on unlink", apiError(409, "CONFLICT"), "unlink", "dashboard.settings.whatsapp.errors.alreadyUnlinked"],
    ["422 account", apiError(422, "VALIDATION_ERROR", { errors: { default_account_id: ["x"] } }), "preferences", "dashboard.settings.whatsapp.errors.invalidAccount"],
    ["422 language", apiError(422, "VALIDATION_ERROR", { errors: { language: ["x"] } }), "preferences", "dashboard.settings.whatsapp.errors.invalidLanguage"],
    ["422 other", apiError(422, "VALIDATION_ERROR"), "preferences", "dashboard.settings.whatsapp.errors.validation"],
  ];

  for (const lng of ["en", "ar"]) {
    for (const [name, error, context, key] of cases) {
      it(`${lng}: ${name}`, async () => {
        const i18n = await createI18n(lng);
        assert.equal(getWhatsAppErrorMessage(error, i18n.t, context), i18n.t(key));
        assert.deepEqual(i18n.missingKeys, []);
      });
    }
  }

  it("429, network and timeout use the shared messages and never leak the token", async () => {
    const i18n = await createI18n("en");
    const rate = getWhatsAppErrorMessage(apiError(429, "RATE_LIMITED", { retryAfter: "9" }), i18n.t, "poll");
    assert.match(rate, /9/);
    assert.equal(getWhatsAppErrorMessage(new ApiError("", { code: "NETWORK_ERROR" }), i18n.t, "create"), i18n.t("api.errors.network"));
    assert.equal(getWhatsAppErrorMessage(new ApiError("", { code: "TIMEOUT" }), i18n.t, "create"), i18n.t("api.errors.timeout"));
    const leaky = new ApiError(`token ${TOKEN} rejected`, { status: 409, code: "CONFLICT" });
    assert.equal(getWhatsAppErrorMessage(leaky, i18n.t, "confirm").includes(TOKEN), false);
  });
});

describe("Arabic and English copy", () => {
  const flat = (object, prefix = "") => Object.entries(object).flatMap(([key, value]) =>
    (value && typeof value === "object" ? flat(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]));
  const en = flat(locales.en.dashboard.settings.whatsapp);
  const ar = new Map(flat(locales.ar.dashboard.settings.whatsapp));

  it("has the same keys and placeholders in both languages", () => {
    assert.ok(en.length > 80);
    for (const [key, value] of en) {
      assert.ok(ar.has(key), `missing in ar: ${key}`);
      const placeholders = (text) => (text.match(/{{\w+}}/g) ?? []).sort().join();
      assert.equal(placeholders(ar.get(key)), placeholders(value), key);
      assert.ok(value.trim() && ar.get(key).trim(), key);
    }
    assert.equal(ar.size, en.length);
  });

  it("Arabic copy is written in Arabic (only language names may stay Latin)", () => {
    for (const [key, value] of ar) {
      if (key === "prefs.languages.en") continue;
      assert.match(value, /[؀-ۿ]/, key);
      assert.doesNotMatch(value.replace(/{{\w+}}/g, ""), /[A-Za-z]{3,}/, key);
    }
  });

  it("the Integrations tab and WhatsApp search keywords exist in both", () => {
    assert.ok(locales.en.dashboard.settings.tabs.integrations);
    assert.ok(locales.ar.dashboard.settings.tabs.integrations);
    assert.match(locales.en.dashboard.search.keywords.settings, /whatsapp/);
    assert.match(locales.ar.dashboard.search.keywords.settings, /whatsapp/);
  });
});
