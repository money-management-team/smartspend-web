import { useId, useState } from "react";
import { ArrowLeft, ArrowRight, Car, House, LayoutDashboard, Plus, Repeat, ShoppingBasket, Target, TrendingUp, Wallet } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { DEMO, WEEKLY_SPENDING, demoTotals, ltr, money, monthAfter, monthsToGoal, percent } from "../landingDemo";
import { onTabKey } from "../landingUi";
import { Bezel, Brand, Progress, SampleBadge, SectionIntro } from "./Shared";

const categoryIcons = {
  food: ShoppingBasket,
  transport: Car,
  subscriptions: Repeat,
  bills: House,
};

/** "$12,450" with a quieter currency sign. textContent stays "$12,450". */
function Amount({ value, id, className, sign = "" }) {
  return <strong className={`num ${className ?? ""}`} dir="ltr" id={id}>{sign}<span className="num-currency">$</span>{money(value)}</strong>;
}

function GoalRing({ value, size = 132 }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const gradient = `ring${useId().replace(/[^\w-]/g, "")}`;
  return <svg className="goal-ring" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--brand-blue)" /><stop offset="1" stopColor="var(--brand-cyan)" /></linearGradient></defs>
    <circle cx="50" cy="50" r={radius} className="goal-ring-track" />
    <circle cx="50" cy="50" r={radius} className="goal-ring-value" stroke={`url(#${gradient})`} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
  </svg>;
}

function SpendingChart({ added }) {
  const { t } = useLanding();
  const values = WEEKLY_SPENDING.map((value, index) => (index === WEEKLY_SPENDING.length - 1 ? value + added : value));
  const max = Math.max(...values, 1400);
  return <div className="chart" role="img" aria-label={t("demo.chart.label", { values: values.map(money).join(", ") })}>
    <div className="chart-plot" aria-hidden="true" dir="ltr">
      <div className="chart-grid"><i /><i /><i /><i /></div>
      {values.map((value, index) => <div className={`chart-col${index === 3 ? " is-current" : ""}`} key={index}>
        <span className="chart-value num" style={{ bottom: `calc(${value / max * 100}% + 8px)` }}>${money(value)}</span>
        <span className="chart-bar" style={{ transform: `scaleY(${Math.max(0.02, value / max)})` }} />
      </div>)}
    </div>
    <div className="chart-labels" aria-hidden="true" dir="ltr">{values.map((_, index) => <span key={index}>{t("demo.chart.week", { number: index + 1 })}</span>)}</div>
  </div>;
}

function Overview({ totals, entries, onGoals }) {
  const { t, lang } = useLanding();
  const used = percent(totals.expenses, DEMO.budget);
  const goal = percent(DEMO.goalSaved, DEMO.goalTarget);
  const recent = [
    ...entries.slice().reverse().map((entry) => ({ id: `new-${entry.id}`, name: entry.description, category: entry.category, amount: entry.amount, fresh: true })),
    { id: "grocery", name: t("demo.overview.items.grocery"), category: "food", amount: 85, fresh: false },
    { id: "transport", name: t("demo.overview.items.transport"), category: "transport", amount: 25, fresh: false },
    { id: "subscription", name: t("demo.overview.items.subscription"), category: "subscriptions", amount: 12, fresh: false },
  ].slice(0, 3);
  return <div className="ov">
    <article className="tile ov-balance">
      <div className="tile-label"><Wallet size={16} />{t("demo.overview.balance")}</div>
      <Amount value={totals.balance} id="demo-balance" className="num-hero num-tick" key={`balance-${totals.balance}`} />
      <p className="tile-note">{t("demo.overview.balanceNote")}</p>
      <div className="ov-flow">
        <div><span>{t("demo.overview.income")}</span><Amount value={totals.income} /></div>
        <div><span>{t("demo.overview.spent")}</span><Amount value={totals.expenses} id="demo-expenses" className="num-tick" key={`spent-${totals.expenses}`} /></div>
      </div>
      <div className="ov-budget">
        <div><span>{t("demo.overview.ofBudget")}</span><span className="num" dir="ltr">{used}% · ${money(DEMO.budget)}</span></div>
        <Progress value={used} tone={used > 100 ? "warn" : "brand"} label={t("demo.budgetUsed")} />
      </div>
    </article>

    <article className="tile ov-chart">
      <div className="tile-head"><h3>{t("demo.overview.rhythm")}</h3><span>{t("demo.overview.rhythmPeriod")}</span></div>
      <SpendingChart added={totals.expenses - DEMO.initialExpenses} />
    </article>

    <article className="tile ov-goal">
      <div className="tile-head"><h3>{t("demo.overview.nextGoal")}</h3></div>
      <div className="ov-goal-body">
        <div className="ring-wrap"><GoalRing value={goal} size={112} /><span className="ring-label num" dir="ltr">{goal}%</span></div>
        <div>
          <strong className="ov-goal-name">{t("demo.goals.name")}</strong>
          <span className="ov-goal-amount num" dir="ltr">${money(DEMO.goalSaved)} <span>/ ${money(DEMO.goalTarget)}</span></span>
        </div>
      </div>
      <button className="text-link" onClick={onGoals}>{t("demo.overview.tryPlan")}{lang === "ar" ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</button>
    </article>

    <article className="tile ov-recent">
      <div className="tile-head"><h3>{t("demo.overview.recent")}</h3><span>{t("personalAccountUsd")}</span></div>
      <ul className="transaction-list">{recent.map((item) => {
        const Icon = categoryIcons[item.category];
        return <li className={`transaction${item.fresh ? " is-fresh" : ""}`} key={item.id}>
          <span className="tx-icon"><Icon size={17} /></span>
          <span className="tx-text"><strong>{item.name}</strong><small>{t(`categories.${item.category}`)} · {t("demo.overview.today")}</small></span>
          <Amount value={item.amount} sign="−" className="tx-amount" />
        </li>;
      })}</ul>
    </article>
  </div>;
}

function Budgets({ totals }) {
  const { t, lang } = useLanding();
  const fig = (value) => (lang === "ar" ? ltr(value) : value);
  const used = percent(totals.expenses, DEMO.budget);
  const over = totals.expenses > DEMO.budget;
  return <div className="bud">
    <article className="tile bud-summary budget-summary">
      <div className="tile-label">{t("demo.budgets.used")}</div>
      <strong className="num num-hero" dir="ltr">${money(totals.expenses)}<span className="num-of"> / ${money(DEMO.budget)}</span></strong>
      <Progress value={used} tone={over ? "warn" : "brand"} label={t("demo.budgetUsed")} />
      <p className="bud-remaining">{over ? t("demo.budgets.over") : t("demo.budgets.left")} <bdi className="num">${money(Math.abs(DEMO.budget - totals.expenses))}</bdi></p>
    </article>
    <ul className="bud-list">{totals.budgets.map((budget) => {
      const Icon = categoryIcons[budget.category];
      const share = percent(budget.spent, budget.limit);
      const isOver = budget.spent > budget.limit;
      return <li className="bud-row" key={budget.category}>
        <span className="tx-icon"><Icon size={17} /></span>
        <div className="bud-row-main">
          <div className="bud-row-top"><strong>{t(`categories.${budget.category}`)}</strong><span className="num" dir="ltr">${money(budget.spent)} <span>/ ${money(budget.limit)}</span></span></div>
          <Progress value={share} tone={isOver ? "warn" : "brand"} />
          <small className={isOver ? "is-warn" : undefined}>{isOver ? t("demo.budgets.rowOver") : t("demo.budgets.rowUsed", { share: fig(`${share}%`) })}</small>
        </div>
      </li>;
    })}</ul>
  </div>;
}

function Goals() {
  const { t, lang } = useLanding();
  const [monthly, setMonthly] = useState(400);
  const remaining = DEMO.goalTarget - DEMO.goalSaved;
  const months = monthsToGoal(monthly);
  const goal = percent(DEMO.goalSaved, DEMO.goalTarget);
  return <div className="goals">
    <article className="tile goal-card">
      <SampleBadge>{t("demo.goals.badge")}</SampleBadge>
      <div className="ring-wrap ring-wrap-lg"><GoalRing value={goal} size={168} /><span className="ring-label num" dir="ltr">{goal}%</span></div>
      <h3>{t("demo.goals.name")}</h3>
      <p>{t("demo.goals.text")}</p>
      <span className="goal-card-amount num" dir="ltr">${money(DEMO.goalSaved)} <span>/ ${money(DEMO.goalTarget)}</span></span>
    </article>
    <article className="tile goal-calc">
      <div className="tile-label">{t("demo.goals.tryPlan")}</div>
      <h3>{t("demo.goals.question")}</h3>
      <label htmlFor="monthly-saving">{t("demo.goals.monthly")}</label>
      <output htmlFor="monthly-saving" className="num" dir="ltr">${money(monthly)}</output>
      <input id="monthly-saving" dir="ltr" type="range" min="100" max="1200" step="50" value={monthly} onChange={(event) => setMonthly(Number(event.target.value))}
        style={{ "--fill": `${(monthly - 100) / 1100 * 100}%` }} aria-valuetext={`$${money(monthly)}`} />
      <div className="range-ends num" dir="ltr"><span>$100</span><span>$1,200</span></div>
      <div className="goal-forecast" aria-live="polite">
        <span className="forecast-icon"><TrendingUp size={18} /></span>
        <p>{t("demo.goals.reach")} <strong>{t("demo.goals.reachValue", { months: t("demo.goals.months", { count: months }) })}</strong>
          <small>{t("demo.goals.by")} {monthAfter(months, lang)} · {t("demo.goals.remaining")} <bdi className="num">${money(remaining)}</bdi></small></p>
      </div>
      <p className="fine-print">{t("demo.goals.fine")}</p>
    </article>
  </div>;
}

const TABS = [
  { id: "overview", Icon: LayoutDashboard },
  { id: "budgets", Icon: Wallet },
  { id: "goals", Icon: Target },
];

export default function ProductDemo({ entries, onExpense }) {
  const { t, lang } = useLanding();
  const [view, setView] = useState("overview");
  const totals = demoTotals(entries);
  const keyboard = (event, index) =>
    onTabKey(event, TABS.map((tab) => tab.id), index, lang === "ar", setView, "demo-tab-");
  const active = TABS.findIndex((tab) => tab.id === view);

  return <section id={HOME_SECTIONS.EXPERIENCE} className="section section-demo" aria-labelledby="experience-title">
    <div className="container">
      <SectionIntro id="experience-title"
        eyebrow={t("demo.eyebrow")}
        title={t("demo.title")}
        accent={t("demo.accent")}
        description={t("demo.description")} />

      <div className="demo-stage">
      <Bezel className="demo" data-reveal>
        <div className="demo-top">
          <Brand size="sm" />
          <span className="demo-period">{t("demo.period")}</span>
          <SampleBadge>{t("demo.sample")}</SampleBadge>
        </div>
        <div className="demo-bar">
          <div className="segmented" role="tablist" aria-label={t("demo.sections")} style={{ "--active": active, "--count": TABS.length }}>
            <span className="segmented-thumb" aria-hidden="true" />
            {TABS.map(({ id, Icon }, index) => <button key={id} id={`demo-tab-${id}`} role="tab" aria-selected={view === id} aria-controls={`demo-panel-${id}`}
              tabIndex={view === id ? 0 : -1} onClick={() => setView(id)} onKeyDown={(event) => keyboard(event, index)}>
              <Icon size={16} /><span>{t(`demo.tabs.${id}`)}</span>
            </button>)}
          </div>
          <button className="btn btn-primary btn-sm demo-add" onClick={onExpense}><Plus size={16} />{t("demo.addExpense")}</button>
        </div>

        <div id={`demo-panel-${view}`} role="tabpanel" aria-labelledby={`demo-tab-${view}`} tabIndex={0} className="demo-panel" key={view}>
          {view === "overview" && <Overview totals={totals} entries={entries} onGoals={() => setView("goals")} />}
          {view === "budgets" && <Budgets totals={totals} />}
          {view === "goals" && <Goals />}
        </div>
        <p className="demo-foot">{t("demo.foot")}</p>
      </Bezel>
      </div>
    </div>
  </section>;
}
