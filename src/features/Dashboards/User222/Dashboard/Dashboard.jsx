import { useCallback, useEffect, useState } from "react";

import DashboardHero from "./components/DashboardHero/DashboardHero";
import SummaryCards from "./components/SummaryCards/SummaryCards";
import MoneyDistribution from "./components/MoneyDistribution/MoneyDistribution";
import GeneralStats from "./components/GeneralStats/GeneralStats";
import CashFlowChart from "./components/CashFlowChart/CashFlowChart";
import ExpenseCategories from "./components/ExpenseCategories/ExpenseCategories";
import BudgetProgress from "./components/BudgetProgress/BudgetProgress";
import SavingsGoals from "./components/SavingsGoals/SavingsGoals";
import UpcomingBills from "./components/UpcomingBills/UpcomingBills";
import RecentTransactions from "./components/RecentTransactions/RecentTransactions";
import AIInsights from "./components/AIInsights/AIInsights";
import { dashboardApi } from "../api/dashboardApi";
import { authApi } from "../api/authApi";

import "./Dashboard.css";

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) ?? null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const [dashboardResponse, userResponse] = await Promise.all([
        dashboardApi.get({}, { signal }),
        authApi.getCurrentUser({ signal }),
      ]);

      setDashboard(dashboardResponse.data);
      setUser(userResponse.data);
      localStorage.setItem("user", JSON.stringify(userResponse.data));

      const workspaceId =
        dashboardResponse.data?.scope?.workspace_id ??
        dashboardResponse.data?.scope?.workspace_ids?.[0];

      if (workspaceId) {
        let storedWorkspace = {};
        try {
          storedWorkspace = JSON.parse(localStorage.getItem("workspace")) ?? {};
        } catch {
          storedWorkspace = {};
        }

        localStorage.setItem(
          "workspace",
          JSON.stringify({ ...storedWorkspace, id: workspaceId }),
        );
      }
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  if (isLoading) {
    return <div className="user-dashboard__state">جارٍ تحميل لوحة المعلومات...</div>;
  }

  if (error) {
    return (
      <div className="user-dashboard__state user-dashboard__state--error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => loadDashboard()}>إعادة المحاولة</button>
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
        <BudgetProgress />
        <SavingsGoals />
        <UpcomingBills />
      </div>

      <div className="user-dashboard__bottom-grid">
        <RecentTransactions transactions={dashboard?.recent_transactions ?? []} />
        <AIInsights />
      </div>
    </div>
  );
}
