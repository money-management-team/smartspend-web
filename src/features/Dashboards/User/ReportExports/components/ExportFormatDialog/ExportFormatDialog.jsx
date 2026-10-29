import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleCheck, LuFileDown, LuFileSpreadsheet, LuFileText, LuTable, LuX } from "react-icons/lu";

import { EXPORT_FORMATS, getExportErrorMessage, getFormatName } from "../../reportExportHelpers";

import "./ExportFormatDialog.css";

const FORMAT_ICONS = {
  csv: LuTable,
  xlsx: LuFileSpreadsheet,
  pdf: LuFileText,
};

/*
 * Pick CSV, Excel (.xlsx) or PDF. CSV and Excel are queued with
 * POST /report-exports; PDF is built in the browser by the Reports page. The
 * choices are native radio buttons, so arrow keys move between them.
 *
 * `onSubmit(format)` queues the export; while it is in flight (`pending`)
 * the dialog cannot be closed or submitted again, and a failure stays in the
 * dialog (`error`) so the user can retry without choosing again.
 */
export default function ExportFormatDialog({ reportName, period, initialFormat, pending, error, onSubmit, onClose }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState(() =>
    EXPORT_FORMATS.includes(initialFormat) ? initialFormat : EXPORT_FORMATS[0],
  );
  const formatName = getFormatName(format);
  // PDF is built in the browser and downloads directly; CSV / Excel are queued.
  const isLocal = format === "pdf";

  const close = () => {
    if (!pending) onClose();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!pending) onSubmit(format);
  };

  return (
    <div
      className="export-format-dialog"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="export-format-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-format-dialog-title"
        aria-describedby="export-format-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="export-format-dialog__header">
          <span className="export-format-dialog__icon" aria-hidden="true">
            <LuFileDown />
          </span>
          <div>
            <h2 id="export-format-dialog-title">{t("dashboard.reportExports.dialog.title")}</h2>
            <p id="export-format-dialog-description">
              {reportName}
              {period && (
                <>
                  {" · "}
                  <bdi>{period}</bdi>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className="export-format-dialog__close"
            onClick={close}
            disabled={pending}
            aria-label={t("common.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <fieldset className="export-format-dialog__options" disabled={pending}>
            <legend>{t("dashboard.reportExports.dialog.chooseFormat")}</legend>

            {EXPORT_FORMATS.map((item) => {
              const Icon = FORMAT_ICONS[item];
              const isSelected = item === format;

              return (
                <label
                  key={item}
                  className={`export-format-option export-format-option--${item}${
                    isSelected ? " export-format-option--selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={item}
                    checked={isSelected}
                    onChange={() => setFormat(item)}
                    autoFocus={isSelected}
                    aria-describedby={`export-format-${item}-hint`}
                  />
                  <span className="export-format-option__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="export-format-option__copy">
                    <strong>
                      <bdi dir="ltr">{t(`dashboard.reportExports.formats.${item}.label`)}</bdi>
                    </strong>
                    <small id={`export-format-${item}-hint`}>
                      {t(`dashboard.reportExports.formats.${item}.description`)}
                    </small>
                  </span>
                  <LuCircleCheck className="export-format-option__check" aria-hidden="true" />
                </label>
              );
            })}
          </fieldset>

          <p className="export-format-dialog__note" aria-live="polite">
            {pending
              ? t(isLocal ? "dashboard.reportExports.dialog.building" : "dashboard.reportExports.dialog.preparing", {
                  format: formatName,
                })
              : t(isLocal ? "dashboard.reportExports.dialog.notePdf" : "dashboard.reportExports.dialog.note")}
          </p>

          {error && (
            <p className="export-format-dialog__error" role="alert">
              {getExportErrorMessage(error, t, "create")}
            </p>
          )}

          <footer className="export-format-dialog__footer">
            <button type="button" className="export-format-dialog__cancel" onClick={close} disabled={pending}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="export-format-dialog__submit"
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? (
                <span className="export-format-dialog__spinner" aria-hidden="true" />
              ) : (
                <LuFileDown aria-hidden="true" />
              )}
              <span>
                {pending
                  ? t("dashboard.reportExports.actions.preparing", { format: formatName })
                  : t("dashboard.reportExports.actions.exportFormat", { format: formatName })}
              </span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
