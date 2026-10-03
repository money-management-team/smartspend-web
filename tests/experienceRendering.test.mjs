import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server, context, auth, i18n;
const ROOT = "/src/features/Dashboards/User/";
before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  ({ ExperienceContext: context } = await server.ssrLoadModule(
    `${ROOT}Experience/experienceContext.js`,
  ));
  ({ AuthContext: auth } = await server.ssrLoadModule(
    "/src/contexts/auth/authContext.js",
  ));
  await server.ssrLoadModule(`${ROOT}Experience/ExperienceProvider.jsx`);
  ({ default: i18n } = await server.ssrLoadModule("/src/i18n.js"));
});
after(async () => {
  await server?.close();
});
const render = (Component, props, preferences = {}) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        auth.Provider,
        { value: { user: { id: 1 }, workspace: { id: 3, timezone: "UTC" } } },
        createElement(
          context.Provider,
          {
            value: {
              workspaceId: 3,
              preferences: {
                hiddenMoney: false,
                guideDismissed: false,
                savedViews: [],
                templates: [],
                dashboardOrder: ["summary", "goals"],
                hiddenDashboard: [],
                persisted: true,
                ...preferences,
              },
              update: () => {},
            },
          },
          createElement(Component, props),
        ),
      ),
    ),
  );

test("privacy removes displayed money from rendered text and accessibility markup while keeping counts", async () => {
  const { default: Money } = await server.ssrLoadModule(
    `${ROOT}Experience/PrivateMoney.jsx`,
  );
  const visible = render(Money, { children: "₪ 25,500.12" });
  assert.ok(visible.includes("25,500.12"));
  const hidden = render(
    Money,
    { children: "₪ 25,500.12" },
    { hiddenMoney: true },
  );
  assert.ok(!hidden.includes("25,500.12"));
  assert.ok(hidden.includes("aria-label="));
  const { default: Value } = await server.ssrLoadModule(
    `${ROOT}Reports/components/ReportValue/ReportValue.jsx`,
  );
  assert.ok(
    !render(
      Value,
      { value: "12345.5000", type: "money", currency: "ILS" },
      { hiddenMoney: true },
    ).includes("12,345"),
  );
  assert.ok(
    render(Value, { value: 42, type: "count" }, { hiddenMoney: true }).includes(
      "42",
    ),
  );
});
test("dashboard ordering hiding and the all-hidden recovery render from actual preferences", async () => {
  const { default: Dashboard } = await server.ssrLoadModule(
    `${ROOT}Experience/DashboardExperience.jsx`,
  );
  const blocks = {
    summary: createElement("p", null, "Summary block"),
    goals: createElement("p", null, "Goals block"),
  };
  const ordered = render(
    Dashboard,
    { blocks },
    { dashboardOrder: ["goals", "summary"] },
  );
  assert.ok(ordered.indexOf("Goals block") < ordered.indexOf("Summary block"));
  assert.ok(
    !render(Dashboard, { blocks }, { hiddenDashboard: ["goals"] }).includes(
      "Goals block",
    ),
  );
  assert.ok(
    render(
      Dashboard,
      { blocks },
      { hiddenDashboard: ["summary", "goals"] },
    ).includes("Restore defaults"),
  );
});
test("new pages render translated Arabic and English UI with distinct accessible headings", async () => {
  for (const language of ["en", "ar"]) {
    await i18n.changeLanguage(language);
    for (const [file, title] of [
      ["AttentionCenter", "attention"],
      ["MonthlyReview", "monthly"],
      ["QuickTemplates", "templates"],
      ["GettingStarted", "guide"],
    ]) {
      const { default: Component } = await server.ssrLoadModule(
        `${ROOT}Experience/${file}.jsx`,
      );
      const output = render(Component, {});
      assert.ok(
        output.includes(i18n.t(title, { ns: "experience" })),
        `${language} ${file}`,
      );
      assert.ok(output.includes("<h1>"));
      assert.ok(!output.includes("experience:"));
    }
  }
});
test("saved views stay page-specific and render escaped names without HTML execution", async () => {
  await i18n.changeLanguage("en");
  const { default: Views } = await server.ssrLoadModule(
    `${ROOT}Experience/SavedViews.jsx`,
  );
  const output = render(
    Views,
    { scope: "reports", filters: {}, onApply: () => {} },
    {
      savedViews: [
        {
          id: "view_1234",
          scope: "reports",
          name: "<img onerror=alert(1)>",
          filters: {},
        },
        {
          id: "view_5678",
          scope: "transactions",
          name: "Other scope",
          filters: {},
        },
      ],
    },
  );
  assert.ok(output.includes("&lt;img"));
  assert.ok(!output.includes("<img onerror"));
  assert.ok(!output.includes("Other scope"));
});
test("new routes are registered inside the existing authenticated layout", async () => {
  const module = await server.ssrLoadModule("/src/routes/Routes.jsx");
  const { PATH } = await server.ssrLoadModule("/src/routes/Path.js");
  const groups = Object.values(module).flatMap((value) =>
    Array.isArray(value) ? value : [],
  );
  const children = groups.flatMap((route) => route.children ?? []);
  for (const key of [
    "ATTENTION",
    "MONTHLY_REVIEW",
    "QUICK_TEMPLATES",
    "GETTING_STARTED",
  ])
    assert.ok(
      children.some((route) => route.path === PATH.USER[key]),
      key,
    );
});

test("account privacy hides money while retaining account navigation and identity", async () => {
  await i18n.changeLanguage("en");
  const { default: Card } = await server.ssrLoadModule(
    `${ROOT}Accounts/components/AccountCard/AccountCard.jsx`,
  );
  const account = {
    id: 10,
    workspace_id: 3,
    name: "Main wallet",
    type: "cash",
    status: "active",
    currency_code: "ILS",
    current_balance: "12345.5000",
  };
  const visible = render(Card, { account });
  assert.ok(visible.includes("12,345"));
  const hidden = render(Card, { account }, { hiddenMoney: true });
  assert.ok(!hidden.includes("12,345"));
  assert.ok(hidden.includes("Main wallet"));
  assert.ok(hidden.includes("/dashboard/accounts/10"));
});
