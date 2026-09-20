import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate } from "../../../utils/formatters";
import { formatReportValue, getFieldLabel, isCurrencyCode } from "../../reportHelpers";
import ReportSection from "../ReportSection/ReportSection";

import "./ReportTrendChart.css";

const PALETTE = ["var(--chart-blue)", "var(--chart-purple)", "var(--chart-green)", "var(--chart-orange)", "var(--chart-red)"];

// Semantic color of a series; unknown series take the next palette color.
function getSeriesColor(key, index) {
  const name = key.split(".").pop();
  if (/income|inflow|(^|_)in$|contribution|received|collection/.test(name)) return "var(--chart-green)";
  if (/expense|outflow|(^|_)out$|withdrawal|given|payment|spent/.test(name)) return "var(--chart-orange)";
  if (/fee/.test(name)) return "var(--chart-red)";
  if (/net/.test(name)) return "var(--chart-blue)";
  return PALETTE[index % PALETTE.length];
}

function getSeriesLabel(key, t, i18n) {
  return key
    .split(".")
    .map((part) => getFieldLabel(part, t, i18n))
    .join(" · ");
}

// Bucket label: months as "Aug 2026", days as dates, anything else as sent.
function formatBucket(label, groupBy, locale) {
  const text = String(label ?? "");

  if (/^\d{4}-\d{2}$/.test(text) || (groupBy === "month" && /^\d{4}-\d{2}-\d{2}/.test(text))) {
    const [year, month] = text.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return formatDate(text.slice(0, 10), locale);

  return text || "—";
}

function TrendTooltip({ active, payload, label, series, currency, locale, t, i18n }) {
  if (!active || !payload?.length) return null;

  const raw = payload[0]?.payload?.raw ?? {};

  return (
    <div className="report-trend__tooltip">
      <strong>{label}</strong>
      {series.map((key, index) => (
        <span key={key}>
          <i style={{ background: getSeriesColor(key, index) }} aria-hidden="true" />
          {getSeriesLabel(key, t, i18n)}:{" "}
          <bdi dir="ltr">{formatReportValue(raw[key], "money", { currency, locale })}</bdi>
        </span>
      ))}
    </div>
  );
}

/*
 * `trend_by_currency`: one chart per currency, never a mixed axis. Bars are
 * drawn from the backend's bucket values; the tooltip shows the backend's
 * strings formatted in that currency.
 */
export default function ReportTrendChart({ groups, groupBy }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  if (groups.length === 0) return null;

  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <ReportSection wide title={t("dashboard.reports.sections.trend")} hint={t("dashboard.reports.sections.trendHint")}>
      <div className="report-trend">
        {groups.map((group) => {
          const currency = isCurrencyCode(group.currency) ? group.currency : null;
          const data = group.points.map((point) => {
            const entry = { label: formatBucket(point.label, groupBy, locale), raw: point.values };

            group.series.forEach((key, index) => {
              const number = Number(point.values[key]);
              entry[`s${index}`] = Number.isFinite(number) ? number : null;
            });

            return entry;
          });

          return (
            <figure className="report-trend__group" key={group.currency || "all"}>
              {group.currency && (
                <figcaption>
                  <bdi dir="ltr">{group.currency}</bdi>
                </figcaption>
              )}

              <div className="report-trend__chart" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={3}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(value) => compact.format(value)}
                      tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                    />
                    <ReferenceLine y={0} stroke="var(--chart-grid)" />
                    <Tooltip
                      cursor={{ fill: "color-mix(in srgb, var(--primary) 4%, transparent)" }}
                      content={
                        <TrendTooltip series={group.series} currency={currency} locale={locale} t={t} i18n={i18n} />
                      }
                    />
                    {group.series.map((key, index) => (
                      <Bar
                        key={key}
                        dataKey={`s${index}`}
                        name={getSeriesLabel(key, t, i18n)}
                        fill={getSeriesColor(key, index)}
                        radius={[5, 5, 0, 0]}
                        maxBarSize={32}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ul className="report-trend__legend">
                {group.series.map((key, index) => (
                  <li key={key}>
                    <i style={{ background: getSeriesColor(key, index) }} aria-hidden="true" />
                    {getSeriesLabel(key, t, i18n)}
                  </li>
                ))}
              </ul>
            </figure>
          );
        })}
      </div>
    </ReportSection>
  );
}
