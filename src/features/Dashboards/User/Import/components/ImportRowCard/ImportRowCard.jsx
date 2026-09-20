import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuBan, LuPencil, LuTriangleAlert } from "react-icons/lu";

import { getTransactionDetailsPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatReportValue } from "../../../Reports/reportHelpers";
import { formatDate } from "../../../utils/formatters";
import { getRowErrors, normalizeMapping } from "../../importHelpers";
import ImportStatusBadge from "../ImportStatusBadge/ImportStatusBadge";

import "./ImportRowCard.css";

/*
 * One preview row: its status, the parsed values the backend derived, the
 * backend's errors (by `code`, with its message kept), and the original file
 * cells (`raw`), which are shown as they were uploaded and never edited.
 *
 * Ignoring a row leaves it here, visible and auditable, with the backend's
 * `ignored` status; it is only left out when the import is confirmed. The row
 * is never removed from the list.
 */
export default function ImportRowCard({ row, importRecord, canEdit, isEditing, onEdit, onIgnore, isIgnoring, children }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const headers = Array.isArray(importRecord.headers) ? importRecord.headers : [];
  const cells = Array.isArray(row.raw?.cells) ? row.raw.cells : [];
  const mapping = normalizeMapping(importRecord.mapping);
  const fieldsByColumn = Object.entries(mapping).reduce((byColumn, [field, index]) => {
    (byColumn[index] ??= []).push(field);
    return byColumn;
  }, {});
  const errors = getRowErrors(row);
  const isProblem = row.status === "invalid" || row.status === "duplicate";
  const label = (group, key) => {
    const path = `dashboard.importPage.${group}.${key}`;
    return i18n.exists(path) ? t(path) : key;
  };
  const typeLabel = row.transaction_type ? label("transactionTypes", row.transaction_type) : "—";
  const amount = formatReportValue(row.amount, "money", { currency: row.currency, locale });

  return (
    <article className={`import-row-card import-row-card--${row.status ?? "unknown"}`}>
      <header className="import-row-card__header">
        <div className="import-row-card__title">
          <strong>{t("dashboard.importPage.rows.rowNumber", { number: row.row_number ?? row.id })}</strong>
          {row.raw?.line != null && (
            <span className="import-row-card__line">{t("dashboard.importPage.rows.line", { line: row.raw.line })}</span>
          )}
          <ImportStatusBadge status={row.status} />
        </div>
        {canEdit && !isEditing && (
          <div className="import-row-card__actions">
            <button type="button" className="import-row-card__edit" onClick={onEdit} disabled={isIgnoring}>
              <LuPencil aria-hidden="true" />
              {row.status === "invalid" ? t("dashboard.importPage.rows.fix") : t("dashboard.importPage.rows.edit")}
            </button>
            {onIgnore && row.status !== "ignored" && (
              <button
                type="button"
                className="import-row-card__ignore"
                onClick={onIgnore}
                disabled={isIgnoring}
                aria-busy={isIgnoring}
                title={t("dashboard.importPage.rows.ignoreHint")}
              >
                <LuBan aria-hidden="true" />
                {isIgnoring ? t("dashboard.importPage.rows.ignoring") : t("dashboard.importPage.rows.ignore")}
              </button>
            )}
          </div>
        )}
      </header>

      {row.status === "ignored" && <p className="import-row-card__ignored">{t("dashboard.importPage.rows.ignoredNote")}</p>}

      <dl className="import-row-card__parsed" aria-label={t("dashboard.importPage.rows.parsedValue")}>
        <div>
          <dt>{t("dashboard.importPage.rowFields.transaction_date")}</dt>
          <dd>{row.transaction_date ? formatDate(row.transaction_date, locale) : "—"}</dd>
        </div>
        <div>
          <dt>{t("dashboard.importPage.rowFields.transaction_type")}</dt>
          <dd>{typeLabel}</dd>
        </div>
        <div>
          <dt>{t("dashboard.importPage.rowFields.amount")}</dt>
          <dd>
            <bdi dir="ltr">{amount}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t("dashboard.importPage.rowFields.category_id")}</dt>
          <dd dir="auto">{row.category?.name ?? (row.category_id != null ? `#${row.category_id}` : "—")}</dd>
        </div>
        <div className="import-row-card__wide">
          <dt>{t("dashboard.importPage.rowFields.description")}</dt>
          <dd dir="auto">{row.description || "—"}</dd>
        </div>
        {row.reference_number && (
          <div>
            <dt>{t("dashboard.importPage.rowFields.reference_number")}</dt>
            <dd dir="auto">{row.reference_number}</dd>
          </div>
        )}
      </dl>

      {errors.length > 0 && (
        <ul className="import-row-card__errors" aria-label={t("dashboard.importPage.rows.validationErrors")}>
          {errors.map((error, index) => (
            <li key={`${error.field}-${error.code}-${index}`}>
              <LuTriangleAlert aria-hidden="true" />
              <span>
                {error.field && <strong>{label("rowFields", error.field)}: </strong>}
                {error.code && i18n.exists(`dashboard.importPage.rowErrorCodes.${error.code}`)
                  ? t(`dashboard.importPage.rowErrorCodes.${error.code}`)
                  : error.message}
                {error.code && i18n.exists(`dashboard.importPage.rowErrorCodes.${error.code}`) && error.message && (
                  <small dir="auto">{error.message}</small>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {row.duplicate_of_transaction_id != null && (
        <p className="import-row-card__duplicate">
          {t("dashboard.importPage.rows.duplicateOf")}{" "}
          <Link to={getTransactionDetailsPath(row.duplicate_of_transaction_id)}>
            {row.duplicate_of_transaction?.description ??
              t("dashboard.importPage.rows.transactionNumber", { id: row.duplicate_of_transaction_id })}
          </Link>
        </p>
      )}

      {cells.length > 0 && (
        <details className="import-row-card__raw" open={isProblem || isEditing}>
          <summary>{t("dashboard.importPage.rows.originalValue")}</summary>
          <table>
            <tbody>
              {cells.map((cell, index) => (
                <tr key={index} className={fieldsByColumn[index] ? "import-row-card__raw-mapped" : ""}>
                  <th scope="row" dir="auto">
                    {headers[index] ?? t("dashboard.importPage.mapping.column", { number: index + 1, name: "" })}
                  </th>
                  <td dir="auto">{cell === null || cell === "" ? "—" : String(cell)}</td>
                  <td className="import-row-card__raw-field">
                    {(fieldsByColumn[index] ?? []).map((field) => label("mappingFields", field)).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {children}
    </article>
  );
}
