import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import { textError } from "../forms/validation.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";

// The full version's feedback fields (AIAssistant/components/FeedbackDialog): a rating, an optional reason, an optional comment.
const FEEDBACK_RATINGS = Object.freeze(["helpful", "not_helpful", "inaccurate"]);
const FEEDBACK_REASONS = Object.freeze(["normal_activity", "not_useful", "inaccurate", "unclear", "other"]);
const FEEDBACK_COMMENT_MAX = 1000;

/*
 * Feedback on an answer or an insight. It can be filled in and checked; sending
 * it is a write (POST /ai/messages/{id}/feedback or /ai/insights/{id}/feedback)
 * that Mobile does not make, so Send is disabled and says why. Nothing typed
 * here is kept: a typed comment is asked about before leaving.
 */
function FeedbackForm({ target, onClose }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [rating, setRating] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [checked, setChecked] = useState(false);
  const guard = useLeaveGuard(comment.trim() !== "");
  const commentError = textError(comment, { max: FEEDBACK_COMMENT_MAX });
  const ratingError = rating ? null : "required";
  const summaryRef = useRef(null);

  const check = (event) => {
    event.preventDefault();
    setChecked(true);
    if (ratingError || commentError) summaryRef.current?.focus();
  };
  const ok = checked && !ratingError && !commentError;

  return (
    <form className="sm-installment-review" onSubmit={check} noValidate data-sm-form="ai-feedback" data-sm-target={`${target.kind}:${target.id}`}>
      {checked && (ratingError || commentError) && (
        <div className="sm-error sm-error-compact" role="alert" tabIndex={-1} ref={summaryRef} data-sm-summary="local">
          {ratingError && <p className="sm-text">{t("aiFeedback.ratingRequired")}</p>}
          {commentError && <p className="sm-text">{t("forms.errors.tooLong", { max: FEEDBACK_COMMENT_MAX })}</p>}
        </div>
      )}
      <fieldset className="sm-fieldset sm-field">
        <legend className="sm-label">{t("aiFeedback.rating")} <span className="sm-required">{t("forms.required")}</span></legend>
        {FEEDBACK_RATINGS.map((value) => (
          <label key={value} className="sm-choice sm-cat-choice">
            <input type="radio" name={`${ids}-rating`} value={value} checked={rating === value} onChange={() => setRating(value)} />
            <span>{t(`aiFeedback.ratings.${value}`)}</span>
          </label>
        ))}
      </fieldset>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-reason`}>{t("aiFeedback.reason")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <select id={`${ids}-reason`} className="sm-select" value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">{t("forms.none")}</option>
          {FEEDBACK_REASONS.map((value) => <option key={value} value={value}>{t(`aiFeedback.reasons.${value}`)}</option>)}
        </select>
      </div>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-comment`}>{t("aiFeedback.comment")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <textarea id={`${ids}-comment`} className="sm-input sm-textarea" dir="auto" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} aria-invalid={checked && commentError ? "true" : undefined} aria-describedby={`${ids}-count`} />
        <p id={`${ids}-count`} className="sm-text sm-muted sm-fine">{t("assist.count", { count: [...comment].length, max: FEEDBACK_COMMENT_MAX })}</p>
      </div>
      {ok && <p className="sm-text" role="status" data-sm-note="feedback-ready">{t("aiFeedback.ready")}</p>}
      <p id={`${ids}-closed`} className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write={`ai.${target.kind}Feedback`}>{t("aiFeedback.closed")}</p>
      <div className="sm-actions sm-form-actions">
        <button type="submit" className="sm-button sm-button-quiet" data-sm-action="check-feedback">{t("aiFeedback.check")}</button>
        <button type="button" className="sm-button" disabled aria-describedby={`${ids}-closed`} data-sm-action="send">{t("aiFeedback.send")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={onClose} data-sm-action="cancel">{t("forms.cancel")}</button>
      </div>
      <Link className="sm-link-row" to={PATH.USER.AI_ASSISTANT}><span>{t("aiFeedback.full")}</span><Chevron /></Link>
      {guard.blocked && (
        <div className="sm-card" role="alertdialog" aria-labelledby={`${ids}-leave`} data-sm-note="leave-feedback">
          <p id={`${ids}-leave`} className="sm-text">{t("aiFeedback.discardBody")}</p>
          <div className="sm-actions">
            <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t("forms.keepEditing")}</button>
            <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
          </div>
        </div>
      )}
    </form>
  );
}

/* A "Rate" button and its sheet, for one answer or one insight. */
export function FeedbackButton({ kind, id }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [open, setOpen] = useState(false);
  const opener = useRef(null);
  return (
    <>
      <button type="button" ref={opener} className="sm-button sm-button-quiet sm-button-small" onClick={() => setOpen(true)} data-sm-action="rate">{t("aiFeedback.open")}</button>
      <MobileSheet open={open} onClose={() => setOpen(false)} titleId={`${ids}-title`} title={t(`aiFeedback.title.${kind}`)} returnFocusRef={opener}>
        {open && <FeedbackForm target={{ kind, id }} onClose={() => setOpen(false)} />}
      </MobileSheet>
    </>
  );
}

/*
 * Deleting a conversation: what the full version says it does (it asks "Delete
 * this conversation?" and removes it from the list after the server answers),
 * and no more: what SmartSpend keeps afterwards follows its retention settings,
 * which Mobile does not confirm. The conversation is not removed from anything
 * here; the last button is disabled (DELETE /ai/conversations/{id} is a write).
 */
export function DeleteConversation({ title }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [open, setOpen] = useState(false);
  const opener = useRef(null);
  return (
    <>
      <button type="button" ref={opener} className="sm-button sm-button-quiet" onClick={() => setOpen(true)} data-sm-action="delete-conversation">{t("aiDelete.open")}</button>
      <MobileSheet open={open} onClose={() => setOpen(false)} titleId={`${ids}-title`} title={t("aiDelete.title")} returnFocusRef={opener}>
        {title && <p className="sm-text"><bdi dir="auto" className="sm-user-text">{title}</bdi></p>}
        <ul className="sm-bullets">
          <li className="sm-text">{t("aiDelete.means")}</li>
          <li className="sm-text">{t("aiDelete.records")}</li>
          <li className="sm-text">{t("aiDelete.retention")}</li>
        </ul>
        <p id={`${ids}-closed`} className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="ai.conversationDelete">{t("aiDelete.closed")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={() => setOpen(false)} data-sm-action="keep-conversation">{t("aiDelete.keep")}</button>
          <button type="button" className="sm-button sm-button-quiet" disabled aria-describedby={`${ids}-closed`} data-sm-action="confirm-delete">{t("aiDelete.confirm")}</button>
        </div>
        <Link className="sm-link-row" to={PATH.USER.AI_ASSISTANT}><span>{t("aiDelete.full")}</span><Chevron /></Link>
      </MobileSheet>
    </>
  );
}
