import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuHistory, LuInfo, LuRotateCcw, LuTriangleAlert } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { savingsPlansApi } from "../../../api/savingsPlansApi";
import { createIdempotentAttempt } from "../../../FinancialOperations/transactionHelpers";
import { sumMoney } from "../../../utils/formatters";
import {
  REVERSAL_REASON_MAX,
  REVERSAL_REASON_MIN,
  buildReversePayload,
  classifyPlanWriteError,
  getSmartPlanErrorMessage,
  readFundingLegs,
} from "../../smartPlanHelpers";
import FundingLegs from "../FundingLegs/FundingLegs";
import PlanDialog from "../PlanDialog/PlanDialog";

import "./ReverseLegsDialog.css";

const isZero = (value) => /^-?0*(\.0*)?$/.test(String(value ?? "").trim());

/*
 * Reverses payments of a multi-account installment (POST …/reverse-legs):
 * the chosen ones, or every one still in the goal. Money goes back to each
 * payment's own account; reversed payments stay in the history.
 *
 * Every opening reads the installment's payments fresh
 * (GET …/funding-legs) — also after a reload — and everything shown and
 * sent comes from that read: the amounts, which legs can be chosen (only
 * ids in `reversal.effective_leg_ids`) and `expected_lock_version`.
 * Earlier confirmation cycles are listed separately, read only.
 *
 * A reason (3–500 characters) and an explicit acknowledgement are required.
 * One Idempotency-Key per payload. A 409 / 404 / 422 means the payments
 * changed: they are read again, the choice and acknowledgement are cleared
 * and the user reviews again — a different set is never reversed. An
 * unknown outcome keeps the key and reads the payments again: if nothing
 * changed, the same choice resends the identical request, which the backend
 * replays instead of reversing twice.
 */
export default function ReverseLegsDialog({ goal, installment, disabled = false, money, day, onReversed, onOutdated, onClose }) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlan.reverse";
  const goalId = goal.id;
  const installmentId = installment.id;

  const [attempt] = useState(() => createIdempotentAttempt("savings-installment-reverse"));
  const pendingRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [failure, setFailure] = useState(null);

  /* ---------- Fresh payments ---------- */

  const [request, setRequest] = useState(0);
  const [result, setResult] = useState({ key: null, legs: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    savingsPlansApi
      .getFundingLegs(goalId, installmentId, { signal: controller.signal })
      .then((response) => {
        const legs = readFundingLegs(response?.data, installmentId);
        setResult(
          legs
            ? { key: request, legs, error: null }
            : { key: request, legs: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: request, legs: null, error });
      });

    return () => controller.abort();
  }, [goalId, installmentId, request]);

  const loading = result.key !== request;
  const data = loading ? null : result.legs;
  const loadError = loading ? null : result.error;
  const lockVersion = data?.reversal.lockVersion ?? null;
  const reload = () => setRequest((value) => value + 1);

  /* ---------- Choice (belongs to one version and one review) ---------- */

  const [review, setReview] = useState(0);
  const choiceKey = `${lockVersion}#${review}`;
  const blank = { key: choiceKey, scope: "all", ids: [], acknowledged: false };
  const [stored, setChoice] = useState(blank);
  const choice = stored.key === choiceKey ? stored : blank;
  const update = (patch) => setChoice({ ...choice, ...patch, key: choiceKey });

  const [reason, setReason] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const currentLegs = data?.current?.funding_legs ?? [];
  const selectable = currentLegs.filter((leg) => leg.selectable);
  const canChoose = selectable.length > 1;
  const chosen = choice.scope === "some" ? selectable.filter((leg) => choice.ids.includes(leg.id)) : selectable;
  const reverseTotal =
    choice.scope === "some"
      ? chosen.length > 0
        ? sumMoney(chosen.map((leg) => leg.amount))
        : null
      : data?.installment.effective_amount ?? null;

  const trimmed = reason.trim();
  const reasonError =
    trimmed.length < REVERSAL_REASON_MIN ? "reasonShort" : trimmed.length > REVERSAL_REASON_MAX ? "reasonLong" : null;
  const selectionError = choice.scope === "some" && chosen.length === 0 ? "chooseLeg" : null;
  const eligible = data?.reversal.eligible === true && selectable.length > 0;
  // Pressable once acknowledged, so a short reason or an empty choice can be explained.
  const canPress = !disabled && !isRunning && !loading && eligible && choice.acknowledged;

  const toggle = (id) =>
    update({ ids: choice.ids.includes(id) ? choice.ids.filter((other) => other !== id) : [...choice.ids, id], acknowledged: false });

  const handleSubmit = async () => {
    setShowErrors(true);
    if (pendingRef.current || !canPress || reasonError || selectionError) return;

    const payload = buildReversePayload({
      reason: trimmed,
      lockVersion,
      legIds: choice.scope === "some" ? chosen.map((leg) => leg.id) : null,
    });
    const idempotencyKey = attempt.keyFor({ goalId, installmentId, ...payload });

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);

    try {
      const response = await savingsPlansApi.reverseLegs(goalId, installmentId, payload, idempotencyKey);
      attempt.settle();
      onReversed(response?.data ?? {});
    } catch (error) {
      // 401: apiClient's session-expired flow takes over.
      if (error?.code === "UNAUTHENTICATED") return;

      const kind = classifyPlanWriteError(error);
      if (kind !== "unknown") attempt.reset();
      setFailure({ error, kind });

      if (kind !== "final") {
        onOutdated();
        reload();
        // The payments may differ now: nothing chosen or approved carries over.
        if (kind !== "unknown") setReview((value) => value + 1);
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
        <p dir="auto">
          {failure.kind === "unknown" ? t(`${prefix}.unknownOutcome`) : getSmartPlanErrorMessage(failure.error, t, i18n, "reverse")}
        </p>
        {failure.kind !== "final" && failure.kind !== "unknown" && <p>{t(`${prefix}.reviewAgain`)}</p>}
      </div>
    </div>
  );

  const legRows = (legs, { current }) =>
    legs.map((leg) => ({
      id: leg.id,
      name: leg.account_name,
      amount: leg.amount,
      state: leg.is_effective ? "effective" : "reversed",
      detail: !leg.is_effective && leg.reversed_at ? (
        <>
          {t(`${prefix}.reversedOn`)} {day(String(leg.reversed_at).slice(0, 10))}
        </>
      ) : null,
      selectable: current && choice.scope === "some" && leg.selectable,
      checked: current && leg.selectable && (choice.scope === "some" ? choice.ids.includes(leg.id) : true),
    }));

  let body;

  if (loading) {
    body = (
      <>
        {failureBanner}
        <p className="plan-dialog__state" role="status">
          {t(`${prefix}.loading`)}
        </p>
      </>
    );
  } else if (loadError) {
    const canRetry = !["NOT_FOUND", "FORBIDDEN"].includes(loadError.code);
    body = (
      <>
        {failureBanner}
        <div className="plan-dialog__state" role="alert">
          <p>{getSmartPlanErrorMessage(loadError, t, i18n, "preview")}</p>
          {canRetry && (
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </>
    );
  } else {
    const fresh = data.installment;
    const facts = [
      ["scheduled", fresh.amount],
      ["confirmed", fresh.confirmed_amount],
      ["effective", fresh.effective_amount],
      ["reversed", fresh.reversed_amount ?? "0.0000"],
    ];

    body = (
      <>
        {failureBanner}

        <dl className="plan-dialog__facts">
          <div>
            <dt>{t("dashboard.savingsGoals.smartPlan.confirm.dueDate")}</dt>
            <dd>{day(fresh.planned_date)}</dd>
          </div>
          {facts.map(([key, value]) =>
            value == null ? null : (
              <div key={key}>
                <dt>{t(`${prefix}.facts.${key}`)}</dt>
                <dd>{money(value)}</dd>
              </div>
            ),
          )}
        </dl>

        {data.current ? (
          <section className="reverse-legs__section" aria-labelledby="reverse-legs-current-title">
            <header className="reverse-legs__cycle-head">
              <h3 id="reverse-legs-current-title">{t(`${prefix}.currentTitle`)}</h3>
              {data.current.confirmed_at && (
                <span className="reverse-legs__cycle-date">
                  {t(`${prefix}.confirmedOn`)} {day(String(data.current.confirmed_at).slice(0, 10))}
                </span>
              )}
            </header>

            {eligible && canChoose && (
              <fieldset className="reverse-legs__scope">
                <legend className="reverse-legs__sr-only">{t(`${prefix}.scopeLabel`)}</legend>
                {["all", "some"].map((scope) => (
                  <label key={scope} className={`reverse-legs__scope-option${choice.scope === scope ? " reverse-legs__scope-option--checked" : ""}`}>
                    <input
                      type="radio"
                      name="reverse-legs-scope"
                      value={scope}
                      checked={choice.scope === scope}
                      onChange={() => update({ scope, ids: [], acknowledged: false })}
                    />
                    <span>{t(`${prefix}.scope.${scope}`)}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <FundingLegs rows={legRows(currentLegs, { current: true })} money={money} onToggle={toggle} />
          </section>
        ) : null}

        {!eligible && (
          <div className="plan-dialog__callout" role="note">
            <LuInfo aria-hidden="true" />
            <p>
              {t(
                data.current && !data.current.is_multi_leg
                  ? `${prefix}.singleAccount`
                  : `${prefix}.nothingLeft`,
              )}
            </p>
          </div>
        )}

        {eligible && (
          <>
            <p className="reverse-legs__summary" aria-live="polite">
              <span>{t(choice.scope === "some" ? `${prefix}.summarySome` : `${prefix}.summaryAll`, { count: chosen.length })}</span>
              <strong>{reverseTotal != null && !isZero(reverseTotal) ? money(reverseTotal) : "—"}</strong>
            </p>
            {showErrors && selectionError && (
              <p className="reverse-legs__error" role="alert">
                {t(`${prefix}.validation.${selectionError}`)}
              </p>
            )}

            <label className="reverse-legs__reason" htmlFor="reverse-legs-reason">
              <span>{t(`${prefix}.reason`)}</span>
              <textarea
                id="reverse-legs-reason"
                rows={2}
                maxLength={REVERSAL_REASON_MAX}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={showErrors && reasonError ? true : undefined}
                disabled={isRunning}
              />
              {showErrors && reasonError ? (
                <small role="alert">{t(`${prefix}.validation.${reasonError}`, { min: REVERSAL_REASON_MIN, max: REVERSAL_REASON_MAX })}</small>
              ) : (
                <small className="reverse-legs__hint">{t(`${prefix}.reasonHint`, { min: REVERSAL_REASON_MIN })}</small>
              )}
            </label>

            <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
              <LuInfo aria-hidden="true" />
              <ul>
                <li>{t(`${prefix}.points.returns`)}</li>
                <li>{t(`${prefix}.points.history`)}</li>
                <li>{t(`${prefix}.points.noReplan`)}</li>
              </ul>
            </div>

            <label className="reverse-legs__ack">
              <input
                type="checkbox"
                checked={choice.acknowledged}
                onChange={(event) => update({ acknowledged: event.target.checked })}
                disabled={isRunning}
              />
              <span>{t(`${prefix}.acknowledge`)}</span>
            </label>
          </>
        )}

        {/* Earlier cycles last: apart from everything that can be acted on. */}
        {data.history.length > 0 && (
          <section className="reverse-legs__history" aria-labelledby="reverse-legs-history-title">
            <h3 id="reverse-legs-history-title">
              <LuHistory aria-hidden="true" />
              <span>{t(`${prefix}.historyTitle`)}</span>
            </h3>
            <p className="reverse-legs__history-hint">{t(`${prefix}.historyHint`)}</p>
            {data.history.map((cycle) => (
              <div key={cycle.confirmation_version} className="reverse-legs__cycle">
                {cycle.confirmed_at && (
                  <p className="reverse-legs__cycle-date">
                    {t(`${prefix}.confirmedOn`)} {day(String(cycle.confirmed_at).slice(0, 10))}
                  </p>
                )}
                <FundingLegs rows={legRows(cycle.funding_legs, { current: false })} money={money} />
              </div>
            ))}
          </section>
        )}

      </>
    );
  }

  return (
    <PlanDialog
      id="reverse-legs"
      role="alertdialog"
      eyebrow={t(`${prefix}.eyebrow`, { number: installment.sequence })}
      title={t(`${prefix}.title`)}
      busy={isRunning}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isRunning} autoFocus>
            {t(eligible ? `${prefix}.keep` : "common.close")}
          </button>
          {eligible && (
            <button type="submit" className="plan-dialog__caution" onClick={handleSubmit} disabled={!canPress} aria-busy={isRunning || undefined}>
              <LuRotateCcw className="reverse-legs__submit-icon" aria-hidden="true" />{" "}
              {t(isRunning ? `${prefix}.running` : failure?.kind === "unknown" ? `${prefix}.retry` : `${prefix}.submit`)}
            </button>
          )}
        </>
      }
    >
      {body}
    </PlanDialog>
  );
}
