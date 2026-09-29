import { useTranslation } from "react-i18next";
import { LuInfo } from "react-icons/lu";

import { COMMON_ANALYTICS_KEYS } from "../../reportDefinitions";
import {
  getFieldLabel,
  getValueLabel,
  isEmptyValue,
  parseComparison,
  parseDistribution,
  parseRankedGroups,
  parseTransactions,
  parseTrend,
} from "../../reportHelpers";
import ReportComparison from "../ReportComparison/ReportComparison";
import ReportDistribution from "../ReportDistribution/ReportDistribution";
import ReportMetrics from "../ReportMetrics/ReportMetrics";
import ReportRankedList from "../ReportRankedList/ReportRankedList";
import ReportSection from "../ReportSection/ReportSection";
import ReportTransactions from "../ReportTransactions/ReportTransactions";
import ReportTrendChart from "../ReportTrendChart/ReportTrendChart";

import "./ReportAnalytics.css";

// The block for one analytics section; falls back to the generic renderer
// when the value doesn't have the expected shape.
function renderSection(section, value) {
  if (section.kind === "ranked") {
    const groups = parseRankedGroups(value);
    if (groups.length > 0) return <ReportRankedList groups={groups} />;
  }

  if (section.kind === "transactions") {
    const rows = parseTransactions(value);
    if (rows.length > 0) return <ReportTransactions rows={rows} />;
  }

  if (section.kind === "distribution") {
    const groups = parseDistribution(value);
    if (groups.length > 0) return <ReportDistribution groups={groups} />;
  }

  return <ReportMetrics value={value} fields={section.fields} />;
}

/*
 * `data.analytics` of one report. Trend and comparison are shared by every
 * report; the definition lists the report-specific sections; any other field
 * the backend sends is still shown with the generic renderer. Only sections
 * present in the response are rendered.
 */
export default function ReportAnalytics({ definition, analytics, summary, groupBy }) {
  const { t, i18n } = useTranslation();
  const order = definition.summary.flatMap((group) => group.fields);
  const trend = parseTrend(analytics.trend_by_currency);
  const comparison = parseComparison({
    comparison: analytics.comparison_by_currency,
    previousSummary: analytics.previous_summary_by_currency,
    summary,
    order,
  });
  const sections = definition.analytics.filter((section) => !isEmptyValue(analytics[section.key]));
  const definedKeys = new Set(definition.analytics.map((section) => section.key));
  const extraKeys = Object.keys(analytics).filter(
    (key) => !COMMON_ANALYTICS_KEYS.has(key) && !definedKeys.has(key) && !isEmptyValue(analytics[key]),
  );
  const flags = [];

  if (analytics.templates_are_forecast_only === true) flags.push(t("dashboard.reports.flags.forecastOnly"));
  if (typeof analytics.actual_source === "string" && analytics.actual_source) {
    flags.push(t("dashboard.reports.flags.actualSource", { source: getValueLabel(analytics.actual_source, t, i18n) }));
  }

  const isEmpty = trend.length === 0 && comparison.length === 0 && sections.length === 0 && extraKeys.length === 0;

  return (
    <>
      {flags.length > 0 && (
        <ul className="report-analytics__flags">
          {flags.map((flag) => (
            <li key={flag}>
              <LuInfo aria-hidden="true" />
              <span>{flag}</span>
            </li>
          ))}
        </ul>
      )}

      {isEmpty ? (
        <p className="report-analytics__empty">{t("dashboard.reports.states.emptyAnalytics")}</p>
      ) : (
        <div className="report-analytics">
          <ReportTrendChart groups={trend} groupBy={groupBy} />
          <ReportComparison groups={comparison} />

          {sections.map((section) => (
            <ReportSection
              key={section.key}
              title={t(`dashboard.reports.sections.${section.title}`)}
              actions={
                section.forecast ? (
                  <span className="report-analytics__forecast">{t("dashboard.reports.forecastBadge")}</span>
                ) : null
              }
            >
              {renderSection(section, analytics[section.key])}
            </ReportSection>
          ))}

          {extraKeys.map((key) => (
            <ReportSection key={key} title={getFieldLabel(key, t, i18n)}>
              <ReportMetrics value={analytics[key]} />
            </ReportSection>
          ))}
        </div>
      )}
    </>
  );
}
