import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPostAuthPath,
  getSafeRedirectPath,
  toReturnPath,
} from "../src/routes/postAuthRedirect.js";

test("keeps pathname, query and hash of the requested page", () => {
  const from = toReturnPath({
    pathname: "/dashboard/reports",
    search: "?period=month&year=2026",
    hash: "#top",
  });
  assert.equal(from, "/dashboard/reports?period=month&year=2026#top");
  assert.equal(getPostAuthPath({ from }), from);
});

test("falls back to the dashboard without a usable destination", () => {
  assert.equal(getPostAuthPath(undefined), "/dashboard");
  assert.equal(getPostAuthPath({}), "/dashboard");
  assert.equal(getPostAuthPath({ from: 42 }), "/dashboard");
});

test("rejects external and protocol-relative targets", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example/dashboard",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "/dash\nboard",
    "",
  ]) {
    assert.equal(getSafeRedirectPath(value), null, value);
  }
});

test("never returns to a guest-only page", () => {
  for (const value of ["/signin", "/signin?x=1", "/register", "/forgot-password"]) {
    assert.equal(getSafeRedirectPath(value), null, value);
  }
  assert.equal(getSafeRedirectPath("/signing-off"), "/signing-off");
});
