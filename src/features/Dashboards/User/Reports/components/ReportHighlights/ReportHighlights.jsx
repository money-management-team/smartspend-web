import { useTranslation } from "react-i18next";
import { LuMinus, LuTrendingDown, LuTrendingUp } from "react-icons/lu";

import {
  getChangeDirection,
  getFieldLabel,
  getValueType,
  hasValue,
  isCurrencyCode,
} from "../../reportHelpers";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportHighlights.css";

const TREND_ICONS = { positive: LuTrendingUp, negative: LuTrendingDown, zero: LuMinus };

const isSigned = (key) => /(^|_)net(_|$)|net_change|net_position|net_movement/.test(key);

/*
 * The headline figures of a report as KPI tiles, one row per currency.
 * Values are the backend's `summary_by_currency` fields named by the report
 * definition's `highlights`; the change line is the backend's own comparison
 * for that metric (percentage preferred, otherwise the change amount), taken
 * from the already parsed comparison groups. Nothing is calculated here and
 * currencies are never combined. As in the comparison table, the change is
 * neutral in color: whether a rise is good depends on the metric.
 */
export default function ReportHighlights({ rows, fields, comparison }) {
  const { t, i18n } = useTranslation();

  const groups = rows
    .map((row) => ({
      row,
      currency: isCurrencyCode(row.currency_code) ? row.currency_code : null,
      keys: fields.filter((key) => hasValue(row[key])),
    }))
    .filter((group) => group.keys.length > 0);

  if (groups.length === 0) return null;

  const showCurrency = groups.length > 1;

  return (
    <section className="report-highlights" aria-label={t("dashboard.reports.highlights.label")}>
      {groups.map(({ row, currency, keys }, index) => {
        const metrics = comparison.find((group) => (group.currency || "") === (row.currency_code ?? ""))?.metrics ?? [];

        return (
          <div className="report-highlights__group" key={row.currency_code ?? index}>
            {showCurrency && (
              <h2 className="report-highlights__currency">
                <bdi dir="ltr">{row.currency_code ?? "—"}</bdi>
              </h2>
            )}

            <dl className="report-highlights__grid" style={{ "--highlight-count": keys.length }}>
              {keys.map((key) => {
                const metric = metrics.find((entry) => entry.key === key);
                const type = getValueType(key, row[key]);
                const hasPercent = hasValue(metric?.percent);
                const hasChange = hasPercent || hasValue(metric?.change);
                const direction = hasChange ? getChangeDirection(metric) : null;
                const Icon = direction ? TREND_ICONS[direction] : null;

                return (
                  <div className="report-highlight" key={key}>
                    <dt>{getFieldLabel(key, t, i18n)}</dt>
                    <dd className="report-highlight__value">
                      <ReportValue value={row[key]} type={type} currency={currency} tone={isSigned(key)} />
                    </dd>
                    {hasChange && (
                      <dd className={`report-highlight__change report-highlight__change--${direction}`}>
                        <Icon aria-hidden="true" />
                        <ReportValue
                          value={hasPercent ? metric.percent : metric.change}
                          type={hasPercent ? "percent" : getValueType(key, metric.change)}
                          currency={currency}
                        />
                        <span>{t("dashboard.reports.highlights.vsPrevious")}</span>
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </section>
  );
}
