import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { exportLoader, keys } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import { buildExportDetail, exportHint } from "../models/exportsImports.js";
import { MOBILE_EXPORTS } from "../navigation.js";
import RecordScreen from "../planning/RecordScreen.jsx";
import Chevron from "../ui/Chevron.jsx";
import { fileSizeText } from "../ui/fileSize.js";
import { Fact } from "../ui/StateChip.jsx";
import WriteClosedNotice from "../ui/WriteClosedNotice.jsx";
import { downloadMessageKey } from "./downloadMessage.js";
import ExportStageChip from "./ExportStageChip.jsx";
import useExportDownload from "./useExportDownload.jsx";

function Detail({ item, locale, refresh }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { states, download, anchor } = useExportDownload();
  const state = states[item.id];
  const hint = exportHint(item);
  const moment = (value) => formatMoment(value, locale);
  const size = fileSizeText(item.fileSize, t, "exportView", locale);
  const inProgress = item.status === "queued" || item.status === "processing";

  return (
    <>
      {anchor}
      <section className="sm-card sm-hero" aria-labelledby="sm-export-title" data-sm-stage={item.stage ?? "unknown"}>
        <h2 id="sm-export-title" className="sm-card-title">
          {item.report ? t(`reports.type.${item.report}.title`, { defaultValue: item.report }) : t("exports.unnamed")}
          {item.format && <> · <bdi dir="ltr">{item.format.toUpperCase()}</bdi></>}
        </h2>
        <p className="sm-chips-inline"><ExportStageChip item={item} /></p>
        {hint && <p className="sm-hero-note sm-hero-sentence" data-sm-hint={hint}>{t(`exportView.hint.${hint}`)}</p>}
        {item.downloadable && (
          <button type="button" className="sm-button sm-button-small" onClick={() => download(item)} disabled={state === "busy"} aria-busy={state === "busy" || undefined} data-sm-action="download-export">
            {state === "busy" ? t("exports.downloading") : t("exports.downloadFormat", { format: (item.format ?? "csv").toUpperCase() })}
          </button>
        )}
        {["failed", "denied", "gone"].includes(state) && <p className="sm-hero-note sm-hero-sentence" role="alert" data-sm-download-error={state}>{t(downloadMessageKey(state))}</p>}
        {state === "saved" && <p className="sm-hero-note sm-hero-sentence" role="status">{t("exports.saved")}</p>}
        {inProgress && (
          <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={refresh.reload} disabled={refresh.refreshing} aria-busy={refresh.refreshing || undefined} data-sm-action="check-again">
            {refresh.refreshing ? t("exportView.checking") : t("exportView.checkAgain")}
          </button>
        )}
      </section>

      {item.status === "failed" && (item.errorMessage || item.errorCode) && (
        <section className="sm-card" aria-labelledby="sm-export-failure" data-sm-section="export-failure">
          <h2 id="sm-export-failure" className="sm-card-title">{t("exportView.failureTitle")}</h2>
          {item.errorMessage && <p className="sm-text sm-user-text">{item.errorMessage}</p>}
          {item.errorCode && <p className="sm-text sm-muted sm-fine">{t("exportView.reference")}: <bdi dir="ltr">{item.errorCode}</bdi></p>}
        </section>
      )}

      <section className="sm-card" aria-labelledby="sm-export-facts">
        <h2 id="sm-export-facts" className="sm-card-title">{t("exportView.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          {item.report && <Fact label={t("exportView.report")}>{t(`reports.type.${item.report}.title`, { defaultValue: item.report })}</Fact>}
          {item.format && <Fact label={t("exportView.format")}><bdi dir="ltr">{item.format.toUpperCase()}</bdi></Fact>}
          {item.from && item.to && <Fact label={t("exportView.period")}><bdi dir="ltr">{item.from}</bdi> – <bdi dir="ltr">{item.to}</bdi></Fact>}
          {item.currency && <Fact label={t("exportView.currency")}><bdi dir="ltr">{item.currency}</bdi></Fact>}
          {moment(item.createdAt) && <Fact label={t("exportView.requested")}><bdi>{moment(item.createdAt)}</bdi></Fact>}
          {moment(item.startedAt) && <Fact label={t("exportView.started")}><bdi>{moment(item.startedAt)}</bdi></Fact>}
          {moment(item.completedAt) && <Fact label={t("exportView.finished")}><bdi>{moment(item.completedAt)}</bdi></Fact>}
          {item.downloadable && moment(item.expiresAt) && <Fact label={t("exportView.availableUntil")}><bdi>{moment(item.expiresAt)}</bdi></Fact>}
          {moment(item.cancelledAt) && <Fact label={t("exportView.cancelledAt")}><bdi>{moment(item.cancelledAt)}</bdi></Fact>}
          {item.fileName && <Fact label={t("exportView.fileName")}><bdi dir="ltr" className="sm-user-text">{item.fileName}</bdi></Fact>}
          {size && <Fact label={t("exportView.fileSize")}><bdi>{size}</bdi></Fact>}
        </dl>
      </section>

      <section className="sm-card" aria-labelledby="sm-export-changes">
        <h2 id="sm-export-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <p className="sm-text sm-muted">{t("exportView.closed")}</p>
        <WriteClosedNotice operation="export.create" compact />
        <Link className="sm-link-row" to={PATH.USER.REPORT_EXPORTS}>
          <span>{t("exports.openFull")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/* One export, read-only (GET /report-exports/{id}). "Check again" re-reads it while it is waiting or being built; nothing is polled. */
export default function MobileExportDetail() {
  const { exportId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="export-detail" recordId={exportId} keyOf={keys.exportOne} loaderOf={exportLoader} build={buildExportDetail} backFallback={MOBILE_EXPORTS} strings="exportView" render={(item, refresh) => <Detail item={item} locale={locale} refresh={refresh} />} />;
}
