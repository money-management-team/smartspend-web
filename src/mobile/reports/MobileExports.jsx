import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { readExportFile } from "../data/readApi.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { useIdentityGuard } from "../identity/guardContext.js";
import { formatMoment } from "../money/format.js";
import { EXPORT_FILTER_STATUSES } from "../models/exportsImports.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import { EXPORT_LIST } from "../planning/lists.js";
import PagedListView from "../planning/PagedListView.jsx";
import { useListScreen } from "../planning/useListScreen.js";
import StateChip from "../ui/StateChip.jsx";

// The full version's built name when the server sends none (docs/report-exports/download.md): smartspend-{report}-{id}.{format}, csv for an unknown format.
const exportFileName = (item) => `smartspend-${item.report ?? "report"}-${item.id}.${["csv", "xlsx", "pdf"].includes(item.format) ? item.format : "csv"}`;

const EXPORT_TONES = { queued: "warn", processing: "warn", completed: "good", failed: "bad", expired: "neutral", cancelled: "neutral" };

/*
 * Saves a file the browser already holds. A link with `download` is the most
 * widely supported way; some phone browsers open the file instead of saving it,
 * which is their choice (real-device behaviour is not verified).
 */
const { createObjectURL, revokeObjectURL } = URL;

// `link` is a hidden link this screen renders, so nothing is added to the page outside the Mobile root.
function saveFile(link, blob, name) {
  if (!link) return;
  const url = createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => revokeObjectURL(url), 60_000);
}

function ExportRow({ item, locale, onDownload, state }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const when = formatMoment(item.createdAt, locale);

  return (
    <div className="sm-row" data-sm-export={item.id} data-sm-status={item.status ?? "none"} data-sm-downloadable={item.downloadable ? "true" : "false"}>
      <span className="sm-row-main">
        <span className="sm-row-title">
          {item.report ? t(`reports.type.${item.report}.title`, { defaultValue: item.report }) : t("exports.unnamed")}
          {item.format && <> · <bdi dir="ltr">{item.format.toUpperCase()}</bdi></>}
        </span>
        {item.from && item.to && <span className="sm-row-meta"><bdi dir="ltr">{item.from}</bdi> – <bdi dir="ltr">{item.to}</bdi></span>}
        {when && <span className="sm-row-meta">{t("exports.requested")} <bdi>{when}</bdi></span>}
        <span className="sm-chips-inline"><StateChip state={item.status} known={item.statusKnown} labels="exports.status" tones={EXPORT_TONES} /></span>
        {item.downloadable ? (
          <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => onDownload(item)} disabled={state === "busy"} aria-busy={state === "busy" || undefined}>
            {state === "busy" ? t("exports.downloading") : t("exports.downloadFormat", { format: (item.format ?? "csv").toUpperCase() })}
          </button>
        ) : (
          <span className="sm-row-meta">{t(item.status === "queued" || item.status === "processing" ? "exports.notReady" : "exports.noFile")}</span>
        )}
        {state === "failed" && <span className="sm-text sm-form-error" role="alert">{t("exports.downloadFailed")}</span>}
        {state === "saved" && <span className="sm-text sm-muted" role="status">{t("exports.saved")}</span>}
      </span>
    </div>
  );
}

/*
 * The report export history, read-only (GET /report-exports). A queued or
 * processing export is said to be not ready: it is never shown as a file. The
 * Download button appears only when the backend says download_available, and
 * fetching the file is a GET. Queueing, cancelling and revoking exports stay in
 * the full version.
 */
export default function MobileExports() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(EXPORT_LIST);
  const guard = useIdentityGuard();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;
  const [states, setStates] = useState({});
  const running = useRef(new Set());
  const linkRef = useRef(null);

  const download = async (item) => {
    if (running.current.has(item.id)) return;
    running.current.add(item.id);
    setStates((current) => ({ ...current, [item.id]: "busy" }));
    try {
      guard.assert();
      const file = await readExportFile(item.id);
      // A file that arrives after the signed-in person changed is not saved here.
      if (!guard.check()) return;
      saveFile(linkRef.current, file.blob, file.filename ?? item.fileName ?? exportFileName(item));
      setStates((current) => ({ ...current, [item.id]: "saved" }));
    } catch {
      if (guard.check()) setStates((current) => ({ ...current, [item.id]: "failed" }));
    } finally {
      running.current.delete(item.id);
    }
  };

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
    <a ref={linkRef} hidden aria-hidden="true" tabIndex={-1} rel="noopener" />
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
      renderRow={(item) => <ExportRow item={item} locale={locale} onDownload={download} state={states[item.id]} />}
    />
    </>
  );
}
