import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft,
  LuArrowRightLeft,
  LuInfo,
  LuPencil,
  LuUndo2,
  LuX,
} from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import {
  PATH,
  getAccountDetailsPath,
  getCategoryDetailsPath,
  getTransactionDetailsPath,
  getTransferDetailsPath,
} from "../../../../routes/Path";
import { transactionsApi } from "../api/transactionsApi";
import { ApiError } from "../api/apiClient";
import { getDisplayLocale, isNegativeMoney } from "../Accounts/accountHelpers";
import CorrectTransactionForm from "../FinancialOperations/components/CorrectTransactionForm/CorrectTransactionForm";
import ReverseTransactionDialog from "../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog";
import TransactionStatusBadge from "../FinancialOperations/components/TransactionStatusBadge/TransactionStatusBadge";
import {
  canChangeTransaction,
  getAmountSign,
  getAmountTone,
  getTransactionAccounts,
  getTransactionErrorMessage,
  getTransactionTitle,
  isReversalRecord,
  isTransactionEntity,
  isTransferTransaction,
  renderTransactionIcon,
  sameId,
  translateEnum,
} from "../FinancialOperations/transactionHelpers";
import { formatDateTime, formatMoney } from "../utils/formatters";

import "./TransactionDetails.css";

export default function TransactionDetails() {
  const { transactionId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  // The list's filters/page, so "back" returns to the same view.
  const [listSearch] = useState(() => location.state?.from ?? "");
  const listPath = `${PATH.USER.FINANCIAL_OPERATIONS}${listSearch}`;

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request, the page is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${transactionId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, transaction: null, error: null });
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  // A dialog failed because the data is stale (e.g. already reversed):
  // refetch once it closes, so its error message stays readable.
  const [refreshOnClose, setRefreshOnClose] = useState(false);
  // { forId, kind: "corrected" | "reversed", originalId?, reversalIds? }.
  // The route element stays mounted when the id changes, so this survives
  // the navigation to a replacement.
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    transactionsApi
      .get(transactionId, { signal: controller.signal })
      .then((response) => {
        const transaction = response.data?.transaction;

        setResult(
          isTransactionEntity(transaction)
            ? { key: requestKey, transaction, error: null }
            : {
                key: requestKey,
                transaction: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, transaction: null, error });
      });

    return () => controller.abort();
  }, [requestKey, transactionId]);

  const isLoading = result.key !== requestKey;
  const { transaction, error } = isLoading ? { transaction: null, error: null } : result;

  const handleRequestError = (requestError) => {
    if (requestError?.code === "NOT_FOUND") {
      setIsCorrecting(false);
      setIsReversing(false);
      setResult({ key: requestKey, transaction: null, error: requestError });
    } else if (requestError?.code === "CONFLICT") {
      setRefreshOnClose(true);
    }
  };

  const closeDialog = (close) => () => {
    close(false);
    if (refreshOnClose) {
      setRefreshOnClose(false);
      setReloadKey((key) => key + 1);
    }
  };

  /*
   * Correction by reversal: the backend reverses this transaction and posts a
   * replacement with a NEW id. From then on the replacement is "the"
   * transaction, so the page moves to its URL.
   */
  const handleCorrect = async (payload, idempotencyKey) => {
    let response;

    try {
      response = await transactionsApi.correct(transaction.id, payload, idempotencyKey);
    } catch (requestError) {
      handleRequestError(requestError);
      throw requestError;
    }

    const replacement = response?.data?.transaction;
    setIsCorrecting(false);
    setRefreshOnClose(false);

    if (isTransactionEntity(replacement) && !sameId(replacement.id, transaction.id)) {
      setNotice({ forId: String(replacement.id), kind: "corrected", originalId: transaction.id });
      navigate(getTransactionDetailsPath(replacement.id), {
        replace: true,
        state: { from: listSearch },
      });
    } else {
      // No replacement in the response: show the current backend state.
      setNotice({ forId: String(transactionId), kind: "corrected", originalId: null });
      setReloadKey((key) => key + 1);
    }
  };

  const handleReverse = async (reason) => {
    let response;

    try {
      response = await transactionsApi.reverse(transaction.id, reason);
    } catch (requestError) {
      handleRequestError(requestError);
      throw requestError;
    }

    // Documented shape: data.transaction_original + data.reversals.
    const original = response?.data?.transaction_original;
    const reversals = Array.isArray(response?.data?.reversals)
      ? response.data.reversals.filter((item) => isTransactionEntity(item))
      : [];

    setIsReversing(false);
    setRefreshOnClose(false);
    setNotice({
      forId: String(transactionId),
      kind: "reversed",
      reversalIds: reversals.map((item) => item.id),
    });

    if (isTransactionEntity(original, transaction.id)) {
      setResult((current) => ({
        ...current,
        transaction: { ...current.transaction, ...original },
      }));
    } else {
      setReloadKey((key) => key + 1);
    }
  };

  const backLink = (
    <Link className="transaction-details__back" to={listPath}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.transactions.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="transaction-details">
        {backLink}
        <Loading message={t("dashboard.transactions.details.loading")} />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.code === "NOT_FOUND";

    return (
      <div className="transaction-details">
        {backLink}

        <div className="transaction-details__state" role="alert">
          <h1>
            {t(
              isNotFound
                ? "dashboard.transactions.details.notFoundTitle"
                : "dashboard.transactions.details.errorTitle",
            )}
          </h1>
          <p>{getTransactionErrorMessage(error, t)}</p>

          {!isNotFound && (
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const tone = getAmountTone(transaction);
  const canChange = canChangeTransaction(transaction);
  const isTransfer = isTransferTransaction(transaction);
  const isReversal = isReversalRecord(transaction);
  const isReversed = transaction.status === "reversed";
  const accounts = getTransactionAccounts(transaction);
  const typeLabel = translateEnum(t, i18n, "dashboard.transactions.types", transaction.type);
  const amount = String(transaction.amount ?? "").replace(/^-/, "");
  const money = (value) => formatMoney(value, transaction.currency_code, locale);
  const dateTime = (value) => formatDateTime(value, locale, timeZone);
  const transactionLink = (id) => (
    <Link to={getTransactionDetailsPath(id)} state={{ from: listSearch }}>
      <bdi>#{id}</bdi>
    </Link>
  );
  const shownNotice = notice && notice.forId === String(transactionId) ? notice : null;

  const rows = [
    ["type", typeLabel],
    ["status", <TransactionStatusBadge key="status" status={transaction.status} />],
    ["amount", <bdi key="amount" dir="ltr">{getAmountSign(transaction)}{money(amount)}</bdi>],
    transaction.currency_code && ["currency", <bdi key="currency">{transaction.currency_code}</bdi>],
    accounts.length > 0 && [
      accounts.length > 1 ? "accounts" : "account",
      <span className="transaction-details__links" key="accounts">
        {accounts.map((account) => (
          <Link key={account.id} to={getAccountDetailsPath(account.id)}>
            <bdi>{account.name ?? `#${account.id}`}</bdi>
          </Link>
        ))}
      </span>,
    ],
    [
      "category",
      transaction.category?.id != null || transaction.category_id != null ? (
        <Link key="category" to={getCategoryDetailsPath(transaction.category?.id ?? transaction.category_id)}>
          <bdi>{transaction.category?.name ?? `#${transaction.category_id}`}</bdi>
        </Link>
      ) : (
        t("dashboard.transactions.details.none")
      ),
    ],
    transaction.description && ["description", <bdi key="description">{transaction.description}</bdi>],
    transaction.reference_number && [
      "referenceNumber",
      <bdi key="reference" dir="ltr">{transaction.reference_number}</bdi>,
    ],
    ["occurredAt", dateTime(transaction.occurred_at)],
    transaction.posted_at && ["postedAt", dateTime(transaction.posted_at)],
    transaction.source && [
      "source",
      translateEnum(t, i18n, "dashboard.transactions.sources", transaction.source),
    ],
    transaction.creator?.name && ["createdBy", <bdi key="creator">{transaction.creator.name}</bdi>],
    transaction.reversed_at && ["reversedAt", dateTime(transaction.reversed_at)],
    transaction.reversal_reason && [
      "reversalReason",
      <bdi key="reversal-reason">{transaction.reversal_reason}</bdi>,
    ],
    transaction.transfer_id != null && [
      "transfer",
      <Link key="transfer" to={getTransferDetailsPath(transaction.transfer_id)}>
        <bdi dir="ltr">#{transaction.transfer_id}</bdi>
      </Link>,
    ],
    transaction.reversal_of_id != null && ["reversalOf", transactionLink(transaction.reversal_of_id)],
    transaction.related_transaction_id != null && !isReversal && [
      "replaces",
      transactionLink(transaction.related_transaction_id),
    ],
  ].filter(Boolean);

  const entries = (transaction.ledger_entries ?? []).filter(Boolean);

  return (
    <div className="transaction-details">
      {backLink}

      {shownNotice && (
        <div className="transaction-details__notice" role="status">
          <p>
            {shownNotice.kind === "corrected" ? (
              shownNotice.originalId != null ? (
                <>
                  {t("dashboard.transactions.correctSuccess")}{" "}
                  {t("dashboard.transactions.details.originalReversed")}{" "}
                  {transactionLink(shownNotice.originalId)}
                </>
              ) : (
                t("dashboard.transactions.correctSuccess")
              )
            ) : (
              <>
                {t("dashboard.transactions.reverseSuccessDetails")}
                {shownNotice.reversalIds?.length > 0 && (
                  <>
                    {" "}
                    {t("dashboard.transactions.details.reversalEntries")}{" "}
                    {shownNotice.reversalIds.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ", "}
                        {transactionLink(id)}
                      </span>
                    ))}
                  </>
                )}
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <header className="transaction-details__header">
        <span className={`transaction-details__icon transaction-details__icon--${tone}`} aria-hidden="true">
          {renderTransactionIcon(transaction)}
        </span>

        <div className="transaction-details__identity">
          <h1 dir="auto">{getTransactionTitle(transaction, t, i18n)}</h1>

          <div className="transaction-details__chips">
            <span className={`transaction-details__chip transaction-details__chip--${tone}`}>{typeLabel}</span>
            <TransactionStatusBadge status={transaction.status} />
            {isReversal && (
              <span className="transaction-details__chip">{t("dashboard.transactions.chips.reversal")}</span>
            )}
            {transaction.related_transaction_id != null && !isReversal && (
              <span className="transaction-details__chip">{t("dashboard.transactions.chips.correction")}</span>
            )}
          </div>
        </div>

        {canChange && (
          <div className="transaction-details__actions">
            <button
              type="button"
              className="transaction-details__action"
              onClick={() => setIsCorrecting(true)}
            >
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.transactions.actions.correct")}</span>
            </button>
            <button
              type="button"
              className="transaction-details__action"
              onClick={() => setIsReversing(true)}
            >
              <LuUndo2 aria-hidden="true" />
              <span>{t("dashboard.transactions.actions.reverse")}</span>
            </button>
          </div>
        )}
      </header>

      <section className="transaction-details__amount-card">
        <span>{t("dashboard.transactions.fields.amount")}</span>
        <strong
          className={`transaction-details__amount transaction-details__amount--${isReversed ? "reversed" : tone}`}
          dir="ltr"
        >
          {getAmountSign(transaction)}
          {money(amount)}
        </strong>
        <small>
          {dateTime(transaction.occurred_at)}
          {accounts[0]?.name && (
            <>
              {" · "}
              <bdi>{accounts.map((account) => account.name ?? `#${account.id}`).join(" → ")}</bdi>
            </>
          )}
        </small>
      </section>

      {isReversed && (
        <p className="transaction-details__note" role="note">
          <LuUndo2 aria-hidden="true" />
          <span>{t("dashboard.transactions.details.reversedNote")}</span>
        </p>
      )}

      {isReversal && (
        <p className="transaction-details__note transaction-details__note--info" role="note">
          <LuInfo aria-hidden="true" />
          <span>
            {t("dashboard.transactions.details.reversalNote")}
            {transaction.reversal_of_id != null && <> {transactionLink(transaction.reversal_of_id)}</>}
          </span>
        </p>
      )}

      {isTransfer && !isReversal && (
        <p className="transaction-details__note transaction-details__note--info" role="note">
          <LuArrowRightLeft aria-hidden="true" />
          <span>
            {t("dashboard.transactions.details.transferNote")}
            {transaction.transfer_id != null && (
              <>
                {" "}
                <Link to={getTransferDetailsPath(transaction.transfer_id)}>
                  {t("dashboard.transactions.details.viewTransfer")}
                </Link>
              </>
            )}
          </span>
        </p>
      )}

      {!isTransfer && !isReversal && !isReversed && transaction.status !== "posted" && (
        <p className="transaction-details__note transaction-details__note--info" role="note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.transactions.details.notPostedNote")}</span>
        </p>
      )}

      <section className="transaction-details__panel" aria-labelledby="transaction-details-title">
        <h2 id="transaction-details-title">{t("dashboard.transactions.details.title")}</h2>

        <dl className="transaction-details__list">
          {rows.map(([key, value]) => (
            <div className="transaction-details__row" key={key}>
              <dt>{t(`dashboard.transactions.details.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {entries.length > 0 && (
        <section className="transaction-details__panel" aria-labelledby="transaction-entries-title">
          <h2 id="transaction-entries-title">{t("dashboard.transactions.details.entriesTitle")}</h2>
          <p className="transaction-details__panel-hint">{t("dashboard.transactions.details.entriesHint")}</p>

          <div className="transaction-details__table-wrap">
            <table className="transaction-details__table">
              <thead>
                <tr>
                  <th scope="col">{t("dashboard.transactions.details.entryAccount")}</th>
                  <th scope="col">{t("dashboard.transactions.details.entryRole")}</th>
                  <th scope="col">{t("dashboard.transactions.details.entryAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const accountId = entry.account?.id ?? entry.account_id;

                  return (
                    <tr key={entry.id ?? index}>
                      <td>
                        {accountId != null ? (
                          <Link to={getAccountDetailsPath(accountId)}>
                            <bdi>{entry.account?.name ?? `#${accountId}`}</bdi>
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{translateEnum(t, i18n, "dashboard.transactions.entryRoles", entry.entry_role) || "—"}</td>
                      <td
                        className={
                          isNegativeMoney(entry.signed_amount)
                            ? "transaction-details__entry-amount transaction-details__entry-amount--negative"
                            : "transaction-details__entry-amount"
                        }
                        dir="ltr"
                      >
                        {entry.signed_amount != null
                          ? formatMoney(entry.signed_amount, entry.currency_code ?? transaction.currency_code, locale)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isCorrecting && canChange && (
        <CorrectTransactionForm
          transaction={transaction}
          onSave={handleCorrect}
          onClose={closeDialog(setIsCorrecting)}
        />
      )}

      {isReversing && canChange && (
        <ReverseTransactionDialog
          transaction={transaction}
          onConfirm={handleReverse}
          onClose={closeDialog(setIsReversing)}
        />
      )}
    </div>
  );
}
