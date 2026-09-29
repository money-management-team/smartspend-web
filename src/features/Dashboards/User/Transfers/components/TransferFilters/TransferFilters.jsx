import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import { ACCOUNT_CURRENCIES } from "../../../Accounts/accountHelpers";
import { TRANSFER_STATUSES, hasActiveTransferFilters } from "../../transferHelpers";

// Same filter bar as the transactions ledger.
import "../../../FinancialOperations/components/TransactionFilters/TransactionFilters.css";

/*
 * Backend filters for GET /transfers: source account, destination account,
 * status, currency and the occurred_at date range. Account options come from
 * the Accounts API (active accounts); a filtered id that isn't among them
 * (e.g. an archived account) stays selectable as "#id".
 */
export default function TransferFilters({ filters, accounts, onChange, onClear, disabled = false }) {
  const { t } = useTranslation();

  const currencies = [
    ...new Set(
      [...ACCOUNT_CURRENCIES, ...accounts.map((account) => account?.currency_code), filters.currency_code]
        .filter((code) => /^[A-Z]{3}$/.test(code ?? "")),
    ),
  ];

  const handle = (event) => onChange({ [event.target.name]: event.target.value });

  const renderAccountSelect = (name, label) => {
    const value = filters[name];
    const isListed = accounts.some((account) => String(account.id) === value);

    return (
      <label className="transaction-filters__field">
        <span>{label}</span>
        <select name={name} value={value} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.transactions.filters.allAccounts")}</option>
          {value && !isListed && <option value={value}>#{value}</option>}
          {accounts.map((account) => (
            <option value={String(account.id)} key={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <div
      className="transaction-filters"
      role="group"
      aria-label={t("dashboard.transactions.filters.label")}
    >
      {renderAccountSelect("from_account_id", t("dashboard.transfers.fields.fromAccount"))}
      {renderAccountSelect("to_account_id", t("dashboard.transfers.fields.toAccount"))}

      <label className="transaction-filters__field">
        <span>{t("dashboard.transfers.fields.status")}</span>
        <select name="status" value={filters.status} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.transactions.filters.allStatuses")}</option>
          {TRANSFER_STATUSES.map((status) => (
            <option value={status} key={status}>
              {t(`dashboard.transfers.statuses.${status}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="transaction-filters__field">
        <span>{t("dashboard.transfers.fields.currency")}</span>
        <select
          name="currency_code"
          value={filters.currency_code}
          onChange={handle}
          disabled={disabled}
        >
          <option value="">{t("dashboard.transfers.filters.allCurrencies")}</option>
          {currencies.map((code) => (
            <option value={code} key={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <label className="transaction-filters__field">
        <span>{t("dashboard.transactions.filters.dateFrom")}</span>
        <input
          type="date"
          name="date_from"
          value={filters.date_from}
          max={filters.date_to || undefined}
          onChange={handle}
          disabled={disabled}
        />
      </label>

      <label className="transaction-filters__field">
        <span>{t("dashboard.transactions.filters.dateTo")}</span>
        <input
          type="date"
          name="date_to"
          value={filters.date_to}
          min={filters.date_from || undefined}
          onChange={handle}
          disabled={disabled}
        />
      </label>

      {hasActiveTransferFilters(filters) && (
        <button
          type="button"
          className="transaction-filters__clear"
          onClick={onClear}
          disabled={disabled}
        >
          <LuX aria-hidden="true" />
          <span>{t("dashboard.transactions.filters.clear")}</span>
        </button>
      )}
    </div>
  );
}
