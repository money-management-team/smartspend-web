import { createElement } from "react";
import { useTranslation } from "react-i18next";
import {
  LuPlus,
  LuMinus,
  LuArrowRightLeft,
  LuTarget,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import {
  getNewOperationPath,
  getNewSavingsGoalPath,
  getNewTransferPath,
} from "../../../../../../routes/Path";

import "./DashboardHero.css";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate } from "../../../utils/formatters";
import { formatOptionalMoney } from "../../dashboardHelpers";

const actions = [
  { key: "income", icon: LuPlus, path: getNewOperationPath("income") },
  { key: "expense", icon: LuMinus, path: getNewOperationPath("expense") },
  { key: "transfer", icon: LuArrowRightLeft, path: getNewTransferPath() },
  { key: "goal", icon: LuTarget, path: getNewSavingsGoalPath() },
];

// `totals.current_balance` is the backend's figure, shown as sent.
export default function DashboardHero({ user, totals, period, periodLabel, multiCurrency }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = getDisplayLocale(i18n.language);
  const range =
    period?.date_from && period?.date_to
      ? `${formatDate(period.date_from, locale)} – ${formatDate(period.date_to, locale)}`
      : "";

  return (
    <section className="dashboard-hero-card">
      <div className="dashboard-hero-card__content">
        {(periodLabel || range) && (
          <span className="dashboard-hero-card__month">
            {periodLabel}
            {periodLabel && range && " · "}
            {range && <bdi>{range}</bdi>}
          </span>
        )}

        <h1>{t("dashboard.user.hero.welcome", { name: user?.name ?? "" })}</h1>

        <p>{t("dashboard.user.hero.subtitle")}</p>

        <strong className="dashboard-hero-card__balance">
          <bdi>{formatOptionalMoney(totals?.current_balance, totals?.currency_code, locale)}</bdi>
        </strong>

        <small>
          {multiCurrency && totals?.currency_code
            ? t("dashboard.user.hero.balanceInCurrency", { currency: totals.currency_code })
            : t("dashboard.user.hero.balanceLabel")}
        </small>
      </div>

      <div className="dashboard-hero-card__actions">
        {actions.map(({ key, icon, path }) => (
          <button type="button" key={key} onClick={() => navigate(path)}>
            {createElement(icon)}
            <span>{t(`dashboard.user.hero.actions.${key}`)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
