import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../../api/apiClient";
import { importsApi } from "../../../api/importsApi";
import {
  TRANSACTION_TYPES,
  getImportErrorMessage,
  getRawValue,
  getRowChanges,
  parseRowUpdateResponse,
  toRowForm,
  validateRowChanges,
} from "../../importHelpers";

import "./ImportRowEditor.css";

const FIELDS = ["transaction_date", "transaction_type", "amount", "description", "category_id"];

/*
 * Step 4 correction: PATCH /imports/{id}/rows/{rowId} with only the fields
 * the user changed. `raw` (the original file cells) is never sent; each field
 * shows its original value as a reference. The backend revalidates the row at
 * once and its answer (`data.row` + `data.import` counts) replaces ours: the
 * row's status and errors are never set here. Its own pending state keeps
 * the rest of the page usable.
 */
export default function ImportRowEditor({ row, importRecord, categories, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => toRowForm(row));
  const [clientErrors, setClientErrors] = useState({});
  const [request, setRequest] = useState({ pending: false, error: null, unchanged: false });
  const pendingRef = useRef(false);
  const type = form.transaction_type || row.transaction_type;
  const categoryOptions = TRANSACTION_TYPES.includes(type)
    ? categories.filter((category) => category.type === type)
    : categories;

  const update = (field) => (event) => {
    const { value } = event.target;

    setForm((current) => ({
      ...current,
      [field]: value,
      // A category of the other type would be refused: pick it again.
      ...(field === "transaction_type" ? { category_id: "" } : {}),
    }));
    setClientErrors((current) => ({ ...current, [field]: undefined }));
    setRequest((current) => ({ ...current, unchanged: false }));
  };

  const serverErrorFor = (field) => {
    const messages = request.error?.code === "VALIDATION_ERROR" ? request.error.errors?.[field] : null;
    return Array.isArray(messages) ? messages.join(" ") : messages;
  };
  const errorFor = (field) =>
    clientErrors[field]
      ? t(
        clientErrors[field] === "dateInvalid"
          ? "dashboard.importPage.rowEditor.errors.dateInvalid"
          : `dashboard.transactions.validation.${clientErrors[field]}`,
      )
      : serverErrorFor(field);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;

    const changes = getRowChanges(row, form, categories);
    if (Object.keys(changes).length === 0) {
      setRequest({ pending: false, error: null, unchanged: true });
      return;
    }

    const errors = validateRowChanges(changes);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    pendingRef.current = true;
    setRequest({ pending: true, error: null, unchanged: false });

    try {
      const parsed = parseRowUpdateResponse(await importsApi.updateRow(importRecord.id, row.id, changes));
      if (!parsed) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      setRequest({ pending: false, error: null, unchanged: false });
      onSaved(parsed.row, parsed.import);
    } catch (error) {
      setRequest({ pending: false, error, unchanged: false });
    } finally {
      pendingRef.current = false;
    }
  };

  const original = (field) => getRawValue(row, importRecord.mapping, field);
  const otherErrors =
    request.error?.code === "VALIDATION_ERROR"
      ? Object.entries(request.error.errors ?? {})
        .filter(([field]) => !FIELDS.includes(field))
        .flatMap(([, messages]) => messages)
      : [];

  const renderHint = (field) => {
    const value = original(field);
    return value != null ? (
      <span className="import-panel__hint">
        {t("dashboard.importPage.rows.originalValue")}: <bdi dir="auto">{value}</bdi>
      </span>
    ) : null;
  };

  return (
    <form className="import-row-editor" onSubmit={handleSubmit} noValidate>
      <h4>{t("dashboard.importPage.rowEditor.title", { number: row.row_number ?? row.id })}</h4>

      <fieldset className="import-row-editor__grid" disabled={request.pending}>
        <label className="import-panel__field">
          <span className="import-panel__label">{t("dashboard.importPage.rowFields.transaction_date")}</span>
          <input
            type="date"
            value={form.transaction_date}
            onChange={update("transaction_date")}
            aria-invalid={errorFor("transaction_date") ? "true" : undefined}
          />
          {renderHint("transaction_date")}
          {errorFor("transaction_date") && <span className="import-panel__field-error">{errorFor("transaction_date")}</span>}
        </label>

        <label className="import-panel__field">
          <span className="import-panel__label">{t("dashboard.importPage.rowFields.transaction_type")}</span>
          <select
            value={form.transaction_type}
            onChange={update("transaction_type")}
            aria-invalid={errorFor("transaction_type") ? "true" : undefined}
          >
            <option value="">{t("dashboard.importPage.rowEditor.chooseType")}</option>
            {TRANSACTION_TYPES.map((option) => (
              <option key={option} value={option}>
                {t(`dashboard.importPage.transactionTypes.${option}`)}
              </option>
            ))}
          </select>
          {renderHint("transaction_type")}
          {errorFor("transaction_type") && <span className="import-panel__field-error">{errorFor("transaction_type")}</span>}
        </label>

        <label className="import-panel__field">
          <span className="import-panel__label">
            {t("dashboard.importPage.rowFields.amount")}
            {row.currency && <bdi dir="ltr">({row.currency})</bdi>}
          </span>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={form.amount}
            onChange={update("amount")}
            aria-invalid={errorFor("amount") ? "true" : undefined}
          />
          {renderHint("amount")}
          {errorFor("amount") && <span className="import-panel__field-error">{errorFor("amount")}</span>}
        </label>

        <label className="import-panel__field">
          <span className="import-panel__label">{t("dashboard.importPage.rowFields.category_id")}</span>
          <select
            value={form.category_id}
            onChange={update("category_id")}
            aria-invalid={errorFor("category_id") ? "true" : undefined}
          >
            <option value="">{t("dashboard.importPage.rowEditor.noCategory")}</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
          {errorFor("category_id") && <span className="import-panel__field-error">{errorFor("category_id")}</span>}
        </label>

        <label className="import-panel__field import-row-editor__wide">
          <span className="import-panel__label">{t("dashboard.importPage.rowFields.description")}</span>
          <input
            type="text"
            dir="auto"
            value={form.description}
            onChange={update("description")}
            aria-invalid={errorFor("description") ? "true" : undefined}
          />
          {renderHint("description")}
          {errorFor("description") && <span className="import-panel__field-error">{errorFor("description")}</span>}
        </label>
      </fieldset>

      {request.unchanged && <p className="import-row-editor__note">{t("dashboard.importPage.rowEditor.unchanged")}</p>}

      {request.error && (
        <div className="import-panel__alert" role="alert">
          <p>{getImportErrorMessage(request.error, t, "row")}</p>
          {otherErrors.length > 0 && (
            <ul>
              {otherErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="import-panel__actions">
        <button type="button" className="import-panel__secondary" onClick={onCancel} disabled={request.pending}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="import-panel__primary" disabled={request.pending} aria-busy={request.pending}>
          {request.pending ? t("common.saving") : t("dashboard.importPage.rowEditor.save")}
        </button>
      </div>
    </form>
  );
}
