import { useId } from "react";
import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Money from "../money/Money.jsx";
import { useMoneyHidden } from "../money/privacyContext.js";
import { barLengths } from "../models/reports.js";
import { bucketLabel } from "./bucketLabel.js";

const H = 100;
const SLOT = 12;
const isNegative = (value) => typeof value === "string" && value.trim().startsWith("-");
// Only a figure the backend gave, and not a negative one (a refund-heavy bucket has no bar; its figure is in the table).
const barValue = (value) => (typeof value === "string" && !isNegative(value) ? value : null);

/*
 * Income and expenses per bucket as paired bars, for one currency. The drawing is decoration (aria-hidden): bar
 * heights are whole percentages of the largest figure on the chart, worked out with BigInt from the backend's
 * decimal strings (models/reports.js barLengths), and every figure is in the table underneath, which is the text
 * alternative. Time runs left to right in both languages (the axis is a left-to-right run); the labels, the legend
 * and the table follow the page's language. With amounts hidden nothing is drawn, as TrendChart does: bar heights
 * would show the figures.
 */
export default function IncomeExpenseChart({ chart, currency }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const hidden = useMoneyHidden();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const points = chart.points;
  const count = points.length;

  if (hidden) return <p className="sm-text sm-muted" data-sm-chart="hidden">{t("reports.trendHidden")}</p>;

  const lengths = barLengths([...points.map((point) => barValue(point.income)), ...points.map((point) => barValue(point.expense))]);
  const incomeLengths = lengths.slice(0, count);
  const expenseLengths = lengths.slice(count);
  const width = Math.max(count, 1) * SLOT;
  const bar = (length) => (length === null ? 0 : Math.max((H * length) / 100, length > 0 ? 1 : 0));

  return (
    <figure className="sm-an-chart" data-sm-chart={currency} data-sm-points={count} aria-labelledby={`${ids}-caption`}>
      <svg className="sm-an-svg" viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line x1="0" x2={width} y1={H} y2={H} className="sm-an-base" />
        {points.map((point, index) => (
          <g key={`${point.label}:${index}`} data-sm-bucket={index}>
            <rect x={index * SLOT + 1.5} y={H - bar(incomeLengths[index])} width="4.2" height={bar(incomeLengths[index])} rx="1" className="sm-an-bar sm-an-income" />
            <rect x={index * SLOT + 6.3} y={H - bar(expenseLengths[index])} width="4.2" height={bar(expenseLengths[index])} rx="1" className="sm-an-bar sm-an-expense" />
          </g>
        ))}
      </svg>
      <div className="sm-an-axis" dir="ltr">
        <bdi>{bucketLabel(points[0]?.label, locale)}</bdi>
        {count > 2 && count % 2 === 1 && <bdi>{bucketLabel(points[(count - 1) >> 1]?.label, locale)}</bdi>}
        {count > 1 && <bdi>{bucketLabel(points[count - 1]?.label, locale)}</bdi>}
      </div>
      <figcaption id={`${ids}-caption`} className="sm-an-legend">
        <span className="sm-an-key"><span className="sm-an-swatch sm-an-income" aria-hidden="true" />{t("analytics.income")}</span>
        <span className="sm-an-key"><span className="sm-an-swatch sm-an-expense" aria-hidden="true" />{t("analytics.expenses")}</span>
      </figcaption>
      <details className="sm-trend-table">
        <summary>{t("analytics.figures", { count })}</summary>
        <div className="sm-table-wrap">
          <table className="sm-table">
            <caption className="sm-sr">{t("reports.trendCaption", { currency })}</caption>
            <thead>
              <tr>
                <th scope="col">{t("reports.trendPeriod")}</th>
                <th scope="col">{t("analytics.income")}</th>
                <th scope="col">{t("analytics.expenses")}</th>
                <th scope="col">{t("reports.trendSeries.net")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={`${point.label}:${index}`}>
                  <th scope="row"><bdi dir="ltr">{bucketLabel(point.label, locale) || "—"}</bdi></th>
                  {[point.income, point.expense, point.net].map((value, column) => (
                    <td key={column}>{value === null || value === undefined ? <span className="sm-muted">{t("reports.noFigure")}</span> : <Money value={value} currency={currency} />}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
