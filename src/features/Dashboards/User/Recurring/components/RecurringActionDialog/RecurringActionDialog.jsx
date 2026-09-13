import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuTriangleAlert } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { getAccountLabel } from "../../../Transfers/transferHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import RecurringBadge from "../RecurringBadge/RecurringBadge";
import {
  REASON_MAX,
  getConfirmErrorHint,
  getFailedOccurrence,
  getRecurringErrorMessage,
  getRuleCurrency,
  getSchedule,
  isOverdueOccurrence,
  isUnknownOutcome,
} from "../../recurringHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./RecurringActionDialog.css";

// What each action explains before it runs.
const POINTS = {
  pause: ["temporary", "noProcessing", "notArchive"],
  resume: ["recalculated", "noRetroactive"],
  archive: ["notDeleted", "keepsHistory", "stopsFuture", "cancelsOpen"],
  confirm: ["movesMoney", "oldestOpen", "createsTransaction"],
  skip: ["noMoney", "oldestOpen", "keptInHistory"],
};

// Codes that leave the page out of date: it is refetched when the dialog
// closes.
const OUTDATING_CODES = ["NOT_FOUND", "CONFLICT", "VALIDATION_ERROR"];

/*
 * Confirms one action on a recurring rule:
 * - "pause" / "resume"  → POST …/pause | …/resume (no body)
 * - "archive"           → DELETE …/{id} (an archive, never a deletion)
 * - "confirm"           → POST …/confirm-next: MOVES MONEY, posts the oldest
 *                         open occurrence as a real transaction
 * - "skip"              → POST …/skip-next (optional reason): moves no money
 *
 * `onConfirm(reason)` performs the request and throws on failure; errors are
 * shown here. A confirm whose outcome is unknown (network error, timeout,
 * 5xx) can't be retried from this dialog: the page is refreshed first, so the
 * next attempt can't post a later occurrence by mistake. `onOutdated` tells
 * the parent to refetch when the dialog closes.
 */
export default function RecurringActionDialog({ action, rule, onConfirm, onClose, onOutdated }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const pendingRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const prefix = `dashboard.recurring.actionDialog.${action}`;
  const showsOccurrence = action === "confirm" || action === "skip";
  const { known, next } = getSchedule(rule);
  const currency = next?.currency_code || getRuleCurrency(rule);

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleConfirm = async () => {
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current || isBlocked) return;

    const trimmedReason = reason.trim();
    if (action === "skip" && trimmedReason.length > REASON_MAX) {
      setFailure({
        message: t("dashboard.recurring.validation.reasonTooLong", { max: REASON_MAX }),
        hint: "",
        occurrence: null,
      });
      return;
    }

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);

    try {
      await onConfirm(action === "skip" ? trimmedReason : undefined);
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        const unknownOutcome = isUnknownOutcome(error);

        setFailure({
          message: getRecurringErrorMessage(error, t, action),
          hint:
            action === "confirm"
              ? getConfirmErrorHint(error, t)
              : unknownOutcome
                ? t("dashboard.recurring.errors.unknownActionOutcome")
                : "",
          occurrence: action === "confirm" ? getFailedOccurrence(error) : null,
          fieldError: error?.errors?.reason?.[0] ?? "",
        });

        if (unknownOutcome && action === "confirm") setIsBlocked(true);
        if (unknownOutcome || OUTDATING_CODES.includes(error?.code)) onOutdated?.();
      }
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
    }
  };

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className={`account-form-modal__dialog recurring-action-dialog recurring-action-dialog--${action}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recurring-action-title"
        aria-describedby="recurring-action-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="recurring-action-title" dir="auto">
            {t(`${prefix}.title`, { name: rule.name })}
          </h2>
          <button type="button" onClick={close} disabled={isRunning} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <div id="recurring-action-description" className="recurring-action-dialog__body">
          <p>{t(`${prefix}.description`)}</p>
          <ul>
            {POINTS[action].map((point) => (
              <li key={point}>{t(`${prefix}.${point}`)}</li>
            ))}
          </ul>
        </div>

        {showsOccurrence && (
          <div className="recurring-action-dialog__occurrence">
            <strong>{t("dashboard.recurring.nextOccurrence.title")}</strong>
            {next ? (
              <dl>
                <div>
                  <dt>{t("dashboard.recurring.fields.dueDate")}</dt>
                  <dd>
                    <bdi>{formatDate(next.due_date, locale)}</bdi>
                    {isOverdueOccurrence(next) && <RecurringBadge kind="overdue" />}
                  </dd>
                </div>
                <div>
                  <dt>{t("dashboard.recurring.fields.amount")}</dt>
                  <dd>
                    <bdi>{formatMoney(next.amount ?? rule.amount, currency, locale)}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>{t("dashboard.recurring.fields.account")}</dt>
                  <dd dir="auto">{getAccountLabel(rule.account, rule.account_id)}</dd>
                </div>
                {next.status && (
                  <div>
                    <dt>{t("dashboard.recurring.fields.status")}</dt>
                    <dd>
                      <RecurringBadge kind="occurrence" value={next.status} />
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p>
                {t(
                  known
                    ? "dashboard.recurring.nextOccurrence.none"
                    : "dashboard.recurring.nextOccurrence.chosenByServer",
                )}
              </p>
            )}
          </div>
        )}

        {action === "skip" && (
          <label className="recurring-action-dialog__reason">
            <span>
              {t("dashboard.recurring.fields.reason")} ({t("dashboard.transactions.form.optional")})
            </span>
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setFailure(null);
              }}
              maxLength={REASON_MAX}
              placeholder={t("dashboard.recurring.actionDialog.skip.reasonPlaceholder")}
              disabled={isRunning}
              aria-invalid={failure?.fieldError ? true : undefined}
              dir="auto"
            />
            {failure?.fieldError && <small>{failure.fieldError}</small>}
          </label>
        )}

        {failure && (
          <div className="account-form-modal__error recurring-action-dialog__error" role="alert">
            <p dir="auto">{failure.message}</p>
            {failure.occurrence && (
              <dl className="recurring-action-dialog__failure">
                {failure.occurrence.due_date && (
                  <div>
                    <dt>{t("dashboard.recurring.fields.dueDate")}</dt>
                    <dd>
                      <bdi>{formatDate(failure.occurrence.due_date, locale)}</bdi>
                    </dd>
                  </div>
                )}
                {failure.occurrence.status && (
                  <div>
                    <dt>{t("dashboard.recurring.fields.status")}</dt>
                    <dd>
                      <RecurringBadge kind="occurrence" value={failure.occurrence.status} />
                    </dd>
                  </div>
                )}
                {failure.occurrence.attempts != null && (
                  <div>
                    <dt>{t("dashboard.recurring.fields.attempts")}</dt>
                    <dd>
                      <bdi>{failure.occurrence.attempts}</bdi>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {failure.hint && (
              <p className="recurring-action-dialog__hint">
                <LuTriangleAlert aria-hidden="true" />
                <span>{failure.hint}</span>
              </p>
            )}
          </div>
        )}

        <footer>
          <button type="button" onClick={close} disabled={isRunning} autoFocus>
            {t(isBlocked ? "common.close" : "common.cancel")}
          </button>
          <button
            type="submit"
            onClick={handleConfirm}
            disabled={isRunning || isBlocked}
            aria-busy={isRunning || undefined}
          >
            {t(
              isRunning
                ? `${prefix}.running`
                : failure && action === "confirm" && !isBlocked
                  ? `${prefix}.retry`
                  : `${prefix}.confirm`,
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
