import { useTranslation } from "react-i18next";
import {
  LuPlus,
  LuMinus,
  LuArrowRightLeft,
  LuTarget,
} from "react-icons/lu";

import "./DashboardHero.css";

const actions = [
  { key: "income", icon: LuPlus },
  { key: "expense", icon: LuMinus },
  { key: "transfer", icon: LuArrowRightLeft },
  { key: "goal", icon: LuTarget },
];

export default function DashboardHero() {
  const { t } = useTranslation();

  return (
    <section className="dashboard-hero-card">
      <div className="dashboard-hero-card__content">
        <span className="dashboard-hero-card__month">
          {t("dashboard.user.hero.month")}
        </span>

        <h1>{t("dashboard.user.hero.title")}</h1>

        <p>{t("dashboard.user.hero.subtitle")}</p>

        <strong className="dashboard-hero-card__balance">
          {t("dashboard.user.hero.balance")}
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
