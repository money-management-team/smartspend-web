import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import { LuArrowLeft, LuArrowRightLeft, LuInfo, LuUndo2, LuX } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import {
  PATH,
  getAccountDetailsPath,
  getCategoryDetailsPath,
  getTransactionDetailsPath,
} from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { transfersApi } from "../api/transfersApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import TransactionStatusBadge from "../FinancialOperations/components/TransactionStatusBadge/TransactionStatusBadge";
import { translateEnum } from "../FinancialOperations/transactionHelpers";
import ReverseTransferDialog from "../Transfers/components/ReverseTransferDialog/ReverseTransferDialog";
import {
  canReverseTransfer,
  getAccountLabel,
  getFromAccount,
  getToAccount,
  getTransactionOfType,
  getTransferErrorMessage,
  getTransferMovements,
  getTransferTransactions,
  hasTransferFee,
  isTransferEntity,
} from "../Transfers/transferHelpers";
import { formatDateTime, formatMoney } from "../utils/formatters";

import "./TransferDetails.css";

/*
 * One transfer (GET /transfers/{id}): where the money went, the optional fee,
 * the transactions the ledger posted for it, and the reversal action.
 * Balances are never recalculated here — everything shown comes from the
 * backend.
 */
export default function TransferDetails() {
  const { transferId } = useParams();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  // The list's page, so "back" returns to the same view.
  const [listSearch] = useState(() => location.state?.from ?? "");
  const listPath = `${PATH.USER.TRANSFERS}${listSearch}`;

  // `key` ties a result to the request that produced it. A refetch of the same
  // transfer keeps the current data on screen instead of flashing a spinner.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${transferId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, id: null, transfer: null, error: null });
  const [isReversing, setIsReversing] = useState(false);
  // The reverse failed because the data is stale (already reversed): refetch
  // once the dialog closes, so its message stays readable.
  const [refreshOnClose, setRefreshOnClose] = useState(false);
  // { forId, reversalIds }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    transfersApi
      .get(transferId, { signal: controller.signal })
      .then((response) => {
        const transfer = response.data?.transfer;

        setResult(
          isTransferEntity(transfer)
            ? { key: requestKey, id: transferId, transfer, error: null }
            : {
                key: requestKey,
                id: transferId,
                transfer: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, id: transferId, transfer: null, error });
      });

    return () => controller.abort();
  }, [requestKey, transferId]);

  const isPending = result.key !== requestKey;
  // Data of another transfer is never shown while this one loads.
  const shownResult = result.id === transferId ? result : { transfer: null, error: null };
  const transfer = shownResult.transfer;
  const error = isPending ? null : shownResult.error;

  const closeDialog = () => {
    setIsReversing(false);

    if (refreshOnClose) {
      setRefreshOnClose(false);
      setReloadKey((key) => key + 1);
    }
  };

  /*
   * Reversing a transfer reverses the whole thing: the movement and the fee,
   * in one atomic backend operation. The frontend never reverses one side.
   */
  const handleReverse = async (reason) => {
    let response;

    try {
      response = await transfersApi.reverse(transfer.id, reason);
    } catch (requestError) {
      if (requestError?.code === "NOT_FOUND") {
        setIsReversing(false);
        setResult({ key: requestKey, id: transferId, transfer: null, error: requestError });
      } else if (["CONFLICT", "VALIDATION_ERROR"].includes(requestError?.code)) {
        // Already reversed, or refused by a ledger rule: the page may be stale.
        setRefreshOnClose(requestError.code === "CONFLICT");
      }
      throw requestError;
    }

    // Documented shape: data.transfer (status "reversed") + data.reversals.
    const reversed = response?.data?.transfer;
    const reversals = Array.isArray(response?.data?.reversals)
      ? response.data.reversals.filter((item) => item?.id != null)
      : [];

    setIsReversing(false);
    setRefreshOnClose(false);
    setNotice({ forId: String(transferId), reversalIds: reversals.map((item) => item.id) });

    if (isTransferEntity(reversed, transfer.id)) {
      setResult((current) => ({
        ...current,
        transfer: { ...current.transfer, ...reversed },
      }));
    }

    // The reversal also posted new transactions and changed both balances, so
    // the full transfer is fetched again.
    setReloadKey((key) => key + 1);
  };

  const backLink = (
    <Link className="transfer-details__back" to={listPath}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.transfers.details.back")}</span>
    </Link>
  );

  if (!transfer && isPending) {
    return (
      <div className="transfer-details">
        {backLink}
        <Loading message={t("dashboard.transfers.details.loading")} />
      </div>
    );
  }

  if (!transfer) {
    const isNotFound = error?.code === "NOT_FOUND";

    return (
      <div className="transfer-details">
        {backLink}

        <div className="transfer-details__state" role="alert">
          <h1>
            {t(
              isNotFound
                ? "dashboard.transfers.details.notFoundTitle"
                : "dashboard.transfers.details.errorTitle",
            )}
          </h1>
          <p>{getTransferErrorMessage(error, t)}</p>

          {!isNotFound && (
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const fromAccount = getFromAccount(transfer);
  const toAccount = getToAccount(transfer);
  const fromLabel = getAccountLabel(fromAccount, transfer.from_account_id);
  const toLabel = getAccountLabel(toAccount, transfer.to_account_id);
  const isReversed = transfer.status === "reversed";
  const canReverse = canReverseTransfer(transfer);
  const withFee = hasTransferFee(transfer);
  const movementTransaction = getTransactionOfType(transfer, "transfer");
  const feeCategoryId = transfer.fee_category?.id ?? transfer.fee_category_id;
  const description = transfer.description ?? movementTransaction?.description;
  const referenceNumber = transfer.reference_number ?? movementTransaction?.reference_number;
  const transactions = getTransferTransactions(transfer);
  const shownNotice = notice && notice.forId === String(transferId) ? notice : null;

  const money = (value) => formatMoney(value, transfer.currency_code, locale);
  const dateTime = (value) => formatDateTime(value, locale, timeZone);
  const accountLink = (account, fallbackId) =>
    (account?.id ?? fallbackId) != null ? (
      <Link to={getAccountDetailsPath(account?.id ?? fallbackId)}>
        <bdi>{getAccountLabel(account, fallbackId)}</bdi>
      </Link>
    ) : (
      "—"
    );

  const rows = [
    ["transferNumber", <bdi key="id" dir="ltr">#{transfer.id}</bdi>],
    [
      "status",
      <TransactionStatusBadge
        key="status"
        status={transfer.status}
        labelsKey="dashboard.transfers.statuses"
      />,
    ],
    ["fromAccount", accountLink(fromAccount, transfer.from_account_id)],
    ["toAccount", accountLink(toAccount, transfer.to_account_id)],
    ["amount", <bdi key="amount" dir="ltr">{money(transfer.amount)}</bdi>],
    transfer.currency_code && ["currency", <bdi key="currency">{transfer.currency_code}</bdi>],
    ["fee", <bdi key="fee" dir="ltr">{money(transfer.fee_amount ?? "0")}</bdi>],
    withFee && [
      "feeCategory",
      feeCategoryId != null ? (
        <Link key="fee-category" to={getCategoryDetailsPath(feeCategoryId)}>
          <bdi>{transfer.fee_category?.name ?? `#${feeCategoryId}`}</bdi>
        </Link>
      ) : (
        t("dashboard.transfers.details.none")
      ),
    ],
    description && ["description", <bdi key="description">{description}</bdi>],
    referenceNumber && [
      "referenceNumber",
      <bdi key="reference" dir="ltr">{referenceNumber}</bdi>,
    ],
    ["occurredAt", dateTime(transfer.occurred_at)],
    transfer.posted_at && ["postedAt", dateTime(transfer.posted_at)],
    transfer.initiator?.name && [
      "initiator",
      <bdi key="initiator">{transfer.initiator.name}</bdi>,
    ],
    transfer.reversed_at && ["reversedAt", dateTime(transfer.reversed_at)],
    transfer.reversal_reason && [
      "reversalReason",
      <bdi key="reversal-reason">{transfer.reversal_reason}</bdi>,
    ],
  ].filter(Boolean);

  return (
    <div className="transfer-details">
      {backLink}

      {shownNotice && (
        <div className="transfer-details__notice" role="status">
          <p>
            {t("dashboard.transfers.messages.reversed")}
            {shownNotice.reversalIds.length > 0 && (
              <>
                {" "}
                {t("dashboard.transfers.details.reversalEntries")}{" "}
                {shownNotice.reversalIds.map((id, index) => (
                  <span key={id}>
                    {index > 0 && ", "}
                    <Link to={getTransactionDetailsPath(id)}>
                      <bdi dir="ltr">#{id}</bdi>
                    </Link>
                  </span>
                ))}
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <header className="transfer-details__header">
        <span className="transfer-details__icon" aria-hidden="true">
          <LuArrowRightLeft />
        </span>

        <div className="transfer-details__identity">
          <h1 dir="auto">
            <bdi>{fromLabel}</bdi>
            {" → "}
            <bdi>{toLabel}</bdi>
          </h1>

          <div className="transfer-details__chips">
            <span className="transfer-details__chip">
              {t("dashboard.transactions.types.transfer")}
            </span>
            <TransactionStatusBadge status={transfer.status} labelsKey="dashboard.transfers.statuses" />
            {withFee && (
              <span className="transfer-details__chip">{t("dashboard.transfers.chips.withFee")}</span>
            )}
          </div>
        </div>

        {canReverse && (
          <div className="transfer-details__actions">
            <button
              type="button"
              className="transfer-details__action"
              onClick={() => setIsReversing(true)}
            >
              <LuUndo2 aria-hidden="true" />
              <span>{t("dashboard.transfers.actions.reverse")}</span>
            </button>
          </div>
        )}
      </header>

      <section className="transfer-details__amount-card">
        <span>{t("dashboard.transfers.fields.amount")}</span>
        <strong
          className={`transfer-details__amount${
            isReversed ? " transfer-details__amount--reversed" : ""
          }`}
          dir="ltr"
        >
          {money(transfer.amount)}
        </strong>
        <small>
          {dateTime(transfer.occurred_at)}
          {" · "}
          <bdi>
            {fromLabel} → {toLabel}
          </bdi>
        </small>
      </section>

      {isReversed && (
        <p className="transfer-details__note" role="note">
          <LuUndo2 aria-hidden="true" />
          <span>
            {t(
              withFee
                ? "dashboard.transfers.details.reversedWithFeeNote"
                : "dashboard.transfers.details.reversedNote",
            )}
          </span>
        </p>
      )}

      {!isReversed && !canReverse && (
        <p className="transfer-details__note transfer-details__note--info" role="note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.transfers.details.notPostedNote")}</span>
        </p>
      )}

      <section className="transfer-details__panel" aria-labelledby="transfer-movement-title">
        <h2 id="transfer-movement-title">{t("dashboard.transfers.details.movementTitle")}</h2>
        <p className="transfer-details__panel-hint">
          {t("dashboard.transfers.details.movementHint")}
        </p>

        <ul className="transfer-details__movements">
          {getTransferMovements(transfer).map((movement) => (
            <li className="transfer-details__movement" key={movement.key}>
              <span className="transfer-details__movement-label">
                {t(`dashboard.transfers.details.movements.${movement.key}`)}
              </span>
              <span className="transfer-details__movement-account">
                {accountLink(movement.account, movement.accountId)}
              </span>
              <span
                className={`transfer-details__movement-amount transfer-details__movement-amount--${movement.direction}`}
                dir="ltr"
              >
                {movement.direction === "out" ? "−" : "+"}
                {money(movement.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="transfer-details__panel" aria-labelledby="transfer-details-title">
        <h2 id="transfer-details-title">{t("dashboard.transfers.details.title")}</h2>

        <dl className="transfer-details__list">
          {rows.map(([key, value]) => (
            <div className="transfer-details__row" key={key}>
              <dt>{t(`dashboard.transfers.fields.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {transactions.length > 0 && (
        <section className="transfer-details__panel" aria-labelledby="transfer-transactions-title">
          <h2 id="transfer-transactions-title">
            {t("dashboard.transfers.details.transactionsTitle")}
          </h2>
          <p className="transfer-details__panel-hint">
            {t("dashboard.transfers.details.transactionsHint")}
          </p>

          <div className="transfer-details__table-wrap">
            <table className="transfer-details__table">
              <thead>
                <tr>
                  <th scope="col">{t("dashboard.transfers.details.transactionNumber")}</th>
                  <th scope="col">{t("dashboard.transactions.fields.type")}</th>
                  <th scope="col">{t("dashboard.transactions.fields.status")}</th>
                  <th scope="col">{t("dashboard.transactions.fields.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={transaction.id ?? index}>
                    <td>
                      {transaction.id != null ? (
                        <Link to={getTransactionDetailsPath(transaction.id)}>
                          <bdi dir="ltr">#{transaction.id}</bdi>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {translateEnum(
                        t,
                        i18n,
                        "dashboard.transactions.types",
                        transaction.type,
                      ) || "—"}
                    </td>
                    <td>
                      <TransactionStatusBadge status={transaction.status} />
                    </td>
                    <td className="transfer-details__table-amount" dir="ltr">
                      {transaction.amount != null
                        ? formatMoney(
                            transaction.amount,
                            transaction.currency_code ?? transfer.currency_code,
                            locale,
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isReversing && canReverse && (
        <ReverseTransferDialog
          transfer={transfer}
          onConfirm={handleReverse}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
