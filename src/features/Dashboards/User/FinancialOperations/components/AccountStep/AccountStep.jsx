import { LuCheck } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import Loading from "../../../../../../components/Loading/Loading";
import { PATH } from "../../../../../../routes/Path";
import { getApiErrorMessage } from "../../../api/apiClient";
import {
  getAccountColor,
  getDisplayLocale,
  isNegativeMoney,
  renderAccountIcon,
} from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";

import "./AccountStep.css";

/*
 * Step 1: the account every operation on this page is booked on. The list is
 * the active accounts from GET /accounts; balances stay the backend's decimal
 * strings and are only formatted for display.
 */
export default function AccountStep({
  accounts,
  selectedAccountId,
  onSelect,
  isLoading,
  error,
  onRetry,
}) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const hasSelection = Boolean(selectedAccountId);

  return (
    <section
      className={hasSelection ? "account-step account-step--complete" : "account-step"}
      aria-labelledby="account-step-title"
    >
      <header className="step-heading">
        <span className="step-heading__number" aria-hidden="true">1</span>

        <div className="step-heading__copy">
          <h2 id="account-step-title">
            {t("dashboard.financialOperations.accountStep.title")}
          </h2>
          <p>{t("dashboard.financialOperations.accountStep.description")}</p>
        </div>

        {hasSelection && (
          <span className="step-heading__done">
            <LuCheck aria-hidden="true" />
            {t("dashboard.financialOperations.accountStep.selected")}
          </span>
        )}
      </header>

      {isLoading && (
        <Loading message={t("dashboard.financialOperations.accountStep.loading")} />
      )}

      {!isLoading && error && (
        <div className="account-step__state account-step__state--error" role="alert">
          <p>{getApiErrorMessage(error, t)}</p>
          <button type="button" onClick={onRetry}>{t("common.retry")}</button>
        </div>
      )}

      {!isLoading && !error && accounts.length === 0 && (
        <div className="account-step__state">
          <p>{t("dashboard.financialOperations.accountStep.empty")}</p>
          <Link to={PATH.USER.ACCOUNTS}>
            {t("dashboard.financialOperations.accountStep.addAccount")}
          </Link>
        </div>
      )}

      {!isLoading && !error && accounts.length > 0 && (
        <div className="account-step__grid">
          {accounts.map((account) => {
            const color = getAccountColor(account);
            const isSelected = String(account.id) === String(selectedAccountId);

            return (
              <button
                type="button"
                key={account.id}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? "account-option account-option--selected"
                    : "account-option"
                }
                style={color ? { "--account-color": color } : undefined}
                onClick={() => onSelect(String(account.id))}
              >
                <span className="account-option__icon" aria-hidden="true">
                  {renderAccountIcon(account)}
                </span>

                <span className="account-option__copy">
                  <strong dir="auto">{account.name}</strong>
                  <small dir="ltr">
                    {t(`dashboard.accounts.types.${account.type}`, {
                      defaultValue: account.type,
                    })}
                    {account.last_four_digits && ` •••• ${account.last_four_digits}`}
                  </small>
                </span>

                <span className="account-option__balance">
                  <small>{t("dashboard.financialOperations.accountStep.balance")}</small>
                  <b
                    className={
                      isNegativeMoney(account.current_balance)
                        ? "account-option__amount account-option__amount--negative"
                        : "account-option__amount"
                    }
                    dir="ltr"
                  >
                    {formatMoney(account.current_balance, account.currency_code, locale)}
                  </b>
                </span>

                <span className="account-option__indicator" aria-hidden="true">
                  {isSelected && <LuCheck />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
