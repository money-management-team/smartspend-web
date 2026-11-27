import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getSavingsGoalDetailsPath } from "../../../routes/Path.js";
import { keys } from "../../data/loaders.js";
import { readConfirmationPreview } from "../../data/readPlanApi.js";
import { useResource } from "../../data/useResource.js";
import { isWriteOpen } from "../../data/writeGate.js";
import { sendPlanWrite } from "../../data/writePlanApi.js";
import { useWorkflowSubmit } from "../../forms/useWorkflowSubmit.js";
import { textError } from "../../forms/validation.js";
import { MOBILE_NAMESPACE } from "../../i18n/messages.js";
import { formatDay } from "../../money/format.js";
import Money from "../../money/Money.jsx";
import MobileSheet from "../../shell/MobileSheet.jsx";
import Chevron from "../../ui/Chevron.jsx";
import ErrorPanel from "../../ui/ErrorPanel.jsx";
import Skeleton from "../../ui/Skeleton.jsx";
import { POSTPONE_CERTAIN_409, POSTPONE_REASON_MAX, buildConfirmationPreview, buildPostponeWrite, defaultAccount, describePostpone, isStalePostpone, postponeBounds, postponeDateError } from "./planModel.js";

const P = "planning.goals.plan";

/*
 * Reviewing one installment: confirm, postpone or skip. What the full version's
 * dialogs show. Confirm and skip end at a disabled button and Mobile has no code
 * that sends POST …/confirm or …/skip. Postpone has a send path
 * (installment.postpone through data/writePlanApi.js), CLOSED by the write gate:
 * its button stays disabled while the gate is closed, which it is for every write
 * while APPROVED is empty (tests/mobileSavings.test.mjs, mobileReadOnly.test.mjs).
 * Opening a review moves no money and changes nothing about the installment.
 *
 *   confirm   reads GET …/confirmation-preview first; nothing from before that
 *             read is shown. The amount is the preview's own, the accounts are
 *             its own, with the backend's answer to whether each can pay. A
 *             blocker is shown and no account can be chosen.
 *   postpone  the date is bounded by the backend's stated rules, checked here.
 *   skip      what a skip means, with "Keep it" as the default.
 *
 * The versions the full version would send (plan version, lock version) are
 * shown, so a reviewer can see which state this review is about.
 */
function ConfirmBody({ goalId, installment, currency, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const loader = useMemo(() => async (signal) => (await readConfirmationPreview(goalId, installment.id, signal)).data, [goalId, installment.id]);
  const resource = useResource(`goalPlanPreview:${goalId}:${installment.id}`, loader);
  const preview = useMemo(() => (resource.data === undefined ? null : buildConfirmationPreview(resource.data, installment.id)), [resource.data, installment.id]);
  const [chosen, setChosen] = useState(null);

  if (resource.loading) return <Skeleton lines={4} label={t(`${P}.previewLoading`)} />;
  // A 404 or 409 here means the installment is gone or no longer open: said so, never guessed.
  if (resource.status === "error" && ["NOT_FOUND", "CONFLICT"].includes(resource.error?.code)) return <p className="sm-text" role="note" data-sm-note="installment-stale">{t(`${P}.stale`)}</p>;
  if (resource.status === "error" || !preview) return <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} compact />;

  const account = chosen ?? defaultAccount(preview);

  return (
    <div data-sm-preview="confirm" data-sm-confirmable={preview.confirmable ? "true" : "false"}>
      <dl className="sm-stats sm-stats-stacked">
        {preview.goalName && <div className="sm-stat"><dt>{t(`${P}.goal`)}</dt><dd><bdi dir="auto" className="sm-user-text">{preview.goalName}</bdi></dd></div>}
        {preview.date && <div className="sm-stat"><dt>{t(`${P}.due`)}</dt><dd><bdi>{formatDay(preview.date, locale, "UTC")}</bdi></dd></div>}
        <div className="sm-stat"><dt>{t(`${P}.toMove`)}</dt><dd><Money plain value={preview.amount ?? undefined} currency={currency ?? undefined} /></dd></div>
      </dl>
      {preview.blocker && <p className="sm-text sm-form-error" role="alert" data-sm-blocker={preview.blocker.code ?? "unknown"}>{t(`${P}.blocker.${preview.blocker.code}`, { defaultValue: preview.blocker.message ?? t(`${P}.blocker.other`) })}</p>}
      {preview.warnings.length > 0 && <ul className="sm-bullets" data-sm-note="preview-warnings">{preview.warnings.map((warning) => <li key={warning} className="sm-text sm-user-text">{warning}</li>)}</ul>}
      <fieldset className="sm-fieldset sm-field" disabled={Boolean(preview.blocker)}>
        <legend className="sm-label">{t(`${P}.fromAccount`)}</legend>
        {preview.accounts.length === 0 && <p className="sm-text sm-muted">{t(`${P}.noAccounts`)}</p>}
        {preview.accounts.map((item) => (
          <label key={item.id} className="sm-choice sm-cat-choice" data-sm-account={item.id} data-sm-covers={item.covers ? "true" : "false"}>
            <input type="radio" name={`${ids}-account`} value={item.id} checked={account === item.id} disabled={!item.covers} onChange={() => setChosen(item.id)} />
            <span>
              <bdi dir="auto" className="sm-user-text">{item.name ?? t("forms.unnamed")}</bdi>
              {item.available && <> · <Money plain value={item.available} currency={currency ?? undefined} /></>}
              {!item.covers && <span className="sm-row-meta"> {t(`${P}.cantCover`)}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="sm-text sm-muted sm-fine">{t(`${P}.balanceNote`)}</p>
      <p className="sm-text sm-muted sm-fine" role="note" data-sm-note="funding-unavailable">{t(`${P}.fundingUnavailable`)}</p>
      <p className="sm-text sm-muted sm-fine" data-sm-versions={`${preview.planVersion ?? "?"}:${preview.lockVersion ?? "?"}`}>{t(`${P}.versions`, { plan: preview.planVersion ?? "—", lock: preview.lockVersion ?? "—" })}</p>
    </div>
  );
}

function PostponeBody({ installment, bounds, locale, date, setDate, reason, setReason, attempted, disabled }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const dateError = postponeDateError(date, bounds);
  const reasonError = textError(reason, { max: POSTPONE_REASON_MAX });

  if (!bounds.available) return <p className="sm-text" role="note" data-sm-note="postpone-unavailable">{t(`${P}.postponeUnavailable`)}</p>;

  return (
    <div data-sm-preview="postpone">
      <ul className="sm-bullets">
        <li className="sm-text">{t(`${P}.postponeRuleToday`)}</li>
        {bounds.max && <li className="sm-text">{t(`${P}.postponeRuleMax`, { date: formatDay(bounds.max, locale, "UTC") })}</li>}
        {installment.postponedCount ? <li className="sm-text">{t(`${P}.postponedBefore`, { count: installment.postponedCount })}</li> : null}
      </ul>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-date`}>{t(`${P}.newDate`)}</label>
        <input id={`${ids}-date`} className="sm-input" type="date" dir="ltr" min={bounds.min ?? undefined} max={bounds.max ?? undefined} value={date} onChange={(event) => setDate(event.target.value)} disabled={disabled} aria-invalid={attempted && dateError ? "true" : undefined} data-sm-input="new-date" />
        {attempted && dateError && <p className="sm-text sm-form-error" data-sm-error={dateError}>{t(`${P}.dateError.${dateError}`)}</p>}
      </div>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-reason`}>{t("forms.fields.reason")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <textarea id={`${ids}-reason`} className="sm-input sm-textarea" dir="auto" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={disabled} data-sm-input="reason" />
        {attempted && reasonError && <p className="sm-text sm-form-error">{t("forms.errors.tooLong", { max: POSTPONE_REASON_MAX })}</p>}
      </div>
    </div>
  );
}

/*
 * The postponement's send path: the Smart Savings facade, its certain 409s, a re-read after a stale review, and which
 * reads it may have changed: every one but the goal's own record (`goal:{id}`), which a postponement can't change (no
 * money moves) and which this review is shown inside; dropping it would unmount the page, and the answer with it.
 */
const postponeSubmit = (goalId) => {
  const goalKey = keys.goal(goalId);
  return { send: sendPlanWrite, certain409: POSTPONE_CERTAIN_409, refreshAfter: isStalePostpone, readsChanged: (key) => key !== goalKey };
};

/*
 * What a postponement's answer said, in words (describePostpone). `role="alert"` for a refusal or an unknown outcome.
 * Field messages of a 422 are the backend's own text, shown as they came; nothing is decided from them.
 */
function PostponeOutcome({ sent, sequence, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const described = describePostpone(sent);
  if (sent.sending) return <p className="sm-text sm-muted" role="status" data-sm-postpone-outcome="sending">{t(`${P}.postponeOutcome.sending`)}</p>;
  if (!described) return null;
  const date = described.values.date ? formatDay(described.values.date, locale, "UTC") : null;
  const key = described.key === "date" && !date ? "dateNoLimit" : described.key;
  const fields = described.key === "invalid" && sent.error?.errors && typeof sent.error.errors === "object"
    ? Object.values(sent.error.errors).flat().filter((item) => typeof item === "string").slice(0, 6).map((item) => item.slice(0, 300))
    : [];
  const confirmed = sent.phase === "confirmed";
  return (
    <div className={confirmed ? "sm-card" : "sm-card sm-error"} role={confirmed ? "status" : "alert"} data-sm-postpone-outcome={described.key} data-sm-phase={sent.phase}>
      <p className="sm-text">{t(`${P}.postponeOutcome.${key}`, { sequence: sequence ?? "", date })}</p>
      {fields.length > 0 && <ul className="sm-cat-summary-list">{fields.map((item) => <li key={item} dir="auto">{item}</li>)}</ul>}
    </div>
  );
}

export default function InstallmentReview({ kind, goalId, installment, installments, planVersion, currency, targetDate, today, locale, onClose, returnFocusRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const keepRef = useRef(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [problem, setProblem] = useState(null);
  // One submission per review (forms/useWorkflowSubmit.js: one request at a time, one key per intent, kept across a reload).
  const submitOptions = useMemo(() => postponeSubmit(goalId), [goalId]);
  const sent = useWorkflowSubmit(submitOptions);
  const bounds = useMemo(() => postponeBounds(installment, installments, targetDate, today), [installment, installments, targetDate, today]);
  // Closed for every write while APPROVED is empty (data/writeGate.js); only a test switch opens it.
  const writeOpen = kind === "postpone" && isWriteOpen("installment.postpone");
  const described = kind === "postpone" ? describePostpone(sent) : null;
  // Nothing more from this review after an answer that may have changed the installment, or a refusal that needs a new review.
  const blocked = Boolean(described?.blocked);
  const canSend = writeOpen && !sent.sending && !blocked && problem !== "notOpen" && problem !== "versions";

  const check = (event) => {
    event.preventDefault();
    setAttempted(true);
    setChecked(true);
  };

  // Postpone: every check before anything leaves; the hook guarantees a single request per submission.
  const sendPostpone = () => {
    setAttempted(true);
    if (!canSend) return;
    const built = buildPostponeWrite({ goalId, installment, planVersion, date, reason, bounds });
    setProblem(built.problem ?? null);
    if (built.write) sent.submit(built.write);
  };

  return (
    <MobileSheet open onClose={onClose} titleId={`${ids}-title`} title={t(`${P}.review.${kind}.title`, { sequence: installment.sequence ?? "" })} returnFocusRef={returnFocusRef}>
      <form className="sm-installment-review" onSubmit={check} noValidate data-sm-review={kind} data-sm-installment={installment.id}>
        <p className="sm-text sm-muted">{t(`${P}.review.${kind}.intro`)}</p>
        <dl className="sm-stats sm-stats-stacked">
          {installment.date && <div className="sm-stat"><dt>{t(`${P}.due`)}</dt><dd><bdi>{formatDay(installment.date, locale, "UTC")}</bdi></dd></div>}
          {installment.amount && <div className="sm-stat"><dt>{t(`${P}.scheduled`)}</dt><dd><Money plain value={installment.amount} currency={currency ?? undefined} /></dd></div>}
        </dl>
        {kind === "confirm" && <ConfirmBody goalId={goalId} installment={installment} currency={currency} locale={locale} />}
        {kind === "postpone" && <PostponeBody installment={installment} bounds={bounds} locale={locale} date={date} setDate={setDate} reason={reason} setReason={setReason} attempted={attempted} disabled={sent.sending || blocked} />}
        {kind === "skip" && (
          <>
            <ul className="sm-bullets" data-sm-preview="skip">
              {["noMoney", "targetSame", "notSpread", "final"].map((key) => <li key={key} className="sm-text">{t(`${P}.skipMeans.${key}`)}</li>)}
            </ul>
            <div className="sm-field">
              <label className="sm-label" htmlFor={`${ids}-reason`}>{t("forms.fields.reason")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
              <textarea id={`${ids}-reason`} className="sm-input sm-textarea" dir="auto" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          </>
        )}
        {kind === "postpone" && checked && !postponeDateError(date, bounds) && <p className="sm-text sm-muted" role="status">{t(`${P}.checked`)}</p>}
        {kind === "postpone" && problem && <p className="sm-text sm-form-error" role="alert" data-sm-postpone-problem={problem}>{t(`${P}.postponeProblem.${problem}`)}</p>}
        {kind === "postpone" && <PostponeOutcome sent={sent} sequence={installment.sequence} locale={locale} />}
        {!writeOpen && (
          <div className="sm-closed sm-closed-compact" role="note" data-sm-note="write-closed" data-sm-write={`installment.${kind}`} id={`${ids}-closed`}>
            <p className="sm-text sm-muted">{t(`${P}.notSent`)}</p>
          </div>
        )}
        <div className="sm-actions sm-form-actions">
          {kind === "postpone" && <button type="submit" className="sm-button sm-button-quiet" disabled={sent.sending || blocked} data-sm-action="check-postpone">{t(`${P}.checkDate`)}</button>}
          {kind === "postpone" ? (
            <button type="button" className="sm-button" disabled={!canSend} aria-describedby={writeOpen ? undefined : `${ids}-closed`} aria-busy={sent.sending || undefined} onClick={sendPostpone} data-sm-action="send">{t(`${P}.review.${kind}.send`)}</button>
          ) : (
            <button type="button" className="sm-button" disabled aria-describedby={`${ids}-closed`} data-sm-action="send">{t(`${P}.review.${kind}.send`)}</button>
          )}
          <button type="button" ref={keepRef} className="sm-button sm-button-quiet" onClick={onClose} data-sm-action="keep">{t(kind === "skip" ? `${P}.keepIt` : `${P}.close`)}</button>
        </div>
        <Link className="sm-link-row" to={getSavingsGoalDetailsPath(goalId)}>
          <span>{t(`${P}.openFull`)}</span>
          <Chevron />
        </Link>
      </form>
    </MobileSheet>
  );
}
