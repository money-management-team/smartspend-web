import { useTranslation } from "react-i18next";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { getBudgetErrorMessage } from "../../budgetHelpers";
import BudgetCard from "./BudgetCard";

import "./BudgetList.css";

/*
 * The budgets panel: the filters (`filters` slot), loading, error, empty and
 * the cards of the current page, with pagination when the backend returns
 * more than one page.
 */
export default function BudgetList({
  listPage,
  isLoading,
  error,
  filters,
  isFiltered = false,
  onClearFilters,
  onRetry,
  onCreate,
  onGoToPage,
  onEdit,
  onArchive,
}) {
  const { t } = useTranslation();
  const items = listPage?.items ?? [];

  return (
    <section className="budget-list" aria-labelledby="budget-list-title">
      <header className="budget-list__header">
        <h2 id="budget-list-title">
          {t("dashboard.budgets.list.title")}
          {listPage && !isLoading && <span className="budget-list__count">{listPage.total}</span>}
        </h2>
        <p>{t("dashboard.budgets.list.subtitle")}</p>
      </header>

      {filters}

      {isLoading && <Loading message={t("dashboard.budgets.states.loading")} />}

      {!isLoading && error && (
        <div className="budget-list__state budget-list__state--error" role="alert">
          <p>{getBudgetErrorMessage(error, t)}</p>
          <div className="budget-list__state-actions">
            <button type="button" onClick={onRetry}>
              {t("common.retry")}
            </button>
            {isFiltered && (
              <button type="button" onClick={onClearFilters}>
                {t("dashboard.transactions.filters.clear")}
              </button>
            )}
          </div>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="budget-list__state">
          {listPage && listPage.total > 0 && listPage.page > 1 ? (
            <>
              <p>{t("dashboard.budgets.states.emptyPage")}</p>
              <button type="button" onClick={() => onGoToPage(1)}>
                {t("dashboard.transactions.pagination.first")}
              </button>
            </>
          ) : isFiltered ? (
            <>
              <p>{t("dashboard.budgets.states.emptyFiltered")}</p>
              <button type="button" onClick={onClearFilters}>
                {t("dashboard.transactions.filters.clear")}
              </button>
            </>
          ) : (
            <>
              <p>{t("dashboard.budgets.states.empty")}</p>
              <button type="button" onClick={onCreate}>
                {t("dashboard.budgets.create")}
              </button>
            </>
          )}
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="budget-list__grid">
          {items.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={() => onEdit(budget)}
              onArchive={() => onArchive(budget)}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && listPage && listPage.lastPage > 1 && (
        <footer className="budget-list__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", {
              from: listPage.from,
              to: listPage.to,
              total: listPage.total,
            })}
          </span>

          <div className="budget-list__pages">
            <button
              type="button"
              onClick={() => onGoToPage(listPage.page - 1)}
              disabled={listPage.page <= 1}
              aria-label={t("dashboard.transactions.pagination.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {t("dashboard.transactions.pagination.page", {
                page: listPage.page,
                lastPage: listPage.lastPage,
              })}
            </span>
            <button
              type="button"
              onClick={() => onGoToPage(listPage.page + 1)}
              disabled={listPage.page >= listPage.lastPage}
              aria-label={t("dashboard.transactions.pagination.next")}
            >
              <LuChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
