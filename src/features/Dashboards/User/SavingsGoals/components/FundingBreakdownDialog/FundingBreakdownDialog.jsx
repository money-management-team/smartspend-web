import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowLeft, LuInfo, LuPlus, LuShieldCheck, LuTrash2, LuTriangleAlert } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { savingsPlansApi } from "../../../api/savingsPlansApi";
import { createIdempotentAttempt } from "../../../FinancialOperations/transactionHelpers";
import {
  CONFIRM_WARNINGS,
  EDITABLE_FUNDING_MODES,
  MAX_FUNDING_LEGS,
  buildConfirmAccountsPayload,
  classifyPlanWriteError,
  getBreakdownKey,
  getSmartPlanErrorMessage,
  readFundingPreview,
  remainingToAllocate,
  toDraftLegs,
  validateDraftLegs,
} from "../../smartPlanHelpers";
import FundingLegs from "../FundingLegs/FundingLegs";
import PlanDialog from "../PlanDialog/PlanDialog";

import "./FundingBreakdownDialog.css";

const isZero = (value) => /^-?0*(\.0*)?$/.test(String(value ?? "").trim());

/*
 * Confirms one installment from several accounts
 * (POST …/funding-preview, then POST …/confirm-accounts).
 *
 * Build: the backend proposes the breakdown (allocated: the plan's shares,
 * fixed; priority: filled in the plan's order) or, where the mode allows it
 * (priority, at_confirmation), the user writes their own split and asks the
 * backend to check it. Every amount shown is the backend's; the only
 * arithmetic here is "left to allocate", in exact BigInt minor units.
 *
 * Approve: the exact breakdown the backend checked and signed, how each
 * part will move, and an explicit approval. Confirm sends that breakdown
 * with its `confirmation_intent` unchanged and one Idempotency-Key per
 * payload. Nothing moves before that press; opening the dialog or
 * previewing moves nothing.
 *
 * Any edit makes the signed preview stale (it can't be approved until
 * checked again). Any failed confirmation goes back to Build with a fresh
 * preview of the same breakdown — never a different one — and needs a new
 * approval; an unknown outcome keeps the key, so an unchanged breakdown
 * resends the identical request and the backend replays it.
 */
export default function FundingBreakdownDialog({
  goal,
  installment,
  mode,
  disabled = false,
  money,
  day,
  onConfirmed,
  onOutdated,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlan.funding.confirm";
  const goalId = goal.id;
  const installmentId = installment.id;
  const canEdit = EDITABLE_FUNDING_MODES.includes(mode);

  const [attempt] = useState(() => createIdempotentAttempt("savings-installment-legs"));
  const pendingRef = useRef(false);
  // The breakdown asked for ({ account_id, amount } list): null = the
  // backend's proposal.
  const [request, setRequest] = useState({ legs: null, nonce: 0 });
  const [preview, setPreview] = useState({ key: null, data: null, error: null });
  // The user's own split while editing (null = not editing).
  const [draft, setDraft] = useState(null);
  const [showDraftError, setShowDraftError] = useState(false);
  const [stage, setStage] = useState("build");
  const [approved, setApproved] = useState(false);
  const [failure, setFailure] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const requestKey = `${getBreakdownKey(null, request.legs)}#${request.nonce}`;

  useEffect(() => {
    const controller = new AbortController();
    const legs = JSON.parse(requestKey.slice(0, requestKey.lastIndexOf("#"))).legs;

    savingsPlansApi
      .fundingPreview(
        goalId,
        installmentId,
        legs ? { legs: legs.map(([account_id, amount]) => ({ account_id, amount })) } : {},
        { signal: controller.signal },
      )
      .then((response) => {
        const data = readFundingPreview(response?.data?.funding_preview, installmentId);
        setPreview(
          data
            ? { key: requestKey, data, error: null }
            : { key: requestKey, data: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setPreview({ key: requestKey, data: null, error });
      });

    return () => controller.abort();
  }, [goalId, installmentId, requestKey]);

  const loading = preview.key !== requestKey;
  const data = loading ? null : preview.data;
  const previewError = loading ? null : preview.error;
  const funding = data?.funding;
  const total = funding?.amount ?? data?.suggested_amount ?? null;
  const accounts = data?.accounts ?? [];
  const accountsById = new Map(accounts.map((account) => [String(account.id), account]));
  const blocker = data?.blocker;
  const warnings = (data?.warnings ?? []).filter((warning) => CONFIRM_WARNINGS.includes(warning));

  // At-confirmation has no proposal: the user always writes the split.
  const needsSplit = funding?.problem === "breakdown_required";
  const editing = canEdit && (draft !== null || needsSplit);
  const draftLegs = draft ?? (needsSplit ? [{ account_id: "", amount: total ?? "" }] : []);
  const draftError = editing ? validateDraftLegs(draftLegs, total) : null;
  // The preview shown is the one for the split being edited only if nothing changed since.
  const draftChecked =
    !editing || (request.legs !== null && getBreakdownKey(null, draftLegs) === getBreakdownKey(null, request.legs));
  const canApprove =
    !disabled && !isRunning && !loading && data?.confirmable === true && Boolean(data.confirmation_intent) && draftChecked;

  const message = (error, context) => getSmartPlanErrorMessage(error, t, i18n, context);
  const refetch = () => setRequest((current) => ({ ...current, nonce: current.nonce + 1 }));

  const editDraft = (next) => {
    setDraft(next);
    setApproved(false);
  };

  const checkSplit = () => {
    setShowDraftError(true);
    if (draftError) return;
    setFailure(null);
    const legs = draftLegs.map((leg) => ({ account_id: String(leg.account_id), amount: String(leg.amount).trim() }));
    setDraft(legs);
    setRequest({ legs, nonce: request.nonce + 1 });
  };

  const handleConfirm = async () => {
    if (pendingRef.current || !approved || !canApprove) return;

    const payload = buildConfirmAccountsPayload(data);
    const idempotencyKey = attempt.keyFor({ goalId, installmentId, ...payload });

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);

    try {
      const response = await savingsPlansApi.confirmAccounts(goalId, installmentId, payload, idempotencyKey);
      attempt.settle();
      onConfirmed(response?.data ?? null);
    } catch (error) {
      // 401: apiClient's session-expired flow takes over.
      if (error?.code === "UNAUTHENTICATED") return;

      const kind = classifyPlanWriteError(error);
      if (kind !== "unknown") attempt.reset();

      setFailure({ error, kind });
      setApproved(false);
      setStage("build");

      if (kind !== "final") {
        onOutdated();
        // The same breakdown, checked again from current data.
        refetch();
      }
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
    }
  };

  /* ---------- Body ---------- */

  const failureBanner = failure && (
    <div className={`plan-dialog__callout plan-dialog__callout--${failure.kind === "unknown" ? "warning" : "danger"}`} role="alert">
      <LuTriangleAlert aria-hidden="true" />
      <div>
        <p dir="auto">{message(failure.error, "confirm")}</p>
        {failure.kind !== "final" && <p>{t(`${prefix}.reviewAgain`)}</p>}
      </div>
    </div>
  );

  let body;

  if (loading) {
    body = (
      <p className="plan-dialog__state" role="status">
        {t(`${prefix}.loading`)}
      </p>
    );
  } else if (previewError) {
    const canRetry = !["NOT_FOUND", "FORBIDDEN"].includes(previewError.code);
    body = (
      <>
        {failureBanner}
        <div className="plan-dialog__state" role="alert">
          <p>{message(previewError, "preview")}</p>
          {canRetry && (
            <button type="button" onClick={refetch}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </>
    );
  } else if (stage === "approve") {
    body = (
      <>
        <p className="funding-breakdown__lead">{t(`${prefix}.approveLead`, { count: funding.legs.length })}</p>
        <FundingLegs
          rows={funding.legs.map((leg) => ({ id: leg.account_id, name: leg.account_name, amount: leg.amount }))}
          goalName={goal.name}
          money={money}
          total={funding.amount}
          totalLabel={t(`${prefix}.total`)}
        />
        <ul className="funding-breakdown__facts">
          <li>{t(`${prefix}.facts.separate`, { count: funding.legs.length })}</li>
          <li>{t(`${prefix}.facts.together`)}</li>
          <li>{t(`${prefix}.facts.recheck`)}</li>
        </ul>
        <label className="funding-breakdown__approve">
          <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} disabled={isRunning} />
          <span>{t(`${prefix}.approve`)}</span>
        </label>
      </>
    );
  } else {
    const remaining = editing ? remainingToAllocate(total, draftLegs) : null;
    const problem = funding?.problem && funding.problem !== "breakdown_required" ? funding.problem : null;

    body = (
      <>
        {failureBanner}

        {blocker && (
          <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
            <LuInfo aria-hidden="true" />
            <p dir="auto">{message({ code: "CONFLICT", serverCode: blocker.code, payload: blocker, message: blocker.message }, "confirm")}</p>
          </div>
        )}

        <dl className="plan-dialog__facts">
          <div>
            <dt>{t("dashboard.savingsGoals.smartPlan.confirm.dueDate")}</dt>
            <dd>{day(data.installment?.planned_date)}</dd>
          </div>
          <div>
            <dt>{t("dashboard.savingsGoals.smartPlan.confirm.scheduledAmount")}</dt>
            <dd>{money(data.installment?.scheduled_amount)}</dd>
          </div>
          {total != null && (
            <div className="plan-dialog__total">
              <dt>{t("dashboard.savingsGoals.smartPlan.confirm.amountToMove")}</dt>
              <dd>{money(total)}</dd>
            </div>
          )}
        </dl>

        {warnings.length > 0 && (
          <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
            <LuInfo aria-hidden="true" />
            {warnings.length === 1 ? (
              <p>{t(`dashboard.savingsGoals.smartPlan.confirm.warnings.${warnings[0]}`)}</p>
            ) : (
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{t(`dashboard.savingsGoals.smartPlan.confirm.warnings.${warning}`)}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!blocker && (
          <section className="funding-breakdown" aria-labelledby="funding-breakdown-title">
            <header className="funding-breakdown__head">
              <h3 id="funding-breakdown-title">{t(`${prefix}.breakdownTitle`)}</h3>
              <span className="funding-breakdown__mode">{t(`dashboard.savingsGoals.smartPlan.funding.modes.${mode}`)}</span>
            </header>
            <p className="funding-breakdown__hint">{t(`${prefix}.modeHints.${mode}`)}</p>

            {editing ? (
              <>
                <ol className="funding-breakdown__editor">
                  {draftLegs.map((leg, index) => {
                    const account = accountsById.get(String(leg.account_id));
                    const taken = new Set(draftLegs.filter((_, i) => i !== index).map((other) => String(other.account_id)));
                    const update = (patch) => editDraft(draftLegs.map((item, i) => (i === index ? { ...item, ...patch } : item)));

                    return (
                      <li key={index} className="funding-breakdown__leg">
                        <label className="funding-breakdown__field funding-breakdown__field--account">
                          <span>{t(`${prefix}.account`)}</span>
                          <select value={leg.account_id} onChange={(event) => update({ account_id: event.target.value })}>
                            <option value="">{t(`${prefix}.chooseAccount`)}</option>
                            {accounts.map((option) => (
                              <option key={option.id} value={option.id} disabled={taken.has(String(option.id))}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                          {account && (
                            <small>
                              {t(`${prefix}.available`)} {money(account.available_balance)}
                            </small>
                          )}
                        </label>
                        <label className="funding-breakdown__field funding-breakdown__field--amount">
                          <span>{t(`${prefix}.amount`)}</span>
                          <input
                            inputMode="decimal"
                            dir="ltr"
                            value={leg.amount}
                            onChange={(event) => update({ amount: event.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="funding-breakdown__remove"
                          onClick={() => editDraft(draftLegs.filter((_, i) => i !== index))}
                          disabled={draftLegs.length === 1}
                          aria-label={t(`${prefix}.removeLeg`, { number: index + 1 })}
                        >
                          <LuTrash2 aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <div className="funding-breakdown__editor-foot">
                  {draftLegs.length < Math.min(MAX_FUNDING_LEGS, accounts.length) && (
                    <button
                      type="button"
                      className="funding-breakdown__add"
                      onClick={() => editDraft([...draftLegs, { account_id: "", amount: "" }])}
                    >
                      <LuPlus aria-hidden="true" />
                      <span>{t(`${prefix}.addLeg`)}</span>
                    </button>
                  )}
                  <p className={`funding-breakdown__remaining${remaining !== null && isZero(remaining) ? " funding-breakdown__remaining--ok" : ""}`} aria-live="polite">
                    {remaining === null
                      ? t(`${prefix}.remainingUnknown`)
                      : isZero(remaining)
                        ? t(`${prefix}.allocated`)
                        : (
                          <>
                            {t(`${prefix}.remaining`)} {money(remaining)}
                          </>
                        )}
                  </p>
                </div>

                {showDraftError && draftError && (
                  <p className="funding-breakdown__error" role="alert">
                    {t(`${prefix}.validation.${draftError}`, { max: MAX_FUNDING_LEGS })}
                  </p>
                )}

                {!draftChecked && !draftError && <p className="funding-breakdown__hint">{t(`${prefix}.checkFirst`)}</p>}
              </>
            ) : (
              <FundingLegs
                rows={(funding?.legs ?? []).map((leg) => ({
                  id: leg.account_id,
                  name: leg.account_name,
                  amount: leg.amount,
                  detail:
                    leg.available_balance != null ? (
                      <>
                        {t(`${prefix}.available`)} {money(leg.available_balance)}
                      </>
                    ) : null,
                }))}
                money={money}
              />
            )}

            {draftChecked && problem && (
              <div className="plan-dialog__callout plan-dialog__callout--danger" role="alert">
                <LuTriangleAlert aria-hidden="true" />
                <p>
                  {t(`${prefix}.problems.${problem}`)}
                  {problem === "insufficient_balance" && !isZero(funding.shortfall_amount) && (
                    <>
                      {" "}
                      {t(`${prefix}.shortBy`)} {money(funding.shortfall_amount)}
                    </>
                  )}
                </p>
              </div>
            )}

            {canEdit && !editing && (
              <button type="button" className="funding-breakdown__change" onClick={() => editDraft(toDraftLegs(funding?.legs))}>
                {t(`${prefix}.changeSplit`)}
              </button>
            )}
          </section>
        )}
      </>
    );
  }

  /* ---------- Footer ---------- */

  const footer =
    stage === "approve" ? (
      <>
        <button type="button" onClick={() => { setStage("build"); setApproved(false); }} disabled={isRunning}>
          <LuArrowLeft className="funding-breakdown__back-icon" aria-hidden="true" /> {t(`${prefix}.back`)}
        </button>
        <button type="submit" onClick={handleConfirm} disabled={!approved || !canApprove} aria-busy={isRunning || undefined}>
          <LuShieldCheck className="funding-breakdown__submit-icon" aria-hidden="true" />{" "}
          {t(isRunning ? `${prefix}.running` : failure?.kind === "unknown" ? `${prefix}.retry` : `${prefix}.submit`)}
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={onClose} disabled={isRunning} autoFocus>
          {t("common.cancel")}
        </button>
        {editing && !draftChecked ? (
          <button type="submit" onClick={checkSplit} disabled={loading || disabled}>
            {t(`${prefix}.check`)}
          </button>
        ) : (
          <button type="submit" onClick={() => setStage("approve")} disabled={!canApprove}>
            {t(`${prefix}.review`)}
          </button>
        )}
      </>
    );

  return (
    <PlanDialog
      id="funding-breakdown"
      eyebrow={t("dashboard.savingsGoals.smartPlan.confirm.eyebrow", { number: installment.sequence })}
      title={t(stage === "approve" ? `${prefix}.approveTitle` : `${prefix}.title`)}
      busy={isRunning}
      onClose={onClose}
      footer={footer}
    >
      {body}
    </PlanDialog>
  );
}
