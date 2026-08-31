import { useTranslation } from "react-i18next";
import {
  LuPlus,
  LuMinus,
  LuArrowRightLeft,
  LuTarget,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { PATH } from "../../../../../../routes/Path";

import "./DashboardHero.css";
import { formatMoney } from "../../../utils/formatters";

const actions = [
  { key: "income", icon: LuPlus, path: PATH.USER.FINANCIAL_OPERATIONS },
  { key: "expense", icon: LuMinus, path: PATH.USER.FINANCIAL_OPERATIONS },
  { key: "transfer", icon: LuArrowRightLeft, path: PATH.USER.FINANCIAL_OPERATIONS },
  { key: "goal", icon: LuTarget, path: PATH.USER.SAVINGS_GOALS },
];

export default function DashboardHero({ user, totals, period }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";

  return (
    <section className="dashboard-hero-card">
      <div className="dashboard-hero-card__content">
        <span className="dashboard-hero-card__month">
          {period?.date_from && period?.date_to
            ? `${period.date_from} - ${period.date_to}`
            : t("dashboard.user.hero.month")}
        </span>

        <h1>{t("dashboard.user.hero.welcome", { name: user?.name ?? "" })}</h1>

        <p>{t("dashboard.user.hero.subtitle")}</p>

        <strong className="dashboard-hero-card__balance">
          {formatMoney(totals?.current_balance, totals?.currency_code, locale)}
        </strong>

        <small>{t("dashboard.user.hero.balanceLabel")}</small>
      </div>

      <div className="dashboard-hero-card__actions">
        {actions.map(({ key, icon: Icon, path }) => (
          <button type="button" key={key} onClick={() => navigate(path)}>
            <Icon />
            <span>{t(`dashboard.user.hero.actions.${key}`)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
