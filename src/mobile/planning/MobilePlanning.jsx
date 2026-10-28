import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { keys, loadAlerts } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildAlertsModel } from "../models/home.js";
import { MOBILE_BUDGETS, MOBILE_CALENDAR, MOBILE_CATEGORIES, MOBILE_DEBTS, MOBILE_GOALS, MOBILE_RECURRING } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import { BUDGET_LIST, GOAL_LIST, RULE_LIST, pageLoader } from "./lists.js";
import { useCount } from "./useCount.js";

const BUDGET_DEFAULT = BUDGET_LIST.readFilters("");
const BUDGET_EXCEEDED = BUDGET_LIST.readFilters("progress_status=exceeded");
const GOAL_DEFAULT = GOAL_LIST.readFilters("");
const RULE_DEFAULT = RULE_LIST.readFilters("");

// Each of these reads the first page of the list it summarises, through the list's own key and request.
const countOf = (list, filters) => ({ key: list.keyOf(list.signatureOf(filters), 1), build: list.build, perPage: list.perPage });

function useListCount(list, filters) {
  const { key, build, perPage } = useMemo(() => countOf(list, filters), [list, filters]);
  const loader = useMemo(() => pageLoader(list, filters, 1), [list, filters]);
  return useCount({ key, loader, build, perPage });
}

function PlanLink({ to, title, hint, chips, state }) {
  return (
    <Link className="sm-row sm-plan-link" to={to} data-sm-plan-link={state}>
      <span className="sm-row-main">
        <span className="sm-row-title">{title}</span>
        <span className="sm-row-meta">{hint}</span>
        {chips}
      </span>
      <Chevron />
    </Link>
  );
}

function summary(count, t, key) {
  if (count.loading) return t("planning.overview.loadingCount");
  if (count.failed) return t("planning.overview.countUnavailable");
  return t(key, { count: count.total });
}

function AttentionCard({ alerts }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const model = useMemo(() => buildAlertsModel(alerts.data), [alerts.data]);

  if (alerts.loading) return null;

  if (alerts.status === "error" || (alerts.data !== undefined && !model)) {
    return (
      <section className="sm-card" aria-labelledby="sm-plan-attention" data-sm-section="attention-error">
        <h2 id="sm-plan-attention" className="sm-card-title">{t("planning.overview.attention")}</h2>
        <div className="sm-error sm-error-compact" role="alert">
          <p className="sm-text">{t("planning.overview.attentionUnavailable")}</p>
          <button type="button" className="sm-button sm-button-quiet" onClick={alerts.reload} disabled={alerts.refreshing}>{t("errors.retry")}</button>
        </div>
      </section>
    );
  }

  // Nothing to attend to is not a section: it appears only when the backend has something to say.
  if (!model || model.count === 0) return null;

  return (
    <section className="sm-card sm-attention" aria-labelledby="sm-plan-attention" data-sm-section="attention">
      <h2 id="sm-plan-attention" className="sm-card-title">{t("planning.overview.attention")}</h2>
      <p className="sm-text">{t("home.attention.count", { count: model.count })}</p>
      <ul className="sm-list">
        {model.items.map((alert, index) => (
          <li key={index} className="sm-alert" data-sm-severity={alert.severity}>
            <span className="sm-chip sm-chip-severity">{t(`home.attention.${alert.severity}`)}</span>
            <span className="sm-user-text">{alert.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/*
 * Planning, read-only. The shape follows the S03.5 direction: what needs attention
 * first (the backend's own alerts, only when there are any), then the things you
 * plan with as one group, then the tools. Six identical cards would say nothing
 * about which matters; this one says "Plan" and "Tools".
 *
 * Every number here is a count the backend gave (a paginator's total) and nothing
 * is added up: no combined budget, no total saved across goals, because those
 * would mix currencies. Debts, Calendar and Reports are not Mobile
 * screens yet; they are links to the full version, each said to be so.
 */
export default function MobilePlanning() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const alerts = useResource(keys.alerts, loadAlerts);
  const budgets = useListCount(BUDGET_LIST, BUDGET_DEFAULT);
  const exceeded = useListCount(BUDGET_LIST, BUDGET_EXCEEDED);
  const goals = useListCount(GOAL_LIST, GOAL_DEFAULT);
  const rules = useListCount(RULE_LIST, RULE_DEFAULT);
  const counts = [budgets, goals, rules];
  const refreshing = counts.some((count) => count.refreshing) || alerts.refreshing;
  const stale = counts.some((count) => count.stale);
  const refresh = () => {
    alerts.reload();
    for (const count of [budgets, exceeded, goals, rules]) count.reload();
  };

  return (
    <section className="sm-page" data-sm-screen="planning" data-sm-state={stale ? "stale" : "ready"} data-sm-stale={stale ? "true" : undefined}>
      <div className="sm-greeting">
        <p className="sm-text">{t("planning.overview.intro")}</p>
        <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>
          {t(refreshing ? "home.refreshing" : "home.refresh")}
        </button>
      </div>

      <AttentionCard alerts={alerts} />

      <section className="sm-card" aria-labelledby="sm-plan-group">
        <h2 id="sm-plan-group" className="sm-card-title">{t("planning.overview.plan")}</h2>
        <ul className="sm-list">
          <li>
            <PlanLink
              to={MOBILE_BUDGETS}
              title={t("planning.overview.budgets")}
              hint={summary(budgets, t, "planning.overview.budgetsCount")}
              state={budgets.failed ? "unavailable" : budgets.loading ? "loading" : "ready"}
              chips={!exceeded.loading && !exceeded.failed && exceeded.total > 0 ? <span className="sm-chips-inline"><span className="sm-chip sm-plan-chip" data-sm-tone="bad">{t("planning.overview.exceeded", { count: exceeded.total })}</span></span> : null}
            />
          </li>
          <li>
            <PlanLink to={MOBILE_GOALS} title={t("planning.overview.goals")} hint={summary(goals, t, "planning.overview.goalsCount")} state={goals.failed ? "unavailable" : goals.loading ? "loading" : "ready"} />
          </li>
          <li>
            <PlanLink to={MOBILE_RECURRING} title={t("planning.overview.recurring")} hint={summary(rules, t, "planning.overview.recurringCount")} state={rules.failed ? "unavailable" : rules.loading ? "loading" : "ready"} />
          </li>
          <li>
            <PlanLink to={MOBILE_DEBTS} title={t("planning.overview.debts")} hint={t("planning.overview.debtsHint")} state="mobile" />
          </li>
        </ul>
      </section>

      <section className="sm-card" aria-labelledby="sm-plan-tools">
        <h2 id="sm-plan-tools" className="sm-card-title">{t("planning.overview.tools")}</h2>
        <ul className="sm-list">
          <li><PlanLink to={MOBILE_CALENDAR} title={t("planning.overview.calendar")} hint={t("planning.overview.calendarHint")} state="mobile" /></li>
          <li><PlanLink to={MOBILE_CATEGORIES} title={t("planning.overview.categories")} hint={t("planning.overview.categoriesHint")} state="mobile" /></li>
          <li><PlanLink to={PATH.USER.REPORTS} title={t("planning.overview.reports")} hint={t("planning.overview.fullOnly")} state="full" /></li>
        </ul>
      </section>

      <p className="sm-text sm-muted sm-fine">{t("planning.overview.readOnly")}</p>
    </section>
  );
}
