import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { FORM_WRITES, envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const writeApi = await import("../src/mobile/data/writeApi.js");
const model = await import("../src/mobile/models/authRecovery.js");
const { getHandoff, getRedirect } = await import("../src/mobile/presentation/resolver.js");
const { FEATURE_MESSAGES } = await import("../src/mobile/i18n/sections/index.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");

/*
 * Mobile account recovery (docs/mobile/AUTH-RECOVERY.md): forgot password, reset password from the emailed link, and the
 * verification email's resend on Profile. All three writes are CLOSED in the product (APPROVED is empty); the first part of
 * this file proves the closed gate sends nothing. The rest opens them ONLY through the test runner's switch, against a fake
 * backend with fictional data that refuses every other non-GET, and checks what is sent, what is said, and what is kept.
 */

after(() => dom.window.close());

const SIGNED_OUT = { isAuthenticated: false, initializing: false, token: null, user: null };
const PERSON = { ...USER_A, email: "alex@example.test" };
const SIGNED_IN = { isAuthenticated: true, initializing: false, token: TOKEN_A, user: PERSON, workspace: { id: 1, base_currency_code: "ILS", timezone: "UTC" } };
const TOKEN = "9f2c41d7a0b3e85516c2d4f7e8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7";
const LINK = `?token=${TOKEN}&identifier=alex%40example.test`;
const PASSWORD = "Tr0ub4dor-staging";
const OPERATIONS = ["auth.forgotPassword", "auth.resetPassword", "email.resend"];
const ALLOW = { "auth.forgotPassword": FORM_WRITES.authForgotPassword, "auth.resetPassword": FORM_WRITES.authResetPassword, "email.resend": FORM_WRITES.emailResend };

let api;
let view;
let logs;
const real = {};
const text = (root = document.body) => root.textContent.replace(/\s+/g, " ");
const action = (name, root = document) => root.querySelector(`[data-sm-action='${name}']`);
const posts = () => api.calls.filter((call) => call.method !== "GET");
const status = (name) => q(`[data-sm-recovery='${name}']`);

/* The fake backend's answer for a handler that has none: nothing else is expected to be read. */
const quiet = (call) => (call.path === "/notifications/preferences" ? { body: envelope({ preferences: { savings_installment_reminders: true }, channels: ["in_app"], savings_installment_reminders_available: true }) } : { status: 404, body: { status: false, message: "Not found" } });
const answer = (body) => ({ body: { status: true, message: "ok", data: body } });
const reject = (status, errors = {}, headers = {}) => ({ status, headers, body: { status: false, message: "Rejected, in the backend's own words (Arabic)", errors } });

async function open(entry, { operations = OPERATIONS, handler = quiet, auth = SIGNED_OUT, emailVerification, preference } = {}) {
  api?.restore();
  api = installFakeApi(handler, { allowWrites: operations.map((operation) => ALLOW[operation]) });
  gate.setWriteApprovalsForTests(operations);
  view = await mountMobile({ entry, auth, emailVerification, ...(preference ? { preference } : {}) });
}

beforeEach(async () => {
  await resetEnvironment();
  logs = [];
  for (const name of ["log", "info", "warn", "error", "debug"]) {
    real[name] = console[name];
    console[name] = (...args) => { logs.push(args.map((arg) => (arg instanceof Error ? `${arg.message}` : typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")); };
  }
});

afterEach(async () => {
  for (const name of Object.keys(real)) console[name] = real[name];
  gate.setWriteApprovalsForTests(null);
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only the writes a test named");
  api?.restore();
  api = null;
});

/* ============================================================== the model */

describe("recovery model: what a form may accept", () => {
  it("an email: required, one address, no spaces, 255 at most; the backend decides the rest", () => {
    assert.equal(model.emailError(""), "required");
    assert.equal(model.emailError("   "), "required");
    assert.equal(model.emailError(undefined), "required");
    for (const bad of ["alex", "alex@", "@example.test", "alex@example", "a b@example.test", "alex@@example.test", `${"a".repeat(250)}@example.test`]) assert.equal(model.emailError(bad), "email", bad);
    for (const good of ["alex@example.test", " alex@example.test ", "a.b+tag@mail.example.co.uk"]) assert.equal(model.emailError(good), null, good);
  });

  it("a password: 8 characters with a letter and a number, as the backend's Password::min(8)->letters()->numbers()", () => {
    assert.equal(model.passwordError(""), "required");
    assert.equal(model.passwordError("abc12"), "passwordShort");
    assert.equal(model.passwordError("abcdefgh"), "passwordMix");
    assert.equal(model.passwordError("12345678"), "passwordMix");
    assert.equal(model.passwordError("abcdefg1"), null);
    assert.equal(model.passwordError("كلمةسر12345"), null, "letters and numbers of any script");
    assert.equal(model.passwordError("😀😀😀😀😀😀😀a1"), null, "length counts characters, not code units");
    assert.deepEqual(model.passwordChecklist("abc"), { length: false, letter: true, digit: false });
    assert.deepEqual(model.passwordChecklist(PASSWORD), { length: true, letter: true, digit: true });
  });

  it("the confirmation must be given and equal", () => {
    assert.equal(model.confirmationError("abcdefg1", ""), "required");
    assert.equal(model.confirmationError("abcdefg1", "abcdefg2"), "passwordMismatch");
    assert.equal(model.confirmationError("abcdefg1", "abcdefg1"), null);
  });
});

describe("recovery model: the emailed reset link", () => {
  it("reads the token and the address; a space in the address is a '+' that lost its encoding", () => {
    assert.deepEqual(model.readResetLink(LINK), { token: TOKEN, identifier: "alex@example.test" });
    assert.deepEqual(model.readResetLink(`?token=${TOKEN}&identifier=alex+tag@example.test`), { token: TOKEN, identifier: "alex+tag@example.test" });
    assert.deepEqual(model.readResetLink(`?token=${TOKEN}&identifier=alex%2Btag%40example.test`), { token: TOKEN, identifier: "alex+tag@example.test" });
  });

  it("a link that is cut short or mangled is 'incomplete': nothing is read from it, nothing can be sent", () => {
    for (const search of ["", "?", `?token=${TOKEN}`, "?identifier=alex%40example.test", `?token=short&identifier=alex%40example.test`, `?token=${TOKEN}&identifier=not-an-email`, `?token=${TOKEN}%20x&identifier=alex%40example.test`, `?token=${"a".repeat(300)}&identifier=alex%40example.test`, undefined, null, 5]) {
      assert.equal(model.readResetLink(search), null, String(search));
    }
  });
});

describe("recovery model: how a failure is described", () => {
  const error = (code, extra = {}) => Object.assign(new Error("backend text"), { code, ...extra });

  it("by the error's code alone, never by the backend's text", () => {
    assert.equal(model.failureKind(error("WRITE_CLOSED")), "closed");
    assert.equal(model.failureKind(error("RATE_LIMITED")), "rate");
    assert.equal(model.failureKind(error("VALIDATION_ERROR", { errors: { token: ["x"] } })), "link");
    assert.equal(model.failureKind(error("VALIDATION_ERROR", { errors: { identifier: ["x"] } })), "link");
    assert.equal(model.failureKind(error("VALIDATION_ERROR", { errors: { password: ["x"] } })), "password");
    assert.equal(model.failureKind(error("VALIDATION_ERROR", { errors: {} })), "invalid");
    assert.equal(model.failureKind(error("VALIDATION_ERROR")), "invalid");
    assert.equal(model.failureKind(error("UNAUTHENTICATED")), "session");
    assert.equal(model.failureKind(error("FORBIDDEN")), "forbidden");
    assert.equal(model.failureKind(error("NOT_FOUND")), "failed");
    assert.equal(model.failureKind(error("CONFLICT")), "failed");
  });

  it("no answer, a timeout, a 5xx and an unreadable answer are UNKNOWN outcomes, never 'failed' and never 'done'", () => {
    for (const code of ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "MALFORMED_RESPONSE", "WORKSPACE_UNAVAILABLE"]) assert.equal(model.failureKind(error(code)), "unknown", code);
    assert.equal(model.failureKind(new Error("no code")), "unknown");
    assert.equal(model.failureKind(null), "unknown");
  });

  it("Retry-After is a number of seconds between 1 second and an hour, else a minute", () => {
    assert.equal(model.retryAfterSeconds({ retryAfter: "45" }), 45);
    assert.equal(model.retryAfterSeconds({ retryAfter: 7 }), 7);
    assert.equal(model.retryAfterSeconds({ retryAfter: "999999" }), 3600);
    for (const bad of [{}, { retryAfter: "" }, { retryAfter: "0" }, { retryAfter: "-5" }, { retryAfter: "soon" }, null]) assert.equal(model.retryAfterSeconds(bad), 60);
    assert.equal(model.retryAfterSeconds({}, 30), 30);
  });
});

/* ====================================================== the registry */

describe("the three recovery writes are registered, classified from the backend's source, and closed", () => {
  it("their classification", () => {
    assert.deepEqual({ ...gate.MOBILE_WRITES["auth.forgotPassword"] }, { endpoint: "POST /auth/forgot-password", moves: false, key: "none", serverDedup: "same-result" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["auth.resetPassword"] }, { endpoint: "POST /auth/reset-password", moves: false, key: "none", serverDedup: "once-only" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["email.resend"] }, { endpoint: "POST /auth/email/verification-notification", moves: false, key: "none", serverDedup: "same-result" });
  });

  it("closed by default, APPROVED still empty, and a build cannot be configured to open them", () => {
    for (const operation of OPERATIONS) assert.equal(gate.isWriteOpen(operation), false, operation);
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
    assert.equal(Object.values(gate.MOBILE_WRITES).filter((write) => write.moves === false && /\/auth\//.test(write.endpoint)).length, 3);
  });

  it("each sender throws WriteClosedError before a request exists, without ever reading its arguments", async () => {
    api = installFakeApi(() => ({ body: envelope({}) }));
    const secret = { toString() { throw new Error("read"); }, get password() { throw new Error("read"); } };
    for (const [name, call] of [["auth.forgotPassword", () => writeApi.sendForgotPassword(secret)], ["auth.resetPassword", () => writeApi.sendResetPassword(secret)], ["email.resend", () => writeApi.sendVerificationResend()]]) {
      assert.throws(call, (caught) => caught.name === "WriteClosedError" && caught.code === "WRITE_CLOSED" && caught.operation === name, name);
    }
    assert.equal(api.calls.length, 0, "nothing was sent");
  });

  it("the test switch opens them and nothing else", async () => {
    gate.setWriteApprovalsForTests(["auth.forgotPassword"]);
    assert.equal(gate.isWriteOpen("auth.forgotPassword"), true);
    assert.equal(gate.isWriteOpen("auth.resetPassword"), false);
    assert.equal(gate.isWriteOpen("email.resend"), false);
    assert.equal(gate.isWriteOpen("profile.password"), false);
    gate.setWriteApprovalsForTests(null);
  });
});

/* ================================= CLOSED GATE: the product as shipped sends nothing */

describe("closed gate (the default): the screens say so and zero requests are made", () => {
  const closed = async (entry, auth = SIGNED_OUT, extra = {}) => {
    api?.restore();
    api = installFakeApi(quiet);
    gate.setWriteApprovalsForTests(null);
    view = await mountMobile({ entry, auth, ...extra });
  };

  it("forgot password: a valid address changes nothing; the button is off, the note is shown, the full version is offered", async () => {
    await closed("/m/forgot-password");
    assert.equal(location(), "/m/forgot-password");
    assert.ok(q("[data-sm-screen='forgot']"));
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='auth.forgotPassword']"));
    await change(q("input[autocomplete='email']"), "alex@example.test");
    assert.equal(action("forgot-send").disabled, true);
    await submit(q("[data-sm-form='forgot']"));
    await settle();
    assert.equal(posts().length, 0, "a form submitted around the disabled button still sends nothing");
    assert.equal(status("sent"), null, "and does not claim anything was sent");
    assert.ok(action("full-version"), "the full version is the way to do it today");
  });

  it("reset password with a valid link: the form is shown, the new password is checked, and nothing is sent", async () => {
    await closed(`/m/reset-password${LINK}`);
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='auth.resetPassword']"));
    const [password, confirmation] = qa("input[autocomplete='new-password']");
    await change(password, PASSWORD);
    await change(confirmation, PASSWORD);
    assert.equal(action("reset-send").disabled, true);
    await submit(q("[data-sm-form='reset']"));
    await settle();
    assert.equal(posts().length, 0);
    assert.equal(status("done"), null);
  });

  it("Profile: the resend button is off and the note and the full version's link stay; nothing is sent", async () => {
    storeSession({ token: TOKEN_A, user: PERSON });
    const refresh = () => {};
    await closed("/m/profile", SIGNED_IN, { emailVerification: { status: { email: PERSON.email, requiresVerification: true, verified: false, verifiedAt: null }, loading: false, error: null, refresh } });
    assert.equal(q("[data-sm-section='email']").dataset.smEmail, "unverified");
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='email.resend']"));
    assert.equal(action("resend-verification").disabled, true);
    await click(action("resend-verification"));
    await settle();
    assert.equal(posts().length, 0);
  });

  it("the sign-in page's 'Forgot your password?' opens Mobile's own page, not the full version", async () => {
    await closed("/m/signin");
    const link = qa("a").find((anchor) => /Forgot/.test(anchor.textContent));
    assert.equal(link.getAttribute("href"), "/m/forgot-password");
    await click(link);
    await settle();
    assert.equal(location(), "/m/forgot-password");
  });

  it("the emailed reset link keeps opening the full version's page while the gate is closed (no hand-off, so nobody is stranded)", async () => {
    await closed(`/reset-password${LINK}`);
    assert.ok(q("#desktop"), "the full version's page");
    assert.equal(location(), `/reset-password${LINK}`);
  });
});

/* ===================================================== forgot password */

describe("forgot password (gate opened by the test switch)", () => {
  const forgot = (handler, extra = {}) => open("/m/forgot-password", { operations: ["auth.forgotPassword"], handler, ...extra });
  const enter = async (value) => { await change(q("input[autocomplete='email']"), value); await submit(q("[data-sm-form='forgot']")); await settle(); };

  it("sends one POST with the trimmed address and no credentials, then says the same careful sentence", async () => {
    await forgot((call) => (call.method === "POST" ? answer(null) : quiet(call)));
    await enter("  Alex@Example.test ");
    const [call] = posts();
    assert.equal(posts().length, 1);
    assert.equal(call.path, "/auth/forgot-password");
    assert.deepEqual(call.body, { identifier: "Alex@Example.test" }, "trimmed; the backend lowercases it");
    assert.equal(call.auth, null, "a public request carries no token");
    assert.match(text(status("sent")), /If that email address belongs to an account/);
    assert.equal(action("forgot-send").disabled, true, "a minute's wait before another");
    assert.match(action("forgot-send").textContent, /Send again in \d+ s/);
  });

  it("an invalid address is refused here, before any request, in the same words the backend's own refusal gets", async () => {
    await forgot((call) => (call.method === "POST" ? reject(422, { identifier: ["صيغة البريد الإلكتروني غير صحيحة"] }) : quiet(call)));
    await enter("");
    assert.match(text(q("[data-sm-form='forgot']")), /Fill this in/);
    await enter("not-an-email");
    const local = text(q("[data-sm-form='forgot']"));
    assert.match(local, /Enter an email address like/);
    assert.equal(posts().length, 0, "nothing was asked");
    await enter("someone@example.test");
    assert.equal(posts().length, 1, "a well-formed address is sent");
    assert.match(text(q("[data-sm-form='forgot']")), /Enter an email address like/, "the backend's format refusal reads exactly like the local one");
    assert.doesNotMatch(text(), /صيغة/, "the backend's own text is never shown");
  });

  it("email enumeration: an address with an account and one without get the identical page", async () => {
    // The backend answers both with the same 200 (PasswordResetController::sendResetLink), so the page must too.
    const pageFor = async (address) => {
      await forgot((call) => (call.method === "POST" ? answer(null) : quiet(call)));
      await enter(address);
      // Generated ids differ between two mounts of the same page; everything else must be identical.
      const html = q("[data-sm-screen='forgot']").innerHTML.replaceAll(address, "ADDRESS").replace(/\s(id|for|aria-describedby|aria-controls)="[^"]*"/g, "");
      await view.unmount();
      view = null;
      return html;
    };
    const known = await pageFor("alex@example.test");
    const unknown = await pageFor("nobody@example.test");
    assert.equal(known, unknown, "nothing on the page depends on the account");
    assert.match(known, /If that email address belongs to an account/);
    assert.doesNotMatch(known, /no account|not found|doesn't exist|isn't registered|already registered/i);
  });

  it("a 429 says how long to wait, from the server's Retry-After, and keeps the button off until then", async () => {
    await forgot((call) => (call.method === "POST" ? reject(429, {}, { "Retry-After": "45" }) : quiet(call)));
    await enter("alex@example.test");
    assert.match(text(status("rate")), /Try again in 45 seconds/);
    assert.equal(action("forgot-send").disabled, true);
    assert.match(action("forgot-send").textContent, /Send again in (4[0-5]|5) ?s|Send again in \d+ s/);
    assert.equal(posts().length, 1, "no automatic retry");
  });

  it("no answer or a server error is an UNKNOWN outcome: not 'sent', not 'failed', a wait, and no automatic retry", async () => {
    for (const outcome of [new Error("offline"), { status: 500, body: { status: false, message: "boom" } }, { status: 200, body: "<html>not json</html>" }]) {
      await forgot((call) => (call.method === "POST" ? outcome : quiet(call)));
      await enter("alex@example.test");
      assert.match(text(status("unknown")), /couldn't tell whether your request reached SmartSpend/, String(outcome?.status ?? outcome));
      assert.equal(status("sent"), null);
      assert.equal(action("forgot-send").disabled, true);
      assert.equal(posts().length, 1);
      await view.unmount();
      view = null;
    }
  });

  it("double submission: two submits in a row send one request", async () => {
    let release;
    await forgot((call) => (call.method === "POST" ? new Promise((resolve) => { release = () => resolve(answer(null)); }) : quiet(call)));
    await change(q("input[autocomplete='email']"), "alex@example.test");
    const form = q("[data-sm-form='forgot']");
    await submit(form);
    await submit(form);
    await click(action("forgot-send"));
    assert.equal(posts().length, 1, "one request however many times it is submitted");
    assert.equal(form.getAttribute("aria-busy"), "true");
    release();
    await settle();
    assert.equal(posts().length, 1);
    assert.ok(status("sent"));
  });

  it("any other refusal is said plainly and the form stays usable", async () => {
    await forgot((call) => (call.method === "POST" ? reject(403) : quiet(call)));
    await enter("alex@example.test");
    assert.match(text(status("failed")), /couldn't be requested/);
    assert.equal(action("forgot-send").disabled, false);
  });
});

/* ====================================================== reset password */

describe("reset password from the emailed link (gate opened by the test switch)", () => {
  const reset = (handler, extra = {}) => open(`/m/reset-password${LINK}`, { operations: ["auth.resetPassword"], handler, ...extra });
  const fill = async (password = PASSWORD, confirmation = password) => {
    const [first, second] = qa("input[autocomplete='new-password']");
    await change(first, password);
    await change(second, confirmation);
  };
  const send = async () => { await submit(q("[data-sm-form='reset']")); await settle(); };
  const accepted = (call) => (call.method === "POST" ? answer(null) : quiet(call));
  const everythingStored = () => JSON.stringify({ local: { ...window.localStorage }, session: { ...window.sessionStorage } });

  it("reads the link once, takes it out of the address bar, and keeps it in no storage", async () => {
    await reset(accepted);
    assert.equal(location(), "/m/reset-password", "the token is no longer in the address");
    assert.equal(window.location.search, "");
    assert.equal(window.history.length >= 1, true);
    assert.ok(q("[data-sm-form='reset']"), "the form is there: the link was read before it was removed");
    await fill();
    assert.doesNotMatch(everythingStored(), new RegExp(TOKEN), "no token in storage");
    assert.doesNotMatch(everythingStored(), /Tr0ub4dor/, "no password in storage");
    assert.ok(document.head.querySelector("meta[name='referrer'][content='no-referrer']"), "no Referer is sent while the page is open");
  });

  it("sends token, address, password and confirmation once, with no credentials, then says it worked and offers sign-in", async () => {
    await reset(accepted);
    await fill();
    await send();
    assert.equal(posts().length, 1);
    const [call] = posts();
    assert.equal(call.path, "/auth/reset-password");
    assert.deepEqual(call.body, { token: TOKEN, identifier: "alex@example.test", password: PASSWORD, password_confirmation: PASSWORD });
    assert.equal(call.auth, null);
    assert.match(text(status("done")), /Your password was changed/);
    assert.match(text(status("done")), /signed out on all your devices/);
    assert.equal(qa("input").length, 0, "no password field is left on the page");
    const signIn = action("signin-after-reset");
    assert.equal(signIn.getAttribute("href"), "/m/signin");
    await click(signIn);
    await settle();
    assert.equal(location(), "/m/signin", "back to Mobile sign-in, not the full version");
    assert.doesNotMatch(everythingStored(), /Tr0ub4dor|9f2c41d7/);
  });

  it("checks the new password before asking: length, letter and number, and the confirmation", async () => {
    await reset(accepted);
    for (const [password, confirmation, expected] of [["", "", /Fill this in/], ["abc12", "abc12", /at least 8 characters/], ["abcdefgh", "abcdefgh", /at least one letter and one digit/], ["12345678", "12345678", /at least one letter and one digit/], [PASSWORD, "different1", /don't match/]]) {
      await fill(password, confirmation);
      await send();
      assert.match(text(q("[data-sm-form='reset']")), expected, `${password} / ${confirmation}`);
    }
    assert.equal(posts().length, 0, "none of them was sent");
  });

  it("the requirements list follows the password with words, not only colour", async () => {
    await reset(accepted);
    const met = () => qa("[data-sm-rule]").map((item) => `${item.dataset.smRule}:${item.dataset.met}`).join(" ");
    assert.equal(met(), "length:false letter:false digit:false");
    await fill("abc", "abc");
    assert.equal(met(), "length:false letter:true digit:false");
    await fill(PASSWORD);
    assert.equal(met(), "length:true letter:true digit:true");
    assert.match(text(q("[data-sm-rules]")), /At least 8 characters.*Done/);
    assert.match(text(q("[data-sm-rules]")), /A number/);
  });

  it("the password and its confirmation can be shown and hidden", async () => {
    await reset(accepted);
    const [first] = qa("input[autocomplete='new-password']");
    assert.equal(first.type, "password");
    await click(qa("[data-sm-action='toggle-password']")[0]);
    assert.equal(first.type, "text");
    await click(qa("[data-sm-action='toggle-password']")[0]);
    assert.equal(first.type, "password");
    assert.equal(qa("[data-sm-action='toggle-password']").length, 2, "one for each field");
  });

  it("an invalid, used or expired token (422 on the token) says the link no longer works and offers a new one", async () => {
    await reset((call) => (call.method === "POST" ? reject(422, { token: ["رابط إعادة التعيين غير صالح أو منتهي الصلاحية."] }) : quiet(call)));
    await fill();
    await send();
    assert.match(text(status("link")), /invalid, was already used, or has expired/);
    assert.doesNotMatch(text(), /رابط/, "the backend's own text is never shown");
    assert.equal(qa("input").length, 0, "the form is gone: the link cannot be tried again");
    assert.equal(action("new-link").getAttribute("href"), "/m/forgot-password");
    assert.equal(posts().length, 1);
    await click(action("new-link"));
    await settle();
    assert.equal(location(), "/m/forgot-password");
  });

  it("a refused address (422 on the identifier) is also a link problem", async () => {
    await reset((call) => (call.method === "POST" ? reject(422, { identifier: ["x"] }) : quiet(call)));
    await fill();
    await send();
    assert.ok(status("link"));
  });

  it("a password the backend refuses is said on the field and the form stays", async () => {
    await reset((call) => (call.method === "POST" ? reject(422, { password: ["x"] }) : quiet(call)));
    await fill();
    await send();
    assert.match(text(status("password")), /didn't accept this password/);
    assert.ok(q("[data-sm-form='reset']"));
    assert.equal(q("input[autocomplete='new-password']").getAttribute("aria-invalid"), "true");
  });

  it("an opened-by-hand page, or a link cut short, has nothing to send", async () => {
    for (const entry of ["/m/reset-password", `/m/reset-password?token=${TOKEN}`, "/m/reset-password?token=abc&identifier=alex%40example.test"]) {
      await open(entry, { operations: ["auth.resetPassword"], handler: accepted });
      assert.match(text(status("missing")), /Open the link from your email/, entry);
      assert.equal(q("[data-sm-form='reset']"), null);
      assert.equal(action("new-link").getAttribute("href"), "/m/forgot-password");
      assert.equal(posts().length, 0);
      await view.unmount();
      view = null;
    }
  });

  it("a 429 says how long to wait and keeps the form, with the button off until then", async () => {
    await reset((call) => (call.method === "POST" ? reject(429, {}, { "Retry-After": "30" }) : quiet(call)));
    await fill();
    await send();
    assert.match(text(status("rate")), /Try again in 30 seconds/);
    assert.equal(action("reset-send").disabled, true);
    assert.equal(posts().length, 1);
  });

  it("an unknown outcome says so, keeps the form, retries nothing; a later 'link no longer works' is then not called a failure", async () => {
    let attempt = 0;
    await reset((call) => {
      if (call.method !== "POST") return quiet(call);
      attempt += 1;
      return attempt === 1 ? new Error("connection lost") : reject(422, { token: ["x"] });
    });
    await fill();
    await send();
    assert.match(text(status("unknown")), /couldn't confirm that your password was changed/);
    assert.equal(posts().length, 1, "nothing retried for the person");
    assert.ok(q("[data-sm-form='reset']"), "the form stays so they can choose");
    assert.equal(status("done"), null, "never claimed as done");
    await send();
    assert.equal(posts().length, 2);
    assert.match(text(status("linkMaybe")), /If you just set a new password, it worked/, "after an unknown outcome a spent token may mean success");
    assert.equal(status("link"), null);
  });

  it("a 500 is unknown too, and an unreadable 200 is not 'done'", async () => {
    for (const outcome of [{ status: 500, body: { status: false, message: "boom" } }, { status: 200, body: "<html>" }]) {
      await reset((call) => (call.method === "POST" ? outcome : quiet(call)));
      await fill();
      await send();
      assert.ok(status("unknown"), String(outcome.status));
      assert.equal(status("done"), null);
      await view.unmount();
      view = null;
    }
  });

  it("double submission: two submits and a click send one request", async () => {
    let release;
    await reset((call) => (call.method === "POST" ? new Promise((resolve) => { release = () => resolve(answer(null)); }) : quiet(call)));
    await fill();
    const form = q("[data-sm-form='reset']");
    await submit(form);
    await submit(form);
    await click(action("reset-send"));
    assert.equal(posts().length, 1);
    release();
    await settle();
    assert.equal(posts().length, 1);
    assert.ok(status("done"));
  });

  it("signed in as the account being reset: the stale local session is ended; as someone else, it is left alone", async () => {
    for (const [email, cleared] of [["ALEX@example.test", true], ["someone.else@example.test", false]]) {
      let calls = 0;
      await reset(accepted, { auth: { ...SIGNED_IN, user: { ...PERSON, email }, clearAuth: () => { calls += 1; } } });
      await fill();
      await send();
      assert.ok(status("done"));
      assert.equal(calls, cleared ? 1 : 0, email);
      await view.unmount();
      view = null;
    }
  });

  it("works with a signed-in visitor too: the emailed link has no guard", async () => {
    await reset(accepted, { auth: SIGNED_IN });
    assert.equal(location(), "/m/reset-password");
    assert.ok(q("[data-sm-form='reset']"));
  });
});

/* ============================================ the reset link's hand-off to Mobile */

describe("the emailed link's hand-off", () => {
  const gateOpen = (operations = ["auth.resetPassword"]) => gate.setWriteApprovalsForTests(operations);
  const context = (over = {}) => ({ enabled: true, authenticated: false, mode: "mobile", ...over });
  const from = { pathname: "/reset-password", search: LINK, hash: "" };

  it("goes to Mobile, query and all, only when Mobile is on, the device's presentation is Mobile and the operation is open", () => {
    gateOpen();
    assert.deepEqual(getHandoff(from, context()), { pathname: "/m/reset-password", search: LINK, hash: "" });
    assert.deepEqual(getRedirect(from, context()), { pathname: "/m/reset-password", search: LINK, hash: "" }, "signed out");
    assert.deepEqual(getRedirect(from, context({ authenticated: true })), { pathname: "/m/reset-password", search: LINK, hash: "" }, "signed in");
    assert.equal(getRedirect(from, context({ mode: "desktop" })), null);
    assert.equal(getRedirect(from, context({ enabled: false })), null);
    assert.equal(getRedirect({ ...from, pathname: "/reset-password/" }, context())?.pathname, "/m/reset-password", "a trailing slash is the same page");
    assert.equal(getRedirect({ pathname: "/forgot-password", search: "", hash: "" }, context()), null, "only the reset link is taken over");
    assert.equal(getRedirect({ pathname: "/verify-email/1/abc", search: "?expires=1&signature=x", hash: "" }, context()), null, "the verification link is not touched");
    assert.equal(getRedirect({ pathname: "/signin", search: "", hash: "" }, context()), null);
    // Idempotent: the result is not redirected again.
    const target = getRedirect(from, context());
    assert.equal(getRedirect(target, context()), null);
  });

  it("while the operation is closed there is no hand-off at all (the default)", () => {
    gate.setWriteApprovalsForTests(null);
    assert.equal(getHandoff(from, context()), null);
    assert.equal(getRedirect(from, context({ authenticated: true })), null);
    gateOpen(["auth.forgotPassword", "email.resend"]);
    assert.equal(getHandoff(from, context()), null, "opening other recovery writes does not open this one");
  });

  it("a signed-in visitor whose presentation is the full version is sent from Mobile's recovery pages to their twins", () => {
    gateOpen();
    const desktop = context({ mode: "desktop", authenticated: true });
    assert.deepEqual(getRedirect({ pathname: "/m/reset-password", search: LINK, hash: "" }, desktop), { pathname: "/reset-password", search: LINK, hash: "" }, "the link survives the trip");
    assert.deepEqual(getRedirect({ pathname: "/m/forgot-password", search: "?x=1", hash: "" }, desktop), { pathname: "/forgot-password", search: "", hash: "" });
    assert.equal(getRedirect({ pathname: "/m/reset-password", search: LINK, hash: "" }, context({ mode: "desktop" })), null, "signed out: stays");
  });

  it("opened from a mail app on a phone: the full version's address ends on Mobile's page, with the token already out of the address bar", async () => {
    await open(`/reset-password${LINK}`, { operations: ["auth.resetPassword"], handler: quiet, preference: "mobile" });
    assert.equal(location(), "/m/reset-password");
    assert.equal(q("#desktop"), null, "the full version's page never showed");
    assert.ok(q("[data-sm-form='reset']"), "the form received the link");
  });

  it("while the session is still being restored the link is handed over without waiting", async () => {
    await open(`/reset-password${LINK}`, { operations: ["auth.resetPassword"], handler: quiet, auth: { ...SIGNED_OUT, initializing: true } });
    assert.equal(q("#desktop"), null, "the full version's page is not shown while the session loads");
    assert.match(location(), /^\/m\/reset-password/);
  });

  it("with the full version chosen, the link stays on the full version", async () => {
    await open(`/reset-password${LINK}`, { operations: ["auth.resetPassword"], handler: quiet, preference: "desktop" });
    assert.ok(q("#desktop"));
    assert.equal(location(), `/reset-password${LINK}`);
  });
});

/* ======================================================= Profile resend */

describe("Profile: sending a new verification email (gate opened by the test switch)", () => {
  const verification = (over = {}) => ({ status: { email: PERSON.email, requiresVerification: true, verified: false, verifiedAt: null }, loading: false, error: null, refresh: () => { verification.refreshed += 1; }, ...over });
  verification.refreshed = 0;
  const profile = async (handler) => {
    storeSession({ token: TOKEN_A, user: PERSON });
    verification.refreshed = 0;
    await open("/m/profile", { operations: ["email.resend"], handler: (call) => (call.method === "POST" ? handler(call) : quiet(call)), auth: SIGNED_IN, emailVerification: verification() });
  };
  const tap = async () => { await click(action("resend-verification")); await settle(); };
  const resend = () => q("[data-sm-resend]")?.dataset.smResend;

  it("sends one authenticated POST with no body, says it is on its way, and waits a minute before another", async () => {
    await profile(() => answer({ already_verified: false }));
    assert.equal(q("[data-sm-note='write-closed']"), null, "no closed note once it is open");
    await tap();
    assert.equal(posts().length, 1);
    assert.equal(posts()[0].path, "/auth/email/verification-notification");
    assert.equal(posts()[0].auth, `Bearer ${TOKEN_A}`, "the signed-in user's own request");
    assert.equal(posts()[0].hasBody, false);
    assert.equal(resend(), "sent");
    assert.match(text(q("[data-sm-resend]")), /Open the link in it, then come back here and tap “Check again”/);
    assert.equal(action("resend-verification").disabled, true);
    assert.match(action("resend-verification").textContent, /Send again in \d+ s/);
    assert.ok(action("check-email"), "Check again is how the new status is read");
  });

  it("an already-verified account is told so, and the status is read again", async () => {
    await profile(() => answer({ already_verified: true }));
    await tap();
    assert.equal(resend(), "already");
    assert.equal(verification.refreshed, 1);
    assert.equal(action("resend-verification").disabled, false);
  });

  it("a 429 waits as long as the server says; no automatic retry", async () => {
    await profile(() => reject(429, {}, { "Retry-After": "20" }));
    await tap();
    assert.equal(resend(), "rate");
    assert.match(text(q("[data-sm-resend]")), /Try again in 20 seconds/);
    assert.equal(action("resend-verification").disabled, true);
    assert.equal(posts().length, 1);
  });

  it("an account with no email (422) and an ended session (401) are said as what they are", async () => {
    await profile(() => reject(422));
    await tap();
    assert.equal(resend(), "noEmail");
    await view.unmount();
    view = null;
    await profile(() => reject(403));
    await tap();
    assert.equal(resend(), "forbidden");
  });

  it("no answer or a 5xx is UNKNOWN: an email may have been sent, so it is not called a failure, and a wait follows", async () => {
    for (const outcome of [new Error("offline"), { status: 502, body: { status: false, message: "bad gateway" } }]) {
      await profile(() => outcome);
      await tap();
      assert.equal(resend(), "unknown");
      assert.match(text(q("[data-sm-resend]")), /couldn't confirm that the email was sent/);
      assert.equal(action("resend-verification").disabled, true);
      assert.equal(posts().length, 1);
      await view.unmount();
      view = null;
    }
  });

  it("double tap: one request", async () => {
    let release;
    await profile(() => new Promise((resolve) => { release = () => resolve(answer({ already_verified: false })); }));
    await click(action("resend-verification"));
    await click(action("resend-verification"));
    await click(action("resend-verification"));
    assert.equal(posts().length, 1);
    release();
    await settle();
    assert.equal(posts().length, 1);
  });

  it("a verified account has no resend at all", async () => {
    storeSession({ token: TOKEN_A, user: PERSON });
    await open("/m/profile", { operations: ["email.resend"], auth: SIGNED_IN, emailVerification: { status: { email: PERSON.email, requiresVerification: true, verified: true, verifiedAt: "2026-11-10T10:00:00Z" }, loading: false, error: null, refresh: () => {} } });
    assert.equal(action("resend-verification"), null);
    assert.equal(posts().length, 0);
  });
});

/* ================================================ Arabic, English, RTL, LTR */

describe("languages, direction and themes", () => {
  it("English is left to right; Arabic is right to left, with the address and passwords still left to right", async () => {
    for (const [language, dir, title, done] of [["en", "ltr", /Reset your password/, /Choose a new password/], ["ar", "rtl", /إعادة تعيين كلمة المرور/, /اختر كلمة مرور جديدة/]]) {
      await resetEnvironment(language);
      await open("/m/forgot-password", { operations: ["auth.forgotPassword"] });
      assert.equal(document.documentElement.getAttribute("dir"), dir, language);
      assert.equal(document.documentElement.getAttribute("lang"), language);
      assert.match(text(q("[data-sm-screen='forgot']")), title);
      assert.equal(q("input[autocomplete='email']").getAttribute("dir"), "ltr", "an address is read left to right in either language");
      await view.unmount();
      view = null;
      await open(`/m/reset-password${LINK}`, { operations: ["auth.resetPassword"] });
      assert.match(text(q("[data-sm-screen='reset']")), done);
      for (const input of qa("input[autocomplete='new-password']")) assert.equal(input.getAttribute("dir"), "ltr");
      assert.doesNotMatch(text(), /\b(recovery|forms\.errors|profile\.resend)\./, `${language}: no untranslated key`);
      await view.unmount();
      view = null;
    }
  });

  it("every recovery sentence exists in both languages, outcome by outcome, with the same placeholders", () => {
    const flat = (value, prefix = "") => Object.entries(value).flatMap(([key, item]) => (typeof item === "object" ? flat(item, `${prefix}${key}.`) : [[`${prefix}${key}`, item]]));
    for (const [section, get] of [["recovery", (language) => FEATURE_MESSAGES[language].recovery], ["profile.resend", (language) => FEATURE_MESSAGES[language].profile.resend]]) {
      const en = Object.fromEntries(flat(get("en")));
      const ar = Object.fromEntries(flat(get("ar")));
      assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort(), section);
      for (const key of Object.keys(en)) {
        assert.ok(String(ar[key]).trim().length > 0, `${section}.${key}`);
        assert.deepEqual([...String(ar[key]).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort(), [...String(en[key]).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort(), `${section}.${key} placeholders`);
      }
    }
  });

  it("an Arabic rate-limit message carries the wait", async () => {
    await resetEnvironment("ar");
    await open("/m/forgot-password", { operations: ["auth.forgotPassword"], handler: (call) => (call.method === "POST" ? reject(429, {}, { "Retry-After": "12" }) : quiet(call)) });
    await change(q("input[autocomplete='email']"), "alex@example.test");
    await submit(q("[data-sm-form='forgot']"));
    await settle();
    assert.match(text(status("rate")), /12/);
    assert.match(text(status("rate")), /محاولات كثيرة/);
  });

  it("the dark theme renders the same screens (the stylesheet carries its dark rule, in logical properties only)", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    await open(`/m/reset-password${LINK}`, { operations: ["auth.resetPassword"] });
    assert.ok(q("[data-sm-form='reset']"));
    const css = readFileSync(new URL("../src/mobile/styles/mobile.css", import.meta.url), "utf8");
    const block = css.slice(css.indexOf("Account recovery (auth/MobileRecovery.jsx)"));
    assert.match(block, /:root\[data-theme="dark"\] \.sm-root \.sm-auth-rules/);
    assert.doesNotMatch(block, /\b(margin|padding)-(left|right)\b|\b(left|right)\s*:|!important/, "logical properties, no !important");
    assert.match(block, /\.sm-auth-rules li\[data-met="true"\]/);
  });

  it("nothing on the recovery pages goes to the full version except the explicit 'Use the full version instead' button", async () => {
    await open("/m/forgot-password", { operations: ["auth.forgotPassword"] });
    assert.deepEqual(qa("a").map((anchor) => anchor.getAttribute("href")), ["/m/signin"]);
    await view.unmount();
    view = null;
    await open(`/m/reset-password${LINK}`, { operations: ["auth.resetPassword"] });
    assert.deepEqual(qa("a").map((anchor) => anchor.getAttribute("href")), ["/m/signin"]);
  });
});

/* ============================================ nothing sensitive is kept or logged */

describe("passwords, tokens and addresses are not logged or stored", () => {
  const sensitive = [TOKEN, PASSWORD, "alex@example.test"];
  const dump = () => JSON.stringify({ local: { ...window.localStorage }, session: { ...window.sessionStorage }, cookie: document.cookie });

  it("through success, refusal, rate limit and unknown outcomes: nothing in the console, nothing in storage", async () => {
    const outcomes = [answer(null), reject(422, { token: ["x"] }), reject(422, { password: ["x"] }), reject(429, {}, { "Retry-After": "9" }), new Error(`network ${TOKEN}`), { status: 500, body: { status: false, message: `server saw ${PASSWORD}` } }];
    for (const outcome of outcomes) {
      await open(`/m/reset-password${LINK}`, { operations: ["auth.resetPassword"], handler: (call) => (call.method === "POST" ? outcome : quiet(call)) });
      const [first, second] = qa("input[autocomplete='new-password']");
      await change(first, PASSWORD);
      await change(second, PASSWORD);
      await submit(q("[data-sm-form='reset']"));
      await settle();
      await view.unmount();
      view = null;
    }
    await open("/m/forgot-password", { operations: ["auth.forgotPassword"], handler: (call) => (call.method === "POST" ? new Error("down") : quiet(call)) });
    await change(q("input[autocomplete='email']"), "alex@example.test");
    await submit(q("[data-sm-form='forgot']"));
    await settle();
    for (const secret of sensitive) {
      assert.equal(logs.filter((line) => line.includes(secret) && !line.startsWith("network")).length, 0, `the console never saw ${secret.slice(0, 6)}…`);
      assert.doesNotMatch(dump(), new RegExp(secret.replace(/[.+]/g, "\\$&")), "storage never held it");
    }
  });

  it("the source never logs, stores or builds a request of its own", () => {
    for (const file of ["src/mobile/auth/MobileRecovery.jsx", "src/mobile/auth/useAuthWrite.js", "src/mobile/models/authRecovery.js"]) {
      const code = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      assert.doesNotMatch(code, /console\.|localStorage|sessionStorage|document\.cookie|indexedDB|\bfetch\s*\(|XMLHttpRequest|sendBeacon|window\.history/, file);
      assert.doesNotMatch(code, /\.(setItem|removeItem)\s*\(/, file);
    }
  });

  it("the error a failed request leaves behind holds what the SERVER said, never what was sent", async () => {
    api = installFakeApi(() => reject(422, { token: ["invalid"] }), { allowWrites: [FORM_WRITES.authResetPassword] });
    gate.setWriteApprovalsForTests(["auth.resetPassword"]);
    const caught = await writeApi.sendResetPassword({ token: TOKEN, identifier: "alex@example.test", password: PASSWORD, passwordConfirmation: PASSWORD }).then(() => null, (error) => error);
    assert.ok(caught instanceof ApiError);
    const kept = JSON.stringify({ ...caught, message: caught.message, stack: undefined });
    for (const secret of [TOKEN, PASSWORD, "alex@example.test"]) assert.equal(kept.includes(secret), false, "the error never carries the request");
  });
});
