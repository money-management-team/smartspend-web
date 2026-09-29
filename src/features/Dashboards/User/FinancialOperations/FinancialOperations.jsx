import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { LuTriangleAlert, LuX } from "react-icons/lu";

import AccountStep from "./components/AccountStep/AccountStep";
import CaptureStep from "./components/CaptureStep/CaptureStep";
import Ledger from "./components/Ledger/Ledger";
import OperationsIntro from "./components/OperationsIntro/OperationsIntro";
import ReverseTransactionDialog from "./components/ReverseTransactionDialog/ReverseTransactionDialog";
import ReviewOperationDialog from "./components/ReviewOperationDialog/ReviewOperationDialog";
import {
  getNewTransferPath,
  getTransactionDetailsPath,
} from "../../../../routes/Path";
import { accountsApi } from "../api/accountsApi";
import { categoriesApi } from "../api/categoriesApi";
import { transactionsApi } from "../api/transactionsApi";
import { ApiError } from "../api/apiClient";
import { sumMoney } from "../utils/formatters";
import {
  createIdempotentAttempt,
  filtersToQuery,
  filtersToSearchParams,
  getTodayInputValue,
  getTransactionTitle,
  isTransactionEntity,
  parseTransactionPage,
  readFilters,
  toOccurredAt,
} from "./transactionHelpers";

import "./FinancialOperations.css";

// Codes after which it is unknown whether the operation was recorded, so the
// list is refreshed before the user tries again.
const UNKNOWN_OUTCOME = ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "MALFORMED_RESPONSE"];

/*
 * The backend caps `per_page` at 100 on every documented list endpoint, and
 * rejects anything above it with a 422. A normal day fits in one page; a busy
 * one is paged through, because a total that silently stopped counting would
 * be a wrong money figure on screen.
 */
const TODAY_PER_PAGE = 100;
// 500 expenses in a single day is already far beyond real use. Bounded so a
// surprising response can never turn this into an unbounded request loop.
const TODAY_MAX_PAGES = 5;

/*
 * Guided capture page: pick the account (step 1), pick an input method
 * (step 2), then confirm a receipt-style review before anything is recorded.
 * The ledger below lists the same transactions with its own filters.
 */
export default function FinancialOperations() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters, sort and page live in the URL, so the details page's back link
  // (and the browser's) return to the same view.
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const query = useMemo(() => filtersToQuery(filters), [filters]);
  const [initialType] = useState(() => searchParams.get("new") ?? "expense");
  // A ?new= link asks for the form, so it opens on manual entry.
  const [initialMethod] = useState(() => (searchParams.get("new") ? "manual" : "voice"));
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

  /* ---------- Accounts and categories (capture card options) ---------- */

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

  /* ---------- Today's expenses (intro card) ---------- */

  const [today, setToday] = useState({ key: null, totals: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const date = getTodayInputValue();

    // Every posted expense booked today, following the paginator so the total
    // covers the whole day rather than whatever fitted in the first page.
    const loadToday = async () => {
      const rows = [];

      for (let page = 1; page <= TODAY_MAX_PAGES; page += 1) {
        const response = await transactionsApi.list(
          {
            type: "expense",
            status: "posted",
            date_from: date,
            date_to: date,
            per_page: TODAY_PER_PAGE,
            page,
          },
          { signal },
        );

        const parsed = parseTransactionPage(response);
        if (!parsed) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

        rows.push(...parsed.items);
        if (page >= parsed.lastPage) break;
      }

      return rows;
    };

    loadToday()
      .then((items) => {
        // Accounts may hold different currencies, so amounts are never mixed:
        // each currency is totalled on its own, largest group first.
        const byCurrency = new Map();

        items.forEach((transaction) => {
          const currency = transaction.currency_code ?? "";
          const amounts = byCurrency.get(currency) ?? [];
          amounts.push(String(transaction.amount ?? "0").replace(/^-/, ""));
          byCurrency.set(currency, amounts);
        });

        setToday({
          key: listReloadKey,
          totals: [...byCurrency.entries()]
            .sort(([, left], [, right]) => right.length - left.length)
            .map(([currency, amounts]) => ({ currency, amount: sumMoney(amounts) })),
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        setToday({ key: listReloadKey, totals: [], error });
      });

    return () => controller.abort();
  }, [listReloadKey]);

  // After money moved: the list, the balances and today's total come back
  // from the backend.
  const refreshAfterMutation = () => {
    setListReloadKey((key) => key + 1);
    setOptionsReloadKey((key) => key + 1);
  };

  /* ---------- Selected account (step 1) ---------- */

  const [chosenAccountId, setChosenAccountId] = useState("");

  /*
   * Derived, not stored: an account that dropped out of the active list can't
   * be used, and with a single account there is nothing to choose, so step 1
   * is already answered.
   */
  const selectedAccount = useMemo(() => {
    const chosen = options.accounts.find((account) => String(account.id) === chosenAccountId);
    if (chosen) return chosen;

    return options.accounts.length === 1 ? options.accounts[0] : null;
  }, [chosenAccountId, options.accounts]);

  const selectedAccountId = selectedAccount ? String(selectedAccount.id) : "";

  const accountStepRef = useRef(null);
  const [warning, setWarning] = useState("");
  const warningTimerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(warningTimerRef.current), []);

  // Every input method calls this before it collects anything.
  const requireAccount = () => {
    if (selectedAccount) return true;

    setWarning(t("dashboard.financialOperations.captureStep.accountRequired"));
    window.clearTimeout(warningTimerRef.current);
    warningTimerRef.current = window.setTimeout(() => setWarning(""), 4000);
    accountStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    return false;
  };

  /* ---------- Review and record ---------- */

  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState(null);

  /*
   * One Idempotency-Key per logical operation, kept at page level: a double
   * click, or a retry of the same details after a timeout, reuses the key, so
   * the money can't be recorded twice.
   */
  const [attempt] = useState(() => createIdempotentAttempt("operation"));

  const openReview = (operation) => {
    if (!requireAccount()) return;
    setNotice(null);
    setDraft({ ...operation, account_id: selectedAccountId });
  };

  // Called by ReviewOperationDialog; errors are shown inside the dialog.
  const recordOperation = async (operation) => {
    const payload = {
      account_id: Number(operation.account_id),
      category_id: operation.category_id ? Number(operation.category_id) : undefined,
      amount: String(operation.amount).trim(),
      description: operation.description?.trim() || undefined,
      reference_number: operation.reference_number?.trim() || undefined,
      occurred_at: toOccurredAt(operation.date),
    };
    const idempotencyKey = attempt.keyFor({ type: operation.type, ...payload });

    let response;

    try {
      response =
        operation.type === "income"
          ? await transactionsApi.createIncome(payload, idempotencyKey)
          : await transactionsApi.createExpense(payload, idempotencyKey);
      attempt.settle(null);
    } catch (error) {
      attempt.settle(error);
      // The outcome is unknown: refresh so the list shows it if it was saved.
      if (UNKNOWN_OUTCOME.includes(error?.code)) refreshAfterMutation();
      throw error;
    }

    const created = response?.data?.transaction;

    setDraft(null);
    operation.onRecorded?.();
    setNotice({
      text: t(
        operation.type === "income"
          ? "dashboard.financialOperations.messages.incomeCreated"
          : "dashboard.financialOperations.messages.expenseCreated",
      ),
      transactionId: isTransactionEntity(created) ? created.id : null,
    });
    // Balances and the list come back from the backend; nothing is
    // recalculated here.
    refreshAfterMutation();
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
    setNotice({
      text: t("dashboard.transactions.reverseSuccess", {
        name: getTransactionTitle(transaction, t, i18n),
      }),
      transactionId: null,
    });
    refreshAfterMutation();
  };

  if (wantsTransfer) return <Navigate to={getNewTransferPath()} replace />;

  return (
    <div className="financial-operations-page">
      <OperationsIntro
        today={{
          totals: today.totals,
          error: today.error,
          isLoading: today.key !== listReloadKey,
          currency: options.accounts[0]?.currency_code,
        }}
        hasAccount={Boolean(selectedAccount)}
      />

      {notice && (
        <div className="financial-operations-page__notice" role="status">
          <p dir="auto">
            {notice.text}
            {notice.transactionId != null && (
              <>
                {" "}
                <Link to={getTransactionDetailsPath(notice.transactionId)}>
                  {t("dashboard.financialOperations.messages.viewTransaction")}
                </Link>
              </>
            )}
          </p>

          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <div ref={accountStepRef}>
        <AccountStep
          accounts={options.accounts}
          selectedAccountId={selectedAccountId}
          onSelect={setChosenAccountId}
          isLoading={isOptionsLoading}
          error={isOptionsLoading ? null : options.error}
          onRetry={() => setOptionsReloadKey((key) => key + 1)}
        />
      </div>

      <CaptureStep
        account={selectedAccount}
        categories={options.categories}
        initialType={initialType}
        initialMethod={initialMethod}
        isLoadingOptions={isOptionsLoading}
        optionsError={isOptionsLoading ? null : options.error}
        onRetryOptions={() => setOptionsReloadKey((key) => key + 1)}
        onRequireAccount={requireAccount}
        onReview={openReview}
      />

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

      {draft && (
        <ReviewOperationDialog
          draft={draft}
          account={selectedAccount}
          categories={options.categories}
          onConfirm={recordOperation}
          onClose={() => setDraft(null)}
        />
      )}

      {reverseTarget && (
        <ReverseTransactionDialog
          transaction={reverseTarget}
          onConfirm={handleReverse}
          onClose={() => setReverseTarget(null)}
        />
      )}

      {warning && (
        <p className="financial-operations-page__warning" role="alert">
          <LuTriangleAlert aria-hidden="true" />
          {warning}
        </p>
      )}
    </div>
  );
}
