import { useId } from "react";
import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Money from "../money/Money.jsx";
import { useMoneyHidden } from "../money/privacyContext.js";
import { barLengths } from "../models/reports.js";

const H = 100;
const human = (name) => name.split(".").pop().replace(/_/g, " ");

/*
 * One series of one currency's trend, as bars. The drawing is decoration: bar
 * heights are whole percentages of the largest value of the series, worked out
 * with BigInt from the backend's strings (models/reports.js barLengths), and
 * every figure is in the table next to it. Negative values go below the zero
 * line. A bucket without a figure draws no bar and says "no figure" in the
 * table. Time runs left to right in both languages; the labels and the table
 * follow the page's language. Nothing moves, so there is nothing for reduced
 * motion to stop.
 */
function SeriesBars({ trend, name, label }) {
  const values = trend.points.map((point) => point.values[name]);
  const lengths = barLengths(values);
  const negative = values.map((value) => typeof value === "string" && value.trim().startsWith("-"));
  const anyNegative = negative.some(Boolean);
  const anyPositive = values.some((value, index) => value !== null && !negative[index] && lengths[index] > 0);
  const zero = anyNegative && anyPositive ? H / 2 : anyNegative ? 0 : H;
  const width = Math.max(trend.points.length, 1) * 10;

  return (
    <div className="sm-trend-series" data-sm-series={name}>
      <p className="sm-row-title">{label}</p>
      <svg className="sm-trend-svg" viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line x1="0" x2={width} y1={zero} y2={zero} className="sm-trend-zero" />
        {lengths.map((length, index) => {
          if (length === null) return null;
          const room = negative[index] ? H - zero : zero;
          const height = Math.max((room * length) / 100, length > 0 ? 1 : 0);
          return <rect key={index} x={index * 10 + 2} width="6" y={negative[index] ? zero : zero - height} height={height} className={negative[index] ? "sm-trend-bar sm-trend-neg" : "sm-trend-bar"} data-sm-bar={index} />;
        })}
      </svg>
      <div className="sm-trend-axis" dir="ltr"><bdi>{trend.points[0]?.label ?? ""}</bdi><bdi>{trend.points.at(-1)?.label ?? ""}</bdi></div>
    </div>
  );
}

export default function TrendChart({ trend }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const hidden = useMoneyHidden();
  const label = (name) => t(`reports.field.${name.split(".").pop()}`, { defaultValue: human(name) });

  return (
    <figure className="sm-trend" role="group" aria-labelledby={`${ids}-title`} data-sm-trend={trend.currency} data-sm-points={trend.points.length}>
      <figcaption id={`${ids}-title`} className="sm-card-title">{t("reports.trendTitle", { currency: trend.currency })}</figcaption>
      {hidden ? <p className="sm-text sm-muted">{t("reports.trendHidden")}</p> : trend.series.map((name) => <SeriesBars key={name} trend={trend} name={name} label={label(name)} />)}
      <details className="sm-trend-table">
        <summary>{t("reports.trendFigures", { count: trend.points.length })}</summary>
        <div className="sm-table-wrap">
          <table className="sm-table">
            <caption className="sm-sr">{t("reports.trendCaption", { currency: trend.currency })}</caption>
            <thead><tr><th scope="col">{t("reports.trendPeriod")}</th>{trend.series.map((name) => <th key={name} scope="col">{label(name)}</th>)}</tr></thead>
            <tbody>
              {trend.points.map((point, index) => (
                <tr key={`${point.label}:${index}`}>
                  <th scope="row"><bdi dir="ltr">{point.label ?? "—"}</bdi></th>
                  {trend.series.map((name) => <td key={name}>{point.values[name] === null ? <span className="sm-muted">{t("reports.noFigure")}</span> : <Money value={point.values[name]} currency={trend.currency} />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
