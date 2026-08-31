import { useCallback, useEffect, useState } from "react";

import SmartCapture from "./components/SmartCapture/SmartCapture";
import NewOperation from "./components/NewOperation/NewOperation";
import Ledger from "./components/Ledger/Ledger";
import { accountsApi } from "../api/accountsApi";
import { categoriesApi } from "../api/categoriesApi";
import { transactionsApi } from "../api/transactionsApi";
import { getApiErrorMessage } from "../api/apiClient";

import { useTranslation } from "react-i18next";

import "./FinancialOperations.css";

export default function FinancialOperations() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async (signal) => {
    try {
      const [accountsResponse, categoriesResponse, transactionsResponse] =
        await Promise.all([
          accountsApi.list({}, { signal }),
          categoriesApi.list({}, { signal }),
          transactionsApi.list({ per_page: 100 }, { signal }),
        ]);

      setAccounts(accountsResponse.data?.accounts ?? []);
      setCategories(categoriesResponse.data?.categories ?? []);
      setTransactions(transactionsResponse.data?.transactions?.data ?? []);
      setError("");
      return true;
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(getApiErrorMessage(requestError, t));
      }
      return false;
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    const requestStart = window.setTimeout(() => {
      void loadData(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(requestStart);
      controller.abort();
    };
  }, [loadData]);

  const handleRetry = () => {
    setIsLoading(true);
    setError("");
    void loadData();
  };

  const handleReverse = async (transactionId, reason) => {
    await transactionsApi.reverse(transactionId, reason);
    await loadData();
  };

  return (
    <div className="financial-operations-page">
      <header className="financial-operations-page__header">
        <h1>
          {t("dashboard.financialOperations.title")}
        </h1>

        <p>
          {t("dashboard.financialOperations.subtitle")}
        </p>
      </header>

      <div className="financial-operations-page__layout">
        <aside className="financial-operations-page__side">
          <SmartCapture />

          <NewOperation
            accounts={accounts}
            categories={categories}
            onCreated={loadData}
          />
        </aside>

        <Ledger
          transactions={transactions}
          isLoading={isLoading}
          error={error}
          onRetry={handleRetry}
          onReverse={handleReverse}
        />
      </div>
    </div>
  );
}
