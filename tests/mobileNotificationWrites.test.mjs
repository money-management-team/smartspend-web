import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { FORM_WRITES, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { moreBackend, notification } from "./helpers/moreFixture.mjs";
import { click } from "./helpers/dom.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const writeApi = await import("../src/mobile/data/writeApi.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
const { notificationWriteOutcome, outcomeMessageKey, readAllProof, readProof } = await import("../src/mobile/models/notificationWrites.js");

/*
 * Phase 1 of the Mobile write integration: marking notifications read (one, or all). Both writes are registered
 * "same-result" and stay CLOSED in the product (APPROVED is empty). These tests open them only through the test
 * runner's switch (setWriteApprovalsForTests), which a build cannot read (tests/mobileBundle.test.mjs), against a fake
 * backend with fictional data. installFakeApi refuses every non-GET except the one a test names.
 */

after(() => dom.window.close());

const OPEN = ["notifications.markRead", "notifications.markAllRead"];
const ALLOW = [FORM_WRITES.notificationRead, FORM_WRITES.notificationsReadAll];
let api;
let view;

const writes = () => api.calls.filter((call) => call.method !== "GET");
const gets = (path) => api.calls.filter((call) => call.method === "GET" && call.path === path);
const outcome = () => q("[data-sm-write-outcome]");
const unread = () => q("[data-sm-unread]").dataset.smUnread;

/* A backend that keeps read state, answering the writes the way NotificationController does. */
function inbox(rows, { onRead, onReadAll, serverUnread } = {}) {
  const read = moreBackend({ notifications: rows });
  const unreadNow = () => rows.filter((row) => !row.is_read).length;
  return (call) => {
    const one = /^\/notifications\/(\d+)\/read$/.exec(call.path);
    if (one && call.method === "PATCH") {
      if (onRead) return onRead(call, one[1]);
      const row = rows.find((item) => String(item.id) === one[1]);
      if (!row) return failure(404, "The requested resource was not found.");
      if (!row.is_read) Object.assign(row, { is_read: true, read_at: "2026-11-15T10:00:00Z" });
      return { body: envelope({ notification: row, unread_count: serverUnread ?? unreadNow() }) };
    }
    if (call.path === "/notifications/read-all" && call.method === "POST") {
      if (onReadAll) return onReadAll(call);
      const marked = rows.filter((row) => !row.is_read).length;
      rows.forEach((row) => Object.assign(row, { is_read: true, read_at: row.read_at ?? "2026-11-15T10:00:00Z" }));
      return { body: envelope({ marked_count: marked, unread_count: 0 }) };
    }
    return read(call);
  };
}

const open = async (handler, { approve = OPEN } = {}) => {
  api?.restore();
  api = installFakeApi(handler, { allowWrites: ALLOW });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry: "/m/notifications" });
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});

afterEach(async () => {
  gate.setWriteApprovalsForTests(null);
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
});

describe("the registration", () => {
  it("registers both writes as same-result, moving no money, with no key, and closed by default", () => {
    for (const operation of OPEN) {
      const write = gate.MOBILE_WRITES[operation];
      assert.equal(write.serverDedup, "same-result", operation);
      assert.equal(write.moves, false, operation);
      assert.equal(write.key, "none", operation);
      assert.equal(gate.isWriteOpen(operation), false, `${operation} is closed by default`);
    }
    assert.equal(gate.MOBILE_WRITES["notifications.markRead"].endpoint, "PATCH /notifications/{id}/read");
    assert.equal(gate.MOBILE_WRITES["notifications.markAllRead"].endpoint, "POST /notifications/read-all");
  });

  it("ships APPROVED empty", () => {
    const source = readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8");
    assert.match(source, /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("the senders refuse before any request exists while the gate is closed", () => {
    api = installFakeApi(() => ({ body: envelope({}) }));
    assert.throws(() => writeApi.sendNotificationRead("1"), (error) => error.name === "WriteClosedError" && error.operation === "notifications.markRead");
    assert.throws(() => writeApi.sendNotificationsReadAll(), (error) => error.name === "WriteClosedError" && error.operation === "notifications.markAllRead");
    assert.deepEqual(api.calls, []);
  });

  it("an id that is not a notification id is never sent, even with the gate open", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: ALLOW });
    gate.setWriteApprovalsForTests(OPEN);
    for (const bad of ["0", "-1", "1/../2", "abc", "", null, undefined, "1".repeat(16)]) {
      assert.throws(() => writeApi.sendNotificationRead(bad), { code: "INVALID_ID" }, String(bad));
    }
    assert.deepEqual(api.calls, []);
  });
});

describe("what an answer proves", () => {
  it("marking one read is confirmed only by the row read and the server's own count", () => {
    assert.deepEqual(readProof({ notification: { id: 4, is_read: true }, unread_count: 7 }, "4"), { unreadCount: 7 });
    assert.equal(readProof({ notification: { id: 5, is_read: true }, unread_count: 7 }, "4"), null, "another row");
    assert.equal(readProof({ notification: { id: 4, is_read: false }, unread_count: 7 }, "4"), null, "still unread");
    for (const count of [undefined, null, -1, 1.5, "3"]) assert.equal(readProof({ notification: { id: 4, is_read: true }, unread_count: count }, "4"), null, String(count));
    assert.equal(readProof(null, "4"), null);
  });

  it("marking all read is confirmed by the server's count and how many it marked (0 is a valid answer)", () => {
    assert.deepEqual(readAllProof({ marked_count: 0, unread_count: 0 }), { unreadCount: 0, marked: 0 });
    assert.deepEqual(readAllProof({ marked_count: 3, unread_count: 0 }), { unreadCount: 0, marked: 3 });
    assert.equal(readAllProof({ unread_count: 0 }), null);
    assert.equal(readAllProof({ marked_count: 3 }), null);
  });

  it("classifies failures: 403/404/429 refused, 401 identity, timeout and network unknown", () => {
    const api = (status, code) => new ApiError("x", { status, code });
    assert.deepEqual(notificationWriteOutcome(api(404, "NOT_FOUND")).kind, "rejected");
    assert.deepEqual(notificationWriteOutcome(api(403, "FORBIDDEN")).kind, "rejected");
    assert.deepEqual(notificationWriteOutcome(api(429, "RATE_LIMITED")).kind, "rejected");
    assert.deepEqual(notificationWriteOutcome(api(401, "UNAUTHENTICATED")).kind, "identity");
    for (const error of [new ApiError("", { code: "TIMEOUT" }), new ApiError("", { code: "NETWORK_ERROR" }), api(500, "SERVER_ERROR"), api(409, "CONFLICT"), new ApiError("", { status: 200, code: "MALFORMED_RESPONSE" }), new Error("anything")]) {
      assert.equal(notificationWriteOutcome(error).kind, "unknown", error.code ?? error.message);
    }
    assert.deepEqual(notificationWriteOutcome(Object.assign(new Error("x"), { code: "INVALID_ID" })).kind, "rejected");
    assert.deepEqual(notificationWriteOutcome(new gate.WriteClosedError("notifications.markRead")).code, "WRITE_CLOSED");
  });

  it("names a message for each outcome", () => {
    assert.equal(outcomeMessageKey({ kind: "confirmed", target: "4" }), "read");
    assert.equal(outcomeMessageKey({ kind: "confirmed", target: "all" }), "readAll");
    assert.equal(outcomeMessageKey({ kind: "rejected", code: "NOT_FOUND" }), "notFound");
    assert.equal(outcomeMessageKey({ kind: "rejected", code: "FORBIDDEN" }), "forbidden");
    assert.equal(outcomeMessageKey({ kind: "rejected", code: "RATE_LIMITED" }), "rateLimited");
    assert.equal(outcomeMessageKey({ kind: "unknown", code: "TIMEOUT" }), "unknown");
  });
});

describe("the notifications screen, gate closed (the product)", () => {
  it("sends nothing: Mark as read explains itself and Mark all is disabled", async () => {
    await open(inbox([notification(1), notification(2)]), { approve: null });
    await click(q("[data-sm-notification='1'] [data-sm-action='mark-read']"));
    assert.ok(q("[data-sm-notification='1'] [data-sm-note='write-closed']"));
    assert.equal(q("[data-sm-action='mark-all-read']").disabled, true);
    await click(q("[data-sm-action='mark-all-read']"));
    await settle();
    assert.deepEqual(writes(), [], "zero writes");
    assert.equal(unread(), "2");
  });
});

describe("the notifications screen, writes opened by the test switch", () => {
  it("marks one read with exactly one request and shows the server's unread count, not a local one", async () => {
    const rows = [notification(1), notification(2), notification(3, { is_read: true })];
    await open(inbox(rows, { serverUnread: 9 }));
    assert.equal(unread(), "2");
    const listReads = gets("/notifications").length;

    await click(q("[data-sm-notification='1'] [data-sm-action='mark-read']"));
    await settle();

    assert.deepEqual(writes().map((call) => `${call.method} ${call.path}`), ["PATCH /notifications/1/read"]);
    assert.equal(writes()[0].hasBody, false, "no body");
    assert.equal(writes()[0].headers["Idempotency-Key"], undefined, "no key: the backend takes none");
    assert.equal(unread(), "9", "the count the write's answer gave, not 2 - 1");
    assert.equal(outcome().dataset.smWriteOutcome, "confirmed");
    assert.match(outcome().textContent, /Marked as read/);
    assert.ok(gets("/notifications").length > listReads, "the rows are read again");
    assert.equal(q("[data-sm-notification='1']").dataset.smRead, "true", "the server's read state");
    assert.equal(q("[data-sm-notification='1'] [data-sm-mark-read]"), null);
  });

  it("a second tap while the answer is on its way sends nothing more, on any control", async () => {
    let release;
    const rows = [notification(1), notification(2)];
    const backend = inbox(rows);
    await open(inbox(rows, { onRead: (call, id) => new Promise((resolve) => { release = () => resolve(backend(call, id)); }) }));

    const button = q("[data-sm-notification='1'] [data-sm-action='mark-read']");
    await click(button);
    await settle(5);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute("aria-busy"), "true");
    assert.equal(q("[data-sm-notification='2'] [data-sm-action='mark-read']").disabled, true);
    assert.equal(q("[data-sm-action='mark-all-read']").disabled, true);
    await click(button);
    await click(q("[data-sm-action='mark-all-read']"));
    assert.equal(writes().length, 1, "still one request");

    release();
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(outcome().dataset.smWriteOutcome, "confirmed");
  });

  it("marks all read with exactly one request; repeating it is safe and still says what the server says", async () => {
    await open(inbox([notification(1), notification(2), notification(3)]));
    assert.equal(unread(), "3");

    await click(q("[data-sm-action='mark-all-read']"));
    await settle();
    assert.deepEqual(writes().map((call) => `${call.method} ${call.path}`), ["POST /notifications/read-all"]);
    assert.equal(unread(), "0");
    assert.equal(outcome().dataset.smWriteOutcome, "confirmed");
    assert.match(outcome().textContent, /All notifications are marked as read/);
    assert.equal(q("[data-sm-action='mark-all-read']"), null, "nothing left to mark");
    assert.ok(qa("[data-sm-notification]").every((row) => row.dataset.smRead === "true"));

    // The same request again (as a browser might deliver it): the backend marks 0 and the answer is the same.
    const again = await writeApi.sendNotificationsReadAll();
    assert.deepEqual(again.data, { marked_count: 0, unread_count: 0 });
    assert.deepEqual(readAllProof(again.data), { unreadCount: 0, marked: 0 });
  });

  it("marking an already-read notification again returns the same row and count", async () => {
    const rows = [notification(1, { is_read: true, read_at: "2026-11-01T08:00:00Z" })];
    api = installFakeApi(inbox(rows), { allowWrites: ALLOW });
    gate.setWriteApprovalsForTests(OPEN);
    const first = await writeApi.sendNotificationRead("1");
    const second = await writeApi.sendNotificationRead("1");
    assert.deepEqual(second.data, first.data);
    assert.equal(rows[0].read_at, "2026-11-01T08:00:00Z", "the first read time is kept");
    assert.deepEqual(readProof(second.data, "1"), { unreadCount: 0 });
  });

  it("a 404 says the notification wasn't found and reads the count and rows again", async () => {
    await open(inbox([notification(1), notification(2)], { onRead: () => failure(404, "The requested resource was not found.") }));
    const countReads = gets("/notifications/unread-count").length;
    const listReads = gets("/notifications").length;

    await click(q("[data-sm-notification='1'] [data-sm-action='mark-read']"));
    await settle();

    assert.equal(writes().length, 1);
    assert.equal(outcome().dataset.smWriteOutcome, "rejected");
    assert.equal(outcome().dataset.smWriteCode, "NOT_FOUND");
    assert.equal(outcome().getAttribute("role"), "alert");
    assert.match(outcome().textContent, /couldn't find that notification/);
    assert.ok(gets("/notifications/unread-count").length > countReads);
    assert.ok(gets("/notifications").length > listReads);
    assert.equal(q("[data-sm-notification='1'] [data-sm-action='mark-read']").disabled, false, "may be tried again by hand");
  });

  it("a 403 says the account was refused and changes nothing", async () => {
    await open(inbox([notification(1)], { onReadAll: () => failure(403, "Your account is inactive.") }));
    const countReads = gets("/notifications/unread-count").length;

    await click(q("[data-sm-action='mark-all-read']"));
    await settle();

    assert.equal(writes().length, 1);
    assert.equal(outcome().dataset.smWriteCode, "FORBIDDEN");
    assert.match(outcome().textContent, /refused this change for your account/);
    assert.equal(unread(), "1", "nothing changed");
    assert.equal(gets("/notifications/unread-count").length, countReads, "nothing to re-read");
  });

  it("a network failure is an unknown outcome: said as such, re-read, never resent by itself", async () => {
    let attempts = 0;
    await open(inbox([notification(1), notification(2)], { onRead: () => { attempts += 1; return new TypeError("Failed to fetch"); } }));
    const countReads = gets("/notifications/unread-count").length;

    await click(q("[data-sm-notification='1'] [data-sm-action='mark-read']"));
    await settle();

    assert.equal(attempts, 1, "sent once, not retried");
    assert.equal(outcome().dataset.smWriteOutcome, "unknown");
    assert.equal(outcome().dataset.smWriteCode, "NETWORK_ERROR");
    assert.match(outcome().textContent, /didn't confirm the change/);
    assert.ok(gets("/notifications/unread-count").length > countReads, "the count is read again");
    await settle();
    assert.equal(attempts, 1, "still once");
  });

  it("a 200 without the server's count is unknown, not confirmed", async () => {
    await open(inbox([notification(1)], { onRead: (call, id) => ({ body: envelope({ notification: { id: Number(id), is_read: true } }) }) }));
    await click(q("[data-sm-notification='1'] [data-sm-action='mark-read']"));
    await settle();
    assert.equal(outcome().dataset.smWriteOutcome, "unknown");
    assert.equal(outcome().dataset.smWriteCode, "UNCONFIRMED");
  });

  it("opening only one of the two writes leaves the other closed", async () => {
    await open(inbox([notification(1)]), { approve: ["notifications.markRead"] });
    assert.equal(q("[data-sm-action='mark-all-read']").disabled, true);
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='notifications.markAllRead']"));
    await click(q("[data-sm-action='mark-all-read']"));
    await settle();
    assert.deepEqual(writes(), []);
  });

  it("speaks Arabic", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    await open(inbox([notification(1)]));
    await click(q("[data-sm-notification='1'] [data-sm-action='mark-read']"));
    await settle();
    assert.match(outcome().textContent, /عُلِّم كمقروء/);
  });
});
