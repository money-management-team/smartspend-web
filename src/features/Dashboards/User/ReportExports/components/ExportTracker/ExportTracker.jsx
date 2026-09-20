import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuRefreshCw, LuX } from "react-icons/lu";

import { PATH } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDateTime } from "../../../utils/formatters";
import { formatFileSize, getExportErrorMessage, getExportStatus, getReportName } from "../../reportExportHelpers";
import { useReportExport } from "../../useReportExport";
import ExportActions from "../ExportActions/ExportActions";
import ExportStatusBadge from "../ExportStatusBadge/ExportStatusBadge";

import "./ExportTracker.css";

/*
 * The export just requested from the Reports page. It starts `queued`; its
 * status is polled until it is final, and Download appears only once the
 * backend reports `download_available`. Mount it with `key={export.id}`.
 */
export default function ExportTracker({ initialRecord, onDismiss }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const { record, replace, pollError, gaveUp, checkAgain } = useReportExport(initialRecord);
  const status = getExportStatus(record);
  const failure = record?.failure_reason ?? record?.error_message ?? null;

  return (
    <section className="export-tracker" aria-live="polite">
      <header className="export-tracker__header">
        <div className="export-tracker__title">
          <strong>
            {t("dashboard.reportExports.tracker.title", {
              report: getReportName(record?.report, t),
              format: String(record?.format ?? "").toUpperCase(),
            })}
          </strong>
          <ExportStatusBadge record={record} />
        </div>
        <button type="button" className="export-tracker__dismiss" onClick={onDismiss} aria-label={t("common.close")}>
          <LuX aria-hidden="true" />
        </button>
      </header>

      <p className="export-tracker__hint">
        {status === "unknown" ? t("dashboard.reportExports.hints.unknown") : t(`dashboard.reportExports.hints.${status}`)}
      </p>
      {status === "failed" && failure && <p className="export-tracker__failure">{failure}</p>}

      <dl className="export-tracker__meta">
        <div>
          <dt>{t("dashboard.reportExports.fields.created_at")}</dt>
          <dd>{formatDateTime(record?.created_at, locale)}</dd>
        </div>
        {record?.completed_at && (
          <div>
            <dt>{t("dashboard.reportExports.fields.completed_at")}</dt>
            <dd>{formatDateTime(record.completed_at, locale)}</dd>
          </div>
        )}
        {record?.expires_at && (
          <div>
            <dt>{t("dashboard.reportExports.fields.expires_at")}</dt>
            <dd>{formatDateTime(record.expires_at, locale)}</dd>
          </div>
        )}
        {record?.file_size != null && (
          <div>
            <dt>{t("dashboard.reportExports.fields.file_size")}</dt>
            <dd>
              <bdi dir="ltr">{formatFileSize(record.file_size, locale)}</bdi>
            </dd>
          </div>
        )}
      </dl>

      {pollError && !gaveUp && (
        <p className="export-tracker__warning" role="status">
          {t("dashboard.reportExports.tracker.pollError", { message: getExportErrorMessage(pollError, t) })}
        </p>
      )}
      {gaveUp && (
        <div className="export-tracker__warning" role="status">
          <span>
            {pollError
              ? getExportErrorMessage(pollError, t)
              : t("dashboard.reportExports.tracker.stillWorking")}
          </span>
          <button type="button" onClick={checkAgain}>
            <LuRefreshCw aria-hidden="true" />
            {t("dashboard.reportExports.actions.checkAgain")}
          </button>
        </div>
      )}

      <footer className="export-tracker__footer">
        <ExportActions record={record} onChange={replace} />
        <Link to={PATH.USER.REPORT_EXPORTS}>{t("dashboard.reportExports.history.open")}</Link>
      </footer>
    </section>
  );
}
