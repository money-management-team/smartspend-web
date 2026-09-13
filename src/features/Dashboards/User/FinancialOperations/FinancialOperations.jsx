import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { LuX } from "react-icons/lu";

import SmartCapture from "./components/SmartCapture/SmartCapture";
import NewOperation from "./components/NewOperation/NewOperation";
import Ledger from "./components/Ledger/Ledger";
import ReverseTransactionDialog from "./components/ReverseTransactionDialog/ReverseTransactionDialog";
import { getNewTransferPath } from "../../../../routes/Path";
import { accountsApi } from "../api/accountsApi";
import { categoriesApi } from "../api/categoriesApi";
import { transactionsApi } from "../api/transactionsApi";
import { ApiError } from "../api/apiClient";
import {
  filtersToQuery,
  filtersToSearchParams,
  getTransactionTitle,
  parseTransactionPage,
  readFilters,
} from "./transactionHelpers";

import "./FinancialOperations.css";

export default function FinancialOperations() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters, sort and page live in the URL, so the details page's back link
  // (and the browser's) return to the same view.
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const query = useMemo(() => filtersToQuery(filters), [filters]);
  const [initialType] = useState(() => searchParams.get("new") ?? "expense");
  // Transfers moved to their own section; old ?new=transfer links follow.
  const wantsTransfer = searchParams.get("new") === "transfer";

  /* ---------- Transactions list ---------- */

  const [listReloadKey, setListReloadKey] = useState(0);
  const listKey = `${JSON.stringify(query)}#${listReloadKey}`;
  const [list, setList] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    transactionsApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const page = parseTransactionPage(response);

        setList(
          page
            ? { key: listKey, page, error: null }
            : { key: listKey, page: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setList({ key: listKey, page: null, error });
      });

    return () => controller.abort();
  }, [listKey, query]);

  const isListLoading = list.key !== listKey;

  /* ---------- Accounts and categories (form + filter options) ---------- */

  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [options, setOptions] = useState({ key: null, accounts: [], categories: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // Active accounts and categories only (system categories included).
    Promise.all([accountsApi.list({}, { signal }), categoriesApi.list({}, { signal })])
      .then(([accountsResponse, categoriesResponse]) => {
        setOptions({
          key: optionsReloadKey,
          accounts: accountsResponse.data?.accounts ?? [],
          categories: categoriesResponse.data?.categories ?? [],
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        setOptions((current) => ({ ...current, key: optionsReloadKey, error }));
      });

    return () => controller.abort();
  }, [optionsReloadKey]);

  const isOptionsLoading = options.key !== optionsReloadKey;

  // After money moved: the list and the balances come back from the backend.
  const refreshAfterMutation = () => {
    setListReloadKey((key) => key + 1);
    setOptionsReloadKey((key) => key + 1);
  };

  /* ---------- Filters ---------- */

  // Built from the live URL, not the last render: two quick changes must not
  // overwrite each other (setSearchParams' `prev` is also from the last render).
  const readCurrentFilters = () => readFilters(new URLSearchParams(window.location.search));

  const updateFilters = (changes) => {
    const next = { ...readCurrentFilters(), ...changes, page: changes.page ?? 1 };

    // A category of the other type can't match the new type filter.
    if ("type" in changes && next.category_id && next.type) {
      const category = options.categories.find((item) => String(item.id) === next.category_id);
      if (category && category.type !== next.type) next.category_id = "";
    }

    setSearchParams(filtersToSearchParams(next), { replace: true });
  };

  const clearFilters = () =>
    setSearchParams(
      filtersToSearchParams({
        ...readFilters(new URLSearchParams()),
        sort: readCurrentFilters().sort,
      }),
      { replace: true },
    );

  /* ---------- Reverse ---------- */

  const [reverseTarget, setReverseTarget] = useState(null);
  const [notice, setNotice] = useState("");

  // Called by ReverseTransactionDialog; errors are shown inside the dialog.
  const handleReverse = async (reason) => {
    const transaction = reverseTarget;

    try {
      await transactionsApi.reverse(transaction.id, reason);
    } catch (error) {
      // Already reversed or gone: the list is out of date.
      if (["CONFLICT", "NOT_FOUND"].includes(error?.code)) setListReloadKey((key) => key + 1);
      throw error;
    }

    setReverseTarget(null);
    setNotice(t("dashboard.transactions.reverseSuccess", {
      name: getTransactionTitle(transaction, t, i18n),
    }));
    refreshAfterMutation();
  };

  if (wantsTransfer) return <Navigate to={getNewTransferPath()} replace />;

  return (
    <div className="financial-operations-page">
      <header className="financial-operations-page__header">
        <h1>{t("dashboard.financialOperations.title")}</h1>
        <p>{t("dashboard.financialOperations.subtitle")}</p>
      </header>

      {notice && (
        <div className="financial-operations-page__notice" role="status">
          <p dir="auto">{notice}</p>
          <button type="button" onClick={() => setNotice("")} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="financial-operations-page__layout">
        <aside className="financial-operations-page__side">
          <SmartCapture />

          <NewOperation
            accounts={options.accounts}
            categories={options.categories}
            initialType={initialType}
            isLoadingOptions={isOptionsLoading}
            optionsError={isOptionsLoading ? null : options.error}
            onRetryOptions={() => setOptionsReloadKey((key) => key + 1)}
            onCreated={refreshAfterMutation}
          />
        </aside>

        <Ledger
          page={isListLoading ? null : list.page}
          isLoading={isListLoading}
          error={isListLoading ? null : list.error}
          filters={filters}
          accounts={options.accounts}
          categories={options.categories}
          listSearch={location.search}
          onFiltersChange={updateFilters}
          onClearFilters={clearFilters}
          onPageChange={(page) => updateFilters({ page })}
          onRetry={() => setListReloadKey((key) => key + 1)}
          onReverse={setReverseTarget}
        />
      </div>

      {reverseTarget && (
        <ReverseTransactionDialog
          transaction={reverseTarget}
          onConfirm={handleReverse}
          onClose={() => setReverseTarget(null)}
        />
      )}
    </div>
  );
}
