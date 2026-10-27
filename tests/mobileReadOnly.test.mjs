import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { installDom } from "./helpers/dom.mjs";
import { installFakeApi } from "./helpers/mobileApi.mjs";

/*
 * Mobile reads and never writes. Three layers:
 *  1. the source: which files may talk to the API layer, and which names they may use;
 *  2. the facade: the only module that makes requests exports reads only;
 *  3. the runtime: the fake backend refuses anything but GET the moment it is attempted,
 *     and this file proves the refusal works (a POST made on purpose is caught).
 */

const dom = installDom();
after(() => dom.window.close());

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE = path.join(ROOT, "src/mobile");
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name)) : [path.join(dir, name)]));
const sources = walk(MOBILE).filter((file) => /\.(js|jsx)$/.test(file));

// Comments may mention what is forbidden ("create/update/archive are not imported"); the code must not use it.
const code = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const find = (pattern, files = sources) => files.filter((file) => pattern.test(code(file))).map(rel);

describe("the source", () => {
  it("only data/readApi.js imports the API wrappers, and identity/guard.js only the session reader from apiClient", () => {
    const importsOf = (file) => [...code(file).matchAll(/from\s*["']([^"']*Dashboards\/User\/api\/([A-Za-z]+)(?:\.js)?)["']/g)].map((match) => match[2]);
    const byFile = Object.fromEntries(sources.map((file) => [rel(file), importsOf(file)]).filter(([, modules]) => modules.length));

    assert.deepEqual(byFile, {
      "src/mobile/data/readApi.js": ["accountsApi", "budgetsApi", "categoriesApi", "apiClient", "dashboardApi", "financialAlertsApi", "recurringTransactionsApi", "savingsGoalsApi", "transactionsApi"],
      // The Smart Savings plan read, in its own file so a build without the flag has no way to ask for a plan.
      "src/mobile/data/readPlanApi.js": ["savingsPlansApi"],
      "src/mobile/identity/guard.js": ["apiClient"],
    });
  });

  it("takes from apiClient only the two readers: the session reader in the guard, the stored workspace in the facade", () => {
    const named = (file) => (code(file).match(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*apiClient(?:\.js)?["']/) ?? [])[1]?.split(",").map((name) => name.trim()).filter(Boolean);

    assert.deepEqual(named(path.join(MOBILE, "identity/guard.js")), ["getStoredAuthSession"]);
    assert.deepEqual(named(path.join(MOBILE, "data/readApi.js")), ["getStoredWorkspace"]);
  });

  it("names no write method of any wrapper, and no way to build a write request", () => {
    assert.deepEqual(find(/\.(create\w*|update|archive|correct|reverse|post|patch|put|confirm\w*|submit\w*)\s*\(/), []);
    assert.deepEqual(find(/["'`](POST|PATCH|PUT|DELETE)["'`]/i), []);
    assert.deepEqual(find(/\bmethod\s*:/), []);
    // (`body:` as a message key in the i18n tables is text, not a request body.)
    assert.deepEqual(find(/\bbody\s*:/, sources.filter((file) => !rel(file).startsWith("src/mobile/i18n/"))), []);
    assert.deepEqual(find(/Idempotency|createIdempotent|toMoneyString/i), []);
  });

  it("makes no request of its own: no fetch, XHR, beacon, socket, event stream or download", () => {
    assert.deepEqual(find(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|apiRequest|apiDownload|axios/), []);
  });

  it("imports nothing about WhatsApp, AI, imports, reports exports, transfers, recurring or other write flows", () => {
    assert.deepEqual(find(/from\s*["'][^"']*(whatsapp|aiCopilot|aiExpense|aiVoice|importsApi|reportExports|transfersApi|debtsApi|plannedSavingsApi|authApi|calendarApi|notificationsApi)[^"']*["']/i), []);
    // Budgets, goals, plans and recurring rules are read in the two facade files and nowhere else.
    const facades = ["src/mobile/data/readApi.js", "src/mobile/data/readPlanApi.js"];
    assert.deepEqual(find(/from\s*["'][^"']*(recurringTransactions|savingsGoalsApi|savingsPlansApi|budgetsApi)[^"']*["']/i).sort(), facades);
  });

  it("does not use the shared money helpers: formatMoney (rounds, shows bad data as 0.00) and the float-free sums are not needed and not imported", () => {
    assert.deepEqual(find(/\bformatMoney\b|\bsumMoney\b|\bsubtractMoney\b|utils\/formatters/), []);
  });

  it("never converts an amount to a floating-point number, and never rounds", () => {
    // The one reviewed exception reads the root font size from CSS (a layout measurement), not an amount.
    const notAmounts = ["src/mobile/shell/useCompactNav.js"];
    assert.deepEqual(find(/parseFloat|\.toFixed\(|\.toLocaleString\(|\bNumber\(/).filter((file) => !notAmounts.includes(file)), []);
    assert.deepEqual(notAmounts.filter((file) => !/parseFloat\(window\.getComputedStyle\(root\)\.fontSize\)/.test(code(path.join(ROOT, file)))), [], "the exception is still only the font-size read");

    // Where amounts are handled, no rounding at all (the paginator's page count in movements.js is not an amount).
    const amountFiles = sources.filter((file) => /src\/mobile\/(money|models|home|accounts)\//.test(rel(file)));
    assert.deepEqual(find(/Math\.(round|floor|trunc)/, amountFiles), []);
  });

  it("has no service worker, cache, IndexedDB or manifest", () => {
    assert.deepEqual(find(/serviceWorker|indexedDB|\bcaches\b|CacheStorage|workbox|manifest|BackgroundSync|periodicSync/i), []);
  });

  it("writes to browser storage in exactly one place: the single presentation word", () => {
    assert.deepEqual(find(/\.setItem\(|\.removeItem\(|document\.cookie|(local|session)Storage\.clear\(/), ["src/mobile/presentation/preference.js"]);
    const writes = [...code(path.join(MOBILE, "presentation/preference.js")).matchAll(/(setItem|removeItem)\(\s*([A-Za-z_]+)/g)].map((match) => match[2]);
    assert.deepEqual([...new Set(writes)], ["PRESENTATION_KEY"]);
  });

  it("reads the full app's preference store but never updates it", () => {
    assert.deepEqual(find(/experienceStore/), ["src/mobile/money/MoneyPrivacy.jsx"]);
    assert.match(code(path.join(MOBILE, "money/MoneyPrivacy.jsx")), /import\s*\{\s*createExperienceStore\s*\}/);
    assert.deepEqual(find(/\bstore\.update\b|\.update\s*\(/), []);
  });

  it("has no second authentication context or token storage of its own", () => {
    assert.deepEqual(find(/createContext\(/).filter((file) => /auth/i.test(code(path.join(ROOT, file)))), []);
    assert.deepEqual(find(/getAuthToken|Bearer|Authorization|getItem\(\s*["']ACCESS_TOKEN/), [], "Mobile never reads or builds the token itself");
  });
});

describe("the facade", () => {
  it("exports reads only", async () => {
    const readApi = await import("../src/mobile/data/readApi.js");

    assert.deepEqual(Object.keys(readApi).sort(), ["ACTIVITY_PER_PAGE", "BUDGETS_PER_PAGE", "DASHBOARD_PERIOD", "GOALS_PER_PAGE", "MOVEMENTS_PER_PAGE", "RULES_PER_PAGE", "isAccountId", "planningWorkspaceId", "readAccount", "readAccountMovements", "readAccounts", "readAlerts", "readBudget", "readBudgets", "readCategories", "readDashboard", "readGoal", "readGoals", "readRule", "readRules", "readTransaction", "readTransactions"]);
    const plan = await import("../src/mobile/data/readPlanApi.js");
    assert.deepEqual(Object.keys(plan), ["readGoalPlan"]);
  });

  it("each read sends a GET to its documented endpoint, with only documented filters", async () => {
    const api = installFakeApi(() => ({ body: { status: true, data: {} } }));

    try {
      const readApi = await import("../src/mobile/data/readApi.js");
      const controller = new AbortController();

      await readApi.readDashboard(controller.signal);
      await readApi.readAlerts(controller.signal);
      await readApi.readAccounts(controller.signal);
      await readApi.readAccount("12", controller.signal);
      await readApi.readAccountMovements("12", 2, controller.signal);

      assert.deepEqual(api.summary(), ["GET /dashboard", "GET /financial-alerts", "GET /accounts", "GET /accounts/12", "GET /transactions"]);
      assert.deepEqual(api.calls[0].query, { period: "month" });
      assert.deepEqual(api.calls[4].query, { account_id: "12", page: "2", per_page: "20", sort_by: "occurred_at", sort_dir: "desc" });
      assert.deepEqual(api.violations, []);
    } finally {
      api.restore();
    }
  });

  it("accepts only account ids that are plain positive integers", async () => {
    const { isAccountId } = await import("../src/mobile/data/readApi.js");

    for (const good of ["1", 5, "123456789012345"]) assert.equal(isAccountId(good), true, String(good));
    for (const bad of ["0", "01", "-1", "1.5", "abc", "", null, undefined, "1234567890123456", "1/2", "1e3", " 1"]) assert.equal(isAccountId(bad), false, String(bad));
  });
});

describe("the instrument itself: a forbidden request fails on the spot", () => {
  it("a POST made through the app's own client is refused, recorded, and thrown", async () => {
    const api = installFakeApi(() => ({ body: { status: true, data: {} } }));

    try {
      const { apiRequest } = await import("../src/features/Dashboards/User/api/apiClient.js");

      // apiRequest wraps what fetch throws; the cause is the fake's refusal.
      await assert.rejects(() => apiRequest("/transactions/expense", { method: "POST", body: { amount: "1.0000" } }), (error) => /FORBIDDEN: Mobile sent POST \/transactions\/expense/.test(error.cause?.message));
      assert.deepEqual(api.takeViolations(), ["POST /transactions/expense"]);
    } finally {
      api.restore();
    }
  });

  it("PATCH, PUT and DELETE are refused the same way, and so is a GET that carries a body", async () => {
    const api = installFakeApi(() => ({ body: { status: true, data: {} } }));

    try {
      const { apiRequest } = await import("../src/features/Dashboards/User/api/apiClient.js");

      for (const method of ["PATCH", "PUT", "DELETE"]) {
        await assert.rejects(() => apiRequest("/accounts/1", { method, body: {} }), (error) => /FORBIDDEN/.test(error.cause?.message), method);
      }
      await assert.rejects(() => apiRequest("/accounts", { method: "GET", body: { sneaky: true } }), (error) => /FORBIDDEN/.test(error.cause?.message));
      assert.equal(api.takeViolations().length, 4);
    } finally {
      api.restore();
    }
  });

  it("other transports are trapped too, so a screen cannot avoid the check by not using fetch", async () => {
    const api = installFakeApi(() => ({}));

    try {
      assert.throws(() => new XMLHttpRequest(), /FORBIDDEN/);
      assert.throws(() => new WebSocket("wss://example.test"), /FORBIDDEN/);
      assert.throws(() => new EventSource("/stream"), /FORBIDDEN/);
      assert.throws(() => navigator.sendBeacon("/log", "x"), /FORBIDDEN/);
      assert.equal(api.takeViolations().length, 4);
    } finally {
      api.restore();
    }
  });

  it("a violation that a screen swallowed still fails the test when the fake API is torn down", () => {
    const api = installFakeApi(() => ({}));

    assert.throws(() => globalThis.fetch("/api/accounts", { method: "DELETE" }), /FORBIDDEN/);
    assert.throws(() => api.restore(), /forbidden requests.*DELETE \/accounts/s);
  });
});
