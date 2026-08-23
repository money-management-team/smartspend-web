import { useState } from "react";

import ReportsHeader from "./components/ReportsHeader/ReportsHeader";
import ReportsSummary from "./components/ReportsSummary/ReportsSummary";
import ReportTabs from "./components/ReportTabs/ReportTabs";
import MonthlyReportChart from "./components/MonthlyReportChart/MonthlyReportChart";
import ExpenseCategoriesTable from "./components/ExpenseCategoriesTable/ExpenseCategoriesTable";

import "./Reports.css";

export default function Reports() {
  const [activeReport, setActiveReport] =
    useState("monthly");

  return (
    <div className="reports-page">
      <ReportsHeader />

      <ReportsSummary />

      <ReportTabs
        activeReport={activeReport}
        onChange={setActiveReport}
      />

      <MonthlyReportChart
        activeReport={activeReport}
      />

      <ExpenseCategoriesTable />
    </div>
  );
}