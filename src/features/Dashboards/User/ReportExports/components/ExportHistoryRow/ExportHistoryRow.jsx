import { useTranslation } from "react-i18next";
import { LuRefreshCw } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDateTime } from "../../../utils/formatters";
import { canDownloadExport, formatFileSize, getExportErrorMessage, getReportName } from "../../reportExportHelpers";
import { useReportExport } from "../../useReportExport";
import ExportActions from "../ExportActions/ExportActions";
import ExportStatusBadge from "../ExportStatusBadge/ExportStatusBadge";

import "./ExportHistoryRow.css";

// One export in the history. Queued / processing rows poll their own status
// (one timer per row; mount with key={export.id}).
export default function ExportHistoryRow({ initialRecord }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const { record, replace, pollError, gaveUp, checkAgain } = useReportExport(initialRecord);
  const date = (value) => (value ? formatDateTime(value, locale) : "—");

  return (
    <tr className="export-history-row">
      <th scope="row">
        <span className="export-history-row__report">{getReportName(record.report, t)}</span>
        {record.file_name && <small dir="ltr">{record.file_name}</small>}
      </th>
      <td>
        <bdi dir="ltr">{String(record.format ?? "—").toUpperCase()}</bdi>
      </td>
      <td>
        <ExportStatusBadge record={record} />
        {(gaveUp || (pollError && !gaveUp)) && (
          <span className="export-history-row__poll">
            {pollError ? getExportErrorMessage(pollError, t) : t("dashboard.reportExports.tracker.stillWorking")}
            {gaveUp && (
              <button type="button" onClick={checkAgain} aria-label={t("dashboard.reportExports.actions.checkAgain")}>
                <LuRefreshCw aria-hidden="true" />
              </button>
            )}
          </span>
        )}
      </td>
      <td>{date(record.created_at)}</td>
      <td>{date(record.completed_at)}</td>
      <td>{date(record.expires_at)}</td>
      <td>
        <bdi dir="ltr">{formatFileSize(record.file_size, locale)}</bdi>
      </td>
      <td>
        {canDownloadExport(record)
          ? t("dashboard.reportExports.history.downloadAvailable")
          : t("dashboard.reportExports.history.downloadUnavailable")}
      </td>
      <td className="export-history-row__actions">
        <ExportActions record={record} onChange={replace} />
      </td>
    </tr>
  );
}
