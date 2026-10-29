import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { keys, reportLoader } from "../data/loaders.js";
import { sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { todayIn } from "../forms/validation.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildReport, reportQuery } from "../models/reports.js";
import { reportPath } from "../navigation.js";
import { SummaryGroup } from "../reports/MobileReport.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";

// The full version's monthly review steps (Experience/MonthlyReview.jsx), each one of the ten reports.
const STEPS = Object.freeze([
  { id: "overview", report: "overview" },
  { id: "flow", report: "income-expense" },
  { id: "budgets", report: "budgets" },
  { id: "goals", report: "savings-goals" },
]);

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The first and last day of a YYYY-MM month (the last day is worked out from the calendar, not guessed). */
function monthRange(month) {
  const match = MONTH.exec(month ?? "");
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const index = parseInt(match[2], 10);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return { from: `${match[1]}-${match[2]}-01`, to: `${match[1]}-${match[2]}-${String(last).padStart(2, "0")}` };
}

const shiftMonth = (month, step) => {
  const [year, index] = month.split("-").map((part) => parseInt(part, 10));
  const date = new Date(Date.UTC(year, index - 1 + step, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

function Step({ step, range }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const query = useMemo(() => reportQuery(step.report, range), [step.report, range]);
  const loader = useMemo(() => reportLoader(step.report, query), [step.report, query]);
  const resource = useResource(keys.report(step.report, range.from, range.to, 1), loader);
  const report = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildReport(resource.data, step.report);
    } catch {
      return null;
    }
  }, [resource.data, step.report]);

  return (
    <section className="sm-card" aria-labelledby={`sm-review-${step.id}`} data-sm-review-step={step.id}>
      <h2 id={`sm-review-${step.id}`} className="sm-card-title">{t(`review.steps.${step.id}`)}</h2>
      {resource.loading ? (
        <Skeleton lines={3} label={t("review.loading")} />
      ) : resource.status === "error" || !report ? (
        <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} compact />
      ) : report.currencies.length === 0 ? (
        <p className="sm-text sm-muted">{t("review.nothing")}</p>
      ) : (
        report.currencies.map((row) => (
          <div key={row.currency} data-sm-currency={row.currency}>
            <h3 className="sm-row-title"><bdi dir="ltr">{row.currency}</bdi></h3>
            {row.groups.map((group) => <SummaryGroup key={group[0].field} group={group} currency={row.currency} />)}
          </div>
        ))
      )}
      <Link className="sm-link-row" to={`${reportPath(step.report)}?from=${range.from}&to=${range.to}`}>
        <span>{t("review.openReport")}</span>
        <Chevron />
      </Link>
    </section>
  );
}

/*
 * A month, step by step: the overview, income and expenses, budgets and goals,
 * each from its report (GET /reports/{type} for that month). Every figure is the
 * backend's, per currency; nothing is recommended or worked out here. The month
 * is in the address, so Back returns to the previous one.
 */
export default function MobileReview() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const [params, setParams] = useSearchParams();
  const current = todayIn(sessionWorkspace()?.timezone).slice(0, 7);
  const month = MONTH.test(params.get("month") ?? "") && params.get("month") <= current ? params.get("month") : current;
  const range = useMemo(() => monthRange(month), [month]);
  const go = (next) => setParams(next === current ? {} : { month: next });
  const label = new Intl.DateTimeFormat(i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${range.from}T12:00:00Z`));

  return (
    <section className="sm-page" data-sm-screen="review" data-sm-month={month}>
      <div className="sm-card">
        <p className="sm-text sm-muted">{t("review.intro")}</p>
        <div className="sm-cal-bar">
          <button type="button" className="sm-button sm-button-quiet" onClick={() => go(shiftMonth(month, -1))} aria-label={t("review.previous")} data-sm-action="previous-month"><Chevron back /></button>
          <p className="sm-cal-month sm-row-title"><bdi>{label}</bdi></p>
          <button type="button" className="sm-button sm-button-quiet" onClick={() => go(shiftMonth(month, 1))} disabled={month >= current} aria-label={t("review.next")} data-sm-action="next-month"><Chevron /></button>
        </div>
        <p className="sm-text sm-muted sm-fine">{t("review.figures")}</p>
      </div>
      {STEPS.map((step) => <Step key={`${step.id}:${month}`} step={step} range={range} />)}
    </section>
  );
}
