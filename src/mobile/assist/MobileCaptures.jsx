import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { assistKeys, receiptCaptureLoader, receiptCapturesLoader, voiceCaptureLoader, voiceCapturesLoader } from "../data/assistLoaders.js";
import { isAccountId, sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { FormWithChoices } from "../forms/MobileWorkflow.jsx";
import { todayIn } from "../forms/validation.js";
import { WORKFLOWS } from "../forms/workflows.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildCaptureDetail, buildPage, normalizeCapture } from "../models/assist.js";
import { formatDay, formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { MOBILE_CAPTURES, MOBILE_RECEIPT_NEW, MOBILE_VOICE_NEW, activityDetailPath, backPathFrom, captureDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import PagedRead from "./PagedRead.jsx";

const STATUS_TONES = { ready_for_review: "warn", failed: "bad", confirmed: "good", discarded: "neutral" };
const receiptsPage = (data) => buildPage(data, "captures", (raw) => normalizeCapture(raw, "receipt"));
const voicePage = (data) => buildPage(data, "captures", (raw) => normalizeCapture(raw, "voice"));
const localeOf = (i18n) => (i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en");

function CaptureRow({ capture }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = localeOf(i18n);
  const title = capture.review.merchant_name || capture.review.description || t(`captures.untitled.${capture.source}`);
  return (
    <Link className="sm-link-row" to={captureDetailPath(capture.source, capture.id)} state={{ from: `${MOBILE_CAPTURES}` }} data-sm-capture={`${capture.source}:${capture.id}`} data-sm-status={capture.status}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{title}</span>
        <span className="sm-row-meta">
          <span className="sm-chip sm-plan-chip" data-sm-tone={STATUS_TONES[capture.status] ?? "neutral"}>{t(`captures.status.${capture.status}`)}</span>
          {capture.review.amount && <> <Money plain value={capture.review.amount} currency={capture.review.currency_code ?? undefined} /></>}
          {capture.createdAt && <> · <bdi>{formatMoment(capture.createdAt, locale)}</bdi></>}
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * Receipts and voice recordings SmartSpend has read for you, newest first, read
 * with GET. A capture is a suggestion: nothing in either list is a recorded
 * expense until it is confirmed, which Mobile does not do yet.
 */
export default function MobileCaptures() {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <section className="sm-page" data-sm-screen="captures">
      <div className="sm-card">
        <h2 className="sm-card-title">{t("captures.title")}</h2>
        <p className="sm-text sm-muted">{t("captures.intro")}</p>
        <Link className="sm-link-row" to={MOBILE_RECEIPT_NEW} state={{ from: MOBILE_CAPTURES }} data-sm-action="new-receipt">
          <span>{t("captures.newReceipt")}</span>
          <Chevron />
        </Link>
        <Link className="sm-link-row" to={MOBILE_VOICE_NEW} state={{ from: MOBILE_CAPTURES }} data-sm-action="new-voice">
          <span>{t("captures.newVoice")}</span>
          <Chevron />
        </Link>
      </div>

      <section className="sm-card" aria-labelledby="sm-captures-receipts">
        <h2 id="sm-captures-receipts" className="sm-card-title">{t("captures.receipts")}</h2>
        <PagedRead name="receipts" param="r" keyOf={assistKeys.receiptCaptures} loaderOf={receiptCapturesLoader} build={receiptsPage} label={t("captures.receipts")} empty={t("captures.receiptsEmpty")} renderItem={(capture) => <CaptureRow capture={capture} />} />
      </section>

      <section className="sm-card" aria-labelledby="sm-captures-voice">
        <h2 id="sm-captures-voice" className="sm-card-title">{t("captures.voice")}</h2>
        <PagedRead name="voice" param="v" keyOf={assistKeys.voiceCaptures} loaderOf={voiceCapturesLoader} build={voicePage} label={t("captures.voice")} empty={t("captures.voiceEmpty")} renderItem={(capture) => <CaptureRow capture={capture} />} />
      </section>
    </section>
  );
}

/* One capture: its status, what was read (and, for a recording, what was heard), and its review. */
export function MobileCaptureDetail({ source }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = localeOf(i18n);
  const { captureId } = useParams();
  const location = useLocation();
  const valid = isAccountId(captureId);
  const loader = useMemo(() => (source === "voice" ? voiceCaptureLoader : receiptCaptureLoader)(captureId), [source, captureId]);
  const resource = useResource((source === "voice" ? assistKeys.voiceCapture : assistKeys.receiptCapture)(captureId), loader, { enabled: valid });
  const capture = useMemo(() => (valid && resource.data !== undefined ? buildCaptureDetail(resource.data, captureId, source) : null), [valid, resource.data, captureId, source]);
  const workflow = WORKFLOWS[`${source}-review`];
  const ctx = useMemo(() => (capture ? { today: todayIn(sessionWorkspace()?.timezone), record: capture } : null), [capture]);
  const backTo = backPathFrom(location.state, MOBILE_CAPTURES);
  const back = (
    <Link className="sm-link-row sm-back" to={backTo}>
      <Chevron back />
      <span>{t("captures.back")}</span>
    </Link>
  );

  if (!valid) return <section className="sm-page" data-sm-screen="capture" data-sm-state="error">{back}<ErrorPanel error={{ code: "NOT_FOUND" }} /></section>;
  if (resource.loading) return <section className="sm-page" data-sm-screen="capture" data-sm-state="loading"><Skeleton lines={5} label={t("captures.loading")} /></section>;
  if (resource.status === "error" || !capture) return <section className="sm-page" data-sm-screen="capture" data-sm-state="error">{back}<ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} hideExistence /></section>;

  const reason = workflow.eligible(capture);

  return (
    <section className="sm-page" data-sm-screen="capture" data-sm-source={source} data-sm-record={capture.id} data-sm-status={capture.status} data-sm-state={resource.stale ? "stale" : "ready"}>
      {back}
      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
      <div className="sm-card">
        <h2 className="sm-card-title">{t(`forms.flows.${workflow.id}.title`)}</h2>
        <p className="sm-chips-inline">
          <span className="sm-chip sm-plan-chip" data-sm-tone={STATUS_TONES[capture.status] ?? "neutral"}>{t(`captures.status.${capture.status}`)}</span>
          <span className="sm-chip sm-ai-chip">{t("assist.generated")}</span>
        </p>
        <p className="sm-text sm-muted">{t(`forms.flows.${workflow.id}.intro`)}</p>
        {capture.createdAt && <p className="sm-text sm-muted sm-fine"><bdi>{formatMoment(capture.createdAt, locale)}</bdi></p>}
        {capture.transcript && (
          <figure className="sm-transcript">
            <figcaption className="sm-label">{t("captures.transcript")}</figcaption>
            <blockquote className="sm-text sm-user-text" dir="auto">{capture.transcript}</blockquote>
          </figure>
        )}
        {capture.warnings.length > 0 && (
          <div role="note" data-sm-note="capture-warnings">
            <h3 className="sm-row-title">{t("captures.warnings")}</h3>
            <ul className="sm-bullets">{capture.warnings.map((warning) => <li key={warning} className="sm-text sm-user-text">{warning}</li>)}</ul>
          </div>
        )}
        {capture.failure && <p className="sm-text sm-form-error sm-user-text">{capture.failure}</p>}
        {capture.status === "confirmed" && capture.transactionId && (
          <Link className="sm-link-row" to={activityDetailPath(capture.transactionId)}>
            <span>{t("captures.openTransaction")}</span>
            <Chevron />
          </Link>
        )}
        {capture.source === "receipt" && <p className="sm-text sm-muted sm-fine" data-sm-note="no-source">{t("captures.noSource")}</p>}
      </div>

      {reason ? (
        <div className="sm-card" role="note" data-sm-note="ineligible" data-sm-reason={reason}>
          <p className="sm-text">{t(`forms.ineligible.${reason}`)}</p>
          {capture.review.amount && <p className="sm-text"><Money plain value={capture.review.amount} currency={capture.review.currency_code ?? undefined} />{capture.review.transaction_date && <> · <bdi>{formatDay(capture.review.transaction_date, locale, "UTC")}</bdi></>}</p>}
          <Link className="sm-link-row" to={source === "voice" ? PATH.USER.FINANCIAL_OPERATIONS : PATH.USER.AI_EXPENSE_CAPTURES}>
            <span>{t("captures.openFull")}</span>
            <Chevron />
          </Link>
        </div>
      ) : (
        <FormWithChoices key={`${workflow.id}:${capture.id}:${capture.reviewVersion}`} workflow={workflow} ctx={ctx} backTo={backTo} />
      )}
    </section>
  );
}
