import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SectionCard from "../shared/SectionCard";

import "./CashFlowChart.css";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";
import { formatOptionalMoney, isNegativeAmount } from "../../dashboardHelpers";

function CashFlowTooltip({ active, payload, currency, locale }) {
  const { t } = useTranslation();

  if (!active || !payload?.length) return null;

  return (
    <div className="cash-flow-tooltip">
      {payload.map((entry) => (
        <span key={entry.dataKey}>
          {t(`dashboard.user.cashFlow.${entry.dataKey}`)}:{" "}
          <bdi>{formatMoney(entry.value, currency, locale)}</bdi>
        </span>
      ))}
    </div>
  );
}

/*
 * Income against expense for the selected period (`data.totals`, in its
 * currency). The response has one figure per period, not a time series, so
 * the chart compares the two totals; the exact backend strings are listed
 * under it. Numbers are converted only to size the bars.
 */
export default function CashFlowChart({ totals, periodLabel }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const currency = totals?.currency_code || undefined;
  const hasFigures = totals?.income != null || totals?.expense != null;
  const data = [
    {
      label: periodLabel,
      income: Number(totals?.income) || 0,
      expense: Number(totals?.expense) || 0,
    },
  ];
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <SectionCard
      className="cash-flow-card"
      title={t("dashboard.user.cashFlow.title")}
      subtitle={
        currency
          ? t("dashboard.user.cashFlow.subtitleCurrency", { period: periodLabel, currency })
          : periodLabel
      }
    >
      {hasFigures ? (
        <>
          <div className="cash-flow-card__chart" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} barGap={18}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={false} height={4} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(value) => compact.format(value)}
                  tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-hover)" }}
                  content={<CashFlowTooltip currency={currency} locale={locale} />}
                />
                <Bar dataKey="income" fill="var(--chart-green)" radius={[8, 8, 0, 0]} maxBarSize={72} />
                <Bar dataKey="expense" fill="var(--chart-orange)" radius={[8, 8, 0, 0]} maxBarSize={72} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <dl className="cash-flow-card__figures">
            {["income", "expense", "net"].map((key) => (
              <div key={key} className={`cash-flow-card__figure cash-flow-card__figure--${key}`}>
                <dt>{t(`dashboard.user.cashFlow.${key}`)}</dt>
                <dd className={key === "net" && isNegativeAmount(totals?.net) ? "cash-flow-card__negative" : ""}>
                  <bdi>{formatOptionalMoney(totals?.[key], currency, locale)}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="cash-flow-card__empty">{t("dashboard.user.cashFlow.empty")}</p>
      )}
    </SectionCard>
  );
}
