import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createElement as h } from "react";
import { flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, locales, withI18n } from "./helpers/i18n.mjs";

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: GoalProgress } = await import("../src/features/Dashboards/User/SavingsGoals/components/GoalProgress/GoalProgress.jsx");
const { default: FundingStep } = await import("../src/features/Dashboards/User/SmartPlanWizard/components/FundingStep/FundingStep.jsx");
const { ExperienceContext } = await import("../src/features/Dashboards/User/Experience/experienceContext.js");

/* The arc of the ring, as its sector path. */
async function ringPath(percentage) {
  const view = await render(h(GoalProgress, { percentage, valueText: `${percentage}%`, label: "Progress", status: "in_progress" }));
  for (let i = 0; i < 5; i += 1) await flush();
  const path = view.container.querySelector(".recharts-radial-bar-sectors path");
  const d = path?.getAttribute("d") ?? null;
  await view.unmount();
  return d;
}

describe("goal progress ring (F6.2)", () => {
  it("draws the arc on a fixed 0–100 scale, so a partly funded goal is not a full ring", async () => {
    const partial = await ringPath("11.1300");
    const full = await ringPath("100.0000");

    assert.ok(partial && full, "the ring renders its sector");
    assert.notEqual(partial, full, "11 % and 100 % are different arcs");
  });
});

describe("smart plan review labels (F6.2)", () => {
  it("names the last installment's date apart from its amount, in both languages", () => {
    for (const [language, messages] of Object.entries(locales)) {
      const wizard = messages.dashboard.savingsGoals.smartPlanWizard;
      assert.notEqual(wizard.review.lastInstallment, wizard.plan.finalInstallment, `${language}: two different review facts`);
    }
  });
});

describe("funding step balances (F6.2.1)", () => {
  const list = [
    { id: 5, name: "Main checking", type: "bank", currency_code: "ILS", current_balance: "12500.0000" },
    { id: 6, name: "Cash wallet", type: "cash", currency_code: "ILS", current_balance: "0.0000" },
  ];
  const renderStep = async (funding, { hiddenMoney = false } = {}) => {
    const i18n = await createI18n("en");
    return render(
      h(ExperienceContext.Provider, { value: { preferences: { hiddenMoney } } },
        withI18n(i18n, h(FundingStep, { funding, accounts: { loading: false, error: null, list }, currency: "ILS", error: null, onChange: () => {}, onRetry: () => {} })),
      ),
    );
  };

  it("shows each account's available balance as a guide", async () => {
    const view = await renderStep({ mode: "single", sources: [] });
    const balances = [...view.container.querySelectorAll(".funding-step__account-balance")].map((node) => node.textContent);
    assert.deepEqual(balances, ["Available ₪12,500.00", "Available ₪0.00"]);
    assert.match(view.container.textContent, /Balances are a guide/);
    await view.unmount();
  });

  it("lists balances in the add-account choice, and hides them in privacy mode", async () => {
    let view = await renderStep({ mode: "priority", sources: [] });
    assert.deepEqual([...view.container.querySelectorAll("select option")].slice(1).map((option) => option.textContent), ["Main checking · ₪12,500.00", "Cash wallet · ₪0.00"]);
    await view.unmount();

    view = await renderStep({ mode: "priority", sources: [] }, { hiddenMoney: true });
    assert.deepEqual([...view.container.querySelectorAll("select option")].slice(1).map((option) => option.textContent), ["Main checking · ••••", "Cash wallet · ••••"]);
    await view.unmount();
  });

  it("no longer says split installments can't be confirmed", async () => {
    const view = await renderStep({ mode: "allocated", sources: [] });
    assert.doesNotMatch(view.container.textContent, /can't be confirmed in the app yet/);
    assert.match(view.container.textContent, /you see exactly how much comes from each account/);
    await view.unmount();
  });
});

describe("review affordability wording (F6.2.1)", () => {
  it("doesn't repeat the word under its own label", () => {
    for (const [language, messages] of Object.entries(locales)) {
      const wizard = messages.dashboard.savingsGoals.smartPlanWizard;
      assert.ok(!wizard.review.affordabilityUnknown.includes(wizard.review.affordability), `${language}: "${wizard.review.affordabilityUnknown}"`);
    }
  });
});
