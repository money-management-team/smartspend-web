import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowRight, LuInfo, LuShieldCheck, LuSplit, LuTriangleAlert } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { savingsPlansApi } from "../../../api/savingsPlansApi";
import { createIdempotentAttempt } from "../../../FinancialOperations/transactionHelpers";
import {
  CONFIRM_WARNINGS,
  buildConfirmPayload,
  classifyPlanWriteError,
  getSmartPlanErrorMessage,
  pickDefaultAccountId,
  readConfirmationPreview,
} from "../../smartPlanHelpers";
import PlanDialog from "../PlanDialog/PlanDialog";

import "./ConfirmInstallmentDialog.css";

/*
 * Confirms one plan installment from a single account. Money moves only
 * here, and only when the user presses Confirm:
 *
 * 1. GET …/confirmation-preview — the current amount, versions, blocker,
 *    warnings and eligible accounts with their balances. Nothing is shown
 *    from before this request.
 * 2. The user picks the account (fixed for a single-account plan).
 * 3. POST …/confirm with exactly the preview's amount and versions and one
 *    Idempotency-Key per payload: an identical retry (after a timeout) reuses
 *    it, so the backend replays instead of moving the money twice.
 *
 * Any failure refetches the preview, so the dialog never offers to confirm
 * what it showed before: after a 409 the plan or installment changed and the
 * user reviews the new details; after an unknown outcome the new preview
 * shows whether it went through (an unchanged preview resubmits the same
 * key). `onOutdated` tells the page to refetch the plan when the dialog
 * closes.
 *
 * `onSplit` (priority and at-confirmation plans) offers to pay the
 * installment from several accounts instead, in FundingBreakdownDialog.
 */
export default function ConfirmInstallmentDialog({
  goal,
  installment,
  disabled = false,
  money,
  day,
  onConfirmed,
  onOutdated,
  onClose,
  onSplit,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlan.confirm";
  const goalId = goal.id;
  const installmentId = installment.id;

  const [attempt] = useState(() => createIdempotentAttempt("savings-installment"));
  const pendingRef = useRef(false);
  const [previewRequest, setPreviewRequest] = useState(0);
  const [preview, setPreview] = useState({ key: null, confirmation: null, error: null });
  const [selection, setSelection] = useState({ key: null, accountId: null });
  // The last submission's failure: { error, kind }, shown above the details.
  const [failure, setFailure] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    savingsPlansApi
      .getConfirmationPreview(goalId, installmentId, { signal: controller.signal })
      .then((response) => {
        const confirmation = readConfirmationPreview(response?.data?.confirmation, installmentId);

        setPreview(
          confirmation
            ? { key: previewRequest, confirmation, error: null }
            : {
                key: previewRequest,
                confirmation: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setPreview({ key: previewRequest, confirmation: null, error });
      });

    return () => controller.abort();
  }, [goalId, installmentId, previewRequest]);

  const isPreviewLoading = preview.key !== previewRequest;
  const confirmation = isPreviewLoading ? null : preview.confirmation;
  const previewError = isPreviewLoading ? null : preview.error;
  const accounts = confirmation?.accounts ?? [];
  const selectedId =
    selection.key === previewRequest ? selection.accountId : pickDefaultAccountId(confirmation);
  const selectedAccount = accounts.find(
    (account) => String(account.id) === String(selectedId) && account.covers_suggested_amount === true,
  );
  const blocker = confirmation?.blocker;
  const warnings = (confirmation?.warnings ?? []).filter((warning) => CONFIRM_WARNINGS.includes(warning));
  const canConfirm =
    !disabled &&
    !isRunning &&
    confirmation?.confirmable === true &&
    !blocker &&
    confirmation.savings_plan != null &&
    confirmation.suggested_amount != null &&
    selectedAccount != null;

  const message = (error, context) => getSmartPlanErrorMessage(error, t, i18n, context);
  const refetchPreview = () => setPreviewRequest((key) => key + 1);

  const handleConfirm = async () => {
    if (pendingRef.current || !canConfirm) return;

    const payload = buildConfirmPayload(confirmation, selectedAccount.id);
    const idempotencyKey = attempt.keyFor({ goalId, installmentId, ...payload });

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);

    try {
      const response = await savingsPlansApi.confirm(goalId, installmentId, payload, idempotencyKey);
      attempt.settle();
      onConfirmed(response?.data ?? null);
    } catch (error) {
      // 401: apiClient's session-expired flow takes over.
      if (error?.code === "UNAUTHENTICATED") return;

      const kind = classifyPlanWriteError(error);

      // Rejected for good: the next press is a new operation with a new key.
      // An unknown outcome keeps the key for an identical retry.
      if (kind !== "unknown") attempt.reset();

      setFailure({ error, kind });

      if (kind !== "final") {
        onOutdated();
        refetchPreview();
      }
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
    }
  };

  const eyebrow = t(`${prefix}.eyebrow`, { number: installment.sequence });

  let body;

  if (isPreviewLoading) {
    body = (
      <p className="plan-dialog__state" role="status">
        {t(`${prefix}.loading`)}
      </p>
    );
  } else if (previewError) {
    const canRetry = !["NOT_FOUND", "FORBIDDEN"].includes(previewError.code);

    body = (
      <div className="plan-dialog__state" role="alert">
        <p>{message(previewError, "preview")}</p>
        {canRetry && (
          <button type="button" onClick={refetchPreview}>
            {t("common.retry")}
          </button>
        )}
      </div>
    );
  } else {
    const planned = confirmation.installment;

    body = (
      <>
        {failure && (
          <div
            className={`plan-dialog__callout plan-dialog__callout--${
              failure.kind === "unknown" ? "warning" : "danger"
            }`}
            role="alert"
          >
            <LuTriangleAlert aria-hidden="true" />
            <div>
              <p dir="auto">{message(failure.error, "confirm")}</p>
              {failure.kind !== "final" && <p>{t(`${prefix}.reviewAgain`)}</p>}
            </div>
          </div>
        )}

        {blocker && (
          <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
            <LuInfo aria-hidden="true" />
            <p dir="auto">
              {message({ code: "CONFLICT", serverCode: blocker.code, payload: blocker, message: blocker.message }, "confirm")}
            </p>
          </div>
        )}

        <dl className="plan-dialog__facts">
          <div>
            <dt>{t(`${prefix}.goal`)}</dt>
            <dd dir="auto">{confirmation.savings_goal?.name ?? goal.name}</dd>
          </div>
          <div>
            <dt>{t(`${prefix}.dueDate`)}</dt>
            <dd>{day(planned.planned_date)}</dd>
          </div>
          <div>
            <dt>{t(`${prefix}.scheduledAmount`)}</dt>
            <dd>{money(planned.scheduled_amount)}</dd>
          </div>
          {confirmation.suggested_amount != null && (
            <div className="plan-dialog__total">
              <dt>{t(`${prefix}.amountToMove`)}</dt>
              <dd>{money(confirmation.suggested_amount)}</dd>
            </div>
          )}
        </dl>

        {warnings.length > 0 && (
          <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
            <LuInfo aria-hidden="true" />
            {warnings.length === 1 ? (
              <p>{t(`${prefix}.warnings.${warnings[0]}`)}</p>
            ) : (
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{t(`${prefix}.warnings.${warning}`)}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!blocker && accounts.length > 0 && (
          <fieldset className="confirm-installment__accounts" disabled={isRunning}>
            <legend>{t(`${prefix}.fromAccount`)}</legend>

            {accounts.map((account) => {
              const covers = account.covers_suggested_amount === true;
              const checked = String(account.id) === String(selectedAccount?.id);

              return (
                <label
                  key={account.id}
                  className={`confirm-installment__account${
                    checked ? " confirm-installment__account--checked" : ""
                  }${covers ? "" : " confirm-installment__account--short"}`}
                >
                  <input
                    type="radio"
                    name="confirm-installment-account"
                    value={account.id}
                    checked={checked}
                    disabled={!covers}
                    onChange={() => setSelection({ key: previewRequest, accountId: account.id })}
                  />
                  <span className="confirm-installment__account-name" dir="auto">
                    {account.name}
                  </span>
                  <span className="confirm-installment__account-balance">
                    {t(`${prefix}.available`)} {money(account.available_balance)}
                  </span>
                  {!covers && (
                    <small className="confirm-installment__account-note">
                      {t(`${prefix}.notEnough`)}
                    </small>
                  )}
                  {covers && account.allows_overdraft === true && (
                    <small className="confirm-installment__account-note">
                      {t(`${prefix}.overdraft`)}
                    </small>
                  )}
                </label>
              );
            })}
          </fieldset>
        )}

        {onSplit && !blocker && (
          <button type="button" className="confirm-installment__split" onClick={onSplit} disabled={isRunning}>
            <LuSplit aria-hidden="true" />
            <span>{t(`${prefix}.split`)}</span>
          </button>
        )}

        {canConfirm && (
          <p className="confirm-installment__statement">
            <LuShieldCheck aria-hidden="true" />
            <span>
              <span dir="auto">{selectedAccount.name}</span>
              <LuArrowRight className="confirm-installment__arrow" aria-hidden="true" />
              <span dir="auto">{confirmation.savings_goal?.name ?? goal.name}</span>
              <span className="confirm-installment__statement-hint">{t(`${prefix}.statement`)}</span>
            </span>
          </p>
        )}
      </>
    );
  }

  return (
    <PlanDialog
      id="confirm-installment"
      eyebrow={eyebrow}
      title={t(`${prefix}.title`)}
      busy={isRunning}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isRunning} autoFocus>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-busy={isRunning || undefined}
          >
            {t(
              isRunning
                ? `${prefix}.running`
                : failure?.kind === "unknown"
                  ? `${prefix}.retry`
                  : `${prefix}.submit`,
            )}
          </button>
        </>
      }
    >
      {body}
    </PlanDialog>
  );
}
