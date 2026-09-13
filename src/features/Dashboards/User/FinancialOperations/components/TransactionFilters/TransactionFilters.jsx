import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import {
  SORT_OPTIONS,
  TRANSACTION_STATUSES,
  hasActiveFilters,
} from "../../transactionHelpers";

import "./TransactionFilters.css";

/*
 * Backend filters for GET /transactions (account, category, status, date
 * range, sort). The type chips live in the ledger header. Options come from
 * the Accounts and Categories APIs (active items only).
 */
export default function TransactionFilters({
  filters,
  accounts,
  categories,
  onChange,
  onClear,
  disabled = false,
}) {
  const { t } = useTranslation();

  const categoryGroups = ["income", "expense"]
    .filter((type) => !filters.type || filters.type === type)
    .map((type) => ({
      type,
      items: categories.filter((category) => category.type === type),
    }))
    .filter((group) => group.items.length > 0);

  // Keep a filtered id visible even if it isn't in the active lists.
  const hasAccount = accounts.some((account) => String(account.id) === filters.account_id);
  const hasCategory = categoryGroups.some((group) =>
    group.items.some((category) => String(category.id) === filters.category_id),
  );

  const handle = (event) => onChange({ [event.target.name]: event.target.value });

  return (
    <div className="transaction-filters" role="group" aria-label={t("dashboard.transactions.filters.label")}>
      <label className="transaction-filters__field">
        <span>{t("dashboard.transactions.fields.account")}</span>
        <select name="account_id" value={filters.account_id} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.transactions.filters.allAccounts")}</option>
          {filters.account_id && !hasAccount && (
            <option value={filters.account_id}>#{filters.account_id}</option>
          )}
          {accounts.map((account) => (
            <option value={String(account.id)} key={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label className="transaction-filters__field">
        <span>{t("dashboard.transactions.fields.category")}</span>
        <select name="category_id" value={filters.category_id} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.transactions.filters.allCategories")}</option>
          {filters.category_id && !hasCategory && (
            <option value={filters.category_id}>#{filters.category_id}</option>
          )}
          {categoryGroups.map((group) => (
            <optgroup label={t(`dashboard.transactions.types.${group.type}`)} key={group.type}>
              {group.items.map((category) => (
                <option value={String(category.id)} key={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="transaction-filters__field">
        <span>{t("dashboard.transactions.fields.status")}</span>
        <select name="status" value={filters.status} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.transactions.filters.allStatuses")}</option>
          {TRANSACTION_STATUSES.map((status) => (
            <option value={status} key={status}>
              {t(`dashboard.transactions.statuses.${status}`)}
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

      <label className="transaction-filters__field">
        <span>{t("dashboard.transactions.filters.sort")}</span>
        <select name="sort" value={filters.sort} onChange={handle} disabled={disabled}>
          {SORT_OPTIONS.map((option) => (
            <option value={option} key={option}>
              {t(`dashboard.transactions.filters.sortOptions.${option.replace(":", "_")}`)}
            </option>
          ))}
        </select>
      </label>

      {hasActiveFilters(filters) && (
        <button type="button" className="transaction-filters__clear" onClick={onClear} disabled={disabled}>
          <LuX aria-hidden="true" />
          <span>{t("dashboard.transactions.filters.clear")}</span>
        </button>
      )}
    </div>
  );
}
