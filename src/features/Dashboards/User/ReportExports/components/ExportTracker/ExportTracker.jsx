import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCircleCheck, LuLoaderCircle, LuRefreshCw, LuRotateCcw, LuX } from "react-icons/lu";

import { PATH } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDateTime } from "../../../utils/formatters";
import {
  formatFileSize,
  getExportErrorMessage,
  getExportStatus,
  getFormatName,
  getReportName,
} from "../../reportExportHelpers";
import { useReportExport } from "../../useReportExport";
import ExportActions from "../ExportActions/ExportActions";
import ExportFormatBadge from "../ExportFormatBadge/ExportFormatBadge";
import ExportStatusBadge from "../ExportStatusBadge/ExportStatusBadge";

import "./ExportTracker.css";

// The backend only reports statuses, never a percentage, so progress is shown
// as these three steps rather than an invented number.
const STEPS = ["queued", "processing", "completed"];

/*
 * The export just requested from the Reports page. It starts `queued`; its
 * status is polled until it is final, and Download appears only once the
 * backend reports `download_available`. A failed export can be retried
 * (`onRetry(record)` queues a new one). Mount it with `key={export.id}`;
 * dismissing or leaving the page unmounts it, which stops the polling.
 */
export default function ExportTracker({ initialRecord, onDismiss, onRetry, isRetrying = false }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const { record, replace, pollError, gaveUp, checkAgain } = useReportExport(initialRecord);
  const status = getExportStatus(record);
  const format = getFormatName(record?.format);
  const failure = record?.failure_reason ?? record?.error_message ?? null;
  const stepIndex = STEPS.indexOf(status);

  return (
    <section className={`export-tracker export-tracker--${status}`} aria-labelledby="export-tracker-title">
      <header className="export-tracker__header">
        <div className="export-tracker__title">
          <strong id="export-tracker-title">
            {t("dashboard.reportExports.tracker.title", { report: getReportName(record?.report, t) })}
          </strong>
          <ExportFormatBadge format={record?.format} />
          <ExportStatusBadge record={record} />
        </div>
        <button type="button" className="export-tracker__dismiss" onClick={onDismiss} aria-label={t("common.close")}>
          <LuX aria-hidden="true" />
        </button>
      </header>

      {stepIndex !== -1 && (
        <ol className="export-tracker__steps" aria-label={t("dashboard.reportExports.tracker.progress")}>
          {STEPS.map((step, index) => {
            const state = index < stepIndex || status === "completed" ? "done" : index === stepIndex ? "current" : "upcoming";

            return (
              <li
                key={step}
                className={`export-tracker__step export-tracker__step--${state}`}
                aria-current={state === "current" ? "step" : undefined}
              >
                <span className="export-tracker__step-marker" aria-hidden="true">
                  {state === "done" && <LuCircleCheck />}
                  {state === "current" && <LuLoaderCircle className="export-tracker__step-spinner" />}
                </span>
                <span>{t(`dashboard.reportExports.tracker.steps.${step}`)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* The one line that changes with the status, announced politely. */}
      <p className="export-tracker__hint" aria-live="polite">
        {status === "failed" && failure ? (
          <span className="export-tracker__failure">{failure}</span>
        ) : (
          t(`dashboard.reportExports.hints.${status}`, { format })
        )}
      </p>

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
        {status === "failed" && onRetry ? (
          <button
            type="button"
            className="export-tracker__retry"
            onClick={() => onRetry(record)}
            disabled={isRetrying}
            aria-busy={isRetrying || undefined}
          >
            <LuRotateCcw aria-hidden="true" />
            {isRetrying
              ? t("dashboard.reportExports.actions.preparing", { format })
              : t("dashboard.reportExports.actions.retry", { format })}
          </button>
        ) : (
          <ExportActions record={record} onChange={replace} />
        )}
        <Link to={PATH.USER.REPORT_EXPORTS}>{t("dashboard.reportExports.history.open")}</Link>
      </footer>
    </section>
  );
}
