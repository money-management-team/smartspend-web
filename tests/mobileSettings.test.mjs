import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { click } from "./helpers/dom.mjs";
import { envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, i18n, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";

const { emailState } = await import("../src/mobile/settings/emailState.js");
const { getSettingsTabPath, PATH } = await import("../src/routes/Path.js");

/*
 * Profile and settings, organised in groups. Reads come from the shared session and one existing GET (the
 * notification preferences). Saving the profile, the password and the preferences, and signing out, are writes that
 * stay closed: the notes say so, and nothing but GET is made. Language and theme are the shared controls.
 */

after(() => dom.window.close());

describe("email status", () => {
  it("is one word, and never 'verified' without a yes from the backend", () => {
    assert.equal(emailState(null), "unknown");
    assert.equal(emailState(undefined), "unknown");
    assert.equal(emailState({ loading: true }), "loading");
    assert.equal(emailState({ error: new Error("x") }), "error");
    assert.equal(emailState({ status: { verified: true } }), "verified");
    assert.equal(emailState({ status: { verified: false } }), "unverified");
    assert.equal(emailState({ status: {} }), "unknown");
    assert.equal(emailState({ status: { verified: "yes" } }), "unknown", "a truthy word is not a yes");
    assert.equal(emailState({ loading: true, status: { verified: true } }), "loading", "while it is being read again, it is not shown as settled");
  });
});

const WORKSPACE = { id: 1, name: "Home budget", base_currency_code: "ILS", timezone: "Asia/Hebron" };
const PERSON = { ...USER_A, email: "alex@example.test", phone: "0500000000" };
const prefs = { preferences: { savings_installment_reminders: true }, channels: ["in_app"], savings_installment_reminders_available: true };

let api;
let view;
const text = (root = q("main")) => root.textContent.replace(/\s+/g, " ");
const section = (name) => q(`[data-sm-section='${name}']`);
const group = (name) => q(`[data-sm-group='${name}']`);
const open = async (entry = "/m/profile") => {
  storeSession({ token: TOKEN_A, user: PERSON, workspace: WORKSPACE });
  api?.restore();
  api = installFakeApi((call) => (call.path === "/notifications/preferences" ? { body: envelope(prefs) } : { status: 404, body: { status: false, message: "Not found" } }));
  view = await mountMobile({ entry, auth: { isAuthenticated: true, initializing: false, token: TOKEN_A, user: PERSON, workspace: WORKSPACE } });
};

beforeEach(async () => {
  await resetEnvironment();
});
afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("Profile and settings", () => {
  it("is six labelled groups under who is signed in, the session last", async () => {
    await open();
    assert.equal(q(".sm-bar-title").textContent, "Profile and settings");
    assert.deepEqual(qa(".sm-more-group").map((item) => item.querySelector(".sm-group-label").textContent), ["Account", "Security", "Preferences", "Notifications", "Help and privacy", "Session"]);
    assert.equal(qa(".sm-more-group").every((item) => item.getAttribute("aria-labelledby") === item.querySelector(".sm-group-label").id), true);
    const who = section("identity");
    assert.match(text(who), /Signed in as: Alex Example/);
    assert.match(text(who), /alex@example\.test/);
    assert.equal(q(".sm-avatar", who).textContent, "A");
  });

  it("the identity says the email's state, 'unknown' when the app cannot say, never verified by default", async () => {
    await open();
    const chip = q("[data-sm-chip]", section("identity"));
    assert.equal(chip.dataset.smChip, "unknown");
    assert.match(chip.textContent, /Email status unknown/);
    assert.equal(section("email").dataset.smEmail, "unknown");
    assert.equal(q("[data-sm-action='check-email']"), null, "nothing to check without the app's email status");
  });

  it("the account group shows the phone, workspace and main currency, and opens the profile form", async () => {
    await open();
    const account = group("account");
    assert.match(text(account), /Phone.*0500000000/);
    assert.match(text(account), /Workspace.*Home budget/);
    assert.match(text(account), /Main currency.*ILS/);
    assert.equal(q("[data-sm-action='profile-edit']", account).getAttribute("href"), "/m/profile/edit");
  });

  it("security: the password form, the email status, the full-version security page, and what is not offered", async () => {
    await open();
    const security = group("security");
    assert.equal(q("[data-sm-action='password-change']", security).getAttribute("href"), "/m/profile/password");
    assert.ok(section("email"));
    assert.equal(q("a[href='" + getSettingsTabPath("security") + "']", security) !== null, true);
    assert.match(text(q("[data-sm-note='password-note']", security)), /signs you out on your other devices/);
    // Signing out is real now (tests/mobileSignOut.test.mjs): one button in its own Session group, not a closed note.
    assert.equal(q("[data-sm-note='sign-out-closed']", security), null);
    assert.equal(qa("button", q("[data-sm-group='session']", q("main"))).filter((button) => /sign out/i.test(button.textContent)).length, 1);
  });

  it("preferences reuse the shared language and theme controls, and say they apply on this device", async () => {
    await open();
    const display = section("display");
    const choice = (name) => qa("button", display).find((button) => button.textContent.trim() === name);
    assert.equal(choice("English").getAttribute("aria-pressed"), "true");
    assert.equal(choice("Light").getAttribute("aria-pressed"), "true");
    assert.match(text(q("[data-sm-note='device-only']", display)), /apply on this device.*saved to your account is changed in the full version/);

    await click(choice("Dark"));
    assert.equal(document.documentElement.dataset.theme, "dark");
    await click(choice("العربية"));
    await settle();
    assert.equal(document.documentElement.dir, "rtl");
    assert.deepEqual(qa(".sm-group-label").map((label) => label.textContent), ["الحساب", "الأمان", "التفضيلات", "الإشعارات", "المساعدة والخصوصية", "الجلسة"]);
    await i18n.changeLanguage("en");
  });

  it("the time zone is shown as it is saved, and changing it is the full version's", async () => {
    await open();
    const zone = section("timezone");
    assert.match(text(zone), /Time zone.*Asia\/Hebron/);
    assert.equal(q("a", zone).getAttribute("href"), getSettingsTabPath("preferences"));
    assert.equal(qa("select", zone).length, 0, "no control that looks like it would save");
  });

  it("'Hide amounts' is a device preference that can be switched here and back, with no request", async () => {
    await open();
    const box = q("[data-sm-pref='hide-amounts']");
    assert.equal(box.checked, false);
    const before = api.calls.length;
    await click(box);
    assert.equal(q("[data-sm-pref='hide-amounts']").checked, true);
    await click(q("[data-sm-pref='hide-amounts']"));
    assert.equal(q("[data-sm-pref='hide-amounts']").checked, false);
    assert.equal(api.calls.length, before, "nothing left the device");
  });

  it("notifications: the reminder preference (changeable, not saved), the inbox and WhatsApp", async () => {
    await open();
    const notifications = group("notifications");
    const box = q("input[data-sm-pref='savings_installment_reminders']", notifications);
    assert.equal(box.checked, true);
    await click(box);
    assert.equal(q("[data-sm-note='write-closed']", notifications).dataset.smWrite, "notifications.preferences");
    assert.equal(q("[data-sm-action='save-preferences']", notifications).disabled, true);
    assert.equal(q("a[href='/m/notifications']", notifications) !== null, true);
    assert.equal(q("a[href='/m/whatsapp']", notifications) !== null, true);
  });

  it("help and privacy link to the public pages", async () => {
    await open();
    assert.deepEqual(qa("a", group("help")).map((link) => link.getAttribute("href")), [PATH.PUBLIC.SUPPORT, PATH.PUBLIC.CONTACT, PATH.PUBLIC.SECURITY]);
  });

  it("reads exactly one thing, the notification preferences, and sends nothing", async () => {
    await open();
    assert.deepEqual(api.calls.map((call) => `${call.method} ${call.path}`), ["GET /notifications/preferences"]);
  });

  it("the profile and password forms have one heading (the bar's) and say what they are for", async () => {
    await open("/m/profile/edit");
    assert.equal(q(".sm-bar-title").textContent, "Edit your profile");
    assert.equal(qa("h2", q("main")).some((heading) => heading.textContent.trim() === "Edit your profile"), false, "the title is not repeated");
    assert.ok(q(".sm-flow-intro"));
    assert.equal(q("[data-sm-note='write-closed'], [data-sm-note='draft-only']") !== null, true, "the form still says it is not saved here");
    await view.unmount();
    view = null;
    await open("/m/profile/password");
    assert.equal(q(".sm-bar-title").textContent, "Change your password");
    assert.ok(q(".sm-flow-intro"));
  });
});
