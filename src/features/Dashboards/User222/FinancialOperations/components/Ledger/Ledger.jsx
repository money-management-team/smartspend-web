import { useMemo, useState } from "react";

import {
  LuTrash2,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./Ledger.css";

const filters = [
  "all",
  "expense",
  "income",
  "transfer",
];

export default function Ledger({
  transactions,
  isLoading,
  error,
  onRetry,
  onReverse,
}) {
  const { t } = useTranslation();

  const [filter, setFilter] =
    useState("all");
  const [reversingId, setReversingId] = useState(null);
  const [actionError, setActionError] = useState("");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? transactions
        : transactions.filter((transaction) => transaction.type === filter),
    [filter, transactions],
  );

  const handleReverse = async (transaction) => {
    const reason = window.prompt("اكتب سبب عكس العملية (3 أحرف على الأقل):");
    if (!reason || reason.trim().length < 3) return;

    setReversingId(transaction.id);
    setActionError("");

    try {
      await onReverse(transaction.id, reason.trim());
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setReversingId(null);
    }
  };

  return (
    <section className="ledger">
      <header className="ledger__header">
        <h2>
          {t(
            "dashboard.financialOperations.ledger.title",
          )}{" "}
          ({transactions.length})
        </h2>

        <div className="ledger__filters">
          {filters.map((item) => (
            <button
              type="button"
              key={item}
              className={
                filter === item
                  ? "ledger__filter ledger__filter--active"
                  : "ledger__filter"
              }
              onClick={() =>
                setFilter(item)
              }
            >
              {t(
                `dashboard.financialOperations.filters.${item}`,
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="ledger__list">
        {isLoading && <p className="ledger__state">جارٍ تحميل العمليات...</p>}
        {!isLoading && error && (
          <div className="ledger__state ledger__state--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={onRetry}>إعادة المحاولة</button>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="ledger__state">لا توجد عمليات.</p>
        )}
        {actionError && <p className="ledger__state ledger__state--error">{actionError}</p>}

        {!isLoading && !error && filtered.map(
          (transaction) => (
            <article
              className="ledger-row"
              key={transaction.id}
            >
              <div className="ledger-row__copy">
                <strong>
                  {transaction.description || transaction.category?.name || transaction.type}
                </strong>

                <small>
                  {transaction.category?.name || transaction.type}
                  {" · "}
                  {transaction.ledger_entries?.[0]?.account?.name || "—"}
                  {" · "}
                  {new Date(transaction.occurred_at).toLocaleDateString()}
                </small>
              </div>

              <strong
                className={`ledger-row__amount ledger-row__amount--${transaction.type}`}
                dir="ltr"
              >
                {transaction.type === "income"
                  ? "+"
                  : transaction.type === "expense" || transaction.type === "fee"
                    ? "-"
                    : ""}
                {Number(transaction.amount).toLocaleString("en-US")} {transaction.currency_code}
              </strong>

              {transaction.status === "posted" && transaction.type !== "reversal" && (
              <button
                type="button"
                className="ledger-row__delete"
                onClick={() => handleReverse(transaction)}
                disabled={reversingId === transaction.id}
                aria-label={t(
                  "dashboard.financialOperations.ledger.delete",
                )}
              >
                <LuTrash2 />
              </button>
              )}
            </article>
          ),
        )}
      </div>
    </section>
  );
}
