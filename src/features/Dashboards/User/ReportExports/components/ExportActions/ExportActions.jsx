import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuBan, LuDownload } from "react-icons/lu";

import { saveBlobAsFile } from "../../../api/apiClient";
import { reportExportsApi } from "../../../api/reportExportsApi";
import {
  canDownloadExport,
  getExportErrorMessage,
  getExportFilename,
  getExportStopAction,
  parseExport,
} from "../../reportExportHelpers";

import "./ExportActions.css";

/*
 * Download and cancel / revoke for one export, each with its own pending
 * state and error.
 *
 * - Download is enabled only when the backend says `download_available`.
 *   The file is fetched as a Blob and handed to the browser once.
 * - DELETE is labelled by what it does: "Cancel export" while queued or
 *   processing, "Revoke export" once completed (the file is removed and the
 *   export becomes expired). It asks for confirmation inline first.
 * - The export returned by the backend replaces the record (`onChange`).
 */
export default function ExportActions({ record, onChange }) {
  const { t } = useTranslation();
  const [download, setDownload] = useState({ pending: false, error: null });
  const [stop, setStop] = useState({ confirming: false, pending: false, error: null });
  const stopAction = getExportStopAction(record);
  const isDownloadable = canDownloadExport(record);

  const handleDownload = async () => {
    if (!isDownloadable || download.pending) return;

    setDownload({ pending: true, error: null });

    try {
      const file = await reportExportsApi.download(record.id);
      saveBlobAsFile(file.blob, getExportFilename(record, file.filename));
      setDownload({ pending: false, error: null });
    } catch (error) {
      setDownload({ pending: false, error });
    }
  };

  const handleStop = async () => {
    if (!stopAction || stop.pending) return;

    setStop({ confirming: true, pending: true, error: null });

    try {
      const next = parseExport(await reportExportsApi.cancel(record.id));
      onChange(next);
      setStop({ confirming: false, pending: false, error: null });
    } catch (error) {
      setStop({ confirming: false, pending: false, error });

      // The export changed meanwhile (e.g. finished): show its real state.
      if (error?.code === "CONFLICT") {
        reportExportsApi
          .get(record.id)
          .then((response) => onChange(parseExport(response)))
          .catch(() => {});
      }
    }
  };

  return (
    <div className="export-actions">
      <div className="export-actions__buttons">
        <button
          type="button"
          className="export-actions__download"
          onClick={handleDownload}
          disabled={!isDownloadable || download.pending}
          aria-busy={download.pending}
        >
          <LuDownload aria-hidden="true" />
          <span>
            {download.pending ? t("dashboard.reportExports.actions.downloading") : t("dashboard.reportExports.actions.download")}
          </span>
        </button>

        {stopAction && !stop.confirming && (
          <button
            type="button"
            className="export-actions__stop"
            onClick={() => setStop({ confirming: true, pending: false, error: null })}
          >
            <LuBan aria-hidden="true" />
            <span>{t(`dashboard.reportExports.actions.${stopAction}`)}</span>
          </button>
        )}
      </div>

      {stopAction && stop.confirming && (
        <div className="export-actions__confirm" role="group" aria-label={t(`dashboard.reportExports.actions.${stopAction}`)}>
          <p>{t(`dashboard.reportExports.confirm.${stopAction}`)}</p>
          <div className="export-actions__buttons">
            <button type="button" className="export-actions__danger" onClick={handleStop} disabled={stop.pending}>
              {stop.pending
                ? t("dashboard.reportExports.actions.working")
                : t(`dashboard.reportExports.confirm.${stopAction}Confirm`)}
            </button>
            <button
              type="button"
              className="export-actions__stop"
              onClick={() => setStop({ confirming: false, pending: false, error: null })}
              disabled={stop.pending}
            >
              {t("dashboard.reportExports.confirm.keep")}
            </button>
          </div>
        </div>
      )}

      {download.error && (
        <p className="export-actions__error" role="alert">
          {getExportErrorMessage(download.error, t, "download")}
        </p>
      )}
      {stop.error && (
        <p className="export-actions__error" role="alert">
          {getExportErrorMessage(stop.error, t, "cancel")}
        </p>
      )}
    </div>
  );
}
