import { useTranslation } from "react-i18next";
import {
  LuPiggyBank,
  LuReceiptText,
  LuArrowRightLeft,
  LuTarget,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";

import "./GeneralStats.css";
import { formatMoney } from "../../../utils/formatters";

export default function GeneralStats({ totals, categories, transactions, period }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const topCategory = [...expenseCategories].sort(
    (a, b) => Number(b.total) - Number(a.total),
  )[0];
  const periodDays = period?.date_from && period?.date_to
    ? Math.max(
        1,
        Math.round(
          (new Date(period.date_to) - new Date(period.date_from)) / 86400000,
        ) + 1,
      )
    : 1;
  const stats = [
    { key: "savingsRate", icon: LuPiggyBank, value: `${totals?.savings_rate ?? 0}%` },
    {
      key: "avgDailySpend",
      icon: LuReceiptText,
      value: formatMoney(
        Number(totals?.expense || 0) / periodDays,
        totals?.currency_code,
        locale,
      ),
    },
    { key: "transactions", icon: LuArrowRightLeft, value: transactions.length },
    { key: "topCategory", icon: LuTarget, value: topCategory?.name ?? "—" },
  ];

  return (
    <SectionCard
      className="general-stats-card"
      title={t("dashboard.user.stats.title")}
      subtitle={t("dashboard.user.stats.subtitle")}
    >
      <div className="general-stats-card__grid">
        {stats.map(({ key, icon: Icon, value }) => (
          <article className="general-stat" key={key}>
            <span className="general-stat__icon">
              <Icon />
            </span>

            <div>
              <small>{t(`dashboard.user.stats.${key}.label`)}</small>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
