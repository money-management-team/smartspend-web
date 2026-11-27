import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getSavingsGoalDetailsPath } from "../../../routes/Path.js";
import { keys } from "../../data/loaders.js";
import { readConfirmationPreview } from "../../data/readPlanApi.js";
import { useResource } from "../../data/useResource.js";
import { useResourceStore } from "../../identity/storeContext.js";
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
import { CONFIRM_CERTAIN_409, POSTPONE_CERTAIN_409, POSTPONE_REASON_MAX, SKIP_CERTAIN_409, SKIP_REASON_MAX, buildConfirmWrite, buildConfirmationPreview, buildPostponeWrite, buildSkipWrite, defaultAccount, describeConfirm, describePostpone, describeSkip, isConfirmRereadNeeded, isStaleInstallmentWrite, isStalePostpone, postponeBounds, postponeDateError } from "./planModel.js";

const P = "planning.goals.plan";

/*
 * Reviewing one installment: confirm, postpone or skip. What the full version's
 * dialogs show. Each has a send path through data/writePlanApi.js
 * (installment.confirm, installment.postpone, installment.skip), CLOSED by the
 * write gate: the send button stays disabled while the gate is closed, which it is
 * for every write while APPROVED is empty (tests/mobileSavings.test.mjs,
 * mobileReadOnly.test.mjs). Opening a review moves no money and changes nothing
 * about the installment. Only a confirmation moves money, from ONE account; the
 * multi-account path stays in the full version.
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
function ConfirmBody({ resource, preview, account, setAccount, currency, locale, disabled }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();

  if (resource.loading) return <Skeleton lines={4} label={t(`${P}.previewLoading`)} />;
  // A 404 or 409 here means the installment is gone or no longer open: said so, never guessed.
  if (resource.status === "error" && ["NOT_FOUND", "CONFLICT"].includes(resource.error?.code)) return <p className="sm-text" role="note" data-sm-note="installment-stale">{t(`${P}.stale`)}</p>;
  if (resource.status === "error" || !preview) return <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} compact />;


  return (
    <div data-sm-preview="confirm" data-sm-confirmable={preview.confirmable ? "true" : "false"}>
      <dl className="sm-stats sm-stats-stacked">
        {preview.goalName && <div className="sm-stat"><dt>{t(`${P}.goal`)}</dt><dd><bdi dir="auto" className="sm-user-text">{preview.goalName}</bdi></dd></div>}
        {preview.date && <div className="sm-stat"><dt>{t(`${P}.due`)}</dt><dd><bdi>{formatDay(preview.date, locale, "UTC")}</bdi></dd></div>}
        <div className="sm-stat"><dt>{t(`${P}.toMove`)}</dt><dd><Money plain value={preview.amount ?? undefined} currency={currency ?? undefined} /></dd></div>
      </dl>
      {preview.blocker && <p className="sm-text sm-form-error" role="alert" data-sm-blocker={preview.blocker.code ?? "unknown"}>{t(`${P}.blocker.${preview.blocker.code}`, { defaultValue: preview.blocker.message ?? t(`${P}.blocker.other`) })}</p>}
      {preview.warnings.length > 0 && <ul className="sm-bullets" data-sm-note="preview-warnings">{preview.warnings.map((warning) => <li key={warning} className="sm-text sm-user-text">{warning}</li>)}</ul>}
      <fieldset className="sm-fieldset sm-field" disabled={Boolean(preview.blocker) || disabled}>
        <legend className="sm-label">{t(`${P}.fromAccount`)}</legend>
        {preview.accounts.length === 0 && <p className="sm-text sm-muted">{t(`${P}.noAccounts`)}</p>}
        {preview.accounts.map((item) => (
          <label key={item.id} className="sm-choice sm-cat-choice" data-sm-account={item.id} data-sm-covers={item.covers ? "true" : "false"}>
            <input type="radio" name={`${ids}-account`} value={item.id} checked={account === item.id} disabled={!item.covers} onChange={() => setAccount(item.id)} />
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
 * Each write's send path: the Smart Savings facade, its certain 409s, when the screen's reads are out of date after a
 * certain refusal, and which reads it may have changed. Never the goal's own record (`goal:{id}`), which this review is
 * shown inside (dropping it would unmount the page, and the answer with it); a confirmation, which moves money into the
 * goal, drops that record when the review closes (see `close` below). A confirmation's preview stays on screen as it
 * was reviewed while the answer is shown; it is read again after a refusal on its details (a 422) and dropped on close.
 */
const previewKey = (goalId, installmentId) => `goalPlanPreview:${goalId}:${installmentId}`;

const submitOptions = (kind, goalId, installmentId) => {
  const goalKey = keys.goal(goalId);
  if (kind === "confirm") {
    const preview = previewKey(goalId, installmentId);
    return { send: sendPlanWrite, certain409: CONFIRM_CERTAIN_409, refreshAfter: isConfirmRereadNeeded, readsChanged: (key) => key !== goalKey && key !== preview };
  }
  if (kind === "skip") return { send: sendPlanWrite, certain409: SKIP_CERTAIN_409, refreshAfter: isStaleInstallmentWrite, readsChanged: (key) => key !== goalKey };
  return { send: sendPlanWrite, certain409: POSTPONE_CERTAIN_409, refreshAfter: isStalePostpone, readsChanged: (key) => key !== goalKey };
};

const DESCRIBE = { confirm: describeConfirm, postpone: describePostpone, skip: describeSkip };
// Problems found before sending after which this review can send nothing (a new review is needed).
const FINAL_PROBLEMS = new Set(["notOpen", "versions", "notConfirmable", "amount"]);

/*
 * What a write's answer said, in words (planModel's describe*). `role="alert"` for a refusal or an unknown outcome.
 * Field messages of a 422 are the backend's own text, shown as they came (for a confirmation with no field messages,
 * the backend's own reason, e.g. the balance); nothing is decided from them.
 */
function InstallmentOutcome({ kind, sent, sequence, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const described = DESCRIBE[kind](sent);
  const attribute = `data-sm-${kind}-outcome`;
  if (sent.sending) return <p className="sm-text sm-muted" role="status" data-sm-outcome="sending" {...{ [attribute]: "sending" }}>{t(`${P}.${kind}Outcome.sending`)}</p>;
  if (!described) return null;
  const date = described.values.date ? formatDay(described.values.date, locale, "UTC") : null;
  const key = described.key === "date" && !date ? "dateNoLimit" : described.key;
  const fieldMessages = described.key === "invalid" && sent.error?.errors && typeof sent.error.errors === "object"
    ? Object.values(sent.error.errors).flat().filter((item) => typeof item === "string")
    : [];
  const ownReason = kind === "confirm" && described.key === "invalid" && fieldMessages.length === 0 && typeof sent.error?.message === "string" && sent.error.message ? [sent.error.message] : [];
  const fields = [...fieldMessages, ...ownReason].slice(0, 6).map((item) => item.slice(0, 300));
  const confirmed = sent.phase === "confirmed";
  return (
    <div className={confirmed ? "sm-card" : "sm-card sm-error"} role={confirmed ? "status" : "alert"} data-sm-outcome={described.key} {...{ [attribute]: described.key }} data-sm-phase={sent.phase}>
      <p className="sm-text">{t(`${P}.${kind}Outcome.${key}`, { sequence: sequence ?? "", date })}</p>
      {fields.length > 0 && <ul className="sm-cat-summary-list">{fields.map((item) => <li key={item} dir="auto">{item}</li>)}</ul>}
    </div>
  );
}

export default function InstallmentReview({ kind, goalId, installment, installments, planVersion, currency, targetDate, today, locale, onClose, returnFocusRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const keepRef = useRef(null);
  const store = useResourceStore();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [problem, setProblem] = useState(null);
  const [chosen, setChosen] = useState(null);
  // One submission per review (forms/useWorkflowSubmit.js: one request at a time, one key per intent, kept across a reload).
  const options = useMemo(() => submitOptions(kind, goalId, installment.id), [kind, goalId, installment.id]);
  const sent = useWorkflowSubmit(options);
  const bounds = useMemo(() => postponeBounds(installment, installments, targetDate, today), [installment, installments, targetDate, today]);

  // A confirmation is built only from the preview read when the review opened (GET …/confirmation-preview).
  const loader = useMemo(() => async (signal) => (await readConfirmationPreview(goalId, installment.id, signal)).data, [goalId, installment.id]);
  const resource = useResource(previewKey(goalId, installment.id), loader, { enabled: kind === "confirm" });
  const preview = useMemo(() => (kind !== "confirm" || resource.data === undefined ? null : buildConfirmationPreview(resource.data, installment.id)), [kind, resource.data, installment.id]);
  const account = preview ? (chosen ?? defaultAccount(preview)) : "";

  const operation = `installment.${kind}`;
  // Closed for every write while APPROVED is empty (data/writeGate.js); only a test switch opens it.
  const writeOpen = isWriteOpen(operation);
  const described = DESCRIBE[kind](sent);
  // Nothing more from this review after an answer that may have changed the installment, or a refusal that needs a new review.
  const blocked = Boolean(described?.blocked);
  const ready = kind !== "confirm" || (Boolean(preview) && resource.status === "ready");
  const canSend = writeOpen && ready && !sent.sending && !blocked && !FINAL_PROBLEMS.has(problem);
  const reasonMax = kind === "skip" ? SKIP_REASON_MAX : POSTPONE_REASON_MAX;

  // A confirmation that may have moved money (sent at all): the goal's own record and the preview are read again once
  // the review closes, so the page shows the goal's progress from the server, and a new review starts from a new preview.
  const close = useCallback(() => {
    if (kind === "confirm" && sent.phase !== "idle" && !store.isDisposed()) {
      const goalKey = keys.goal(goalId);
      const previewEntry = previewKey(goalId, installment.id);
      store.drop((key) => key === goalKey || key === previewEntry);
    }
    onClose();
  }, [kind, sent.phase, store, goalId, installment.id, onClose]);

  const check = (event) => {
    event.preventDefault();
    setAttempted(true);
    setChecked(true);
  };

  // Every check before anything leaves; the hook guarantees a single request per submission.
  const sendReview = async () => {
    setAttempted(true);
    if (!canSend) return;
    let built;
    if (kind === "confirm") built = buildConfirmWrite({ goalId, installmentId: installment.id, preview, accountId: account });
    else if (kind === "skip") built = buildSkipWrite({ goalId, installment, planVersion, reason });
    else built = buildPostponeWrite({ goalId, installment, planVersion, date, reason, bounds });
    setProblem(built.problem ?? null);
    if (!built.write) return;
    const outcome = await sent.submit(built.write);
    // Refused on its details: the balances on screen are out of date, so the preview is read again (nothing is resent).
    if (kind === "confirm" && outcome?.kind === "rejected" && outcome.code === "VALIDATION_ERROR") resource.reload();
  };

  const reasonTooLong = attempted && kind === "skip" && Boolean(textError(reason, { max: reasonMax }));

  return (
    <MobileSheet open onClose={close} titleId={`${ids}-title`} title={t(`${P}.review.${kind}.title`, { sequence: installment.sequence ?? "" })} returnFocusRef={returnFocusRef}>
      <form className="sm-installment-review" onSubmit={check} noValidate data-sm-review={kind} data-sm-installment={installment.id}>
        <p className="sm-text sm-muted">{t(`${P}.review.${kind}.intro`)}</p>
        <dl className="sm-stats sm-stats-stacked">
          {installment.date && <div className="sm-stat"><dt>{t(`${P}.due`)}</dt><dd><bdi>{formatDay(installment.date, locale, "UTC")}</bdi></dd></div>}
          {installment.amount && <div className="sm-stat"><dt>{t(`${P}.scheduled`)}</dt><dd><Money plain value={installment.amount} currency={currency ?? undefined} /></dd></div>}
        </dl>
        {kind === "confirm" && <ConfirmBody resource={resource} preview={preview} account={account} setAccount={setChosen} currency={currency} locale={locale} disabled={sent.sending || blocked} />}
        {kind === "postpone" && <PostponeBody installment={installment} bounds={bounds} locale={locale} date={date} setDate={setDate} reason={reason} setReason={setReason} attempted={attempted} disabled={sent.sending || blocked} />}
        {kind === "skip" && (
          <>
            <ul className="sm-bullets" data-sm-preview="skip">
              {["noMoney", "targetSame", "notSpread", "final"].map((key) => <li key={key} className="sm-text">{t(`${P}.skipMeans.${key}`)}</li>)}
            </ul>
            <div className="sm-field">
              <label className="sm-label" htmlFor={`${ids}-reason`}>{t("forms.fields.reason")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
              <textarea id={`${ids}-reason`} className="sm-input sm-textarea" dir="auto" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={sent.sending || blocked} data-sm-input="reason" />
              {reasonTooLong && <p className="sm-text sm-form-error">{t("forms.errors.tooLong", { max: reasonMax })}</p>}
            </div>
          </>
        )}
        {kind === "postpone" && checked && !postponeDateError(date, bounds) && <p className="sm-text sm-muted" role="status">{t(`${P}.checked`)}</p>}
        {problem && <p className="sm-text sm-form-error" role="alert" data-sm-problem={problem} {...{ [`data-sm-${kind}-problem`]: problem }}>{t(`${P}.${kind}Problem.${problem}`)}</p>}
        <InstallmentOutcome kind={kind} sent={sent} sequence={installment.sequence} locale={locale} />
        {!writeOpen && (
          <div className="sm-closed sm-closed-compact" role="note" data-sm-note="write-closed" data-sm-write={operation} id={`${ids}-closed`}>
            <p className="sm-text sm-muted">{t(`${P}.notSent`)}</p>
          </div>
        )}
        <div className="sm-actions sm-form-actions">
          {kind === "postpone" && <button type="submit" className="sm-button sm-button-quiet" disabled={sent.sending || blocked} data-sm-action="check-postpone">{t(`${P}.checkDate`)}</button>}
          <button type="button" className="sm-button" disabled={!canSend} aria-describedby={writeOpen ? undefined : `${ids}-closed`} aria-busy={sent.sending || undefined} onClick={sendReview} data-sm-action="send">{t(`${P}.review.${kind}.send`)}</button>
          <button type="button" ref={keepRef} className="sm-button sm-button-quiet" onClick={close} data-sm-action="keep">{t(kind === "skip" ? `${P}.keepIt` : `${P}.close`)}</button>
        </div>
        <Link className="sm-link-row" to={getSavingsGoalDetailsPath(goalId)}>
          <span>{t(`${P}.openFull`)}</span>
          <Chevron />
        </Link>
      </form>
    </MobileSheet>
  );
}
