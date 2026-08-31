import { LuPercent, LuHash, LuCircleDollarSign } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import "./ReportsSummary.css";

function formatMoney(value, currency, language) {
  const locale = language?.toLowerCase().startsWith("ar") ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "ILS",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function ReportsSummary({ totals, categories }) {
  const { t, i18n } = useTranslation();
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const topCategory = [...expenseCategories].sort((a, b) => Number(b.total) - Number(a.total))[0];
  const summary = [
    {
      key: "savingsRate",
      value: totals?.savings_rate == null ? "—" : `${totals.savings_rate}%`,
      icon: LuPercent,
      primary: true,
    },
    {
      key: "topCategory",
      value: topCategory?.name ?? "—",
      icon: LuHash,
    },
    {
      key: "net",
      value: formatMoney(totals?.net, totals?.currency_code, i18n.resolvedLanguage || i18n.language),
      icon: LuCircleDollarSign,
    },
  ];

  return (
    <section className="reports-summary">
      {summary.map(({ key, value, icon: Icon, primary }) => (
        <article className={`reports-summary-card ${primary ? "reports-summary-card--primary" : ""}`} key={key}>
          <div className="reports-summary-card__top">
            <span className="reports-summary-card__label">{t(`dashboard.reports.summary.${key}`)}</span>
            <span className="reports-summary-card__icon"><Icon /></span>
          </div>
          <strong className="reports-summary-card__value">{value}</strong>
        </article>
      ))}
    </section>
  );
}
