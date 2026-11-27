import { useMemo, useState } from "react";
import { LuArrowLeftRight, LuChartColumn, LuChartPie, LuHandCoins, LuLayoutDashboard, LuRepeat, LuTags, LuTarget, LuTrendingUp, LuWallet } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { keys, reportLoader } from "../data/loaders.js";
import { sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDayMonth } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildAnalytics, buildBudgetPerformance, defaultGroup, hasActivity, presetRange, readHubRange } from "../models/analytics.js";
import { REPORT_GROUPS, REPORT_TYPES, reportQuery } from "../models/reports.js";
import { MOBILE_EXPORTS, budgetDetailPath, reportPath } from "../navigation.js";
import PlanChip from "../planning/PlanChip.jsx";
import Progress from "../planning/Progress.jsx";
import { toneOf } from "../planning/tones.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import AnalyticsPeriod from "./AnalyticsPeriod.jsx";
import IncomeExpenseChart from "./IncomeExpenseChart.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const REPORT_ICONS = { overview: LuLayoutDashboard, "income-expense": LuChartColumn, "cash-flow": LuTrendingUp, accounts: LuWallet, categories: LuTags, transfers: LuArrowLeftRight, budgets: LuChartPie, "savings-goals": LuTarget, debts: LuHandCoins, recurring: LuRepeat };
const LRI = "⁦";
const PDI = "⁩";

// A percentage as text, isolated so its digits keep their order inside Arabic text.
const isolated = (text) => `${LRI}${text}%${PDI}`;

function ChangeChip({ change }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  if (!change) return null;
  const sign = change.negative || change.zero ? "" : "+";
  return <span className="sm-an-change" data-sm-change={change.negative ? "down" : change.zero ? "flat" : "up"}>{t("analytics.vsPrevious", { value: `${LRI}${sign}${change.text}%${PDI}` })}</span>;
}

function Overview({ row, range, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const from = formatDayMonth(range.from, locale) ?? range.from;
  const to = formatDayMonth(range.to, locale) ?? range.to;

  return (
    <section className="sm-card sm-hero sm-an-hero" aria-labelledby="sm-an-net" data-sm-section="overview" data-sm-currency={row.currency}>
      <h2 id="sm-an-net" className="sm-card-title">{t("analytics.net")} · <bdi dir="ltr">{row.currency}</bdi></h2>
      <div className="sm-an-lead">
        <Money className="sm-hero-money sm-an-net" plus value={row.net} currency={row.currency} />
        <ChangeChip change={row.change?.net} />
      </div>
      <div className="sm-an-tiles">
        <div className="sm-an-tile" data-sm-flow="in" data-sm-field="income">
          <span className="sm-an-tile-label">{t("analytics.income")}</span>
          <Money plus value={row.income} currency={row.currency} />
          <ChangeChip change={row.change?.income} />
        </div>
        <div className="sm-an-tile" data-sm-flow="out" data-sm-field="expense">
          <span className="sm-an-tile-label">{t("analytics.expenses")}</span>
          <Money value={row.expense} currency={row.currency} />
          <ChangeChip change={row.change?.expense} />
        </div>
      </div>
      <p className="sm-hero-note">{t("reports.periodShown", { from, to })}</p>
    </section>
  );
}

function TrendCard({ row, group, onGroup }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <section className="sm-card" aria-labelledby="sm-an-trend" data-sm-section="trend">
      <h2 id="sm-an-trend" className="sm-card-title">{t("analytics.trendTitle")}</h2>
      <div className="sm-segment sm-segment-wrap" role="group" aria-label={t("reports.groupBy")}>
        {REPORT_GROUPS.map((value) => <button key={value} type="button" className="sm-segment-button" aria-pressed={group === value} onClick={() => onGroup(value)} data-sm-group={value}>{t(`reports.group.${value}`)}</button>)}
      </div>
      {row.chart ? (
        <>
          <IncomeExpenseChart chart={row.chart} currency={row.currency} />
          <p className="sm-text sm-muted sm-fine">{t("analytics.trendDrawn")}</p>
        </>
      ) : (
        <p className="sm-text sm-muted" data-sm-empty="trend">{t("analytics.trendEmpty")}</p>
      )}
    </section>
  );
}

function CategoriesCard({ row, rangeSearch }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <section className="sm-card" aria-labelledby="sm-an-cats" data-sm-section="categories">
      <h2 id="sm-an-cats" className="sm-card-title">{t("analytics.categoriesTitle")}</h2>
      {row.categories.length === 0 ? (
        <p className="sm-text sm-muted" data-sm-empty="categories">{t("analytics.categoriesEmpty")}</p>
      ) : (
        <ul className="sm-an-cats">
          {row.categories.map((category, index) => (
            <li key={category.key} className="sm-an-cat" data-sm-category={category.key}>
              <span className="sm-an-cat-head">
                <span className="sm-row-title sm-user-text">{category.name ?? t("reports.items.unnamed")}</span>
                <Money plain value={category.total} currency={row.currency} />
              </span>
              {category.percent && (
                <>
                  <span className="sm-an-cat-track" aria-hidden="true"><span className="sm-an-cat-fill" data-sm-rank={Math.min(index, 4)} style={{ inlineSize: category.percent.bar }} /></span>
                  <span className="sm-row-meta">{t("analytics.share", { value: isolated(category.percent.text) })}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link className="sm-link-row" to={`${reportPath("categories")}${rangeSearch}`} data-sm-action="open-categories">
        <span>{t("analytics.categoriesAll")}</span>
        <Chevron />
      </Link>
    </section>
  );
}

function BudgetsCard({ resource, performance, currency, rangeSearch }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const row = performance?.currencies.find((item) => item.currency === currency) ?? null;

  let body;
  if (resource.loading) body = <Skeleton lines={3} label={t("reports.loading")} />;
  else if (resource.status === "error" || !performance) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else if (!row || (row.budgets.length === 0 && row.total === null)) body = <p className="sm-text sm-muted" data-sm-empty="budgets">{t("analytics.budgetsEmpty")}</p>;
  else {
    body = (
      <>
        <div className="sm-an-budget-total" data-sm-budget-total={row.currency}>
          <span className="sm-row-meta">{t("analytics.budgetsSpent")} <Money plain value={row.spent} currency={row.currency} /> {t("analytics.budgetsOf")} <Money plain value={row.total} currency={row.currency} /></span>
          {row.utilization && <Progress percent={row.utilization} tone="calm" spoken={t("analytics.budgetsUsed", { value: isolated(row.utilization.text) })} />}
        </div>
        <ul className="sm-an-budgets">
          {row.budgets.map((budget) => {
            const content = (
              <>
                <span className="sm-an-budget-head">
                  <span className="sm-row-title sm-user-text">{budget.name ?? t("planning.budgets.untitled")}</span>
                  {budget.status && <PlanChip state={budget.status} known={budget.known} />}
                </span>
                <span className="sm-row-meta">
                  <Money plain value={budget.spent} currency={row.currency} /> {t("analytics.budgetsOf")} <Money plain value={budget.limit} currency={row.currency} />
                </span>
                {budget.percent && <Progress percent={budget.percent} tone={toneOf(budget.status, budget.known)} spoken={t("planning.budgets.percentSpoken", { value: budget.percent.text })} />}
              </>
            );
            return (
              <li key={budget.key} data-sm-budget={budget.key}>
                {budget.id ? <Link className="sm-an-budget" to={budgetDetailPath(budget.id)} state={{ from: "/m/reports" }}>{content}</Link> : <div className="sm-an-budget">{content}</div>}
              </li>
            );
          })}
        </ul>
        {performance.more && <p className="sm-text sm-muted sm-fine">{t("analytics.budgetsMore", { count: row.budgets.length })}</p>}
        <Link className="sm-link-row" to={`${reportPath("budgets")}${rangeSearch}`} data-sm-action="open-budgets-report">
          <span>{t("analytics.budgetsAll")}</span>
          <Chevron />
        </Link>
      </>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-an-budgets" data-sm-section="budgets" data-sm-state={resource.loading ? "loading" : performance ? "ready" : "error"}>
      <h2 id="sm-an-budgets" className="sm-card-title">{t("analytics.budgetsTitle")}</h2>
      {body}
    </section>
  );
}

/*
 * Reports: the analytics first, then the ten reports to open. Two documented reads (GET /reports/overview and GET
 * /reports/budgets, the ones the report pages make, so a report opened from here is already in the cache), both for
 * the period in the address. Everything shown is the backend's own figure, per currency; one currency is shown at a
 * time and currencies are never added. Read-only: a PDF or an export is made in the full version.
 */
export default function MobileReports() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const range = readHubRange(location.search);
  const { from, to } = range;
  const explicit = new URLSearchParams(location.search).get("group_by");
  const group = REPORT_GROUPS.includes(explicit) ? explicit : defaultGroup(from, to);
  const [picked, setPicked] = useState(null);

  const overviewLoader = useMemo(() => reportLoader("overview", reportQuery("overview", { from, to }, 1, group)), [from, to, group]);
  const budgetsLoader = useMemo(() => reportLoader("budgets", reportQuery("budgets", { from, to }, 1, "month")), [from, to]);
  const overview = useResource(keys.report("overview", from, to, group === "month" ? 1 : `1:${group}`), overviewLoader);
  const budgets = useResource(keys.report("budgets", from, to, 1), budgetsLoader);

  const analytics = useMemo(() => {
    if (overview.data === undefined) return null;
    try {
      return buildAnalytics(overview.data);
    } catch {
      return null;
    }
  }, [overview.data]);
  const performance = useMemo(() => {
    if (budgets.data === undefined) return null;
    try {
      return buildBudgetPerformance(budgets.data);
    } catch {
      return null;
    }
  }, [budgets.data]);

  const rows = analytics?.currencies ?? [];
  const base = sessionWorkspace()?.base_currency_code;
  const row = rows.find((item) => item.currency === picked) ?? rows.find((item) => item.currency === base) ?? rows[0] ?? null;
  const rangeSearch = `?${new URLSearchParams({ from, to })}`;

  const go = (next) => navigate({ pathname: location.pathname, search: next.toString() ? `?${next}` : "" }, { replace: true });
  const choosePreset = (preset) => {
    const next = presetRange(preset);
    go(new URLSearchParams(preset === "6-months" ? {} : { from: next.from, to: next.to }));
  };
  const chooseRange = (next) => go(new URLSearchParams({ from: next.from, to: next.to }));
  const chooseGroup = (value) => {
    const params = new URLSearchParams(location.search);
    params.set("group_by", value);
    go(params);
  };

  let top;
  if (overview.loading) top = <Skeleton lines={6} label={t("reports.loading")} />;
  else if (overview.status === "error" || !analytics) top = <ErrorPanel error={overview.error ?? MALFORMED} onRetry={overview.reload} retrying={overview.refreshing} />;
  else {
    top = (
      <>
        {overview.stale && <StaleNotice error={overview.error} updatedAt={overview.updatedAt} onRetry={overview.reload} retrying={overview.refreshing} />}
        {rows.length > 1 && (
          <div className="sm-segment sm-segment-wrap" role="group" aria-label={t("analytics.currency")}>
            {rows.map((item) => <button key={item.currency} type="button" className="sm-segment-button" aria-pressed={item.currency === row?.currency} onClick={() => setPicked(item.currency)} data-sm-currency-choice={item.currency}><bdi dir="ltr">{item.currency}</bdi></button>)}
          </div>
        )}
        {!row || (!hasActivity(row) && row.categories.length === 0 && !row.chart) ? (
          <div className="sm-card" data-sm-report-state="empty">
            <h2 className="sm-card-title">{t("analytics.emptyTitle")}</h2>
            <p className="sm-text sm-muted">{t("analytics.emptyBody")}</p>
          </div>
        ) : (
          <>
            <Overview row={row} range={range} locale={locale} />
            <TrendCard row={row} group={group} onGroup={chooseGroup} />
            <CategoriesCard row={row} rangeSearch={rangeSearch} />
          </>
        )}
        {rows.length > 1 && <p className="sm-text sm-muted sm-fine">{t("reports.perCurrency")}</p>}
      </>
    );
  }

  return (
    <section className="sm-page sm-an" data-sm-screen="reports" data-sm-state={overview.loading ? "loading" : analytics ? "ready" : "error"} aria-busy={overview.loading || undefined}>
      <AnalyticsPeriod key={`${from}:${to}`} range={range} locale={locale} onPreset={choosePreset} onRange={chooseRange} />
      {top}
      {analytics && <BudgetsCard resource={budgets} performance={performance} currency={row?.currency} rangeSearch={rangeSearch} />}

      <section className="sm-an-explore" aria-labelledby="sm-an-explore" data-sm-section="all-reports">
        <h2 id="sm-an-explore" className="sm-group-label">{t("analytics.exploreTitle")}</h2>
        <ul className="sm-an-reports" aria-label={t("reports.listLabel")}>
          {REPORT_TYPES.map((type) => {
            const Icon = REPORT_ICONS[type] ?? LuChartColumn;
            return (
              <li key={type}>
                <Link className="sm-an-report" to={`${reportPath(type)}${rangeSearch}`} data-sm-report={type}>
                  <span className="sm-tile-icon" aria-hidden="true"><Icon /></span>
                  <span className="sm-an-report-title">{t(`reports.type.${type}.title`)}</span>
                  <span className="sm-sr">{t(`reports.type.${type}.hint`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="sm-card sm-an-foot">
        <p className="sm-text sm-muted sm-fine">{t("reports.exportsBody")}</p>
        <Link className="sm-link-row" to={MOBILE_EXPORTS}>
          <span>{t("reports.exportsHistory")}</span>
          <Chevron />
        </Link>
        <Link className="sm-link-row" to={PATH.USER.REPORTS}>
          <span>{t("reports.openFull")}</span>
          <Chevron />
        </Link>
      </div>
    </section>
  );
}
