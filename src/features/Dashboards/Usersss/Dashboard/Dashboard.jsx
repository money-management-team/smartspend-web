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

import "./Dashboard.css";

export default function Dashboard() {
  return (
    <div className="user-dashboard">
      <DashboardHero />
      <SummaryCards />
      <MoneyDistribution />
      <GeneralStats />

      <div className="user-dashboard__charts-grid">
        <CashFlowChart />
        <ExpenseCategories />
      </div>

      <div className="user-dashboard__three-grid">
        <BudgetProgress />
        <SavingsGoals />
        <UpcomingBills />
      </div>

      <div className="user-dashboard__bottom-grid">
        <RecentTransactions />
        <AIInsights />
      </div>
    </div>
  );
}
