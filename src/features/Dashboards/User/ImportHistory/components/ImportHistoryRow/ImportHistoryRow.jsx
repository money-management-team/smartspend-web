import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuArrowRight, LuFileSpreadsheet, LuFileText } from "react-icons/lu";

import { getImportPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { COUNT_KEYS, getImportNextAction } from "../../../Import/importHelpers";
import ImportStatusBadge from "../../../Import/components/ImportStatusBadge/ImportStatusBadge";
import { formatFileSize } from "../../../ReportExports/reportExportHelpers";
import { formatDateTime } from "../../../utils/formatters";

import "./ImportHistoryRow.css";

/*
 * One import in the history. The action is whatever `getImportNextAction`
 * says this status allows — an import that is processing offers "View
 * status", a completed one "View details", and one that never got its
 * mapping "Continue". Impossible actions are never rendered, and every one
 * of them opens the wizard, which resumes from the backend's state.
 */
export default function ImportHistoryRow({ importRecord }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const number = new Intl.NumberFormat(locale);
  const action = getImportNextAction(importRecord);
  const counts = importRecord.counts ?? {};
  const shownCounts = COUNT_KEYS.filter((key) => counts[key] != null && Number(counts[key]) > 0).slice(0, 4);
  const isSpreadsheet = String(importRecord.file_type ?? importRecord.original_filename ?? "")
    .toLowerCase()
    .includes("xlsx");
  const FileIcon = isSpreadsheet ? LuFileSpreadsheet : LuFileText;

  return (
    <article className="import-history-row">
      <div className="import-history-row__main">
        <FileIcon className="import-history-row__icon" aria-hidden="true" />
        <div className="import-history-row__identity">
          <h2 dir="auto">{importRecord.original_filename ?? t("dashboard.importPage.history.untitled")}</h2>
          <div className="import-history-row__meta">
            <ImportStatusBadge status={importRecord.status} />
            {importRecord.account?.name && <span dir="auto">{importRecord.account.name}</span>}
            {importRecord.file_size != null && (
              <span>
                <bdi dir="ltr">{formatFileSize(importRecord.file_size, locale)}</bdi>
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="import-history-row__dates">
        <div>
          <dt>{t("dashboard.importPage.fields.created_at")}</dt>
          <dd>
            <bdi dir="ltr">{formatDateTime(importRecord.created_at, locale)}</bdi>
          </dd>
        </div>
        {importRecord.completed_at && (
          <div>
            <dt>{t("dashboard.importPage.fields.completed_at")}</dt>
            <dd>
              <bdi dir="ltr">{formatDateTime(importRecord.completed_at, locale)}</bdi>
            </dd>
          </div>
        )}
      </dl>

      {shownCounts.length > 0 && (
        <ul className="import-history-row__counts">
          {shownCounts.map((key) => (
            <li key={key}>
              <span>{t(`dashboard.importPage.counts.${key}`)}</span>
              <strong>
                <bdi dir="ltr">{number.format(Number(counts[key]) || 0)}</bdi>
              </strong>
            </li>
          ))}
        </ul>
      )}

      {action && (
        <Link to={getImportPath(importRecord.id)} className="import-history-row__action">
          {t(`dashboard.importPage.history.actions.${action}`)}
          <LuArrowRight aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}
