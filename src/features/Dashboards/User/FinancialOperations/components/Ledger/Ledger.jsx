import { useMemo, useState } from "react";

import {
  LuUndo2,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "../../../api/apiClient";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { formatDate } from "../../../utils/formatters";

import "./Ledger.css";
import Loading from "../../../../../../components/Loading/Loading";

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
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;

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
    const reason = window.prompt(
      t("dashboard.financialOperations.ledger.reversePrompt"),
    );
    if (!reason || reason.trim().length < 3) return;

    setReversingId(transaction.id);
    setActionError("");

    try {
      await onReverse(transaction.id, reason.trim());
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, t));
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
        {isLoading && (
          <Loading message={false} />
        )}
        {!isLoading && error && (
          <div className="ledger__state ledger__state--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={onRetry}>{t("common.retry")}</button>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="ledger__state">
            {t("dashboard.financialOperations.states.empty")}
          </p>
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
                  {transaction.description ||
                    transaction.category?.name ||
                    t(`dashboard.financialOperations.types.${transaction.type}`)}
                </strong>

                <small>
                  {transaction.category?.name ||
                    t(`dashboard.financialOperations.types.${transaction.type}`)}
                  {" · "}
                  {transaction.ledger_entries?.[0]?.account?.name || t("common.notAvailable")}
                  {" · "}
                  {formatDate(transaction.occurred_at, locale, timeZone)}
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

              {transaction.status === "posted" &&
                ["expense", "transfer"].includes(transaction.type) && (
              <button
                type="button"
                className="ledger-row__delete"
                onClick={() => handleReverse(transaction)}
                disabled={reversingId === transaction.id}
                aria-label={t(
                  "dashboard.financialOperations.ledger.delete",
                )}
                title={t("dashboard.financialOperations.ledger.delete")}
              >
                <LuUndo2 />
              </button>
              )}
            </article>
          ),
        )}
      </div>
    </section>
  );
}
