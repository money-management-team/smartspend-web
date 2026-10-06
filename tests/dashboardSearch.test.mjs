import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server, i18n, buildSearchEntries, searchEntries, normalizeSearchText, PATH;
const DIR = "/src/layouts/DashboardLayout/components/DashboardSearch/";

before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  ({ default: i18n } = await server.ssrLoadModule("/src/i18n.js"));
  ({ buildSearchEntries } = await server.ssrLoadModule(
    `${DIR}buildSearchEntries.js`,
  ));
  ({ searchEntries, normalizeSearchText } = await server.ssrLoadModule(
    `${DIR}searchMatch.js`,
  ));
  ({ PATH } = await server.ssrLoadModule("/src/routes/Path.js"));
});
after(async () => {
  await server?.close();
});

const entriesIn = async (language) => {
  await i18n.changeLanguage(language);
  return buildSearchEntries(i18n, i18n.t.bind(i18n));
};
const paths = (results) => results.map((entry) => entry.path);

test("indexes every page of the sidebar menu", async () => {
  const entries = await entriesIn("en");
  const indexed = paths(entries);
  for (const path of [
    PATH.USER.DASHBOARD,
    PATH.USER.ACCOUNTS,
    PATH.USER.FINANCIAL_OPERATIONS,
    PATH.USER.TRANSFERS,
    PATH.USER.BUDGETS,
    PATH.USER.SAVINGS_GOALS,
    PATH.USER.DEBTS,
    PATH.USER.RECURRING,
    PATH.USER.REPORTS,
    PATH.USER.AI_ASSISTANT,
    PATH.USER.NOTIFICATIONS,
    PATH.USER.SETTING,
  ]) {
    assert.ok(indexed.includes(path), path);
  }
  assert.equal(new Set(indexed).size, indexed.length, "unique paths");
});

test("matches English names, partial words and any letter case", async () => {
  const entries = await entriesIn("en");
  assert.equal(searchEntries(entries, "budg")[0].path, PATH.USER.BUDGETS);
  assert.equal(searchEntries(entries, "ACCOUNTS")[0].path, PATH.USER.ACCOUNTS);
  assert.equal(searchEntries(entries, "profile")[0].path, PATH.USER.SETTING);
  assert.ok(
    paths(searchEntries(entries, "transactions")).includes(
      PATH.USER.FINANCIAL_OPERATIONS,
    ),
  );
});

test("matches Arabic names, and Arabic works while the UI is English", async () => {
  const arabic = await entriesIn("ar");
  assert.equal(searchEntries(arabic, "الحسابات")[0].path, PATH.USER.ACCOUNTS);
  assert.equal(searchEntries(arabic, "ميزاني")[0].path, PATH.USER.BUDGETS);

  const english = await entriesIn("en");
  assert.equal(searchEntries(english, "الحسابات")[0].path, PATH.USER.ACCOUNTS);
  // …and English works while the UI is Arabic.
  assert.equal(searchEntries(arabic, "budgets")[0].path, PATH.USER.BUDGETS);
});

test("normalises Arabic spelling variants", () => {
  assert.equal(normalizeSearchText("إضافة"), normalizeSearchText("اضافه"));
  assert.equal(normalizeSearchText("الميزانيّة"), normalizeSearchText("الميزانيه"));
});

test("returns nothing for an empty or unmatched query", async () => {
  const entries = await entriesIn("en");
  assert.deepEqual(searchEntries(entries, ""), []);
  assert.deepEqual(searchEntries(entries, "   "), []);
  assert.deepEqual(searchEntries(entries, "zzzzqqq"), []);
});

test("every typed word has to match", async () => {
  const entries = await entriesIn("en");
  assert.deepEqual(searchEntries(entries, "budgets zzzz"), []);
});
