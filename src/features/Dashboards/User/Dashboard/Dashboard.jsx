import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import DashboardHero from "./components/DashboardHero/DashboardHero";
import SummaryCards from "./components/SummaryCards/SummaryCards";
import MoneyDistribution from "./components/MoneyDistribution/MoneyDistribution";
import GeneralStats from "./components/GeneralStats/GeneralStats";
import CashFlowChart from "./components/CashFlowChart/CashFlowChart";
import ExpenseCategories from "./components/ExpenseCategories/ExpenseCategories";
import BudgetProgress from "./components/BudgetProgress/BudgetProgress";
import SavingsGoals from "./components/SavingsGoals/SavingsGoals";
import RecentTransactions from "./components/RecentTransactions/RecentTransactions";
import { dashboardApi } from "../api/dashboardApi";
import {
  getApiErrorMessage,
  getStoredWorkspace,
} from "../api/apiClient";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import "./Dashboard.css";
import Loading from "../../../../components/Loading/Loading";

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, updateWorkspace } = useAuthContext();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (signal) => {
    try {
      const dashboardResponse = await dashboardApi.get({}, { signal });

      setDashboard(dashboardResponse.data);
      setError("");

      const workspaceId =
        dashboardResponse.data?.scope?.workspace_id ??
        dashboardResponse.data?.scope?.workspace_ids?.[0];

      if (workspaceId) {
        updateWorkspace({
          ...(getStoredWorkspace() ?? {}),
          id: workspaceId,
          base_currency_code:
            dashboardResponse.data?.scope?.primary_currency_code,
          timezone: dashboardResponse.data?.period?.timezone,
        });
      }
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(getApiErrorMessage(requestError, t));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [t, updateWorkspace]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  const handleRetry = () => {
    setIsLoading(true);
    setError("");
    void loadDashboard();
  };

  if (isLoading) {
    return (
      <Loading message={false} />
    );
  }

  if (error) {
    return (
      <div className="user-dashboard__state user-dashboard__state--error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={handleRetry}>
          {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="user-dashboard">
      <DashboardHero user={user} totals={dashboard?.totals} period={dashboard?.period} />
      <SummaryCards accounts={dashboard?.accounts ?? []} />
      <MoneyDistribution accounts={dashboard?.accounts ?? []} />
      <GeneralStats
        totals={dashboard?.totals}
        categories={dashboard?.breakdown?.by_category ?? []}
        transactions={dashboard?.recent_transactions ?? []}
        period={dashboard?.period}
      />

      <div className="user-dashboard__charts-grid">
        <CashFlowChart totals={dashboard?.totals} period={dashboard?.period} />
        <ExpenseCategories
          categories={dashboard?.breakdown?.by_category ?? []}
          currency={dashboard?.totals?.currency_code}
        />
      </div>

      <div className="user-dashboard__three-grid">
        <BudgetProgress budgets={dashboard?.planning?.budgets?.items ?? []} />
        <SavingsGoals goals={dashboard?.planning?.savings_goals?.items ?? []} />
      </div>

      <div className="user-dashboard__bottom-grid">
        <RecentTransactions transactions={dashboard?.recent_transactions ?? []} />
      </div>
    </div>
  );
}
