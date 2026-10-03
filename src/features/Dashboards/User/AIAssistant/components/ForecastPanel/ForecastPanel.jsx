import PrivateMoney from "../../../Experience/PrivateMoney";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  LuCalendarRange,
  LuChartNoAxesCombined,
  LuCheck,
  LuSparkles,
  LuTarget,
  LuTrendingDown,
  LuTrendingUp,
  LuTriangleAlert,
  LuWallet,
} from "react-icons/lu";

import { aiLocale, formatAiDate, formatAiMoney } from "../../aiFormat";
import { SourceChips } from "../AiShared/AiShared";

import "./ForecastPanel.css";

const x = "dashboard.aiAssistant.extra";
const KPIS = [
  { key: "current_balance", icon: LuWallet, tone: "neutral" },
  { key: "expected_inflow", icon: LuTrendingUp, tone: "success" },
  { key: "expected_outflow", icon: LuTrendingDown, tone: "danger" },
  { key: "projected_balance", icon: LuTarget, tone: "primary" },
  { key: "minimum_projected_balance", icon: LuTriangleAlert, tone: "warning" },
];
const TIMELINE_FIELDS = [
  "expected_inflow",
  "expected_outflow",
  "closing_balance",
];

const shortDate = (value, locale) => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date);
};

function BalanceTooltip({ active, payload, currency, locale, t }) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload.raw;

  return (
    <div className="ai-forecast__tooltip">
      <strong>{formatAiDate(day.date, locale)}</strong>
      {TIMELINE_FIELDS.map((field) => (
        <span key={field}>
          {t(`${x}.${field}`)}:{" "}
          <bdi dir="ltr">
            <PrivateMoney>
              {formatAiMoney(day[field], currency, locale)}
            </PrivateMoney>
          </bdi>
        </span>
      ))}
    </div>
  );
}

/*
 * The projected closing balance per day. The backend's strings are turned
 * into numbers only to place points on the chart; every label shows the
 * backend value formatted. Pressure days are marked on the axis.
 */
function BalanceChart({ currency, timeline, pressureDays, locale, t }) {
  const gradientId = useId().replace(/:/g, "");
  const data = timeline
    .filter((day) => day?.date && Number.isFinite(Number(day.closing_balance)))
    .map((day) => ({
      date: day.date,
      balance: Number(day.closing_balance),
      raw: day,
    }));

  if (data.length < 2) return null;

  const compact = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const hasNegative = data.some((point) => point.balance < 0);

  return (
    <figure className="ai-forecast__chart">
      <figcaption>{t(`${x}.chartTitle`)}</figcaption>
      <div className="ai-forecast__chart-box" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-blue)"
                  stopOpacity={0.28}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-blue)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tickFormatter={(value) => shortDate(value, locale)}
              tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={52}
              domain={["auto", "auto"]}
              tickFormatter={(value) => compact.format(value)}
              tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            />
            {hasNegative && (
              <ReferenceLine
                y={0}
                stroke="var(--color-danger)"
                strokeDasharray="4 4"
              />
            )}
            {pressureDays.map((day) => (
              <ReferenceLine
                key={day}
                x={day}
                stroke="var(--color-warning)"
                strokeDasharray="4 4"
              />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
              content={
                <BalanceTooltip currency={currency} locale={locale} t={t} />
              }
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="var(--chart-blue)"
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function CurrencyForecast({ currency }) {
  const { t, i18n } = useTranslation();
  const locale = aiLocale(i18n);
  const code = currency.currency_code;
  const pressureDays = Array.isArray(currency.pressure_days)
    ? currency.pressure_days
    : [];
  const timeline = Array.isArray(currency.timeline) ? currency.timeline : [];

  return (
    <article className="ai-forecast__currency">
      <header className="ai-forecast__currency-head">
        <h3>
          <bdi dir="ltr">{code}</bdi>
        </h3>
        <SourceChips sources={currency.sources} />
      </header>

      <dl className="ai-forecast__kpis">
        {KPIS.map(({ key, icon: Icon, tone }) => (
          <div
            key={key}
            className={`ai-forecast__kpi ai-forecast__kpi--${tone}`}
          >
            <dt>
              <Icon aria-hidden="true" />
              {t(`${x}.${key}`)}
            </dt>
            <dd>
              <bdi dir="ltr">
                <PrivateMoney>
                  {formatAiMoney(currency[key], code, locale)}
                </PrivateMoney>
              </bdi>
            </dd>
          </div>
        ))}
      </dl>

      <BalanceChart
        currency={code}
        timeline={timeline}
        pressureDays={pressureDays}
        locale={locale}
        t={t}
      />

      {pressureDays.length > 0 && (
        <div className="ai-forecast__pressure">
          <p>
            <LuTriangleAlert aria-hidden="true" />
            <span>
              <strong>{t(`${x}.pressureDays`)}</strong> ·{" "}
              {t(`${x}.pressureDaysHint`)}
            </span>
          </p>
          <ul>
            {pressureDays.map((day) => (
              <li key={day}>
                <bdi>{formatAiDate(day, locale)}</bdi>
              </li>
            ))}
          </ul>
        </div>
      )}

      {timeline.length > 0 && (
        <details className="ai-forecast__timeline">
          <summary>{t(`${x}.dailyTimeline`)}</summary>
          <div className="ai-forecast__table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t(`${x}.date`)}</th>
                  {TIMELINE_FIELDS.map((field) => (
                    <th scope="col" key={field}>
                      {t(`${x}.${field}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeline.map((day) => (
                  <tr
                    key={day.date}
                    className={
                      pressureDays.includes(day.date)
                        ? "is-pressure"
                        : undefined
                    }
                  >
                    <th scope="row">
                      <bdi>{formatAiDate(day.date, locale)}</bdi>
                    </th>
                    {TIMELINE_FIELDS.map((field) => (
                      <td key={field}>
                        <bdi dir="ltr">
                          <PrivateMoney>
                            {formatAiMoney(day[field], code, locale)}
                          </PrivateMoney>
                        </bdi>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </article>
  );
}

/* The 30-day forecast exactly as the backend returns it. */
export default function ForecastPanel({ forecast, busy }) {
  const { t, i18n } = useTranslation();
  const locale = aiLocale(i18n);
  const isReady = forecast?.status === "ready";

  return (
    <section className="ai-panel" aria-labelledby="ai-forecast-title">
      <header className="ai-panel__head">
        <div>
          <h2 id="ai-forecast-title">{t(`${x}.forecastTitle`)}</h2>
          <p>{t(`${x}.forecastDescription`)}</p>
        </div>

        {forecast?.period && (
          <span className="ai-forecast__period">
            <LuCalendarRange aria-hidden="true" />
            <bdi>
              {formatAiDate(forecast.period.start, locale)} –{" "}
              {formatAiDate(forecast.period.end, locale)}
            </bdi>
          </span>
        )}
      </header>

      {!isReady && (
        <div className="ai-empty">
          <span className="ai-empty__icon" aria-hidden="true">
            <LuChartNoAxesCombined />
          </span>
          <p role="status">{busy ? t(`${x}.loading`) : t(`${x}.noForecast`)}</p>
        </div>
      )}

      {(forecast?.explanation || forecast?.assumptions?.length > 0) && (
        <div className="ai-forecast__summary">
          {forecast.explanation && (
            <div className="ai-forecast__explanation">
              <span
                className="ai-forecast__explanation-icon"
                aria-hidden="true"
              >
                <LuSparkles />
              </span>
              <div>
                <strong>{t(`${x}.aiSummary`)}</strong>
                <p dir="auto">{forecast.explanation}</p>
              </div>
            </div>
          )}

          {forecast.assumptions?.length > 0 && (
            <div className="ai-forecast__assumptions">
              <strong>{t(`${x}.assumptions`)}</strong>
              <ul>
                {forecast.assumptions.map((assumption) => (
                  <li key={assumption.code}>
                    <LuCheck aria-hidden="true" />
                    <span dir="auto">{assumption.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {forecast?.currencies?.map((currency) => (
        <CurrencyForecast key={currency.currency_code} currency={currency} />
      ))}
    </section>
  );
}
