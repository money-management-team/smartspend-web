import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getSavingsGoalDetailsPath } from "../../../routes/Path.js";
import { readConfirmationPreview } from "../../data/readPlanApi.js";
import { useResource } from "../../data/useResource.js";
import { isCalendarDay, textError } from "../../forms/validation.js";
import { MOBILE_NAMESPACE } from "../../i18n/messages.js";
import { formatDay } from "../../money/format.js";
import Money from "../../money/Money.jsx";
import MobileSheet from "../../shell/MobileSheet.jsx";
import Chevron from "../../ui/Chevron.jsx";
import ErrorPanel from "../../ui/ErrorPanel.jsx";
import Skeleton from "../../ui/Skeleton.jsx";
import { buildConfirmationPreview, defaultAccount, postponeBounds } from "./planModel.js";

const P = "planning.goals.plan";

/*
 * Reviewing one installment: confirm, postpone or skip. What the full version's
 * dialogs show, and nothing more is done: the last button is disabled and no
 * file of Mobile has code that sends POST …/confirm, …/postpone or …/skip
 * (tests/mobileReadOnly.test.mjs). Opening a review moves no money and changes
 * nothing about the installment; it stays open in the plan.
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
      <p className="sm-text sm-muted sm-fine" data-sm-versions={`${preview.planVersion ?? "?"}:${preview.lockVersion ?? "?"}`}>{t(`${P}.versions`, { plan: preview.planVersion ?? "—", lock: preview.lockVersion ?? "—" })}</p>
    </div>
  );
}

function PostponeBody({ installment, installments, targetDate, today, locale, date, setDate, reason, setReason, attempted }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const bounds = postponeBounds(installment, installments, targetDate, today);
  const dateError = !date ? "required" : !isCalendarDay(date) ? "date" : (bounds.min && date < bounds.min) || (bounds.max && date > bounds.max) ? "bounds" : null;
  const reasonError = textError(reason, { max: 500 });

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
        <input id={`${ids}-date`} className="sm-input" type="date" dir="ltr" min={bounds.min ?? undefined} max={bounds.max ?? undefined} value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={attempted && dateError ? "true" : undefined} data-sm-input="new-date" />
        {attempted && dateError && <p className="sm-text sm-form-error" data-sm-error={dateError}>{t(`${P}.dateError.${dateError}`)}</p>}
      </div>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-reason`}>{t("forms.fields.reason")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <textarea id={`${ids}-reason`} className="sm-input sm-textarea" dir="auto" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        {attempted && reasonError && <p className="sm-text sm-form-error">{t("forms.errors.tooLong", { max: 500 })}</p>}
      </div>
    </div>
  );
}

export default function InstallmentReview({ kind, goalId, installment, installments, currency, targetDate, today, locale, onClose, returnFocusRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const keepRef = useRef(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [checked, setChecked] = useState(false);

  const check = (event) => {
    event.preventDefault();
    setAttempted(true);
    setChecked(true);
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
        {kind === "postpone" && <PostponeBody installment={installment} installments={installments} targetDate={targetDate} today={today} locale={locale} date={date} setDate={setDate} reason={reason} setReason={setReason} attempted={attempted} />}
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
        {kind === "postpone" && checked && <p className="sm-text sm-muted" role="status">{t(`${P}.checked`)}</p>}
        <div className="sm-closed sm-closed-compact" role="note" data-sm-note="write-closed" data-sm-write={`installment.${kind}`} id={`${ids}-closed`}>
          <p className="sm-text sm-muted">{t(`${P}.notSent`)}</p>
        </div>
        <div className="sm-actions sm-form-actions">
          {kind === "postpone" && <button type="submit" className="sm-button sm-button-quiet" data-sm-action="check-postpone">{t(`${P}.checkDate`)}</button>}
          <button type="button" className="sm-button" disabled aria-describedby={`${ids}-closed`} data-sm-action="send">{t(`${P}.review.${kind}.send`)}</button>
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
