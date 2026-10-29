import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { LuArrowLeft, LuRefreshCw, LuTriangleAlert } from "react-icons/lu";

import UnsavedChangesGuard from "../../../../components/UnsavedChanges/UnsavedChangesGuard.jsx";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext.js";
import { useWhatsAppPending } from "../../../../contexts/whatsappPending/useWhatsAppPending.js";
import { PATH } from "../../../../routes/Path.js";
import { whatsappApi } from "../api/whatsappApi.js";
import { getDisplayLocale } from "../Accounts/accountHelpers.js";
import DraftActionsPanel from "./components/DraftReview/DraftActionsPanel.jsx";
import DraftEditForm from "./components/DraftReview/DraftEditForm.jsx";
import { AboutCard, FinancialCard, ReadinessCard } from "./components/DraftDetailsView/DraftDetailsView.jsx";
import { draftTitle, getDraftsErrorMessage } from "./draftHelpers.js";
import { getReviewErrorMessage } from "./draftReview.js";
import { useDraftChoices } from "./useDraftChoices.js";
import { useWhatsAppDraftReview } from "./useWhatsAppDraftReview.js";

import "./WhatsAppDrafts.css";

const x = "dashboard.whatsappDrafts";

function ConflictBanner({ conflict, onReapply, onDismiss }) {
  const { t } = useTranslation();
  const mine = Object.keys(conflict.mine ?? {});

  return (
    <section className="wad-banner wad-banner--conflict" role="alert" aria-labelledby="wad-conflict-title">
      <LuTriangleAlert aria-hidden="true" />
      <div>
        <h2 id="wad-conflict-title">{t(`${x}.review.conflictTitle`)}</h2>
        <p>{t(`${x}.review.conflictBody`)}</p>
        {mine.length > 0 && (
          <>
            <p>{t(`${x}.review.conflictMine`)}</p>
            <ul className="wad-conflict__fields">
              {mine.map((field) => <li key={field}>{t(`${x}.review.fields.${field}`)}</li>)}
            </ul>
          </>
        )}
        <div className="wad-final__actions">
          {mine.length > 0 && (
            <button type="button" className="wad-button" onClick={onReapply}>{t(`${x}.review.reapply`)}</button>
          )}
          <button type="button" className="wad-button wad-button--primary" onClick={onDismiss}>
            {mine.length > 0 ? t(`${x}.review.discardMine`) : t(`${x}.review.understood`)}
          </button>
        </div>
      </div>
    </section>
  );
}

/*
 * Review, edit, confirm or discard one WhatsApp draft. All state and every
 * write live in useWhatsAppDraftReview (see its notes on money safety). This
 * component is mounted under a key of session + draft id by the default export
 * below, so a different user or draft always starts from nothing.
 */
function DraftReview({ api, accounts, categories, draftId }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const location = useLocation();
  const { refresh: refreshPending } = useWhatsAppPending();
  const review = useWhatsAppDraftReview({ api, draftId, onChanged: refreshPending });
  const { state } = review;
  const { draft } = state;

  const editable = Boolean(draft && draft.status === "ready_for_review" && draft.can_edit === true);
  const choices = useDraftChoices({ workspaceId: draft?.workspace_id, enabled: editable, accounts, categories });

  const listSearch = typeof location.state?.listSearch === "string" ? location.state.listSearch : "";
  const back = `${PATH.USER.WHATSAPP_DRAFTS}${listSearch}`;
  const loading = state.load === "loading";
  const failure = state.load === "error"
    ? (state.loadError?.code === "WHATSAPP_INPUT_INVALID" ? { ...state.loadError, code: "NOT_FOUND" } : state.loadError)
    : null;

  return (
    <div className="wad-page">
      <UnsavedChangesGuard when={review.isDirty && state.save.phase !== "saving"} />

      <nav className="wad-back" aria-label={t(`${x}.details.navLabel`)}>
        <Link className="wad-button wad-button--ghost" to={back}>
          <LuArrowLeft aria-hidden="true" />
          {t(`${x}.details.back`)}
        </Link>
        <button
          type="button"
          className="wad-button"
          onClick={review.reload}
          disabled={loading || review.busy || review.isDirty}
        >
          <LuRefreshCw aria-hidden="true" />
          {t(`${x}.refresh`)}
        </button>
      </nav>

      <header className="wad-header wad-header--details">
        <div className="wad-header__title">
          <span className="wad-header__icon" aria-hidden="true"><FaWhatsapp /></span>
          <div>
            <h1 dir="auto">
              {draft ? draftTitle(draft) ?? t(`${x}.row.untitled`, { id: draft.id }) : t(`${x}.details.title`)}
            </h1>
            <p>{editable ? t(`${x}.review.subtitle`) : t(`${x}.details.subtitle`)}</p>
          </div>
        </div>
      </header>

      <div aria-busy={loading}>
        {loading && (
          <div className="wad-skeletons" role="status">
            <span className="wad-sr-only">{t(`${x}.loading`)}</span>
            <div className="wad-skeleton wad-skeleton--tall" aria-hidden="true" />
            <div className="wad-skeleton" aria-hidden="true" />
          </div>
        )}

        {failure && (
          <div className="wad-state wad-state--error" role="alert">
            <p dir="auto">{getDraftsErrorMessage(failure, t)}</p>
            {failure.code !== "NOT_FOUND" && failure.code !== "FORBIDDEN" && (
              <button type="button" className="wad-button" onClick={review.reload}>{t("common.retry")}</button>
            )}
            <Link className="wad-button wad-button--ghost" to={back}>{t(`${x}.details.back`)}</Link>
          </div>
        )}

        {draft && (
          <div className="wad-details">
            {state.conflict && (
              <ConflictBanner
                conflict={state.conflict}
                onReapply={() => review.resolveConflict("reapply")}
                onDismiss={() => review.resolveConflict("dismiss")}
              />
            )}

            {draft.status !== "ready_for_review" && <DraftActionsPanel review={review} locale={locale} />}

            {editable ? (
              <DraftEditForm
                draft={draft}
                form={state.form}
                fieldErrors={state.fieldErrors}
                saveState={state.save}
                saveMessage={state.save.error ? getReviewErrorMessage(state.save.error, t, "save") : null}
                choices={choices}
                dirty={review.isDirty}
                disabled={review.busy && state.save.phase !== "saving"}
                onChange={review.setField}
                onSave={review.save}
                onReset={review.resetForm}
              />
            ) : (
              <FinancialCard draft={draft} locale={locale} />
            )}

            <ReadinessCard draft={draft} />

            {draft.status === "ready_for_review" && <DraftActionsPanel review={review} locale={locale} />}

            <AboutCard draft={draft} locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppDraftDetails({ api = whatsappApi, accounts, categories }) {
  const { draftId } = useParams();
  const { user } = useAuthContext();
  const scope = String(user?.id ?? "anonymous");

  // A different session or draft is a different instance: nothing carries over.
  return (
    <DraftReview
      key={`${scope}|${draftId}`}
      api={api}
      accounts={accounts}
      categories={categories}
      draftId={draftId}
    />
  );
}
