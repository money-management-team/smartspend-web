import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import { EXPORT_FILTER_STATUSES, exportHint } from "../models/exportsImports.js";
import { exportDetailPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import { EXPORT_LIST } from "../planning/lists.js";
import PagedListView from "../planning/PagedListView.jsx";
import { useListScreen } from "../planning/useListScreen.js";
import { fileSizeText } from "../ui/fileSize.js";
import { downloadMessageKey } from "./downloadMessage.js";
import ExportStageChip from "./ExportStageChip.jsx";
import useExportDownload from "./useExportDownload.jsx";

function ExportRow({ item, locale, from, pages, onDownload, state }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const when = formatMoment(item.createdAt, locale);
  const until = item.downloadable ? formatMoment(item.expiresAt, locale) : null;
  const size = fileSizeText(item.fileSize, t, "exportView", locale);
  const hint = exportHint(item);

  return (
    <div className="sm-row sm-export-row" data-sm-export={item.id} data-sm-status={item.status ?? "none"} data-sm-stage={item.stage ?? "unknown"} data-sm-downloadable={item.downloadable ? "true" : "false"}>
      <span className="sm-row-main">
        <span className="sm-row-title">
          {item.report ? t(`reports.type.${item.report}.title`, { defaultValue: item.report }) : t("exports.unnamed")}
          {item.format && <> · <bdi dir="ltr">{item.format.toUpperCase()}</bdi></>}
        </span>
        {item.from && item.to && <span className="sm-row-meta"><bdi dir="ltr">{item.from}</bdi> – <bdi dir="ltr">{item.to}</bdi></span>}
        {when && <span className="sm-row-meta">{t("exports.requested")} <bdi>{when}</bdi></span>}
        <span className="sm-chips-inline"><ExportStageChip item={item} /></span>
        {hint && <span className="sm-text sm-muted sm-fine" data-sm-hint={hint} data-sm-note={hint === "expired" ? "expired" : undefined}>{t(`exportView.hint.${hint}`)}</span>}
        {item.status === "failed" && item.errorMessage && <span className="sm-text sm-fine sm-user-text sm-export-reason" data-sm-export-reason="true">{t("exportView.failureTitle")}: {item.errorMessage}</span>}
        {item.downloadable && (until || size) && (
          <span className="sm-row-meta" data-sm-export-file="true">
            {size}{size && until && " · "}{until && <>{t("exportView.availableUntil")} <bdi>{until}</bdi></>}
          </span>
        )}
        {item.downloadable && (
          <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => onDownload(item)} disabled={state === "busy"} aria-busy={state === "busy" || undefined}>
            {state === "busy" ? t("exports.downloading") : t("exports.downloadFormat", { format: (item.format ?? "csv").toUpperCase() })}
          </button>
        )}
        {["failed", "denied", "gone"].includes(state) && <span className="sm-text sm-form-error" role="alert" data-sm-download-error={state}>{t(downloadMessageKey(state))}</span>}
        {state === "saved" && <span className="sm-text sm-muted" role="status">{t("exports.saved")}</span>}
        <Link className="sm-note-link" to={exportDetailPath(item.id)} state={{ from, pages }} data-sm-link="export-details">{t("exportView.detailsLink")}</Link>
      </span>
    </div>
  );
}

/*
 * The report export history, read-only (GET /report-exports). Every export says where it stands: waiting to start,
 * being built, ready, failed (with the backend's reason), expired or cancelled. A queued or processing export is said
 * to have no file yet: it is never shown as one. The Download button appears only when the backend says
 * download_available, and fetching the file is a GET. Queueing, cancelling and revoking exports stay in the full version.
 */
export default function MobileExports() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(EXPORT_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;
  const { states, download, anchor } = useExportDownload();

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <p className="sm-text sm-muted sm-fine" data-sm-note="pdf">{t("exports.pdfNote")}</p>
      <Link className="sm-button sm-button-small sm-new-link" to={"/m/add/export"} data-sm-action="new-export">{t("newLinks.exportFile")}</Link>
      <FilterTabs
        label={t("exports.filterStatus")}
        value={filters.status}
        options={[{ value: "", label: t("exports.all") }, ...EXPORT_FILTER_STATUSES.map((value) => ({ value, label: t(`exports.status.${value}`) }))]}
        onChange={(status) => setFilters({ ...filters, status })}
      />
    </div>
  );

  return (
    <>
      {anchor}
      <PagedListView
        screen="exports"
        list={screen.list}
        toolbar={toolbar}
        filtered={screen.filtered}
        onResetFilters={screen.reset}
        strings="exports"
        pages={screen.pages}
        perPage={EXPORT_LIST.perPage}
        onLoadMore={screen.loadMore}
        onRefresh={screen.refresh}
        fullPath={PATH.USER.REPORT_EXPORTS}
        renderRow={(item) => <ExportRow item={item} locale={locale} from={screen.here} pages={screen.pages} onDownload={download} state={states[item.id]} />}
      />
    </>
  );
}
