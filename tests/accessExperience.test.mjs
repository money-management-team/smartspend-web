import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import {
  createWelcomeNotice,
  dismissWelcomeNotice,
  isWelcomeForUser,
  welcomeGreeting,
} from "../src/contexts/auth/welcomeNotice.js";

test("welcome notices distinguish a successful registration from login without retaining private session data", () => {
  const user = {
    id: 1,
    password: "not-retained",
    token: "not-retained",
    balance: "25.5000",
  };
  assert.deepEqual(createWelcomeNotice(user, "register", 2), {
    id: 2,
    userId: "1",
    kind: "register",
  });
  assert.deepEqual(createWelcomeNotice(user, "login", 3), {
    id: 3,
    userId: "1",
    kind: "login",
  });
});
test("unknown identities kinds and invalid generations cannot create welcome notices", () => {
  for (const id of [null, 0, "../2", Number.MAX_SAFE_INTEGER + 1])
    assert.equal(createWelcomeNotice({ id }, "login", 1), null);
  assert.equal(createWelcomeNotice({ id: 1 }, "restore", 1), null);
  for (const sequence of [0, -1, NaN, "2"])
    assert.equal(createWelcomeNotice({ id: 1 }, "login", sequence), null);
});
test("a stale dismissal cannot clear a newer successful sign-in", () => {
  const notice = createWelcomeNotice({ id: 1 }, "login", 3);
  assert.equal(dismissWelcomeNotice(notice, 2), notice);
  assert.equal(dismissWelcomeNotice(notice, 3), null);
});
test("welcome display cannot show another user's pending notice", () => {
  const notice = createWelcomeNotice({ id: 1 }, "login", 1);
  assert.equal(isWelcomeForUser(notice, { id: "1" }), true);
  assert.equal(isWelcomeForUser(notice, { id: 2 }), false);
  assert.equal(isWelcomeForUser(notice, null), false);
  assert.equal(isWelcomeForUser(null, { id: 1 }), false);
});
test("greeting boundaries use the chosen timezone and never compare formatted clock strings", () => {
  for (const [hour, expected] of [
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [21, "evening"],
    [22, "night"],
  ]) {
    assert.equal(
      welcomeGreeting(
        "UTC",
        new Date(`2026-10-03T${String(hour).padStart(2, "0")}:00:00Z`),
      ),
      expected,
    );
  }
  assert.equal(
    welcomeGreeting("Asia/Tokyo", new Date("2026-10-03T14:00:00Z")),
    "night",
  );
});
test("a malformed profile timezone still provides a usable greeting", () => {
  assert.ok(
    ["morning", "afternoon", "evening", "night"].includes(
      welcomeGreeting("unknown/timezone", new Date("2026-10-03T10:00:00Z")),
    ),
  );
});
test("Arabic and English have matching policy and welcome copy without executable markup", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  try {
    const { accessMessages } = await server.ssrLoadModule(
      "/src/components/AccessExperience/accessMessages.js",
    );
    const keys = (object, prefix = "") =>
      Object.entries(object)
        .flatMap(([key, value]) =>
          value && typeof value === "object"
            ? keys(value, `${prefix}${key}.`)
            : [`${prefix}${key}`],
        )
        .sort();
    assert.deepEqual(keys(accessMessages.ar), keys(accessMessages.en));
    for (const messages of Object.values(accessMessages)) {
      assert.equal(messages.termsSections.length, 6);
      assert.equal(messages.privacySections.length, 6);
      assert.ok(
        messages.termsSections.every((item) => item.title && item.body),
      );
      assert.ok(!JSON.stringify(messages).includes("<script"));
    }
  } finally {
    await server.close();
  }
});
