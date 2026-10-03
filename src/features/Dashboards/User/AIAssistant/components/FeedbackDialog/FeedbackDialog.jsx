import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFlag, LuThumbsDown, LuThumbsUp, LuX } from "react-icons/lu";

import "./FeedbackDialog.css";

const x = "dashboard.aiAssistant.extra";
const REASONS = ["normal_activity", "not_useful", "inaccurate", "unclear", "other"];
const RATING_ICONS = { helpful: LuThumbsUp, not_helpful: LuThumbsDown, inaccurate: LuFlag };

/* Optional reason and comment for a rating on an answer or an insight. */
export default function FeedbackDialog({ rating, busy, error, onSubmit, onClose }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const RatingIcon = RATING_ICONS[rating] ?? LuThumbsUp;

  return (
    <div className="ai-feedback-backdrop" role="presentation" onMouseDown={() => !busy && onClose()}>
      <section
        className="ai-feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-feedback-title"
        aria-describedby="ai-feedback-rating"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && !busy && onClose()}
      >
        <header className="ai-feedback-dialog__head">
          <span className={`ai-feedback-dialog__rating ai-feedback-dialog__rating--${rating}`} aria-hidden="true">
            <RatingIcon />
          </span>
          <div>
            <h2 id="ai-feedback-title">{t(`${x}.feedbackTitle`)}</h2>
            <p id="ai-feedback-rating">{t(`${x}.${rating}`)}</p>
          </div>
          <button
            type="button"
            className="ai-icon-button"
            disabled={busy}
            onClick={onClose}
            aria-label={t(`${x}.cancelFeedback`)}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              rating,
              ...(reason && { reason_code: reason }),
              ...(comment.trim() && { comment: comment.trim() }),
            });
          }}
        >
          <label className="ai-field">
            <span>{t(`${x}.feedbackReason`)}</span>
            <select value={reason} disabled={busy} autoFocus onChange={(event) => setReason(event.target.value)}>
              <option value="">{t(`${x}.optional`)}</option>
              {REASONS.map((value) => (
                <option key={value} value={value}>
                  {t(`${x}.reasons.${value}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="ai-field">
            <span>{t(`${x}.feedbackComment`)}</span>
            <textarea
              value={comment}
              maxLength={1000}
              rows={3}
              disabled={busy}
              dir="auto"
              onChange={(event) => setComment(event.target.value)}
              placeholder={t(`${x}.optional`)}
            />
          </label>

          {error && (
            <p role="alert" className="ai-alert ai-alert--error">
              {error}
            </p>
          )}

          <div className="ai-feedback-dialog__actions">
            <button type="button" className="ai-button ai-button--secondary" disabled={busy} onClick={onClose}>
              {t(`${x}.cancelFeedback`)}
            </button>
            <button type="submit" className="ai-button ai-button--primary" disabled={busy}>
              {t(`${x}.save`)}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
