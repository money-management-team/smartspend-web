import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCircleCheck, LuHourglass, LuInbox, LuReceiptText, LuTrash2 } from "react-icons/lu";

import ConfirmDialog from "../../../../../../components/ConfirmDialog/ConfirmDialog.jsx";
import { PATH, getTransactionDetailsPath } from "../../../../../../routes/Path.js";
import { formatDraftAmount, formatDraftDate, formatDraftTime } from "../../draftHelpers.js";
import { getReviewErrorMessage } from "../../draftReview.js";

const x = "dashboard.whatsappDrafts.review";

/* A short statement of what will be recorded, taken from the SAVED draft. */
function ConfirmSummary({ draft, locale }) {
  const { t } = useTranslation();
  const values = draft.review_values;
  const amount = formatDraftAmount(values.amount, values.currency_code, locale);
  const date = formatDraftDate(values.transaction_date, locale);
  const time = formatDraftTime(values.transaction_time);

  return (
    <dl className="wad-summary">
      <div><dt>{t(`${x}.amount`)}</dt><dd><bdi dir="ltr">{amount ?? "—"}</bdi></dd></div>
      <div><dt>{t(`${x}.account`)}</dt><dd dir="auto">{draft.account?.name ?? "—"}</dd></div>
      <div><dt>{t(`${x}.category`)}</dt><dd dir="auto">{draft.category?.name ?? "—"}</dd></div>
      <div>
        <dt>{t(`${x}.date`)}</dt>
        <dd><bdi>{date ?? "—"}</bdi>{time && <> <bdi dir="ltr">{time}</bdi></>}</dd>
      </div>
    </dl>
  );
}

function TerminalCard({ icon: Icon, tone, title, body, children }) {
  return (
    <section className={`wad-card wad-final wad-final--${tone}`} role="status">
      <span className="wad-final__icon" aria-hidden="true"><Icon /></span>
      <div className="wad-final__text">
        <h2>{title}</h2>
        <p>{body}</p>
        {children}
      </div>
    </section>
  );
}

/*
 * Confirmation and discard for one draft, plus the terminal states. It only
 * reflects the `review` object from useWhatsAppDraftReview; every state shown
 * here comes from a backend answer, never from a click.
 */
export default function DraftActionsPanel({ review, locale }) {
  const { t } = useTranslation();
  const { state, canConfirm, isDirty } = review;
  const { draft, confirm, discard, conflict, transaction } = state;
  const [dialog, setDialog] = useState(null); // "confirm" | "discard"

  const working = confirm.phase === "confirming" || confirm.phase === "checking";
  const discarding = discard.phase === "discarding" || discard.phase === "checking";
  const transactionId = transaction?.id ?? draft.confirmed_transaction_id;

  if (draft.status === "confirmed") {
    return (
      <TerminalCard icon={LuCircleCheck} tone="ok" title={t(`${x}.confirmedTitle`)} body={t(`${x}.confirmedBody`)}>
        {transactionId != null && (
          <p className="wad-final__ref">
            {t(`${x}.transactionRef`)} <bdi dir="ltr">#{transactionId}</bdi>
          </p>
        )}
        {confirm.note === "reconciled" && <p className="wad-note">{t(`${x}.reconciledNote`)}</p>}
        <div className="wad-final__actions">
          {transactionId != null && (
            <Link className="wad-button wad-button--primary" to={getTransactionDetailsPath(transactionId)}>
              <LuReceiptText aria-hidden="true" />{t(`${x}.viewTransaction`)}
            </Link>
          )}
          <Link className="wad-button" to={PATH.USER.WHATSAPP_DRAFTS}>
            <LuInbox aria-hidden="true" />{t(`${x}.backToInbox`)}
          </Link>
        </div>
      </TerminalCard>
    );
  }

  if (draft.status === "discarded") {
    return (
      <TerminalCard icon={LuTrash2} tone="muted" title={t(`${x}.discardedTitle`)} body={t(`${x}.discardedBody`)}>
        <div className="wad-final__actions">
          <Link className="wad-button" to={PATH.USER.WHATSAPP_DRAFTS}>
            <LuInbox aria-hidden="true" />{t(`${x}.backToInbox`)}
          </Link>
        </div>
      </TerminalCard>
    );
  }

  if (draft.status === "expired") {
    return <TerminalCard icon={LuHourglass} tone="muted" title={t(`${x}.expiredTitle`)} body={t(`${x}.expiredBody`)} />;
  }

  if (draft.status === "collecting") {
    return <TerminalCard icon={LuHourglass} tone="muted" title={t(`${x}.collectingTitle`)} body={t(`${x}.collectingBody`)} />;
  }

  // ready_for_review
  const blocker = conflict ? "conflict" : isDirty ? "dirty" : !draft.can_confirm ? "forbidden" : !draft.confirmation.ready ? "notReady" : null;

  return (
    <>
      <section className="wad-card" aria-labelledby="wad-confirm-title">
        <header className="wad-card__head">
          <h2 id="wad-confirm-title">{t(`${x}.confirmTitle`)}</h2>
        </header>
        <p>{t(`${x}.confirmIntro`)}</p>

        {confirm.phase === "uncertain" || (confirm.phase === "checking" && confirm.uncertain) ? (
          <div className="wad-uncertain" role="alert">
            <h3>{t(`${x}.uncertainTitle`)}</h3>
            <p>{t(`${x}.uncertainBody`)}</p>
            {confirm.note === "not_recorded_yet" && <p>{t(`${x}.notRecordedYet`)}</p>}
            {confirm.note === "unreadable" && <p>{t(`${x}.unreadable`)}</p>}
            <div className="wad-final__actions">
              <button type="button" className="wad-button" onClick={review.checkConfirmation} disabled={working}>
                {confirm.phase === "checking" ? t(`${x}.checking`) : t(`${x}.checkStatus`)}
              </button>
              <button type="button" className="wad-button wad-button--primary" onClick={review.retryConfirmation} disabled={working}>
                {t(`${x}.retrySame`)}
              </button>
            </div>
            <p className="wad-note">{t(`${x}.retryNote`)}</p>
          </div>
        ) : (
          <>
            {confirm.phase === "rejected" && confirm.error && (
              <p className="wad-error" role="alert">{getReviewErrorMessage(confirm.error, t, "confirm")}</p>
            )}

            {blocker && <p className="wad-note wad-note--block">{t(`${x}.blocked.${blocker}`)}</p>}

            <div className="wad-final__actions">
              <button
                type="button"
                className="wad-button wad-button--primary"
                disabled={!canConfirm || working}
                aria-busy={working}
                onClick={() => setDialog("confirm")}
              >
                <LuCircleCheck aria-hidden="true" />
                {working ? t(`${x}.confirming`) : t(`${x}.confirm`)}
              </button>
            </div>
          </>
        )}
      </section>

      {draft.can_discard && (
        <section className="wad-card wad-discard" aria-labelledby="wad-discard-title">
          <div>
            <h2 id="wad-discard-title">{t(`${x}.discardTitle`)}</h2>
            <p>{t(`${x}.discardIntro`)}</p>
            {discard.phase === "rejected" && (
              <p className="wad-error" role="alert">
                {discard.error ? getReviewErrorMessage(discard.error, t, "discard") : t(`${x}.notDiscarded`)}
              </p>
            )}
            {discard.phase === "uncertain" && (
              <p className="wad-error" role="alert">{t(`${x}.discardUncertain`)}</p>
            )}
          </div>
          {discard.phase === "uncertain" ? (
            <button type="button" className="wad-button" onClick={review.checkDiscard}>{t(`${x}.checkStatus`)}</button>
          ) : (
            <button
              type="button"
              className="wad-button wad-button--danger"
              disabled={discarding || working || review.busy}
              aria-busy={discarding}
              onClick={() => setDialog("discard")}
            >
              <LuTrash2 aria-hidden="true" />
              {discarding ? t(`${x}.discarding`) : t(`${x}.discard`)}
            </button>
          )}
        </section>
      )}

      {dialog === "confirm" && (
        <ConfirmDialog
          tone="primary"
          title={t(`${x}.dialog.confirmTitle`)}
          message={t(`${x}.dialog.confirmBody`)}
          confirmLabel={t(`${x}.dialog.confirmAction`)}
          cancelLabel={t(`${x}.dialog.cancel`)}
          onCancel={() => setDialog(null)}
          onConfirm={() => { setDialog(null); review.confirm(); }}
        >
          <ConfirmSummary draft={draft} locale={locale} />
        </ConfirmDialog>
      )}

      {dialog === "discard" && (
        <ConfirmDialog
          title={t(`${x}.dialog.discardTitle`)}
          message={t(`${x}.dialog.discardBody`)}
          confirmLabel={t(`${x}.dialog.discardAction`)}
          cancelLabel={t(`${x}.dialog.keep`)}
          onCancel={() => setDialog(null)}
          onConfirm={() => { setDialog(null); review.discard(); }}
        />
      )}
    </>
  );
}
