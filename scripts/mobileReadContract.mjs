/*
 * Read-only contract check for the Mobile screens, against an APPROVED, ISOLATED
 * backend with a FICTIONAL account. It sends GET requests only (there is no code
 * here that can send anything else) and validates each answer with the same
 * models the Mobile screens use, so a field the screens rely on that the backend
 * does not send shows up as a failure here.
 *
 *   SMARTSPEND_CONTRACT_BASE   e.g. https://staging-api.example.test/api (required)
 *   SMARTSPEND_CONTRACT_TOKEN  a bearer token of a fictional test user (required)
 *   SMARTSPEND_CONTRACT_OK     must be exactly "isolated-fictional-data": the
 *                              operator's statement that the target holds no real data
 *
 *   node scripts/mobileReadContract.mjs
 *
 * It is not part of `npm test` and has never been run against a real backend
 * (none was available); see docs/mobile/BACKEND-CONTRACT-GAPS.md.
 */
import { buildCalendarMonth } from "../src/mobile/models/calendar.js";
import { buildDebtsPage } from "../src/mobile/models/debts.js";
import { buildExportsPage, buildImportsPage } from "../src/mobile/models/exportsImports.js";
import { buildNotificationsPage } from "../src/mobile/models/notifications.js";
import { REPORT_TYPES, buildReport } from "../src/mobile/models/reports.js";
import { buildTransfersPage } from "../src/mobile/models/transfers.js";

const base = process.env.SMARTSPEND_CONTRACT_BASE ?? "";
const token = process.env.SMARTSPEND_CONTRACT_TOKEN ?? "";

if (process.env.SMARTSPEND_CONTRACT_OK !== "isolated-fictional-data" || !base || !token) {
  console.error("Refusing to run: set SMARTSPEND_CONTRACT_BASE, SMARTSPEND_CONTRACT_TOKEN and SMARTSPEND_CONTRACT_OK=isolated-fictional-data.");
  process.exit(2);
}
if (!/^https:\/\//.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(base)) {
  console.error("Refusing to run: the target must be https, or a local server.");
  process.exit(2);
}

async function get(path, query = {}) {
  const url = new URL(base.replace(/\/$/, "") + path);
  for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const today = new Date();
const month = today.getMonth() + 1;
const year = today.getFullYear();
const from = `${year}-${String(month).padStart(2, "0")}-01`;
const to = today.toISOString().slice(0, 10);

const checks = [
  ["GET /debts", () => get("/debts", { per_page: 20, page: 1 }), (r) => buildDebtsPage(r.body, { page: 1, perPage: 20 })],
  ["GET /transfers", () => get("/transfers", { per_page: 20, page: 1 }), (r) => buildTransfersPage(r.body, { page: 1, perPage: 20 })],
  ["GET /notifications", () => get("/notifications", { per_page: 20, page: 1 }), (r) => buildNotificationsPage(r.body, { page: 1, perPage: 20 })],
  ["GET /calendar", () => get("/calendar", { month, year, view: "month" }), (r) => buildCalendarMonth(r.body?.data, { year, month })],
  ["GET /report-exports", () => get("/report-exports", { per_page: 20, page: 1 }), (r) => buildExportsPage(r.body, { page: 1, perPage: 20 })],
  ["GET /imports", () => get("/imports", { per_page: 20, page: 1 }), (r) => buildImportsPage(r.body, { page: 1, perPage: 20 })],
  ...REPORT_TYPES.map((type) => [`GET /reports/${type}`, () => get(`/reports/${type}`, { from, to }), (r) => buildReport(r.body?.data, type)]),
];

let failed = 0;
for (const [name, request, validate] of checks) {
  try {
    const answer = await request();
    if (answer.status !== 200) throw new Error(`HTTP ${answer.status}`);
    validate(answer);
    console.log(`ok    ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${name}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
