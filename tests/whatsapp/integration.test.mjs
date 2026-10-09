import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { whatsappApi } from "../../src/features/Dashboards/User/api/whatsappApi.js";
import {
  classifyWhatsAppError, isOutcomeUncertain, isWhatsAppDisabledError, parseChallengeStatusResponse,
  parseCreatedChallengeResponse, parseIntegrationResponse, parseWhatsAppAvailability, shouldStopChallengePolling,
} from "../../src/features/Dashboards/User/FinancialOperations/whatsappContract.js";
import { envelope, installBrowserStubs, mockFetch } from "../helpers/mockFetch.mjs";
import { DISABLED_BODY, TOKEN, availability, challenge, integration } from "./fixtures.mjs";

const BASE = "/api/integrations/whatsapp";
let stubs;
beforeEach(() => { stubs = installBrowserStubs(); });

const rejects = async (promise) => promise.then(() => assert.fail("expected rejection"), (e) => e);

describe("availability", () => {
  it("disabled: no link", async () => {
    const calls = mockFetch(() => ({ body: envelope({
      enabled: false,
      state: "disabled",
      capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true },
      integration: null,
    }) }));
    const a = parseWhatsAppAvailability(await whatsappApi.getIntegration());
    assert.equal(calls[0].url, BASE);
    assert.equal(calls[0].headers.Authorization, "Bearer test-token");
    assert.equal(calls[0].headers["Accept-Language"], "en");
    assert.deepEqual([a.enabled, a.state, a.integration], [false, "disabled", null]);
    assert.equal(a.capabilities.can_review_drafts, true);
  });

  it("enabled but not linked", async () => {
    mockFetch(() => ({ body: envelope({
      enabled: true,
      state: "not_linked",
      capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true },
      integration: null,
    }) }));
    const a = parseWhatsAppAvailability(await whatsappApi.getIntegration());
    assert.equal(a.state, "not_linked");
    assert.equal(a.capabilities.can_link, true);
    assert.equal(a.capabilities.can_manage_link, false);
  });

  it("enabled and linked", async () => {
    mockFetch(() => ({ body: envelope(availability()) }));
    const a = parseWhatsAppAvailability(await whatsappApi.getIntegration());
    assert.equal(a.state, "linked");
    assert.equal(a.integration.phone_last_digits, "5678");
    assert.equal(a.integration.generation, 1);
    assert.equal(a.capabilities.can_manage_link, true);
  });

  it("disabled with a stored integration keeps the old link but not the operations", async () => {
    mockFetch(() => ({ body: envelope(availability({
      enabled: false,
      state: "disabled",
      capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true },
    })) }));
    const a = parseWhatsAppAvailability(await whatsappApi.getIntegration());
    assert.equal(a.integration.linked, true);
    assert.equal(a.state, "disabled");
    assert.equal(a.capabilities.can_manage_link, false);
    assert.equal(a.capabilities.can_link, false);
  });

  it("never infers availability from integration data", () => {
    assert.throws(() => parseWhatsAppAvailability(envelope({ integration: integration() })), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => parseWhatsAppAvailability(envelope({ ...availability(), enabled: "yes" })), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => parseWhatsAppAvailability(envelope({ ...availability(), state: "on" })), { code: "MALFORMED_RESPONSE" });
    assert.throws(
      () => parseWhatsAppAvailability(envelope({ ...availability(), capabilities: { can_link: true } })),
      { code: "MALFORMED_RESPONSE" },
    );
  });

  it("whitelists integration fields so secrets the backend might add never pass", () => {
    const a = parseWhatsAppAvailability(envelope(availability({
      integration: integration({ wa_id_hash: "x", access_token: "secret", phone_number: "+970599" }),
    })));
    assert.deepEqual(Object.keys(a.integration).sort(), [
      "default_account", "default_account_id", "generation", "language", "linked", "linked_at",
      "phone_last_digits", "revoked_at", "status", "workspace_id",
    ]);
  });
});

describe("whatsapp_disabled error", () => {
  it("keeps status, message and code and is distinct from other 409s", async () => {
    mockFetch(() => ({ status: 409, body: DISABLED_BODY }));
    const error = await rejects(whatsappApi.createLinkChallenge());
    assert.equal(error.status, 409);
    assert.equal(error.message, "WhatsApp integration is currently unavailable.");
    assert.equal(error.serverCode, "whatsapp_disabled");
    assert.equal(error.code, "CONFLICT");
    assert.equal(isWhatsAppDisabledError(error), true);
    assert.equal(classifyWhatsAppError(error), "disabled");
    assert.equal(isOutcomeUncertain(error), false);
    assert.equal(shouldStopChallengePolling(error), true);
  });

  it("is not retried automatically", async () => {
    const calls = mockFetch(() => ({ status: 409, body: DISABLED_BODY }));
    await rejects(whatsappApi.getLinkChallenge(TOKEN));
    assert.equal(calls.length, 1);
  });

  it("an ordinary 409 is a conflict, not disabled", async () => {
    mockFetch(() => ({ status: 409, body: { status: false, message: "stale" } }));
    const error = await rejects(whatsappApi.getLinkChallenge(TOKEN));
    assert.equal(error.serverCode, null);
    assert.equal(isWhatsAppDisabledError(error), false);
    assert.equal(classifyWhatsAppError(error), "conflict");
    assert.equal(shouldStopChallengePolling(error), false);
  });

  it("the code on another status is not 'disabled'", async () => {
    mockFetch(() => ({ status: 422, body: { ...DISABLED_BODY } }));
    assert.equal(isWhatsAppDisabledError(await rejects(whatsappApi.unlink())), false);
  });
});

describe("linking", () => {
  it("creates a challenge and returns the token only in memory", async () => {
    const calls = mockFetch(() => ({ status: 201, body: envelope({
      challenge: challenge(),
      linking: { token: TOKEN, public_number: "+970000", message: `LINK ${TOKEN}` },
    }) }));
    const created = parseCreatedChallengeResponse(await whatsappApi.createLinkChallenge());
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${BASE}/link-challenges`);
    assert.equal(calls[0].body, undefined);
    assert.equal(created.linking.token, TOKEN);
    assert.equal(created.challenge.status, "pending");
    assert.equal(JSON.stringify(stubs.localStorage.dump()).includes(TOKEN), false);
    assert.equal(JSON.stringify(stubs.sessionStorage.dump()).includes(TOKEN), false);
  });

  it("creation without a token is malformed and the error never carries the body", () => {
    try {
      parseCreatedChallengeResponse(envelope({ challenge: challenge(), linking: {} }));
      assert.fail("expected throw");
    } catch (e) {
      assert.equal(e.code, "MALFORMED_RESPONSE");
      assert.equal(e.payload, null);
    }
  });

  it("polls by token (not id), parses status and stops when settled", async () => {
    const calls = mockFetch(() => ({ body: envelope({
      challenge: challenge({ status: "sender_verified", sender_verified: true, phone_last_digits: "5678" }),
    }) }));
    const c = parseChallengeStatusResponse(await whatsappApi.getLinkChallenge(` ${TOKEN.toUpperCase()} `));
    assert.equal(calls[0].url, `${BASE}/link-challenges/${TOKEN.toUpperCase()}`);
    assert.equal(c.sender_verified, true);
    assert.equal(shouldStopChallengePolling(c), true);
    assert.equal(shouldStopChallengePolling(challenge()), false);
    assert.equal(shouldStopChallengePolling(challenge({ status: "expired" })), true);
  });

  it("rejects tokens that could alter the path, before any request", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    for (const bad of ["", "12", "../drafts/1", `${TOKEN}/confirm`, 5, null, `${TOKEN}?x=1`]) {
      assert.equal((await rejects(whatsappApi.getLinkChallenge(bad))).code, "WHATSAPP_INPUT_INVALID");
    }
    assert.equal(calls.length, 0);
  });

  it("confirms explicitly with POST and no body", async () => {
    const calls = mockFetch(() => ({ body: envelope({ integration: integration() }) }));
    const i = parseIntegrationResponse(await whatsappApi.confirmLinkChallenge(TOKEN));
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${BASE}/link-challenges/${TOKEN}/confirm`);
    assert.equal(calls[0].rawBody, undefined);
    assert.equal(i.linked, true);
  });

  it("updates preferences with only the documented fields", async () => {
    const calls = mockFetch(() => ({ body: envelope({
      integration: integration({ language: "en", default_account_id: null }),
    }) }));
    const i = parseIntegrationResponse(await whatsappApi.updatePreferences({ language: " EN ", default_account_id: null }));
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, `${BASE}/preferences`);
    assert.deepEqual(calls[0].body, { language: "en", default_account_id: null });
    assert.equal(i.default_account_id, null);
    assert.equal((await rejects(whatsappApi.updatePreferences({ language: "fr" }))).code, "WHATSAPP_INPUT_INVALID");
    assert.equal((await rejects(whatsappApi.updatePreferences({ phone: "1" }))).code, "WHATSAPP_INPUT_INVALID");
    assert.equal((await rejects(whatsappApi.updatePreferences({}))).code, "WHATSAPP_INPUT_INVALID");
    assert.equal(calls.length, 1);
  });

  it("unlinks with DELETE", async () => {
    const calls = mockFetch(() => ({ body: envelope({
      integration: integration({ linked: false, status: "revoked" }),
    }) }));
    const i = parseIntegrationResponse(await whatsappApi.unlink());
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, `${BASE}/link`);
    assert.equal(i.status, "revoked");
  });

  it("aborts a pending challenge request", async () => {
    mockFetch((url, init) => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    const controller = new AbortController();
    const pending = rejects(whatsappApi.getLinkChallenge(TOKEN, { signal: controller.signal }));
    controller.abort();
    const error = await pending;
    assert.equal(error.name, "AbortError");
    assert.equal(classifyWhatsAppError(error), "aborted");
    assert.equal(shouldStopChallengePolling(error), true);
  });
});

describe("no sensitive persistence", () => {
  it("the adapter modules never touch storage, cookies or console", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const file of [
      "src/features/Dashboards/User/api/whatsappApi.js",
      "src/features/Dashboards/User/FinancialOperations/whatsappContract.js",
    ]) {
      const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
      assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie|console\./.test(source), false, file);
    }
  });

  it("a full link flow leaves the token out of both storages", async () => {
    mockFetch((url) => (url.endsWith("/link-challenges")
      ? { status: 201, body: envelope({ challenge: challenge(), linking: { token: TOKEN, public_number: "+1", message: `LINK ${TOKEN}` } }) }
      : { body: envelope({ challenge: challenge({ status: "sender_verified", sender_verified: true }) }) }));
    const { linking } = parseCreatedChallengeResponse(await whatsappApi.createLinkChallenge());
    await whatsappApi.getLinkChallenge(linking.token);
    assert.equal(JSON.stringify(stubs.localStorage.dump()).includes(TOKEN), false);
    assert.equal(JSON.stringify(stubs.sessionStorage.dump()).includes(TOKEN), false);
  });
});
