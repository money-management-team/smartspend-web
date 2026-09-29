import { LuSparkles, LuTrendingUp } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";

import "./OperationsIntro.css";

// Step 1 is reached as soon as the page opens; the rest follow the account.
const FLOW_STEPS = ["account", "input", "review", "confirm"];

/*
 * Page hero: what this page does, the four-step flow of the capture card and
 * today's expense total (GET /transactions for today, summed per currency by
 * the page).
 */
export default function OperationsIntro({ today, hasAccount }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  const [main, ...others] = today.totals;

  return (
    <section className="operations-intro">
      <div className="operations-intro__copy">
        <span className="operations-intro__kicker">
          <LuSparkles aria-hidden="true" />
          {t("dashboard.financialOperations.intro.kicker")}
        </span>

        <h1>{t("dashboard.financialOperations.intro.title")}</h1>
        <p>{t("dashboard.financialOperations.intro.description")}</p>

        <div className="operations-intro__flow">
          <span className="operations-intro__flow-label">
            {t("dashboard.financialOperations.intro.flow")}
          </span>

          {FLOW_STEPS.map((step, index) => {
            const isActive = index === 0 || hasAccount;

            return (
              <div className="operations-intro__flow-item" key={step}>
                {index > 0 && <i className="operations-intro__flow-line" aria-hidden="true" />}

                <span
                  className={
                    isActive
                      ? "operations-intro__flow-step operations-intro__flow-step--active"
                      : "operations-intro__flow-step"
                  }
                >
                  <b>{index + 1}</b>
                  {t(`dashboard.financialOperations.intro.steps.${step}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="operations-intro__today">
        <span className="operations-intro__today-icon" aria-hidden="true">
          <LuTrendingUp />
        </span>

        <div className="operations-intro__today-value">
          <span>{t("dashboard.financialOperations.today.label")}</span>

          {today.isLoading ? (
            <strong className="operations-intro__today-placeholder">
              {t("dashboard.financialOperations.today.loading")}
            </strong>
          ) : today.error ? (
            <strong className="operations-intro__today-placeholder">
              {t("dashboard.financialOperations.today.unavailable")}
            </strong>
          ) : (
            <strong dir="ltr">
              {formatMoney(main?.amount ?? 0, main?.currency ?? today.currency, locale)}
            </strong>
          )}
        </div>

        <small>
          {others.length > 0
            ? t("dashboard.financialOperations.today.more", { extra: others.length })
            : t("dashboard.financialOperations.today.updated")}
        </small>
      </div>
    </section>
  );
}
