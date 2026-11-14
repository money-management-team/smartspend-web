import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { MemoryRouter } from "react-router-dom";

import { flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());

const { default: FinancialAlerts } = await import("../src/features/Dashboards/User/Dashboard/components/FinancialAlerts/FinancialAlerts.jsx");

/*
 * GET /financial-alerts takes `workspace_id` (FinancialAlertController, fix/financial-idempotency-p0
 * @ 6b696d72). The card used to send `id_workspace`, which the backend ignores, so it showed the alerts
 * of every workspace the user manages instead of the session's.
 */

const BODY = envelope({ generated_at: "2026-11-14T00:00:00Z", alerts: [], summary: { active_budgets: 0 } });
let calls;
let i18n;

beforeEach(async () => {
  installBrowserStubs();
  calls = mockFetch(() => ({ body: BODY }));
  i18n = await createI18n("en");
});

async function mount(props) {
  const view = await render(withI18n(i18n, h(MemoryRouter, null, h(FinancialAlerts, props))));
  await flush();
  return view;
}

const alertCalls = () => calls.filter((call) => new URL(call.url, "http://localhost").pathname.endsWith("/financial-alerts"));
const queryOf = (call) => Object.fromEntries(new URL(call.url, "http://localhost").searchParams);

describe("the dashboard alerts card", () => {
  it("sends the session workspace as workspace_id, never id_workspace", async () => {
    const view = await mount({ workspaceId: 7 });
    assert.equal(alertCalls().length, 1);
    assert.deepEqual(queryOf(alertCalls()[0]), { workspace_id: "7" });
    assert.equal(alertCalls()[0].method, "GET");
    await view.unmount();
  });

  it("sends no workspace filter when the workspace is unknown, and refetches under the new id when it changes", async () => {
    const view = await mount({ workspaceId: null });
    assert.deepEqual(queryOf(alertCalls()[0]), {});
    await view.rerender(withI18n(i18n, h(MemoryRouter, null, h(FinancialAlerts, { workspaceId: 9, variant: "full" }))));
    await flush();
    assert.deepEqual(queryOf(alertCalls().at(-1)), { workspace_id: "9" });
    assert.ok(alertCalls().every((call) => !("id_workspace" in queryOf(call))));
    await view.unmount();
  });

  it("makes no request but the one read: no write, no body", async () => {
    const view = await mount({ workspaceId: 7 });
    assert.ok(calls.every((call) => call.method === "GET" && call.rawBody === undefined));
    await view.unmount();
  });
});

describe("no caller sends id_workspace to /financial-alerts", () => {
  it("neither the Desktop card nor Mobile's read does", () => {
    const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const file of ["src/features/Dashboards/User/Dashboard/components/FinancialAlerts/FinancialAlerts.jsx", "src/features/Dashboards/User/api/financialAlertsApi.js"]) {
      assert.doesNotMatch(read(file), /id_workspace/, file);
    }
    assert.match(read("src/mobile/data/readApi.js"), /readAlerts = \(signal\) => financialAlertsApi\.list\(\{ workspace_id: workspaceId\(\) \}/);
  });
});
