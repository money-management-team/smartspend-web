import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFileSpreadsheet, LuFileText, LuUpload, LuX } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { resolveWorkspaceId } from "../../../api/dashboardApi";
import { importsApi } from "../../../api/importsApi";
import { ApiError } from "../../../api/apiClient";
import { formatFileSize } from "../../../ReportExports/reportExportHelpers";
import {
  AUTO_OPTION,
  DATE_ORDER_OPTIONS,
  DECIMAL_SEPARATOR_OPTIONS,
  IMPORT_ACCEPT,
  getFieldMessages,
  getFileExtension,
  getImportErrorMessage,
  parseUploadResponse,
  validateImportFile,
} from "../../importHelpers";

import "./UploadStatement.css";

/*
 * Step 1: POST /imports (multipart/form-data) with the workspace, the file
 * and the parsing options. The backend stores and inspects the file and
 * answers with the import (`mapping_required`), its column headers and a
 * suggested mapping. Nothing is imported and no balance changes.
 *
 * Only CSV and XLSX can be picked; the backend still validates the content.
 * A rejected file stays selected so it can be retried or replaced.
 */
export default function UploadStatement({ onUploaded }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const fileInputRef = useRef(null);
  const pendingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [hasHeader, setHasHeader] = useState(true);
  /*
   * Parsing hints. `auto` is the default and, for now, the only value the API
   * contract confirms, so each select appears only once its list offers a real
   * choice — the UI never invents an enum the backend would reject.
   */
  const [dateOrder, setDateOrder] = useState(AUTO_OPTION);
  const [decimalSeparator, setDecimalSeparator] = useState(AUTO_OPTION);
  const [upload, setUpload] = useState({ pending: false, error: null });
  const parsingOptions = [
    { name: "date_order", value: dateOrder, setValue: setDateOrder, options: DATE_ORDER_OPTIONS },
    {
      name: "decimal_separator",
      value: decimalSeparator,
      setValue: setDecimalSeparator,
      options: DECIMAL_SEPARATOR_OPTIONS,
    },
  ].filter((option) => option.options.length > 1);

  const selectFile = (candidate) => {
    if (!candidate) return;

    setFileError(validateImportFile(candidate));
    setFile(candidate);
    setUpload({ pending: false, error: null });
  };

  const clearFile = () => {
    setFile(null);
    setFileError(null);
    setUpload({ pending: false, error: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrag = (dragging) => (event) => {
    event.preventDefault();
    if (upload.pending) return;
    if (dragging || event.currentTarget === event.target) setIsDragging(dragging);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (!upload.pending) selectFile(event.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;

    const problem = validateImportFile(file);
    if (problem) {
      setFileError(problem);
      return;
    }

    pendingRef.current = true;
    setUpload({ pending: true, error: null });

    try {
      const workspaceId = await resolveWorkspaceId();
      const response = await importsApi.upload({
        workspace_id: workspaceId,
        file,
        has_header: hasHeader,
        date_order: dateOrder,
        decimal_separator: decimalSeparator,
      });
      const parsed = parseUploadResponse(response);
      if (!parsed) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      setUpload({ pending: false, error: null });
      onUploaded(parsed);
    } catch (error) {
      setUpload({ pending: false, error });
    } finally {
      pendingRef.current = false;
    }
  };

  const fieldMessages = getFieldMessages(upload.error);
  const extension = file ? getFileExtension(file.name) : "";

  return (
    <form className="upload-statement" onSubmit={handleSubmit} noValidate>
      <header className="upload-statement__header">
        <h2>{t("dashboard.importPage.upload.title")}</h2>
        <p>{t("dashboard.importPage.upload.supported")}</p>
      </header>

      <div className="upload-statement__body">
        <input
          ref={fileInputRef}
          className="upload-statement__input"
          type="file"
          accept={IMPORT_ACCEPT}
          onChange={(event) => selectFile(event.target.files?.[0])}
          disabled={upload.pending}
          aria-label={t("dashboard.importPage.upload.browse")}
        />

        <div
          className={`upload-drop-zone ${isDragging ? "upload-drop-zone--dragging" : ""}`}
          onDragEnter={handleDrag(true)}
          onDragOver={handleDrag(true)}
          onDragLeave={handleDrag(false)}
          onDrop={handleDrop}
        >
          {!file ? (
            <>
              <LuFileSpreadsheet className="upload-drop-zone__main-icon" aria-hidden="true" />
              <strong>{t("dashboard.importPage.upload.dropTitle")}</strong>
              <span>{t("dashboard.importPage.upload.supported")}</span>
              <button type="button" className="upload-drop-zone__browse" onClick={() => fileInputRef.current?.click()}>
                <LuUpload aria-hidden="true" />
                <span>{t("dashboard.importPage.upload.browse")}</span>
              </button>
            </>
          ) : (
            <div className="upload-selected-file">
              <span className="upload-selected-file__icon">
                <LuFileText aria-hidden="true" />
              </span>

              <div className="upload-selected-file__copy">
                <strong dir="auto">{file.name}</strong>
                <span>
                  <bdi dir="ltr">{formatFileSize(file.size, locale)}</bdi>
                  {extension && (
                    <>
                      {" · "}
                      <bdi dir="ltr">{extension.toUpperCase()}</bdi>
                    </>
                  )}
                </span>
              </div>

              <button
                type="button"
                className="upload-selected-file__change"
                onClick={() => fileInputRef.current?.click()}
                disabled={upload.pending}
              >
                {t("dashboard.importPage.upload.change")}
              </button>
              <button
                type="button"
                className="upload-selected-file__remove"
                onClick={clearFile}
                disabled={upload.pending}
                aria-label={t("dashboard.importPage.upload.remove")}
              >
                <LuX aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {fileError && (
          <p className="upload-statement__error" role="alert">
            {t(`dashboard.importPage.upload.errors.${fileError}`)}
          </p>
        )}

        <label className="upload-statement__option">
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(event) => setHasHeader(event.target.checked)}
            disabled={upload.pending}
          />
          <span>
            <strong>{t("dashboard.importPage.upload.hasHeader")}</strong>
            <small>{t("dashboard.importPage.upload.hasHeaderHint")}</small>
          </span>
        </label>

        {parsingOptions.length > 0 && (
          <div className="upload-statement__parsing">
            {parsingOptions.map(({ name, value, setValue, options }) => (
              <label key={name} className="upload-statement__field">
                <span>{t(`dashboard.importPage.upload.parsing.${name}`)}</span>
                <select value={value} onChange={(event) => setValue(event.target.value)} disabled={upload.pending}>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {t(`dashboard.importPage.upload.parsingValues.${name}.${option}`)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        <p className="upload-statement__note">{t("dashboard.importPage.upload.autoDetect")}</p>

        {upload.error && (
          <div className="upload-statement__alert" role="alert">
            <p>{getImportErrorMessage(upload.error, t, "upload")}</p>
            {fieldMessages.length > 0 && (
              <ul>
                {fieldMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="upload-statement__actions">
          <p>{t("dashboard.importPage.noMoneyMoved")}</p>
          <button type="submit" className="upload-statement__submit" disabled={!file || Boolean(fileError) || upload.pending}>
            <LuUpload aria-hidden="true" />
            {upload.pending ? t("dashboard.importPage.upload.uploading") : t("dashboard.importPage.upload.submit")}
          </button>
        </div>
      </div>
    </form>
  );
}
