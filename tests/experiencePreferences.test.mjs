import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createExperienceStore,
  preferenceKey,
  normalizePreferences,
  normalizeTemplate,
  templateIsEligible,
  sanitizeFilters,
  manualTemplateForm,
  DASHBOARD_BLOCKS,
} from "../src/features/Dashboards/User/Experience/experienceStore.js";
import { experienceMessages } from "../src/features/Dashboards/User/Experience/experienceMessages.js";

const storage = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};
const template = (extra = {}) => ({
  id: "template_123",
  name: "Coffee",
  type: "expense",
  account_id: "10",
  workspace_id: "3",
  category_id: "4",
  currency_code: "ILS",
  amount: "25.5001",
  description: "قهوة",
  ...extra,
});
const accounts = [
  { id: 10, workspace_id: 3, status: "active", currency_code: "ILS" },
];
const categories = [
  { id: 4, workspace_id: 3, type: "expense", is_active: true },
];

test("device preferences and templates are isolated by authenticated user and workspace", () => {
  const disk = storage(),
    first = createExperienceStore({ userId: 1, workspaceId: 3, storage: disk });
  first.update({ hiddenMoney: true, templates: [template()] });
  assert.equal(
    createExperienceStore({
      userId: 1,
      workspaceId: 3,
      storage: disk,
    }).getSnapshot().hiddenMoney,
    true,
  );
  for (const [userId, workspaceId] of [
    [2, 3],
    [1, 4],
  ]) {
    const other = createExperienceStore({
      userId,
      workspaceId,
      storage: disk,
    }).getSnapshot();
    assert.equal(other.hiddenMoney, false);
    assert.deepEqual(other.templates, []);
  }
});
test("unknown ownership cannot create a global device preference key", () => {
  for (const value of [
    null,
    0,
    "../3",
    "3&user_id=2",
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(preferenceKey(value, 3), null);
  const disk = storage(),
    store = createExperienceStore({ userId: 1, storage: disk });
  store.update({ hiddenMoney: true });
  assert.equal(store.getSnapshot().persisted, false);
});
test("corrupt null arrays and unsupported preference versions recover to complete defaults", () => {
  const disk = storage(),
    key = preferenceKey(1, 3);
  for (const value of [
    "{bad",
    "null",
    "[]",
    '{"version":9,"hiddenMoney":true}',
  ]) {
    disk.setItem(key, value);
    const store = createExperienceStore({
      userId: 1,
      workspaceId: 3,
      storage: disk,
    });
    assert.equal(store.getSnapshot().hiddenMoney, false);
    assert.deepEqual(store.getSnapshot().dashboardOrder, DASHBOARD_BLOCKS);
  }
});
test("a denied device write preserves usable session preferences without claiming persistence", () => {
  const store = createExperienceStore({
    userId: 1,
    workspaceId: 3,
    storage: {
      getItem: () => null,
      setItem: () => {
        throw new Error("Denied");
      },
    },
  });
  store.update({ hiddenMoney: true });
  store.update({ guideDismissed: true });
  assert.equal(store.getSnapshot().hiddenMoney, true);
  assert.equal(store.getSnapshot().guideDismissed, true);
  assert.equal(store.getSnapshot().persisted, false);
});
test("two tabs merge their latest changes rather than clobber unrelated preferences", () => {
  const disk = storage(),
    one = createExperienceStore({ userId: 1, workspaceId: 3, storage: disk }),
    two = createExperienceStore({ userId: 1, workspaceId: 3, storage: disk });
  one.update({ hiddenMoney: true });
  two.update((state) => ({ ...state, templates: [template()] }));
  one.update({ guideDismissed: true });
  assert.equal(one.getSnapshot().hiddenMoney, true);
  assert.equal(one.getSnapshot().templates.length, 1);
});
test("storage events update the matching scope and dispose their subscription", () => {
  let handler,
    removed = false;
  const disk = storage(),
    store = createExperienceStore({
      userId: 1,
      workspaceId: 3,
      storage: disk,
      eventTarget: {
        addEventListener: (type, fn) => {
          handler = fn;
        },
        removeEventListener: (type, fn) => {
          removed = fn === handler;
        },
      },
    });
  let published = 0;
  const unsubscribe = store.subscribe(() => published++),
    disconnect = store.connect();
  disk.setItem(
    preferenceKey(1, 3),
    JSON.stringify({ version: 1, hiddenMoney: true }),
  );
  handler({ key: preferenceKey(2, 3) });
  assert.equal(published, 0);
  handler({ key: preferenceKey(1, 3) });
  assert.equal(store.getSnapshot().hiddenMoney, true);
  assert.equal(published, 1);
  disconnect();
  unsubscribe();
  assert.equal(removed, true);
});
test("dashboard customization removes duplicates and unknown ids while restoring newly introduced sections", () => {
  const state = normalizePreferences({
    dashboardOrder: ["goals", "goals", "delete-account"],
    hiddenDashboard: ["summary", "summary", "admin"],
  });
  assert.equal(state.dashboardOrder[0], "goals");
  assert.equal(state.dashboardOrder.length, DASHBOARD_BLOCKS.length);
  assert.deepEqual(state.hiddenDashboard, ["summary"]);
});
test("saved views retain real page filters but strip write intents and ownership parameters", () => {
  const value = sanitizeFilters(
    "transactions",
    new URLSearchParams({
      sort: "amount:asc",
      account_id: "10",
      date_from: "2026-10-01",
      new: "expense",
      template: "secret",
      user_id: "9",
      workspace_id: "4",
      page: "3",
    }),
  );
  assert.deepEqual(value, {
    account_id: "10",
    date_from: "2026-10-01",
    sort: "amount:asc",
  });
  assert.deepEqual(
    sanitizeFilters("account:10", {
      account_id: "9",
      category_id: "4",
      sort: "occurred_at:asc",
      per_page: "50",
    }),
    { sort: "occurred_at:asc", per_page: "50" },
  );
});
test("saved filters names scopes control characters and size are bounded", () => {
  const state = normalizePreferences({
    savedViews: [
      {
        id: "view_1234",
        scope: "reports",
        name: "  My report  ",
        filters: { from: "2026-10-01", user_id: "4", to: "a\nsecret" },
      },
      { id: "view_5678", scope: "admin", name: "Invalid" },
    ],
  });
  assert.equal(state.savedViews.length, 1);
  assert.equal(state.savedViews[0].name, "My report");
  assert.deepEqual(state.savedViews[0].filters, { from: "2026-10-01" });
});
test("template money remains exact and optional amounts remain empty", () => {
  assert.equal(normalizeTemplate(template()).amount, "25.5001");
  assert.equal(normalizeTemplate(template({ amount: "" })).amount, "");
  for (const amount of ["0", "-5", "1e3", "12.00001", "NaN", "1;delete"])
    assert.equal(normalizeTemplate(template({ amount })), null);
});
test("template payload cannot retain dates references ownership changes or automatic posting flags", () => {
  const value = normalizeTemplate(
    template({
      occurred_at: "yesterday",
      reference_number: "duplicate",
      user_id: 2,
      confirmed: true,
    }),
  );
  assert.equal(value.occurred_at, undefined);
  assert.equal(value.reference_number, undefined);
  assert.equal(value.user_id, undefined);
  assert.equal(value.confirmed, undefined);
});
test("archived foreign savings goal and changed-currency accounts cannot apply a template", () => {
  assert.equal(templateIsEligible(template(), accounts, categories, 3), true);
  for (const extra of [
    { status: "archived" },
    { workspace_id: 4 },
    { savings_goal: { id: 8 } },
    { currency_code: "USD" },
  ])
    assert.equal(
      templateIsEligible(
        template(),
        [{ ...accounts[0], ...extra }],
        categories,
        3,
      ),
      false,
    );
  assert.equal(templateIsEligible(template(), accounts, categories, 4), false);
});
test("template categories require matching type activity and workspace while global categories remain valid", () => {
  for (const extra of [
    { type: "income" },
    { is_active: false },
    { workspace_id: 4 },
  ])
    assert.equal(
      templateIsEligible(
        template(),
        accounts,
        [{ ...categories[0], ...extra }],
        3,
      ),
      false,
    );
  assert.equal(
    templateIsEligible(
      template(),
      accounts,
      [{ ...categories[0], workspace_id: null }],
      3,
    ),
    true,
  );
  assert.equal(
    templateIsEligible(
      template({ category_id: "", type: "income" }),
      accounts,
      [],
      3,
    ),
    true,
  );
});
test("template and view caps prevent unbounded persisted preferences", () => {
  const state = normalizePreferences({
    templates: Array.from({ length: 40 }, (_, index) =>
      template({ id: `template_${index}` }),
    ),
    savedViews: Array.from({ length: 40 }, (_, index) => ({
      id: `saved_view_${index}`,
      scope: "reports",
      name: "Report",
      filters: {},
    })),
  });
  assert.equal(state.templates.length, 20);
  assert.equal(state.savedViews.length, 30);
});
test("Arabic and English additions expose the same translation keys", () => {
  const keys = (obj, prefix = "") =>
    Object.entries(obj)
      .flatMap(([key, value]) =>
        typeof value === "object"
          ? keys(value, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      )
      .sort();
  assert.deepEqual(keys(experienceMessages.ar), keys(experienceMessages.en));
});

test("applying a template preserves exact money but uses a new date and clears financial references", () => {
  const form = manualTemplateForm(
    template({ date: "2025-01-01", reference_number: "old-reference" }),
    "2026-10-03",
  );
  assert.deepEqual(form, {
    amount: "25.5001",
    category_id: "4",
    note: "قهوة",
    reference_number: "",
    date: "2026-10-03",
  });
  assert.equal(
    manualTemplateForm(template({ amount: "" }), "2026-10-03").amount,
    "",
  );
  assert.throws(() =>
    manualTemplateForm(template({ amount: "-1" }), "2026-10-03"),
  );
});
