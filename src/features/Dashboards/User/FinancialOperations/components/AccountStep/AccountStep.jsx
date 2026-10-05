import PrivateMoney from "../../../Experience/PrivateMoney";
import { LuChevronDown } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PATH } from "../../../../../../routes/Path";
import { getApiErrorMessage } from "../../../api/apiClient";
import { getDisplayLocale, isNegativeMoney } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";
import "./AccountStep.css";

// The same active-account selection, presented as one compact native control.
export default function AccountStep({ accounts, selectedAccountId, onSelect,
  isLoading, error, onRetry, selectorRef }) {
  const { t, i18n } = useTranslation();
  const selected = accounts.find((item) => String(item.id) === selectedAccountId);
  return (
    <div className="account-step" ref={selectorRef}>
      <label className="capture-selector">
        <span>{t("dashboard.transactions.fields.account")}</span>
        <div className="capture-selector__control">
          <select id="operation-account" value={selectedAccountId}
            onChange={(event) => onSelect(event.target.value)}
            disabled={isLoading || accounts.length === 0}
            aria-describedby={selected ? "operation-account-balance" : undefined}>
            <option value="" disabled>
              {t(isLoading ? "dashboard.financialOperations.accountStep.loading"
                : "dashboard.financialOperations.ui.chooseAccount")}
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={String(account.id)}>
                {account.name} · {account.currency_code}
              </option>
            ))}
          </select>
          <LuChevronDown aria-hidden="true" />
        </div>
      </label>
      {selected && (
        <p id="operation-account-balance" className="account-step__balance">
          {t("dashboard.financialOperations.accountStep.balance")}
          <bdi className={isNegativeMoney(selected.current_balance) ? "account-step__negative" : undefined}>
            <PrivateMoney>{formatMoney(selected.current_balance, selected.currency_code,
              getDisplayLocale(i18n.language))}</PrivateMoney>
          </bdi>
        </p>
      )}
      {!isLoading && error && (
        <p className="account-step__message" role="alert">
          {getApiErrorMessage(error, t)} <button type="button" onClick={onRetry}>{t("common.retry")}</button>
        </p>
      )}
      {!isLoading && !error && accounts.length === 0 && (
        <p className="account-step__message">
          {t("dashboard.financialOperations.accountStep.empty")} <Link to={PATH.USER.ACCOUNTS}>
            {t("dashboard.financialOperations.accountStep.addAccount")}
          </Link>
        </p>
      )}
    </div>
  );
}
