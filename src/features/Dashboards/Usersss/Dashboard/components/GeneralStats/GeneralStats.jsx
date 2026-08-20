import { useTranslation } from "react-i18next";
import {
  LuPiggyBank,
  LuReceiptText,
  LuArrowRightLeft,
  LuTarget,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";

import "./GeneralStats.css";

const stats = [
  { key: "savingsRate", icon: LuPiggyBank },
  { key: "avgDailySpend", icon: LuReceiptText },
  { key: "transactions", icon: LuArrowRightLeft },
  { key: "topCategory", icon: LuTarget },
];

export default function GeneralStats() {
  const { t } = useTranslation();

  return (
    <SectionCard
      className="general-stats-card"
      title={t("dashboard.user.stats.title")}
      subtitle={t("dashboard.user.stats.subtitle")}
    >
      <div className="general-stats-card__grid">
        {stats.map(({ key, icon: Icon }) => (
          <article className="general-stat" key={key}>
            <span className="general-stat__icon">
              <Icon />
            </span>

            <div>
              <small>{t(`dashboard.user.stats.${key}.label`)}</small>
              <strong>{t(`dashboard.user.stats.${key}.value`)}</strong>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
