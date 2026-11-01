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
      "src/mobile/data/readApi.js": ["accountsApi", "budgetsApi", "calendarApi", "categoriesApi", "apiClient", "dashboardApi", "debtsApi", "financialAlertsApi", "importsApi", "notificationsApi", "recurringTransactionsApi", "reportExportsApi", "reportsApi", "savingsGoalsApi", "transactionsApi", "transfersApi"],
      // The Smart Savings plan read, in its own file so a build without the flag has no way to ask for a plan.
      "src/mobile/data/readPlanApi.js": ["savingsPlansApi"],
      // The assistant, captures, WhatsApp and notification-preference reads: GET only (see below).
      "src/mobile/data/readAssistApi.js": ["aiCopilotApi", "aiExpenseCapturesApi", "aiInputQuotasApi", "aiVoiceExpenseCapturesApi", "notificationsApi", "whatsappApi"],
      // The one write facade: every call checks the write gate first (all closed), then uses the app's own wrapper.
      "src/mobile/data/writeApi.js": ["accountsApi", "apiClient", "aiExpenseCapturesApi", "aiVoiceExpenseCapturesApi", "authApi", "budgetsApi", "categoriesApi", "debtsApi", "plannedSavingsApi", "recurringTransactionsApi", "reportExportsApi", "savingsGoalsApi", "transactionsApi", "transfersApi", "whatsappApi"],
      "src/mobile/identity/guard.js": ["apiClient"],
    });
  });

  it("takes from apiClient only the two readers: the session reader in the guard, the stored workspace in the facade", () => {
    const named = (file) => (code(file).match(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*apiClient(?:\.js)?["']/) ?? [])[1]?.split(",").map((name) => name.trim()).filter(Boolean);

    assert.deepEqual(named(path.join(MOBILE, "identity/guard.js")), ["getStoredAuthSession"]);
    assert.deepEqual(named(path.join(MOBILE, "data/readApi.js")), ["getStoredWorkspace"]);
    // The write facade takes only the key maker, for the writes the backend keys (every write is closed).
    assert.deepEqual(named(path.join(MOBILE, "data/writeApi.js")), ["createIdempotencyKey"]);
  });

  it("names no write method of any wrapper outside the category write facade, and that one names exactly create and update of categories", () => {
    const WRITE = "src/mobile/data/writeApi.js";
    // MoneyPrivacy.jsx calls the device preference store's `update` (hide amounts), pinned by the store test below.
    const others = sources.filter((file) => rel(file) !== WRITE && rel(file) !== "src/mobile/money/MoneyPrivacy.jsx");
    // (`URL.createObjectURL` is the browser's own, for showing a chosen photo or a recording on this device.)
    // forms/DraftForm.jsx calls its own submission hook (`sent.submit`), which reaches the facade and its gate only.
    assert.deepEqual(find(/(?<!\bURL|\bsent)\.(create\w*|update|archive|correct|reverse|post|patch|put|confirm\w*|submit\w*)\s*\(/, others), []);
    // forms/ names the full version's endpoints as text ("POST /accounts/{id}/archive") and has a Mobile address
    // ending in /archive (a review that sends nothing); tests/mobileForms.test.mjs checks that forms/ has no request code.
    // The gate's registry names the full version's endpoints as text too (".../archive"); the facade's calls are pinned below.
    const notForms = sources.filter((file) => !rel(file).startsWith("src/mobile/forms/") && rel(file) !== "src/mobile/data/writeGate.js");
    assert.deepEqual(find(/categoriesApi\.(archive|delete)|\/archive[`"']/, notForms), [], "no archive, no delete");
    assert.deepEqual(find(/categoriesApi|accountsApi|Api\.archive/, sources.filter((file) => rel(file).startsWith("src/mobile/forms/"))), [], "forms/ names no API wrapper at all");
    const calls = [...code(path.join(ROOT, WRITE)).matchAll(/\b(\w+Api)\.(\w+)\s*\(/g)].map((match) => `${match[1]}.${match[2]}`);
    assert.deepEqual([...new Set(calls)].sort(), [
      "accountsApi.archive", "accountsApi.create", "accountsApi.update", "aiExpenseCapturesApi.confirm", "aiExpenseCapturesApi.update",
      "aiVoiceExpenseCapturesApi.confirm", "aiVoiceExpenseCapturesApi.update", "authApi.changePassword", "authApi.updateProfile",
      "budgetsApi.create", "budgetsApi.update", "categoriesApi.create", "categoriesApi.update", "debtsApi.create", "debtsApi.recordPayment",
      "debtsApi.reversePayment", "debtsApi.update", "plannedSavingsApi.create", "recurringTransactionsApi.confirmNext", "recurringTransactionsApi.create",
      "recurringTransactionsApi.skipNext", "recurringTransactionsApi.update", "reportExportsApi.create", "savingsGoalsApi.contribute", "savingsGoalsApi.create",
      "savingsGoalsApi.update", "savingsGoalsApi.withdraw", "transactionsApi.correct", "transactionsApi.createExpense", "transactionsApi.createIncome",
      "transactionsApi.reverse", "transfersApi.create", "transfersApi.reverse", "whatsappApi.confirmDraft", "whatsappApi.updateDraft",
    ], "the facade names these writes and no other (no budget, goal, debt, rule or category archive; no import, discard or unlink)");
    // Every one of them is behind the gate: the only function that reaches SENDERS asserts it first.
    assert.match(code(path.join(ROOT, WRITE)), /export function sendWorkflowWrite\(write, key\) \{\n  assertWriteOpen\(write\.operation\);/);
    // Two places send: the category form, and the forms' submission hook. No other screen imports the write facade.
    assert.deepEqual(find(/from\s*["'][^"']*data\/writeApi(?:\.js)?["']/), ["src/mobile/categories/MobileCategoryForm.jsx", "src/mobile/forms/useWorkflowSubmit.js"]);
  });

  it("never asks for the Smart Savings funding preview: a POST, blocked until the backend shows it has no consequential side effect", () => {
    assert.deepEqual(find(/fundingPreview|funding-preview|confirmAccounts|reverseLegs/), []);
  });

  it("has no way to build a write request of its own", () => {
    assert.deepEqual(find(/["'`](POST|PATCH|PUT|DELETE)["'`]/i), []);
    assert.deepEqual(find(/\bmethod\s*:/), []);
    // (`body:` as a message key in the i18n tables is text, not a request body.)
    assert.deepEqual(find(/\bbody\s*:/, sources.filter((file) => !rel(file).startsWith("src/mobile/i18n/"))), []);
    // The key exists in the write facade only (comments aside): it makes one per submission intent and passes it to the wrapper.
    assert.deepEqual(find(/Idempotency|createIdempotent/i), ["src/mobile/data/writeApi.js"]);
    assert.deepEqual(find(/toMoneyString/), []);
  });

  it("makes no request of its own: no fetch, XHR, beacon, socket, event stream or download", () => {
    assert.deepEqual(find(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|apiRequest|apiDownload|axios/), []);
  });

  it("imports nothing about WhatsApp, AI, imports, reports exports, planned savings or auth outside the read facades", () => {
    // Outside the read facades, only the (closed) write facade names these wrappers; the methods it calls are pinned above.
    assert.deepEqual(find(/from\s*["'][^"']*(plannedSavingsApi|authApi)[^"']*["']/i), ["src/mobile/data/writeApi.js"]);
    // WhatsApp, the assistant and captures are read in their own facade, through these GET methods and no other.
    assert.deepEqual(find(/from\s*["'][^"']*(whatsappApi|whatsappContract|aiCopilot|aiExpense|aiVoice|aiInputQuotas)[^"']*["']/i), ["src/mobile/data/readAssistApi.js", "src/mobile/data/writeApi.js"]);
    const assistUsed = [...code(path.join(MOBILE, "data/readAssistApi.js")).matchAll(/\b(aiCopilotApi|aiExpenseCapturesApi|aiInputQuotasApi|aiVoiceExpenseCapturesApi|notificationsApi|whatsappApi)\.(\w+)\(/g)].map((match) => `${match[1]}.${match[2]}`);
    assert.deepEqual([...new Set(assistUsed)].sort(), ["aiCopilotApi.conversation", "aiCopilotApi.conversations", "aiCopilotApi.forecast", "aiCopilotApi.insights", "aiCopilotApi.settings", "aiExpenseCapturesApi.get", "aiExpenseCapturesApi.list", "aiInputQuotasApi.get", "aiVoiceExpenseCapturesApi.get", "aiVoiceExpenseCapturesApi.list", "notificationsApi.getPreferences", "whatsappApi.getDraft", "whatsappApi.getIntegration", "whatsappApi.listDrafts"]);
    // Debts, transfers, notifications and the calendar are read in the facade only, and only through these methods.
    assert.deepEqual(find(/from\s*["'][^"']*(transfersApi|debtsApi|calendarApi|notificationsApi|importsApi|reportExports|reportsApi)[^"']*["']/i), ["src/mobile/data/readApi.js", "src/mobile/data/readAssistApi.js", "src/mobile/data/writeApi.js"]);
    const used = [...code(path.join(MOBILE, "data/readApi.js")).matchAll(/\b(debtsApi|transfersApi|notificationsApi|calendarApi|importsApi|reportExportsApi)\.(\w+)\(/g)].map((match) => `${match[1]}.${match[2]}`);
    assert.deepEqual([...new Set(used)].sort(), ["calendarApi.get", "debtsApi.get", "debtsApi.list", "debtsApi.listPayments", "importsApi.get", "importsApi.list", "notificationsApi.list", "notificationsApi.unreadCount", "reportExportsApi.download", "reportExportsApi.list", "transfersApi.get", "transfersApi.list"]);
    // Budgets, goals, plans and recurring rules are read in the two facade files and nowhere else.
    const facades = ["src/mobile/data/readApi.js", "src/mobile/data/readPlanApi.js", "src/mobile/data/writeApi.js"];
    assert.deepEqual(find(/from\s*["'][^"']*(recurringTransactions|savingsGoalsApi|savingsPlansApi|budgetsApi)[^"']*["']/i).sort(), facades);
  });

  it("does not use the shared money helpers: formatMoney (rounds, shows bad data as 0.00) and the float-free sums are not needed and not imported", () => {
    assert.deepEqual(find(/\bformatMoney\b|\bsumMoney\b|\bsubtractMoney\b|utils\/formatters/), []);
  });

  it("never converts an amount to a floating-point number, and never rounds", () => {
    // The one reviewed exception reads the root font size from CSS (a layout measurement), not an amount.
    // The second reviewed exception turns record ids and whole counts into numbers for a request body; amounts stay strings there (wireAmount).
    const notAmounts = ["src/mobile/forms/writePayloads.js", "src/mobile/shell/useCompactNav.js"];
    assert.deepEqual(find(/parseFloat|\.toFixed\(|\.toLocaleString\(|\bNumber\(/).filter((file) => !notAmounts.includes(file)), []);
    assert.deepEqual(notAmounts.filter((file) => file.endsWith("useCompactNav.js") && !/parseFloat\(window\.getComputedStyle\(root\)\.fontSize\)/.test(code(path.join(ROOT, file)))), [], "the exception is still only the font-size read");
    const payloads = code(path.join(MOBILE, "forms/writePayloads.js"));
    assert.deepEqual([...payloads.matchAll(/\bNumber\(([\w.]*(?:\(\))?)\)/g)].map((match) => match[1]).sort(), ["ctx.workspaceId", "value", "value.trim()"], "ids, the workspace and whole counts only");
    assert.doesNotMatch(payloads, /parseFloat|toFixed|Math\./);

    // Where amounts are handled, no rounding at all (the paginator's page count in movements.js is not an amount).
    const amountFiles = sources.filter((file) => /src\/mobile\/(money|models|home|accounts)\//.test(rel(file)));
    assert.deepEqual(find(/Math\.(round|floor|trunc)/, amountFiles), []);
  });

  it("touches the service worker and caches in one file only, and never IndexedDB, background sync or a queue", () => {
    // pwa/worker.js registers /m/sw.js in a local/staging PWA build, and removes it in every other build (scripts/mobilePwa.mjs).
    assert.deepEqual(find(/serviceWorker|\bcaches\b|CacheStorage|manifest/i), ["src/mobile/pwa/worker.js"]);
    assert.deepEqual(find(/indexedDB|workbox|BackgroundSync|periodicSync|\bsync\.register/i), []);
  });

  it("writes to browser storage in two places: the presentation word, and Mobile's own per-identity preferences", () => {
    assert.deepEqual(find(/\.setItem\(|\.removeItem\(|document\.cookie|(local|session)Storage\.clear\(/), ["src/mobile/preferences/deviceStore.js", "src/mobile/presentation/preference.js"]);
    const writes = [...code(path.join(MOBILE, "presentation/preference.js")).matchAll(/(setItem|removeItem)\(\s*([A-Za-z_]+)/g)].map((match) => match[2]);
    assert.deepEqual([...new Set(writes)], ["PRESENTATION_KEY"]);
    // The preference record: one setItem, under a key that names the person and the workspace, of a normalized record only.
    const prefs = code(path.join(MOBILE, "preferences/deviceStore.js"));
    assert.deepEqual([...prefs.matchAll(/\.(setItem|removeItem)\(([^,)]*)/g)].map((match) => `${match[1]}(${match[2].trim()}`), ["setItem(key"]);
    assert.match(prefs, /smartspend:mobile:prefs:v1:u:\$\{userId\}:w:\$\{workspaceId\}/);
    assert.match(prefs, /storage\.setItem\(key, JSON\.stringify\(next\)\)/);
    assert.match(prefs, /const next = normalizePreferences\(/);
    assert.doesNotMatch(prefs, /token|ACCESS_TOKEN|apiRequest|response/i);
  });

  it("changes the full app's preference store in one place, and only its hide-amounts choice", () => {
    assert.deepEqual(find(/experienceStore/), ["src/mobile/money/MoneyPrivacy.jsx"]);
    assert.match(code(path.join(MOBILE, "money/MoneyPrivacy.jsx")), /import\s*\{\s*createExperienceStore\s*\}/);
    // The category rename in the write facade is the wrapper's `update`, not the store's.
    assert.deepEqual(find(/\bstore\.update\b|\.update\s*\(/).filter((file) => file !== "src/mobile/data/writeApi.js"), ["src/mobile/money/MoneyPrivacy.jsx"]);
    assert.deepEqual([...code(path.join(MOBILE, "money/MoneyPrivacy.jsx")).matchAll(/store\.update\(([^)]*\)?)\)/g)].map((match) => match[1]), ["{ hiddenMoney: hidden === true }"]);
    assert.doesNotMatch(code(path.join(MOBILE, "data/writeApi.js")), /experience|store\./i);
  });

  it("has no second authentication context or token storage of its own", () => {
    assert.deepEqual(find(/createContext\(/).filter((file) => /auth/i.test(code(path.join(ROOT, file)))), []);
    assert.deepEqual(find(/getAuthToken|Bearer|Authorization|getItem\(\s*["']ACCESS_TOKEN/), [], "Mobile never reads or builds the token itself");
  });
});

describe("the facade", () => {
  it("exports reads only", async () => {
    const readApi = await import("../src/mobile/data/readApi.js");

    assert.deepEqual(Object.keys(readApi).sort(), ["ACTIVITY_PER_PAGE", "BUDGETS_PER_PAGE", "DASHBOARD_PERIOD", "DASHBOARD_PERIODS", "DEBTS_PER_PAGE", "EXPORTS_PER_PAGE", "GOALS_PER_PAGE", "IMPORTS_PER_PAGE", "MOVEMENTS_PER_PAGE", "NOTIFICATIONS_PER_PAGE", "PAYMENTS_PER_PAGE", "RULES_PER_PAGE", "TRANSFERS_PER_PAGE", "isAccountId", "planningWorkspaceId", "readAccount", "readAccountMovements", "readAccounts", "readAlerts", "readBudget", "readBudgets", "readCalendarMonth", "readCategories", "readCategory", "readCategoryList", "readDashboard", "readDebt", "readDebtPayments", "readDebts", "readExportFile", "readExports", "readGoal", "readGoals", "readImport", "readImports", "readNotifications", "readReport", "readRule", "readRules", "readTransaction", "readTransactions", "readTransfer", "readTransfers", "readUnreadCount", "sessionWorkspace"]);
    const plan = await import("../src/mobile/data/readPlanApi.js");
    assert.deepEqual(Object.keys(plan).sort(), ["readConfirmationPreview", "readGoalPlan", "readPlanOptions"]);
    const planUses = [...code(path.join(MOBILE, "data/readPlanApi.js")).matchAll(/savingsPlansApi\.(\w+)\(/g)].map((match) => match[1]).sort();
    assert.deepEqual(planUses, ["getActive", "getConfirmationPreview", "getOptions"], "the plan facade reads only");
    const assist = await import("../src/mobile/data/readAssistApi.js");
    assert.ok(Object.keys(assist).every((name) => /^read[A-Z]|_PER_PAGE$/.test(name)), "the assistant facade exports reads only");
    const write = await import("../src/mobile/data/writeApi.js");
    assert.deepEqual(Object.keys(write).sort(), ["SENDABLE_OPERATIONS", "newWriteKey", "sendCategoryCreate", "sendCategoryUpdate", "sendWorkflowWrite"]);
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
