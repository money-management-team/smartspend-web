import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

import { PATH, getSettingsTabPath, getWhatsAppDraftPath } from "../../routes/Path.js";
import PagedRead from "../assist/PagedRead.jsx";
import { assistKeys, loadWhatsApp, whatsAppDraftLoader, whatsAppDraftsLoader } from "../data/assistLoaders.js";
import { isAccountId, sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { FormWithChoices } from "../forms/MobileWorkflow.jsx";
import { todayIn } from "../forms/validation.js";
import { WORKFLOWS } from "../forms/workflows.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { DRAFT_STATUSES, buildDraftDetail, buildPage, buildWhatsApp, normalizeDraft } from "../models/assist.js";
import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { MOBILE_WHATSAPP, MOBILE_WHATSAPP_DRAFTS, backPathFrom, whatsappDraftPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

const DRAFT_TONES = { collecting: "neutral", ready_for_review: "warn", confirmed: "good", discarded: "neutral", expired: "bad" };
const localeOf = (i18n) => (i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en");
const draftsPage = (data) => buildPage(data, "drafts", normalizeDraft);

/*
 * WhatsApp on Mobile, read-only (GET /integrations/whatsapp and the draft
 * reads). Linking needs a one-time challenge the server creates (a write), so
 * it is explained here and done in the full version; Mobile never asks for or
 * shows a linking token. Disconnecting is a write too: its confirmation is
 * shown, and its last step is disabled. The consent and legal wording is the
 * product owner's to approve, and is marked as such.
 */
export default function MobileWhatsApp() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const resource = useResource(assistKeys.whatsapp, loadWhatsApp);
  const [askDisconnect, setAskDisconnect] = useState(false);
  const disconnectRef = useRef(null);
  const status = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildWhatsApp(resource.data);
    } catch {
      return null;
    }
  }, [resource.data]);

  if (resource.loading) return <section className="sm-page" data-sm-screen="whatsapp" data-sm-state="loading"><Skeleton lines={5} label={t("whatsapp.loading")} /></section>;
  if (resource.status === "error" || !status) return <section className="sm-page" data-sm-screen="whatsapp" data-sm-state="error"><ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} /></section>;

  const state = status.enabled ? status.state : "disabled";

  return (
    <section className="sm-page" data-sm-screen="whatsapp" data-sm-state="ready" data-sm-whatsapp={state}>
      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
      <div className="sm-card">
        <h2 className="sm-card-title">{t("whatsapp.title")}</h2>
        <p className="sm-text sm-muted">{t("whatsapp.intro")}</p>
        <p className="sm-chips-inline"><span className="sm-chip sm-plan-chip" data-sm-tone={state === "linked" ? "good" : state === "disabled" ? "bad" : "warn"}>{t(`whatsapp.state.${state}`)}</span></p>
        <p className="sm-text">{t(`whatsapp.stateBody.${state}`)}</p>
        {state === "linked" && (
          <dl className="sm-stats sm-stats-stacked">
            {status.phoneLastDigits && <div className="sm-stat"><dt>{t("whatsapp.number")}</dt><dd><bdi dir="ltr">•••• {status.phoneLastDigits}</bdi></dd></div>}
            {status.linkedAt && <div className="sm-stat"><dt>{t("whatsapp.linkedAt")}</dt><dd><bdi>{formatMoment(status.linkedAt, localeOf(i18n))}</bdi></dd></div>}
          </dl>
        )}
      </div>

      {state === "not_linked" && (
        <section className="sm-card" aria-labelledby={`${ids}-link`} data-sm-section="linking">
          <h2 id={`${ids}-link`} className="sm-card-title">{t("whatsapp.howTitle")}</h2>
          <ol className="sm-steps">
            {["one", "two", "three"].map((step) => <li key={step} className="sm-text">{t(`whatsapp.how.${step}`)}</li>)}
          </ol>
          <p className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="whatsapp.link">{t("whatsapp.linkClosed")}</p>
          {status.canLink && (
            <Link className="sm-link-row" to={getSettingsTabPath("integrations")}>
              <span>{t("whatsapp.linkFull")}</span>
              <Chevron />
            </Link>
          )}
        </section>
      )}

      {state !== "disabled" && (status.canReview || state === "linked") && (
        <Link className="sm-card sm-card-link" to={MOBILE_WHATSAPP_DRAFTS} data-sm-action="drafts">
          <span className="sm-row-main">
            <span className="sm-row-title">{t("whatsapp.draftsTitle")}</span>
            <span className="sm-row-meta">{t("whatsapp.draftsHint")}</span>
          </span>
          <Chevron />
        </Link>
      )}

      {state === "linked" && status.canManage && (
        <section className="sm-card" aria-labelledby={`${ids}-manage`}>
          <h2 id={`${ids}-manage`} className="sm-card-title">{t("whatsapp.manageTitle")}</h2>
          <button type="button" ref={disconnectRef} className="sm-button sm-button-quiet" onClick={() => setAskDisconnect(true)} data-sm-action="disconnect">{t("whatsapp.disconnect")}</button>
        </section>
      )}

      <section className="sm-card" aria-labelledby={`${ids}-legal`} data-sm-section="consent">
        <h2 id={`${ids}-legal`} className="sm-card-title">{t("whatsapp.privacyTitle")}</h2>
        <p className="sm-text sm-muted">{t("whatsapp.privacyBody")}</p>
        <p className="sm-text sm-fine sm-pending" role="note" data-sm-note="legal-pending">{t("whatsapp.legalPending")}</p>
        <Link className="sm-link-row" to={PATH.PUBLIC.SECURITY}>
          <span>{t("whatsapp.security")}</span>
          <Chevron />
        </Link>
      </section>

      <MobileSheet open={askDisconnect} onClose={() => setAskDisconnect(false)} titleId={`${ids}-disconnect`} title={t("whatsapp.disconnectTitle")} returnFocusRef={disconnectRef}>
        <p className="sm-text">{t("whatsapp.disconnectBody")}</p>
        <p className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="whatsapp.unlink">{t("whatsapp.disconnectClosed")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={() => setAskDisconnect(false)} data-sm-action="keep-linked">{t("whatsapp.keepLinked")}</button>
          <button type="button" className="sm-button sm-button-quiet" disabled data-sm-action="confirm-disconnect">{t("whatsapp.disconnect")}</button>
        </div>
        <Link className="sm-link-row" to={getSettingsTabPath("integrations")}>
          <span>{t("whatsapp.disconnectFull")}</span>
          <Chevron />
        </Link>
      </MobileSheet>
    </section>
  );
}

function DraftRow({ draft }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  return (
    <Link className="sm-link-row" to={whatsappDraftPath(draft.id)} state={{ from: MOBILE_WHATSAPP_DRAFTS }} data-sm-draft={draft.id} data-sm-status={draft.status}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{draft.review.description || t("whatsapp.untitled")}</span>
        <span className="sm-row-meta">
          <span className="sm-chip sm-plan-chip" data-sm-tone={DRAFT_TONES[draft.status]}>{t(`whatsapp.draftStatus.${draft.status}`)}</span>
          {draft.review.amount && <> <Money plain value={draft.review.amount} currency={draft.currency ?? undefined} /></>}
          {draft.createdAt && <> · <bdi>{formatMoment(draft.createdAt, localeOf(i18n))}</bdi></>}
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

export function MobileWhatsAppDrafts() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [params, setParams] = useSearchParams();
  const status = DRAFT_STATUSES.includes(params.get("status")) ? params.get("status") : "";
  const keyOf = useMemo(() => (page) => assistKeys.whatsappDrafts(status, page), [status]);
  const loaderOf = useMemo(() => (page) => whatsAppDraftsLoader(status, page), [status]);

  return (
    <section className="sm-page" data-sm-screen="whatsapp-drafts">
      <Link className="sm-link-row sm-back" to={MOBILE_WHATSAPP}>
        <Chevron back />
        <span>{t("whatsapp.back")}</span>
      </Link>
      <div className="sm-card sm-plan-filters">
        <FilterTabs tight label={t("whatsapp.filter")} value={status} options={[{ value: "", label: t("whatsapp.all") }, ...DRAFT_STATUSES.map((value) => ({ value, label: t(`whatsapp.draftStatus.${value}`) }))]} onChange={(next) => setParams(next ? { status: next } : {})} />
      </div>
      <div className="sm-card">
        <PagedRead key={status} name="whatsapp-drafts" keyOf={keyOf} loaderOf={loaderOf} build={draftsPage} label={t("whatsapp.draftsTitle")} empty={t(status ? "whatsapp.draftsEmptyFiltered" : "whatsapp.draftsEmpty")} renderItem={(draft) => <DraftRow draft={draft} />} />
      </div>
    </section>
  );
}

/* One draft: what was sent, what is missing, and its review. A draft that is gone (expired, missing) says so. */
export function MobileWhatsAppDraft() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { draftId } = useParams();
  const location = useLocation();
  const valid = isAccountId(draftId);
  const loader = useMemo(() => whatsAppDraftLoader(draftId), [draftId]);
  const resource = useResource(assistKeys.whatsappDraft(draftId), loader, { enabled: valid });
  const draft = useMemo(() => (valid && resource.data !== undefined ? buildDraftDetail(resource.data, draftId) : null), [valid, resource.data, draftId]);
  const ctx = useMemo(() => (draft ? { today: todayIn(sessionWorkspace()?.timezone), record: draft } : null), [draft]);
  const backTo = backPathFrom(location.state, MOBILE_WHATSAPP_DRAFTS);
  const workflow = WORKFLOWS["whatsapp-draft"];
  const back = (
    <Link className="sm-link-row sm-back" to={backTo}>
      <Chevron back />
      <span>{t("whatsapp.backToDrafts")}</span>
    </Link>
  );

  if (!valid) return <section className="sm-page" data-sm-screen="whatsapp-draft" data-sm-state="error">{back}<ErrorPanel error={{ code: "NOT_FOUND" }} /></section>;
  if (resource.loading) return <section className="sm-page" data-sm-screen="whatsapp-draft" data-sm-state="loading"><Skeleton lines={5} label={t("whatsapp.loadingDraft")} /></section>;
  if (resource.status === "error" || !draft) {
    return (
      <section className="sm-page" data-sm-screen="whatsapp-draft" data-sm-state="error">
        {back}
        <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} hideExistence />
        <p className="sm-text sm-muted">{t("whatsapp.missingDraft")}</p>
      </section>
    );
  }

  const reason = workflow.eligible(draft);

  return (
    <section className="sm-page" data-sm-screen="whatsapp-draft" data-sm-record={draft.id} data-sm-status={draft.status} data-sm-version={draft.reviewVersion} data-sm-state={resource.stale ? "stale" : "ready"}>
      {back}
      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
      <div className="sm-card">
        <h2 className="sm-card-title">{t("forms.flows.whatsapp-draft.title")}</h2>
        <p className="sm-chips-inline"><span className="sm-chip sm-plan-chip" data-sm-tone={DRAFT_TONES[draft.status]}>{t(`whatsapp.draftStatus.${draft.status}`)}</span></p>
        <p className="sm-text sm-muted">{t("forms.flows.whatsapp-draft.intro")}</p>
        {draft.message && <blockquote className="sm-text sm-user-text sm-transcript" dir="auto">{draft.message}</blockquote>}
        {draft.issues.length > 0 && (
          <div role="note" data-sm-note="draft-issues">
            <h3 className="sm-row-title">{t("whatsapp.issuesTitle")}</h3>
            <ul className="sm-bullets">{draft.issues.map((code) => <li key={code} className="sm-text">{t(`whatsapp.issue.${code}`, { defaultValue: t("whatsapp.issue.other") })}</li>)}</ul>
          </div>
        )}
        <p className="sm-text sm-muted sm-fine">{t("whatsapp.version", { version: draft.reviewVersion })}</p>
      </div>
      {reason ? (
        <div className="sm-card" role="note" data-sm-note="ineligible" data-sm-reason={reason}>
          <p className="sm-text">{t(`forms.ineligible.${reason}`)}</p>
          <Link className="sm-link-row" to={getWhatsAppDraftPath(draft.id)}>
            <span>{t("whatsapp.openFull")}</span>
            <Chevron />
          </Link>
        </div>
      ) : (
        <FormWithChoices key={`${draft.id}:${draft.reviewVersion}`} workflow={workflow} ctx={ctx} backTo={backTo} />
      )}
    </section>
  );
}
