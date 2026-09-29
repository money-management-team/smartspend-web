import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import DashboardHero from "./components/DashboardHero/DashboardHero";
import DashboardPeriodFilter from "./components/DashboardPeriodFilter/DashboardPeriodFilter";
import CurrencySummary from "./components/CurrencySummary/CurrencySummary";
import SummaryCards from "./components/SummaryCards/SummaryCards";
import MoneyDistribution from "./components/MoneyDistribution/MoneyDistribution";
import GeneralStats from "./components/GeneralStats/GeneralStats";
import CashFlowChart from "./components/CashFlowChart/CashFlowChart";
import ExpenseCategories from "./components/ExpenseCategories/ExpenseCategories";
import BudgetProgress from "./components/BudgetProgress/BudgetProgress";
import SavingsGoals from "./components/SavingsGoals/SavingsGoals";
import RecurringCommitments from "./components/RecurringCommitments/RecurringCommitments";
import RecentTransactions from "./components/RecentTransactions/RecentTransactions";
import FinancialAlerts from "./components/FinancialAlerts/FinancialAlerts";
import { dashboardApi } from "../api/dashboardApi";
import { ApiError, getApiErrorMessage, getStoredWorkspace } from "../api/apiClient";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import {
  dashboardFiltersToQuery,
  dashboardFiltersToSearchParams,
  getBlockItems,
  getCurrencySummaries,
  getPeriodLabel,
  getPrimaryCurrency,
  getScopeWorkspaceId,
  isMultiCurrency,
  readDashboardFilters,
} from "./dashboardHelpers";
import "./Dashboard.css";
import Loading from "../../../../components/Loading/Loading";

/*
 * GET /dashboard for the period in the URL (`?period=`, and for custom
 * `?date_from=&date_to=`). Every figure is the backend's: nothing is summed,
 * converted or recalculated here. Transfers are shown on their own, never as
 * income or expense, and several currencies are listed per currency.
 *
 * While another period loads, the previous figures stay visible (dimmed) so
 * the page doesn't jump; they are replaced as soon as the response arrives.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const { user, workspace, updateWorkspace } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readDashboardFilters(searchParams);
  const filterKey = dashboardFiltersToSearchParams(filters).toString();

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const query = dashboardFiltersToQuery(readDashboardFilters(new URLSearchParams(filterKey)));

    dashboardApi
      .get(query, { signal: controller.signal })
      .then((response) => {
        const data = response?.data;

        if (!data || typeof data !== "object") {
          setResult({ key: requestKey, data: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) });
          return;
        }

        // Remember the workspace only when the dashboard is scoped to one.
        const workspaceId = getScopeWorkspaceId(data.scope);
        if (workspaceId != null) {
          const stored = getStoredWorkspace() ?? {};
          updateWorkspace({
            ...stored,
            id: workspaceId,
            base_currency_code: data.scope?.primary_currency_code ?? stored.base_currency_code,
            timezone: data.period?.timezone ?? stored.timezone,
          });
        }

        setResult({ key: requestKey, data, error: null });
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, data: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey, updateWorkspace]);

  const isLoading = result.key !== requestKey;
  // `data` is the last successful response (null after an error).
  const { data, error } = result;

  const changePeriod = (next) => setSearchParams(dashboardFiltersToSearchParams(next));
  const retry = () => setReloadKey((key) => key + 1);

  const periodLabel = getPeriodLabel(t, data?.period, filters.period);
  const multiCurrency = isMultiCurrency(data);
  const currencyRows = getCurrencySummaries(data);
  const primaryCurrency = getPrimaryCurrency(data);

  return (
    <div className="user-dashboard">
      <DashboardPeriodFilter
        key={filterKey}
        filters={filters}
        period={isLoading ? null : data?.period}
        onChange={changePeriod}
        disabled={isLoading}
      />

      {isLoading && !data && <Loading message={t("dashboard.user.states.loading")} />}

      {!isLoading && error && (
        <div className="user-dashboard__state user-dashboard__state--error" role="alert">
          <p>{getApiErrorMessage(error, t)}</p>
          <button type="button" onClick={retry}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {data && (
        <div
          className={`user-dashboard__content${isLoading ? " user-dashboard__content--stale" : ""}`}
          aria-busy={isLoading}
        >
          {isLoading && (
            <p className="user-dashboard__refreshing" role="status">
              {t("dashboard.user.states.refreshing")}
            </p>
          )}

          <DashboardHero
            user={user}
            totals={data.totals}
            period={data.period}
            periodLabel={periodLabel}
            multiCurrency={multiCurrency}
          />

          {multiCurrency && currencyRows.length > 0 && (
            <CurrencySummary rows={currencyRows} primaryCurrency={primaryCurrency} />
          )}

          <SummaryCards totals={data.totals} />

          <MoneyDistribution accounts={Array.isArray(data.accounts) ? data.accounts : []} />

          <GeneralStats totals={data.totals} transfers={data.transfers} />

          <div className="user-dashboard__charts-grid">
            <CashFlowChart totals={data.totals} periodLabel={periodLabel} />
            <ExpenseCategories
              categories={getBlockItems(data.breakdown?.by_category)}
              currency={primaryCurrency}
            />
          </div>

          <div className="user-dashboard__three-grid">
            <BudgetProgress budgets={getBlockItems(data.planning?.budgets)} />
            <SavingsGoals goals={getBlockItems(data.planning?.savings_goals)} />
            <RecurringCommitments block={data.commitments?.recurring} />
          </div>

          <div className="user-dashboard__bottom-grid">
            <RecentTransactions
              transactions={Array.isArray(data.recent_transactions) ? data.recent_transactions : []}
            />
            <FinancialAlerts workspaceId={workspace?.id} variant="compact" />
          </div>
        </div>
      )}
    </div>
  );
}
