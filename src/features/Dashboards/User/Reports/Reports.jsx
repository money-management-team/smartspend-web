import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ReportsHeader from "./components/ReportsHeader/ReportsHeader";
import ReportsSummary from "./components/ReportsSummary/ReportsSummary";
import ReportTabs from "./components/ReportTabs/ReportTabs";
import MonthlyReportChart from "./components/MonthlyReportChart/MonthlyReportChart";
import ExpenseCategoriesTable from "./components/ExpenseCategoriesTable/ExpenseCategoriesTable";
import { dashboardApi } from "../api/dashboardApi";
import { getApiErrorMessage } from "../api/apiClient";

import "./Reports.css";
import Loading from "../../../../components/Loading/Loading";

const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLastMonthRanges(count = 8) {
  const now = new Date();
  const ranges = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    ranges.push({
      monthKey: monthKeys[date.getMonth()],
      year: date.getFullYear(),
      date_from: toDateString(start),
      date_to: toDateString(end),
    });
  }

  return ranges;
}

export default function Reports() {
  const { t } = useTranslation();
  const [activeReport, setActiveReport] = useState("monthly");
  const [report, setReport] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const ranges = useMemo(() => getLastMonthRanges(8), []);

  const loadReport = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const fullRange = {
        date_from: ranges[0].date_from,
        date_to: ranges[ranges.length - 1].date_to,
      };

      const [overallResponse, ...monthResponses] = await Promise.all([
        dashboardApi.get(fullRange, { signal }),
        ...ranges.map((range) => dashboardApi.get(
          { date_from: range.date_from, date_to: range.date_to },
          { signal },
        )),
      ]);

      setReport(overallResponse.data);
      setMonthlyData(monthResponses.map((response, index) => ({
        monthKey: ranges[index].monthKey,
        year: ranges[index].year,
        income: Number(response.data?.totals?.income || 0),
        expense: Number(response.data?.totals?.expense || 0),
      })));
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(getApiErrorMessage(requestError, t));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [ranges, t]);

  useEffect(() => {
    const controller = new AbortController();
    loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport]);

  return (
    <div className="reports-page">
      <ReportsHeader />

      {isLoading && <Loading message={false} />}
      {!isLoading && error && (
        <div className="reports-page__state reports-page__state--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => loadReport()}>{t("common.retry")}</button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <ReportsSummary totals={report?.totals} categories={report?.breakdown?.by_category ?? []} />
          <ReportTabs activeReport={activeReport} onChange={setActiveReport} />
          <MonthlyReportChart activeReport={activeReport} reportData={monthlyData} />
          <ExpenseCategoriesTable
            categories={report?.breakdown?.by_category ?? []}
            currency={report?.totals?.currency_code ?? "ILS"}
          />
        </>
      )}
    </div>
  );
}
