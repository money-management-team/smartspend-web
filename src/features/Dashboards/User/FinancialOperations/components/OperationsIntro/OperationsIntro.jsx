import PrivateMoney from "../../../Experience/PrivateMoney";
import { LuArrowLeftRight, LuTrendingUp } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";
import "./OperationsIntro.css";

// Today's figures still come from the existing paginated, per-currency loader.
export default function OperationsIntro({ today }) {
  const { t, i18n } = useTranslation();
  const [main, ...others] = today.totals;
  return (
    <section className="operations-intro" aria-labelledby="operations-page-title">
      <div className="operations-intro__copy">
        <span className="operations-intro__icon" aria-hidden="true"><LuArrowLeftRight /></span>
        <div>
          <span className="operations-intro__kicker">{t("dashboard.financialOperations.ui.heroKicker")}</span>
          <h1 id="operations-page-title">{t("dashboard.transactions.title")}</h1>
          <p>{t("dashboard.financialOperations.ui.heroDescription")}</p>
        </div>
      </div>
      <div className="operations-intro__today">
        <span className="operations-intro__today-label"><LuTrendingUp aria-hidden="true" />
          {t("dashboard.financialOperations.today.label")}</span>
        {today.isLoading || today.error ? (
          <strong className="operations-intro__today-placeholder">
            {t(today.isLoading ? "dashboard.financialOperations.today.loading"
              : "dashboard.financialOperations.today.unavailable")}
          </strong>
        ) : (
          <strong><bdi dir="ltr"><PrivateMoney>{formatMoney(main?.amount ?? 0,
            main?.currency ?? today.currency, getDisplayLocale(i18n.language))}</PrivateMoney></bdi></strong>
        )}
        {others.length > 0 && <small>{t("dashboard.financialOperations.today.more", { extra: others.length })}</small>}
      </div>
    </section>
  );
}
