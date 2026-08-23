import BudgetsHeader from "./components/BudgetsHeader/BudgetsHeader";
import BudgetSummary from "./components/BudgetSummary/BudgetSummary";
import BudgetList from "./components/BudgetList/BudgetList";

import "./Budgets.css";

export default function Budgets() {
  return (
    <div className="budgets-page">
      <BudgetsHeader />

      <BudgetSummary />

      <BudgetList />
    </div>
  );
}