import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleCheck, LuTriangleAlert } from "react-icons/lu";

import { getApiErrorMessage } from "../../../api/apiClient";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import {
  CAPTURE_CONFIRM_SUMMARY_FIELDS,
  CAPTURE_MONEY_FIELDS,
} from "../../captureConstants";
import {
  canConfirmCapture,
  captureHasTransaction,
  getCaptureStatus,
  getConfirmErrorKind,
  humanizeCaptureField,
  isUncertainOutcome,
} from "../../captureHelpers";

// The same modal shell the other dashboard dialogs use.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./CaptureConfirm.css";

/*
 * POST /ai/expense-captures/{id}/confirm — the point where a reviewed receipt
 * becomes a real expense.
 *
 * This is the **only money-moving action in Sprint 7**. Everything before it
 * is a draft; after it the backend has run its posting pipeline and a
 * Transaction, its Ledger Entries, the account balance and any budget are all
 * affected. None of that is computed here: this component sends one request
 * and renders what the backend answers.
 *
 * Rendered only when `canConfirmCapture(status)` — `ready_for_review`. It
 * never posts on the first click: the dialog shows what will be recorded, and
 * that summary is the **reviewed draft**, never the AI's suggestions.
 *
 * The parent owns the request. `onConfirm()` saves any unsaved edits through
 * the existing PATCH flow, then confirms against the version PATCH returned,
 * and throws on failure. `onCheckStatus()` re-reads the capture, which is the
 * only safe answer to an outcome nobody knows.
 */
export default function CaptureConfirm({
  capture,
  values,
  accounts = [],
  categories = [],
  blockers = [],
  isDraftDirty = false,
  // Another write is in flight: the page's shared action lock.
  isBusy = false,
  onConfirm,
  onCheckStatus,
  onReloadLatest,
  onBusyChange,
}) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  /*
   * The outcome is genuinely unknown: the request never came back, so the
   * expense may or may not exist. Nothing here says it failed.
   */
  const [isUncertain, setIsUncertain] = useState(false);
  /*
   * Synchronous guard. A double click fires twice before React re-renders,
   * and this is the one request in the feature that must never go twice.
   */
  const pendingRef = useRef(false);

  const status = getCaptureStatus(capture);

  if (!canConfirmCapture(status)) return null;

  const setBusy = (busy) => {
    onBusyChange?.(busy);
  };

  const close = () => {
    if (pendingRef.current) return;
    setIsOpen(false);
    setError(null);
    setIsUncertain(false);
  };

  const confirm = async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsConfirming(true);
    setBusy(true);
    setError(null);

    try {
      await onConfirm();
      // The capture is confirmed now, so this whole section unmounts.
      setIsUncertain(false);
      setIsOpen(false);
    } catch (requestError) {
      // 401 is the global session-expired flow; nothing to show here.
      if (requestError?.code === "UNAUTHENTICATED") return;

      setError(requestError);

      /*
       * A timeout, a dropped connection or a 5xx leaves the expense in doubt.
       * One read — never a second POST — to find out whether the backend took
       * it. If that read is inconclusive the uncertain state stays on screen
       * with the check offered manually.
       */
      if (isUncertainOutcome(requestError)) {
        setIsUncertain(true);
        const fresh = await onCheckStatus().catch(() => null);
        if (fresh && captureHasTransaction(fresh)) setIsUncertain(false);
      }
    } finally {
      pendingRef.current = false;
      setIsConfirming(false);
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    if (pendingRef.current || isChecking) return;

    setIsChecking(true);

    try {
      // A read, and only a read. It can never create an expense.
      const fresh = await onCheckStatus();
      if (fresh && captureHasTransaction(fresh)) setIsUncertain(false);
    } catch {
      // The capture stays as it was; the uncertain state remains honest.
    } finally {
      setIsChecking(false);
    }
  };

  /* ---------- Summary ---------- */

  const named = (list, id) => {
    const match = list.find((item) => String(item.id) === String(id));
    return match?.name ?? `#${id}`;
  };

  const label = (field) => {
    const key = `dashboard.aiCaptures.fields.${field}`;
    return i18n.exists(key) ? t(key) : humanizeCaptureField(field);
  };

  const renderValue = (field, value) => {
    if (field === "account_id") return <bdi dir="auto">{named(accounts, value)}</bdi>;
    if (field === "category_id") return <bdi dir="auto">{named(categories, value)}</bdi>;

    // Display only. The stored value stays the backend's decimal string.
    if (CAPTURE_MONEY_FIELDS.includes(field)) {
      return <bdi dir="ltr">{formatMoney(value, values.currency_code, locale)}</bdi>;
    }

    if (field === "transaction_date") return <bdi dir="ltr">{formatDate(value, locale)}</bdi>;
    if (field === "currency_code") return <bdi dir="ltr">{String(value)}</bdi>;

    return <bdi dir="auto">{String(value)}</bdi>;
  };

  const summary = CAPTURE_CONFIRM_SUMMARY_FIELDS.filter(
    (field) => String(values?.[field] ?? "").trim() !== "",
  );

  /* ---------- Error presentation ---------- */

  const kind = getConfirmErrorKind(error);
  const isVersionConflict = kind === "version";
  const isBalance = kind === "balance";
  const isForbidden = error?.code === "FORBIDDEN";
  const isNotFound = error?.code === "NOT_FOUND";

  const errorMessage = isVersionConflict
    ? t("dashboard.aiCaptures.form.conflict.message")
    : isBalance
      ? t("dashboard.aiCaptures.confirm.insufficientBalance")
      : isForbidden
        ? t("dashboard.aiCaptures.details.forbiddenMessage")
        : isNotFound
          ? t("dashboard.aiCaptures.details.notFoundMessage")
          : kind === "fields"
            ? t("dashboard.aiCaptures.confirm.fieldErrors")
            : kind === "lifecycle"
              ? t("dashboard.aiCaptures.confirm.lifecycle")
              : getApiErrorMessage(error, t);

  const isBlocked = blockers.length > 0;

  return (
    <section className="capture-confirm" aria-labelledby="capture-confirm-title">
      <header className="capture-confirm__header">
        <h2 id="capture-confirm-title">
          <LuCircleCheck aria-hidden="true" />
          {t("dashboard.aiCaptures.confirm.title")}
        </h2>
        <p>{t("dashboard.aiCaptures.confirm.description")}</p>
      </header>

      {/*
        * What the saved draft is still missing. Named rather than described as
        * "invalid", so the user knows which field to fill in.
        */}
      {isBlocked && (
        <p className="capture-confirm__blocked" role="note">
          {t("dashboard.aiCaptures.confirm.blocked", {
            fields: blockers.map(label).join(t("dashboard.aiCaptures.confirm.separator")),
          })}
        </p>
      )}

      <button
        type="button"
        className="capture-confirm__open"
        onClick={() => setIsOpen(true)}
        disabled={isBlocked || isConfirming || isBusy}
      >
        <LuCircleCheck aria-hidden="true" />
        {t("dashboard.aiCaptures.confirm.open")}
      </button>

      {isOpen && (
        <div
          className="account-form-modal"
          role="presentation"
          onMouseDown={close}
          onKeyDown={(event) => event.key === "Escape" && close()}
        >
          <section
            className="account-form-modal__dialog capture-confirm__dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="capture-confirm-dialog-title"
            aria-describedby="capture-confirm-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="capture-confirm-dialog-title">
                {t("dashboard.aiCaptures.confirm.dialogTitle")}
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={isConfirming}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </header>

            <div id="capture-confirm-dialog-description" className="capture-confirm__body">
              <p>{t("dashboard.aiCaptures.confirm.effects.intro")}</p>

              <ul>
                <li>{t("dashboard.aiCaptures.confirm.effects.transaction")}</li>
                <li>{t("dashboard.aiCaptures.confirm.effects.account")}</li>
                <li>{t("dashboard.aiCaptures.confirm.effects.budget")}</li>
                <li>{t("dashboard.aiCaptures.confirm.effects.reviewed")}</li>
              </ul>

              {/*
                * Unsaved edits are saved first, because the backend confirms
                * the draft it already holds. Said plainly rather than done
                * silently.
                */}
              {isDraftDirty && (
                <p className="capture-confirm__note" role="note">
                  {t("dashboard.aiCaptures.confirm.willSaveFirst")}
                </p>
              )}

              <h3>{t("dashboard.aiCaptures.confirm.summaryTitle")}</h3>

              {summary.length === 0 ? (
                <p className="capture-confirm__note">
                  {t("dashboard.aiCaptures.confirm.summaryEmpty")}
                </p>
              ) : (
                <dl className="capture-confirm__summary">
                  {summary.map((field) => (
                    <div className="capture-confirm__row" key={field}>
                      <dt>{label(field)}</dt>
                      <dd>{renderValue(field, values[field])}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {/*
              * Unknown, not failed. The expense may exist, so nothing here
              * invites another attempt before the status has been read.
              */}
            {isUncertain && (
              <div className="capture-confirm__uncertain" role="alert">
                <p>
                  <LuTriangleAlert aria-hidden="true" />
                  <span>{t("dashboard.aiCaptures.confirm.uncertainTitle")}</span>
                </p>
                <p>{t("dashboard.aiCaptures.confirm.uncertainBody")}</p>
              </div>
            )}

            {error && !isUncertain && (
              <div className="capture-confirm__error" role="alert">
                <p dir="auto">{errorMessage}</p>

                {isVersionConflict && <p>{t("dashboard.aiCaptures.form.conflict.discards")}</p>}
                {isBalance && <p>{t("dashboard.aiCaptures.confirm.nothingRecorded")}</p>}
              </div>
            )}

            <footer className="capture-confirm__actions">
              {/*
                * After an uncertain result the only safe next step is a read.
                * Retrying keeps the same Idempotency-Key, so it replays the
                * original request rather than creating a second expense.
                */}
              {isUncertain && (
                <button
                  type="button"
                  className="capture-confirm__check"
                  onClick={checkStatus}
                  disabled={isChecking || isConfirming}
                >
                  {t(
                    isChecking
                      ? "dashboard.aiCaptures.confirm.checking"
                      : "dashboard.aiCaptures.confirm.checkStatus",
                  )}
                </button>
              )}

              {isVersionConflict ? (
                <button
                  type="button"
                  className="capture-confirm__submit"
                  onClick={onReloadLatest}
                >
                  {t("dashboard.aiCaptures.form.conflict.reload")}
                </button>
              ) : (
                !isForbidden &&
                !isNotFound && (
                  <button
                    type="button"
                    className="capture-confirm__submit"
                    onClick={confirm}
                    disabled={isConfirming || isChecking}
                    aria-busy={isConfirming}
                  >
                    <LuCircleCheck aria-hidden="true" />
                    {t(
                      isConfirming
                        ? "dashboard.aiCaptures.confirm.confirming"
                        : isUncertain || error
                          ? "dashboard.aiCaptures.confirm.retry"
                          : "dashboard.aiCaptures.confirm.submit",
                    )}
                  </button>
                )
              )}

              <button
                type="button"
                className="capture-confirm__cancel"
                onClick={close}
                disabled={isConfirming}
              >
                {t("common.cancel")}
              </button>
            </footer>

            {/* Announced rather than conveyed by a disabled button alone. */}
            <p className="capture-confirm__status" role="status">
              {isConfirming
                ? t("dashboard.aiCaptures.confirm.confirming")
                : isChecking
                  ? t("dashboard.aiCaptures.confirm.checking")
                  : ""}
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
