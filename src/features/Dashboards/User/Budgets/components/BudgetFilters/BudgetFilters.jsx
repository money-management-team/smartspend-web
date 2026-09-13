import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSlidersHorizontal, LuX } from "react-icons/lu";

import {
  BUDGET_PROGRESS_STATUSES,
  BUDGET_SCOPES,
  BUDGET_STATUSES,
  getCurrencyOptions,
  hasActiveBudgetFilters,
} from "../../budgetHelpers";

// Same filter bar as the transactions ledger.
import "../../../FinancialOperations/components/TransactionFilters/TransactionFilters.css";
import "./BudgetFilters.css";

const hasMoreFilters = (filters) =>
  Boolean(filters.date_from || filters.date_to || filters.active_on || filters.owner);

/*
 * Backend filters for GET /budgets. The main row holds scope, category,
 * lifecycle status, progress status and currency; the period range, "active
 * on" and "only mine" sit behind "More filters", opened automatically when one
 * of them is set. The workspace isn't a control: the page always sends the
 * session workspace.
 */
export default function BudgetFilters({
  filters,
  categories,
  baseCurrency,
  onChange,
  onClear,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(() => hasMoreFilters(filters));
  const isMoreOpen = showMore || hasMoreFilters(filters);

  const currencies = getCurrencyOptions(baseCurrency, filters.currency_code);
  // Keep a filtered id visible even if it isn't among the listed categories.
  const hasCategory = categories.some((category) => String(category.id) === filters.category_id);
  const isRangeIncomplete = Boolean(filters.date_from) !== Boolean(filters.date_to);

  const handle = (event) => onChange({ [event.target.name]: event.target.value });

  const select = (name, label, allLabel, options) => (
    <label className="transaction-filters__field">
      <span>{label}</span>
      <select name={name} value={filters[name]} onChange={handle} disabled={disabled}>
        <option value="">{allLabel}</option>
        {options.map(({ value, label: optionLabel }) => (
          <option value={value} key={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="budget-filters">
      <div
        className="transaction-filters"
        role="group"
        aria-label={t("dashboard.transactions.filters.label")}
      >
        {select(
          "scope",
          t("dashboard.budgets.fields.scope"),
          t("dashboard.budgets.filters.allScopes"),
          BUDGET_SCOPES.map((scope) => ({ value: scope, label: t(`dashboard.budgets.scopes.${scope}`) })),
        )}

        <label className="transaction-filters__field">
          <span>{t("dashboard.budgets.fields.category")}</span>
          <select
            name="category_id"
            value={filters.category_id}
            onChange={handle}
            // A general budget has no category.
            disabled={disabled || filters.scope === "general"}
          >
            <option value="">{t("dashboard.transactions.filters.allCategories")}</option>
            {filters.category_id && !hasCategory && (
              <option value={filters.category_id}>#{filters.category_id}</option>
            )}
            {categories.map((category) => (
              <option value={String(category.id)} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {select(
          "status",
          t("dashboard.budgets.fields.status"),
          t("dashboard.transactions.filters.allStatuses"),
          BUDGET_STATUSES.map((status) => ({ value: status, label: t(`dashboard.budgets.status.${status}`) })),
        )}

        {select(
          "progress_status",
          t("dashboard.budgets.filters.progress"),
          t("dashboard.budgets.filters.allProgress"),
          BUDGET_PROGRESS_STATUSES.map((status) => ({
            value: status,
            label: t(`dashboard.budgets.progressStatus.${status}`),
          })),
        )}

        {select(
          "currency_code",
          t("dashboard.budgets.fields.currency"),
          t("dashboard.budgets.filters.allCurrencies"),
          currencies.map((code) => ({ value: code, label: code })),
        )}

        {isMoreOpen && (
          <>
            <label className="transaction-filters__field">
              <span>{t("dashboard.budgets.filters.periodFrom")}</span>
              <input
                type="date"
                name="date_from"
                value={filters.date_from}
                max={filters.date_to || undefined}
                onChange={handle}
                disabled={disabled}
                aria-describedby={isRangeIncomplete ? "budget-filters-range-hint" : undefined}
              />
            </label>

            <label className="transaction-filters__field">
              <span>{t("dashboard.budgets.filters.periodTo")}</span>
              <input
                type="date"
                name="date_to"
                value={filters.date_to}
                min={filters.date_from || undefined}
                onChange={handle}
                disabled={disabled}
                aria-describedby={isRangeIncomplete ? "budget-filters-range-hint" : undefined}
              />
            </label>

            <label className="transaction-filters__field">
              <span>{t("dashboard.budgets.filters.activeOn")}</span>
              <input
                type="date"
                name="active_on"
                value={filters.active_on}
                onChange={handle}
                disabled={disabled}
              />
            </label>

            {select(
              "owner",
              t("dashboard.budgets.filters.owner"),
              t("dashboard.budgets.filters.ownerAll"),
              [{ value: "mine", label: t("dashboard.budgets.filters.ownerMine") }],
            )}
          </>
        )}

        <div className="budget-filters__actions">
          {/* Can't be folded away while one of its filters is set. */}
          {!hasMoreFilters(filters) && (
            <button
              type="button"
              className="transaction-filters__clear"
              onClick={() => setShowMore((current) => !current)}
              aria-expanded={isMoreOpen}
              disabled={disabled}
            >
              <LuSlidersHorizontal aria-hidden="true" />
              <span>
                {t(
                  isMoreOpen
                    ? "dashboard.budgets.filters.lessFilters"
                    : "dashboard.budgets.filters.moreFilters",
                )}
              </span>
            </button>
          )}

          {hasActiveBudgetFilters(filters) && (
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
      </div>

      {isRangeIncomplete && (
        <p className="budget-filters__hint" id="budget-filters-range-hint" role="status">
          {t("dashboard.budgets.filters.rangeHint")}
        </p>
      )}
    </div>
  );
}
