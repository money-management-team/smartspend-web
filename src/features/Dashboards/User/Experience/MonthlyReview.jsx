import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCalendarCheck, LuCheck } from "react-icons/lu";
import { PATH } from "../../../../routes/Path";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { getTodayIso } from "../Calendar/calendarHelpers";
import { getReport } from "../api/reportsApi";
import { parseReport } from "../Reports/reportHelpers";
import { REPORT_DEFINITIONS } from "../Reports/reportDefinitions";
import ReportSummary from "../Reports/components/ReportSummary/ReportSummary";
import ReportAnalytics from "../Reports/components/ReportAnalytics/ReportAnalytics";
import ReportComparison from "../Reports/components/ReportComparison/ReportComparison";
import {
  dataError,
  monthRange,
  previousMonthRange,
  calendarMonthComparison,
} from "./experienceData";

const STEPS = ["overview", "flow", "comparison", "budgets", "goals"];
const REPORTS = [
  "overview",
  "income-expense",
  "income-expense",
  "budgets",
  "savings-goals",
];
export default function MonthlyReview() {
  const { t } = useTranslation("experience"),
    { workspace } = useAuthContext();
  const [month, setMonth] = useState(() =>
      getTodayIso(workspace?.timezone).slice(0, 7),
    ),
    [step, setStep] = useState(0),
    [refresh, setRefresh] = useState(0),
    [done, setDone] = useState(false);
  const [result, setResult] = useState({ key: null });
  let range = null;
  try {
    range = monthRange(month);
  } catch {
    /* The month input can be temporarily empty. */
  }
  const reportName = REPORTS[step],
    key = `${month}:${step}:${refresh}`,
    definition = REPORT_DEFINITIONS[reportName];
  useEffect(() => {
    const controller = new AbortController();
    let dates;
    try {
      dates = monthRange(month);
    } catch {
      return () => controller.abort();
    }
    const fetch = (range) =>
      getReport(
        reportName,
        { ...range, group_by: "month", per_page: 20, page: 1 },
        { signal: controller.signal },
      ).then((response) => {
        const report = parseReport(response);
        if (!report || report.report !== reportName) throw dataError();
        return report;
      });
    Promise.all([
      fetch(dates),
      step === 2 ? fetch(previousMonthRange(month)) : Promise.resolve(null),
    ])
      .then(([report, previous]) => {
        if (!controller.signal.aborted) setResult({ key, report, previous });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, error });
      });
    return () => controller.abort();
  }, [key, month, reportName, step]);
  const busy = Boolean(range) && result.key !== key,
    report = !busy && result.key === key ? result.report : null;
  const comparison =
    report && result.previous
      ? calendarMonthComparison(
          report.summary,
          result.previous.summary,
          definition.summary.flatMap((group) => group.fields),
        )
      : [];
  const move = (value) => {
    setStep(value);
    setDone(false);
  };
  return (
    <div className="exp-page">
      <header className="exp-hero">
        <div>
          <span className="exp-kicker">SMARTSPEND · MONTHLY CHECK-IN</span>
          <h1>{t("monthly")}</h1>
          <p>{t("monthlyHint")}</p>
        </div>
        <span className="exp-hero-icon">
          <LuCalendarCheck aria-hidden="true" />
        </span>
      </header>
      <div className="exp-card exp-toolbar">
        <label className="exp-field">
          {t("month")}
          <input
            type="month"
            min="2000-01"
            max="2100-12"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setStep(0);
              setDone(false);
            }}
          />
        </label>
        <p className="exp-muted">
          {t("readOnly")} {t("reportScope")}
        </p>
        <button
          className="exp-button exp-button--subtle"
          type="button"
          disabled={busy || !range}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {t("refresh")}
        </button>
      </div>
      <nav className="exp-steps" aria-label={t("monthly")}>
        {STEPS.map((name, index) => (
          <button
            key={name}
            type="button"
            aria-current={step === index ? "step" : undefined}
            onClick={() => move(index)}
          >
            <span className="exp-step-number">{index + 1}</span>
            <strong>{t(`monthlyStep.${name}`)}</strong>
          </button>
        ))}
      </nav>
      <section className="exp-card" aria-busy={busy}>
        <h2>{t(`monthlyStep.${STEPS[step]}`)}</h2>
        <p className="exp-muted">{t(`monthlyStepHint.${STEPS[step]}`)}</p>
        {!range ? (
          <p className="exp-error">{t("exportDates")}</p>
        ) : busy ? (
          <p className="exp-state" role="status">
            {t("loading")}
          </p>
        ) : result.error ? (
          <p className="exp-error" role="alert">
            {t("error")}
          </p>
        ) : (
          report && (
            <>
              {step === 2 ? (
                comparison.length ? (
                  <ReportComparison groups={comparison} />
                ) : (
                  <p className="exp-state">{t("noComparison")}</p>
                )
              ) : (
                <>
                  <ReportSummary
                    rows={report.summary}
                    groups={definition.summary}
                  />
                  {step > 0 && (
                    <ReportAnalytics
                      definition={definition}
                      analytics={report.analytics}
                      summary={report.summary}
                      groupBy="month"
                    />
                  )}
                </>
              )}
              <Link
                className="exp-button exp-button--subtle"
                style={{ marginTop: 20 }}
                to={`${PATH.USER.REPORTS}?${new URLSearchParams({ report: reportName, ...range, group_by: "month" })}`}
              >
                {t("fullReport")}
              </Link>
            </>
          )
        )}
      </section>
      {done && (
        <p className="exp-success" role="status">
          <LuCheck aria-hidden="true" /> {t("monthlyDone")}
        </p>
      )}
      <nav className="exp-navigation" aria-label={t("monthly")}>
        <button
          className="exp-button exp-button--subtle"
          type="button"
          disabled={step === 0}
          onClick={() => move(step - 1)}
        >
          {t("previous")}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            className="exp-button"
            type="button"
            onClick={() => move(step + 1)}
          >
            {t("next")}
          </button>
        ) : (
          <button
            className="exp-button"
            type="button"
            disabled={!report || busy}
            onClick={() => setDone(true)}
          >
            {t("finish")}
          </button>
        )}
      </nav>
    </div>
  );
}
