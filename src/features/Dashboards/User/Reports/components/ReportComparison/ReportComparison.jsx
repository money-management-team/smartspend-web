import { useTranslation } from "react-i18next";
import { LuMinus, LuTrendingDown, LuTrendingUp } from "react-icons/lu";

import { getChangeDirection, getFieldLabel, getValueType, isCurrencyCode } from "../../reportHelpers";
import ReportSection from "../ReportSection/ReportSection";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportComparison.css";

const TREND_ICONS = { positive: LuTrendingUp, negative: LuTrendingDown, zero: LuMinus };

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
                <table className="report-comparison__table" role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col">{t("dashboard.reports.comparison.metric")}</th>
                      <th scope="col">{t("dashboard.reports.comparison.current")}</th>
                      <th scope="col">{t("dashboard.reports.comparison.previous")}</th>
                      {showChange && <th scope="col">{t("dashboard.reports.comparison.change")}</th>}
                      {showPercent && <th scope="col">{t("dashboard.reports.comparison.changePercent")}</th>}
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {group.metrics.map((metric) => {
                      const type = getValueType(metric.key, metric.current ?? metric.previous ?? metric.change);
                      const direction = getChangeDirection(metric);
                      const Icon = TREND_ICONS[direction];

                      return (
                        <tr key={metric.key} role="row">
                          <th scope="row">{getFieldLabel(metric.key, t, i18n)}</th>
                          <td data-label={t("dashboard.reports.comparison.current")} role="cell">
                            <ReportValue value={metric.current} type={type} currency={currency} />
                          </td>
                          <td data-label={t("dashboard.reports.comparison.previous")} role="cell">
                            <ReportValue value={metric.previous} type={type} currency={currency} />
                          </td>
                          {showChange && (
                            <td data-label={t("dashboard.reports.comparison.change")} role="cell">
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
                            <td data-label={t("dashboard.reports.comparison.changePercent")} role="cell">
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
