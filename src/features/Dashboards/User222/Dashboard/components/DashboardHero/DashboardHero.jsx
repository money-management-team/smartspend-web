import { useTranslation } from "react-i18next";
import {
  LuPlus,
  LuMinus,
  LuArrowRightLeft,
  LuTarget,
} from "react-icons/lu";

import "./DashboardHero.css";
import { formatMoney } from "../../../utils/formatters";

const actions = [
  { key: "income", icon: LuPlus },
  { key: "expense", icon: LuMinus },
  { key: "transfer", icon: LuArrowRightLeft },
  { key: "goal", icon: LuTarget },
];

export default function DashboardHero({ user, totals, period }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";

  return (
    <section className="dashboard-hero-card">
      <div className="dashboard-hero-card__content">
        <span className="dashboard-hero-card__month">
          {period?.date_from && period?.date_to
            ? `${period.date_from} - ${period.date_to}`
            : t("dashboard.user.hero.month")}
        </span>

        <h1>
          {t("dashboard.user.hero.title")} {user?.name ? `، ${user.name}` : ""}
        </h1>

        <p>{t("dashboard.user.hero.subtitle")}</p>

        <strong className="dashboard-hero-card__balance">
          {formatMoney(totals?.current_balance, totals?.currency_code, locale)}
        </strong>

        <small>{t("dashboard.user.hero.balanceLabel")}</small>
      </div>

      <div className="dashboard-hero-card__actions">
        {actions.map(({ key, icon: Icon }) => (
          <button type="button" key={key}>
            <Icon />
            <span>{t(`dashboard.user.hero.actions.${key}`)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
