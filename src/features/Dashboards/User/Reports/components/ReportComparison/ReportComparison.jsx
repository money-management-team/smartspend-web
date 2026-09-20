import { useTranslation } from "react-i18next";
import { LuMinus, LuTrendingDown, LuTrendingUp } from "react-icons/lu";

import { getAmountTone, getFieldLabel, getValueType, isCurrencyCode } from "../../reportHelpers";
import ReportSection from "../ReportSection/ReportSection";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportComparison.css";

const TREND_ICONS = { positive: LuTrendingUp, negative: LuTrendingDown, zero: LuMinus };

// Direction of a change: the backend's `direction`/`trend` when sent,
// otherwise the sign of its change figure. Never calculated from two totals.
function getDirection(metric) {
  const trend = String(metric.trend ?? "").toLowerCase();
  if (["up", "increase", "increased", "higher"].includes(trend)) return "positive";
  if (["down", "decrease", "decreased", "lower"].includes(trend)) return "negative";
  if (["flat", "same", "unchanged", "equal"].includes(trend)) return "zero";
  return getAmountTone(metric.change ?? metric.percent);
}

/*
 * Current vs previous period, per currency. Values, changes and percentages
 * are the backend's (`comparison_by_currency`, `previous_summary_by_currency`).
 * The change is shown neutral: whether a rise is good depends on the metric.
 */
export default function ReportComparison({ groups }) {
  const { t, i18n } = useTranslation();

  if (groups.length === 0) return null;

  return (
    <ReportSection wide title={t("dashboard.reports.sections.comparison")} hint={t("dashboard.reports.sections.comparisonHint")}>
      <div className="report-comparison">
        {groups.map((group) => {
          const currency = isCurrencyCode(group.currency) ? group.currency : null;
          const showChange = group.metrics.some((metric) => metric.change != null);
          const showPercent = group.metrics.some((metric) => metric.percent != null);

          return (
            <div className="report-comparison__group" key={group.currency || "all"}>
              {group.currency && (
                <h3>
                  <bdi dir="ltr">{group.currency}</bdi>
                </h3>
              )}

              <div className="report-comparison__scroll">
                <table className="report-comparison__table">
                  <thead>
                    <tr>
                      <th scope="col">{t("dashboard.reports.comparison.metric")}</th>
                      <th scope="col">{t("dashboard.reports.comparison.current")}</th>
                      <th scope="col">{t("dashboard.reports.comparison.previous")}</th>
                      {showChange && <th scope="col">{t("dashboard.reports.comparison.change")}</th>}
                      {showPercent && <th scope="col">{t("dashboard.reports.comparison.changePercent")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.metrics.map((metric) => {
                      const type = getValueType(metric.key, metric.current ?? metric.previous ?? metric.change);
                      const direction = getDirection(metric);
                      const Icon = TREND_ICONS[direction];

                      return (
                        <tr key={metric.key}>
                          <th scope="row">{getFieldLabel(metric.key, t, i18n)}</th>
                          <td>
                            <ReportValue value={metric.current} type={type} currency={currency} />
                          </td>
                          <td>
                            <ReportValue value={metric.previous} type={type} currency={currency} />
                          </td>
                          {showChange && (
                            <td>
                              <span className="report-comparison__change">
                                {metric.change != null && <Icon aria-hidden="true" />}
                                <ReportValue
                                  value={metric.change}
                                  type={type === "percent" ? "percent" : getValueType(metric.key, metric.change)}
                                  currency={currency}
                                />
                              </span>
                            </td>
                          )}
                          {showPercent && (
                            <td>
                              <ReportValue value={metric.percent} type="percent" />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </ReportSection>
  );
}
