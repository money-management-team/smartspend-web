import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

import { PATH, getSettingsTabPath, getWhatsAppDraftPath } from "../../routes/Path.js";
import PagedRead from "../assist/PagedRead.jsx";
import { assistKeys, loadWhatsApp, loadWhatsAppSummary, whatsAppDraftLoader, whatsAppDraftsLoader } from "../data/assistLoaders.js";
import { isAccountId, sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { FormWithChoices } from "../forms/MobileWorkflow.jsx";
import { todayIn } from "../forms/validation.js";
import { WORKFLOWS } from "../forms/workflows.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { DEFAULT_DRAFT_STATUS, DRAFT_STATUSES, buildDraftDetail, buildDraftSummary, buildPage, buildWhatsApp, normalizeDraft } from "../models/assist.js";
import { formatDay, formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { MOBILE_WHATSAPP, MOBILE_WHATSAPP_DRAFTS, accountDetailPath, activityDetailPath, backPathFrom, whatsappDraftPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import { Fact } from "../ui/StateChip.jsx";

const DRAFT_TONES = { collecting: "neutral", ready_for_review: "warn", confirmed: "good", discarded: "neutral", expired: "bad" };
const LINK_TONES = { active: "good", pending: "warn", revoked: "neutral" };
const localeOf = (i18n) => (i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en");
const draftsPage = (data) => buildPage(data, "drafts", normalizeDraft);
const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/* The backend's count of drafts waiting for review, as a line and a link. A failed read says so and leaves the rest alone. */
function PendingReview({ canReview }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const resource = useResource(assistKeys.whatsappSummary, loadWhatsAppSummary);
  const summary = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildDraftSummary(resource.data);
    } catch {
      return null;
    }
  }, [resource.data]);

  let line;
  if (resource.loading) line = <Skeleton lines={1} label={t("whatsappView.pending.loading")} />;
  else if (!summary) line = <p className="sm-text sm-muted" data-sm-pending="unknown">{t("whatsappView.pending.unknown")}</p>;
  else if (summary.pending === 0) line = <p className="sm-text sm-muted" data-sm-pending="0">{t("whatsappView.pending.none")}</p>;
  else line = <p className="sm-row-title" data-sm-pending={summary.pending}>{t("whatsappView.pending.count", { n: summary.pending })}</p>;

  return (
    <section className="sm-card" aria-labelledby="sm-wa-pending" data-sm-section="pending-review">
      <h2 id="sm-wa-pending" className="sm-card-title">{t("whatsappView.pending.title")}</h2>
      {line}
      {canReview && (
        <Link className="sm-link-row" to={MOBILE_WHATSAPP_DRAFTS} data-sm-action="drafts">
          <span className="sm-row-main">
            <span className="sm-row-title">{t("whatsappView.pending.open")}</span>
            <span className="sm-row-meta">{t("whatsapp.draftsHint")}</span>
          </span>
          <Chevron />
        </Link>
      )}
    </section>
  );
}

/*
 * WhatsApp on Mobile, read-only (GET /integrations/whatsapp, its draft summary and the draft reads). It says what the
 * backend says: whether WhatsApp is available, whether the person's number is linked (and the link's own status, the
 * number's last digits, the reply language and the default account), SmartSpend's number, and how many drafts wait for
 * review. Linking needs a one-time challenge the server creates (a write), so it is explained here and done in the
 * full version; Mobile never asks for or shows a linking token. Disconnecting is a write too: its confirmation is shown,
 * and its last step is disabled. There is no endpoint for WhatsApp messages or usage limits, and the screen says so.
 */
export default function MobileWhatsApp() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const locale = localeOf(i18n);
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
  if (resource.status === "error" || !status) return <section className="sm-page" data-sm-screen="whatsapp" data-sm-state="error"><ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} /></section>;

  const state = status.enabled ? status.state : "disabled";
  const linkedOn = formatMoment(status.linkedAt, locale);
  const revokedOn = formatDay(status.revokedAt, locale);
  const language = status.language ? t(`whatsappView.languages.${status.language}`, { defaultValue: status.language }) : null;
  // A number is the current one only while linked; a link that is pending (or has a status Mobile does not know) shows just that status.
  const isLinked = state === "linked";
  const showStatus = isLinked || (status.linkStatus !== null && status.linkStatus !== "revoked");
  const earlier = state !== "linked" && status.linkStatus === "revoked" && revokedOn;

  return (
    <section className="sm-page" data-sm-screen="whatsapp" data-sm-state="ready" data-sm-whatsapp={state} data-sm-link-status={status.linkStatus ?? undefined}>
      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
      <div className="sm-card" data-sm-section="connection">
        <h2 className="sm-card-title">{t("whatsapp.title")}</h2>
        <p className="sm-text sm-muted">{t("whatsapp.intro")}</p>
        <p className="sm-chips-inline"><span className="sm-chip sm-plan-chip" data-sm-tone={state === "linked" ? "good" : state === "disabled" ? "bad" : "warn"}>{t(`whatsapp.state.${state}`)}</span></p>
        <p className="sm-text">{t(`whatsapp.stateBody.${state}`)}</p>
        {state === "disabled" && status.canReview && <p className="sm-text sm-muted" data-sm-note="disabled-drafts">{t("whatsappView.disabledDrafts")}</p>}
        {earlier && <p className="sm-text sm-muted" data-sm-note="earlier-link">{t("whatsappView.earlierLink", { date: revokedOn })}</p>}
        {(showStatus || status.publicNumber) && (
          <dl className="sm-stats sm-stats-stacked">
            {isLinked && status.phoneLastDigits && <Fact label={t("whatsapp.number")}><bdi dir="ltr">•••• {status.phoneLastDigits}</bdi></Fact>}
            {isLinked && linkedOn && <Fact label={t("whatsapp.linkedAt")}><bdi>{linkedOn}</bdi></Fact>}
            {showStatus && status.linkStatus && (
              <Fact label={t("whatsappView.linkStatus")}>
                <span className="sm-chip sm-plan-chip" data-sm-tone={status.linkStatusKnown ? LINK_TONES[status.linkStatus] : "neutral"} data-sm-link-chip={status.linkStatus}>{status.linkStatusKnown ? t(`whatsappView.linkStatuses.${status.linkStatus}`) : t("planning.state.unknown", { status: status.linkStatus.replace(/_/g, " ") })}</span>
              </Fact>
            )}
            {isLinked && language && <Fact label={t("whatsappView.language")}><bdi>{language}</bdi></Fact>}
            {isLinked && (
              <Fact label={t("whatsappView.defaultAccount")}>
                {status.defaultAccountName ? (isAccountId(status.defaultAccountId) ? <Link to={accountDetailPath(status.defaultAccountId)} state={{ from: MOBILE_WHATSAPP }}><bdi className="sm-user-text">{status.defaultAccountName}</bdi></Link> : <bdi className="sm-user-text">{status.defaultAccountName}</bdi>) : t("whatsappView.noDefaultAccount")}
              </Fact>
            )}
            {status.publicNumber && <Fact label={t("whatsappView.smartspendNumber")}><bdi dir="ltr" data-sm-public-number="true">+{status.publicNumber}</bdi></Fact>}
          </dl>
        )}
        {state === "linked" && status.publicNumber && (
          <>
            <a className="sm-link-row" href={`https://wa.me/${status.publicNumber}`} target="_blank" rel="noopener noreferrer" data-sm-action="open-chat">
              <span>{t("whatsappView.openChat")}</span>
              <Chevron />
            </a>
            <p className="sm-text sm-muted sm-fine">{t("whatsappView.chatHint")}</p>
          </>
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

      {(status.canReview || state === "linked") && <PendingReview canReview />}

      <section className="sm-card" aria-labelledby={`${ids}-limits`} data-sm-section="limits">
        <h2 id={`${ids}-limits`} className="sm-card-title">{t("whatsappView.limits.title")}</h2>
        <p className="sm-text sm-muted">{t("whatsappView.limits.body")}</p>
        {(status.canReview || state === "linked") && (
          <Link className="sm-link-row" to={MOBILE_WHATSAPP_DRAFTS}>
            <span>{t("whatsappView.limits.open")}</span>
            <Chevron />
          </Link>
        )}
      </section>

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

function DraftRow({ draft, from }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = localeOf(i18n);
  const day = formatDay(draft.review.transaction_date, locale);
  const reviewBy = draft.status === "ready_for_review" ? formatMoment(draft.expiresAt, locale) : null;

  return (
    <Link className="sm-link-row" to={whatsappDraftPath(draft.id)} state={{ from }} data-sm-draft={draft.id} data-sm-status={draft.status} data-sm-ready={draft.status === "ready_for_review" ? String(draft.ready) : undefined}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{draft.review.description || t("whatsapp.untitled")}</span>
        <span className="sm-row-meta">
          {draft.review.amount ? <Money plain value={draft.review.amount} currency={draft.currency ?? undefined} /> : t("whatsappView.drafts.noAmount")}
          {draft.accountName && <> · <bdi className="sm-user-text">{draft.accountName}</bdi></>}
          {day && <> · <bdi>{day}</bdi></>}
        </span>
        <span className="sm-chips-inline">
          <span className="sm-chip sm-plan-chip" data-sm-tone={DRAFT_TONES[draft.status]}>{t(`whatsapp.draftStatus.${draft.status}`)}</span>
          {draft.status === "ready_for_review" && (draft.ready
            ? <span className="sm-chip sm-plan-chip" data-sm-tone="neutral" data-sm-readiness="complete">{t("whatsappView.drafts.complete")}</span>
            : draft.issues.length > 0 && <span className="sm-chip sm-plan-chip" data-sm-tone="warn" data-sm-readiness="attention">{t("whatsappView.drafts.attention", { n: draft.issues.length })}</span>)}
        </span>
        {reviewBy && <span className="sm-row-meta">{t("whatsappView.drafts.reviewBy")} <bdi>{reviewBy}</bdi></span>}
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * The drafts, one status at a time (GET .../expense-drafts?status=). The backend has no "all": without a status it lists
 * the ones waiting for review, so the five statuses are the five tabs and "waiting for review" is the one that opens.
 * The status is in the address (omitted for the default), the page is the backend's, and the total is its paginator's.
 */
export function MobileWhatsAppDrafts() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const status = DRAFT_STATUSES.includes(params.get("status")) ? params.get("status") : DEFAULT_DRAFT_STATUS;
  const keyOf = useMemo(() => (page) => assistKeys.whatsappDrafts(status, page), [status]);
  const loaderOf = useMemo(() => (page) => whatsAppDraftsLoader(status, page), [status]);
  const here = `${location.pathname}${location.search}`;

  return (
    <section className="sm-page" data-sm-screen="whatsapp-drafts" data-sm-status={status}>
      <Link className="sm-link-row sm-back" to={MOBILE_WHATSAPP}>
        <Chevron back />
        <span>{t("whatsapp.back")}</span>
      </Link>
      <div className="sm-card sm-plan-filters">
        <FilterTabs tight label={t("whatsapp.filter")} value={status} options={DRAFT_STATUSES.map((value) => ({ value, label: t(`whatsapp.draftStatus.${value}`) }))} onChange={(next) => setParams(next === DEFAULT_DRAFT_STATUS ? {} : { status: next })} />
      </div>
      <div className="sm-card">
        <p className="sm-text sm-muted sm-fine" data-sm-hint={status}>{t(`whatsappView.drafts.statusHint.${status}`)}</p>
        <PagedRead
          key={status}
          name="whatsapp-drafts"
          keyOf={keyOf}
          loaderOf={loaderOf}
          build={draftsPage}
          label={t("whatsapp.draftsTitle")}
          empty={t(`whatsappView.drafts.empty.${status}`)}
          header={(result) => (result.total !== null && result.total > 0 ? <p className="sm-text sm-muted sm-fine" data-sm-total={result.total}>{t("whatsappView.drafts.total", { n: result.total })}</p> : null)}
          renderItem={(draft) => <DraftRow draft={draft} from={here} />}
        />
        <p className="sm-text sm-muted sm-fine">{t("whatsappView.drafts.hint")}</p>
      </div>
    </section>
  );
}

/* One date-and-time line of a draft's timeline, in the draft's own time zone when it names a valid one. */
function Timeline({ draft, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const zone = draft.timezone ?? undefined;
  const events = [
    ["created", draft.createdAt],
    ["ready", draft.readyAt],
    ["expires", draft.status === "ready_for_review" ? draft.expiresAt : null],
    ["confirmed", draft.confirmedAt],
    ["discarded", draft.discardedAt],
    ["expired", draft.expiredAt],
  ].filter(([, value]) => formatMoment(value, locale, zone));

  if (events.length === 0) return null;

  return (
    <section className="sm-card" aria-labelledby="sm-wa-timeline" data-sm-section="draft-timeline">
      <h2 id="sm-wa-timeline" className="sm-card-title">{t("whatsappView.draft.timeline")}</h2>
      <dl className="sm-stats sm-stats-stacked">
        {events.map(([key, value]) => <Fact key={key} label={t(`whatsappView.draft.events.${key}`)}><bdi>{formatMoment(value, locale, zone)}</bdi></Fact>)}
      </dl>
    </section>
  );
}

/* One draft: what SmartSpend read from the message, whether it is ready to confirm and why not, its timeline, and its review. A draft that is gone (expired, missing) says so. */
export function MobileWhatsAppDraft() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = localeOf(i18n);
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
        <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} hideExistence />
        <p className="sm-text sm-muted">{t("whatsapp.missingDraft")}</p>
      </section>
    );
  }

  const reason = workflow.eligible(draft);
  const reviewable = draft.status === "ready_for_review";
  const day = formatDay(draft.review.transaction_date, locale);
  // A code SmartSpend later adds has no words here: the backend's own message is shown instead.
  const issueText = (issue) => (issue.code && i18n.exists(`whatsappView.draft.issue.${issue.code}`, { ns: MOBILE_NAMESPACE }) ? t(`whatsappView.draft.issue.${issue.code}`) : issue.message || t("whatsappView.draft.issue.other"));

  return (
    <section className="sm-page" data-sm-screen="whatsapp-draft" data-sm-record={draft.id} data-sm-status={draft.status} data-sm-version={draft.reviewVersion} data-sm-state={resource.stale ? "stale" : "ready"}>
      {back}
      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}

      <div className="sm-card" data-sm-section="draft-summary">
        <h2 className="sm-card-title">{t("forms.flows.whatsapp-draft.title")}</h2>
        <p className="sm-chips-inline"><span className="sm-chip sm-plan-chip" data-sm-tone={DRAFT_TONES[draft.status]}>{t(`whatsapp.draftStatus.${draft.status}`)}</span></p>
        <p className="sm-text" data-sm-hint={draft.status}>{t(`whatsappView.drafts.statusHint.${draft.status}`)}</p>
        <p className="sm-text sm-muted sm-fine" data-sm-note="message">{t("whatsappView.draft.messageNote")}</p>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("whatsappView.draft.amount")}>{draft.review.amount ? <Money value={draft.review.amount} currency={draft.currency ?? undefined} /> : t("whatsappView.draft.notSet")}</Fact>
          <Fact label={t("whatsappView.draft.account")}>
            {draft.accountName ? (isAccountId(draft.accountId) ? <Link to={accountDetailPath(draft.accountId)} state={{ from: `${location.pathname}${location.search}` }}><bdi className="sm-user-text">{draft.accountName}</bdi></Link> : <bdi className="sm-user-text">{draft.accountName}</bdi>) : t("whatsappView.draft.notSet")}
          </Fact>
          {draft.accountBalance && draft.currency && <Fact label={t("whatsappView.draft.balance")}><Money plain value={draft.accountBalance} currency={draft.currency} /></Fact>}
          <Fact label={t("whatsappView.draft.category")}>{draft.categoryName ? <bdi className="sm-user-text">{draft.categoryName}</bdi> : t("whatsappView.draft.notSet")}</Fact>
          <Fact label={t("whatsappView.draft.date")}>{day ? <bdi>{day}</bdi> : t("whatsappView.draft.notSet")}</Fact>
          {draft.review.transaction_time && <Fact label={t("whatsappView.draft.time")}><bdi dir="ltr">{draft.review.transaction_time}</bdi></Fact>}
          {draft.timezone && <Fact label={t("whatsappView.draft.timezone")}><bdi dir="ltr">{draft.timezone}</bdi></Fact>}
          <Fact label={t("whatsappView.draft.description")}>{draft.review.description ? <span className="sm-user-text">{draft.review.description}</span> : t("whatsappView.draft.notSet")}</Fact>
        </dl>
        {draft.status === "confirmed" && draft.confirmedTransactionId && (
          <Link className="sm-link-row" to={activityDetailPath(draft.confirmedTransactionId)} state={{ from: `${location.pathname}${location.search}` }} data-sm-link="confirmed-transaction">
            <span>{t("whatsappView.draft.recorded")}</span>
            <Chevron />
          </Link>
        )}
        <p className="sm-text sm-muted sm-fine">{t("whatsapp.version", { version: draft.reviewVersion })}</p>
      </div>

      {reviewable && (
        <section className="sm-card" aria-labelledby="sm-wa-readiness" data-sm-section="draft-readiness" data-sm-ready={String(draft.ready)}>
          <h2 id="sm-wa-readiness" className="sm-card-title">{t("whatsappView.draft.readiness")}</h2>
          <p className="sm-chips-inline"><span className="sm-chip sm-plan-chip" data-sm-tone={draft.ready ? "neutral" : "warn"}>{t(draft.ready ? "whatsappView.draft.ready" : "whatsappView.draft.notReady")}</span></p>
          {draft.issueDetails.length > 0 ? (
            <div role="note" data-sm-note="draft-issues">
              <h3 className="sm-row-title">{t("whatsapp.issuesTitle")}</h3>
              <ul className="sm-bullets">{draft.issueDetails.map((issue, index) => <li key={`${index}:${issue.code}`} className="sm-text" data-sm-issue={issue.code ?? "other"}>{issueText(issue)}</li>)}</ul>
            </div>
          ) : (
            <p className="sm-text">{t(draft.ready ? "whatsappView.draft.readyBody" : "whatsappView.draft.noIssues")}</p>
          )}
          <p className="sm-text sm-muted sm-fine">{t("whatsappView.draft.recheck")}</p>
        </section>
      )}

      <Timeline draft={draft} locale={locale} />

      <section className="sm-card" aria-labelledby="sm-wa-about" data-sm-section="draft-about">
        <h2 id="sm-wa-about" className="sm-card-title">{t("whatsappView.draft.about")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("whatsappView.draft.reference")}><bdi dir="ltr">#{draft.id}</bdi></Fact>
          <Fact label={t("whatsappView.draft.source")}>{t("whatsappView.draft.sourceValue")}</Fact>
        </dl>
      </section>

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
