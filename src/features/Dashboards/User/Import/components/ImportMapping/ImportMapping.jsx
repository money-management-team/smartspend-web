import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuColumns3, LuSparkles } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { ApiError, getApiErrorMessage, getStoredWorkspace } from "../../../api/apiClient";
import { accountsApi } from "../../../api/accountsApi";
import { categoriesApi } from "../../../api/categoriesApi";
import { importsApi } from "../../../api/importsApi";
import {
  getImportErrorMessage,
  getMappingFields,
  isImportEditable,
  mappingFormToPayload,
  normalizeMapping,
  parseImportResponse,
  splitMappingErrors,
  toMappingForm,
  validateMappingForm,
} from "../../importHelpers";
import ImportPanel from "../ImportPanel/ImportPanel";

import "./ImportMapping.css";

const isSelectableAccount = (account) => account?.id != null && account.status !== "archived";
const findById = (list, value) => list.find((item) => String(item.id) === String(value));

/*
 * Step 2: POST /imports/{id}/mapping. Every field maps to a zero-based
 * column index of the uploaded `headers`; the backend's
 * `suggested_mapping` (or the saved mapping) prefills the form. The account
 * and default categories come from the existing Accounts / Categories APIs
 * (expense default: expense categories only; income default: income only).
 * The import the backend returns becomes the source of truth.
 */
export default function ImportMapping({ importRecord, suggestedMapping, onSaved, onCancel }) {
  const { t, i18n } = useTranslation();
  const headers = Array.isArray(importRecord.headers) ? importRecord.headers : [];
  const savedMapping = normalizeMapping(importRecord.mapping);
  const hasSavedMapping = Object.keys(savedMapping).length > 0;
  const suggested = normalizeMapping(suggestedMapping);
  const fields = getMappingFields(suggested, savedMapping);
  const editable = isImportEditable(importRecord);

  const [form, setForm] = useState(() => toMappingForm(hasSavedMapping ? savedMapping : suggested));
  const [accountId, setAccountId] = useState(importRecord.account_id != null ? String(importRecord.account_id) : "");
  const [expenseCategoryId, setExpenseCategoryId] = useState(
    importRecord.options?.default_expense_category_id != null ? String(importRecord.options.default_expense_category_id) : "",
  );
  const [incomeCategoryId, setIncomeCategoryId] = useState(
    importRecord.options?.default_income_category_id != null ? String(importRecord.options.default_income_category_id) : "",
  );
  const [clientErrors, setClientErrors] = useState({});
  const [save, setSave] = useState({ pending: false, error: null });
  const pendingRef = useRef(false);

  /* ---------- Accounts and categories ---------- */

  const [optionsKey, setOptionsKey] = useState(0);
  const [options, setOptions] = useState({ key: null, accounts: [], categories: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const workspaceId = importRecord.workspace_id ?? getStoredWorkspace()?.id;

    Promise.all([
      accountsApi.list({ id_workspace: workspaceId }, { signal }),
      categoriesApi.list({ workspace_id: workspaceId }, { signal }),
    ])
      .then(([accountsResponse, categoriesResponse]) => {
        setOptions({
          key: optionsKey,
          accounts: (accountsResponse.data?.accounts ?? []).filter(isSelectableAccount),
          categories: (categoriesResponse.data?.categories ?? []).filter((category) => category?.id != null),
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        setOptions({ key: optionsKey, accounts: [], categories: [], error });
      });

    return () => controller.abort();
  }, [importRecord.workspace_id, optionsKey]);

  const isLoadingOptions = options.key !== optionsKey;
  const expenseCategories = options.categories.filter((category) => category.type === "expense");
  const incomeCategories = options.categories.filter((category) => category.type === "income");

  /* ---------- Save ---------- */

  const serverErrors = save.error?.code === "VALIDATION_ERROR" ? splitMappingErrors(save.error) : { byField: {}, general: [] };
  const errorFor = (field) =>
    clientErrors[field]
      ? t(`dashboard.importPage.mapping.errors.${clientErrors[field]}`)
      : serverErrors.byField[field]?.join(" ");

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setClientErrors((current) => ({ ...current, [field]: undefined, amount: field === "debit" || field === "credit" ? undefined : current.amount }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current || !editable) return;

    const errors = validateMappingForm(form, accountId);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const account = findById(options.accounts, accountId);
    const expense = findById(expenseCategories, expenseCategoryId);
    const income = findById(incomeCategories, incomeCategoryId);

    pendingRef.current = true;
    setSave({ pending: true, error: null });

    try {
      const response = await importsApi.saveMapping(importRecord.id, {
        mapping: mappingFormToPayload(form),
        account_id: account?.id ?? Number(accountId),
        default_expense_category_id: expense ? expense.id : null,
        default_income_category_id: income ? income.id : null,
      });
      const saved = parseImportResponse(response);
      if (!saved) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      setSave({ pending: false, error: null });
      onSaved(saved);
    } catch (error) {
      setSave({ pending: false, error });
    } finally {
      pendingRef.current = false;
    }
  };

  const columnLabel = (header, index) =>
    t("dashboard.importPage.mapping.column", {
      number: index + 1,
      name: header === null || header === undefined || header === "" ? t("dashboard.importPage.mapping.unnamed") : String(header),
    });

  return (
    <ImportPanel title={t("dashboard.importPage.mapping.title")} hint={t("dashboard.importPage.mapping.hint")}>
      {headers.length === 0 ? (
        <p className="import-mapping__empty">{t("dashboard.importPage.mapping.noHeaders")}</p>
      ) : (
        <form className="import-mapping" onSubmit={handleSubmit} noValidate>
          <fieldset className="import-mapping__group" disabled={!editable || save.pending}>
            <legend>
              <LuColumns3 aria-hidden="true" />
              {t("dashboard.importPage.mapping.columnsTitle")}
            </legend>
            <p className="import-panel__hint">{t("dashboard.importPage.mapping.amountHint")}</p>

            <div className="import-mapping__grid">
              {fields.map((field) => {
                const value = form[field] ?? "";
                const isSuggested = suggested[field] != null && String(suggested[field]) === value;
                const error = errorFor(field);
                const fieldKey = `dashboard.importPage.mappingFields.${field}`;

                return (
                  <label className="import-panel__field" key={field}>
                    <span className="import-panel__label">
                      {i18n.exists(fieldKey) ? t(fieldKey) : field}
                      {field === "date" && <span aria-hidden="true">*</span>}
                      {isSuggested && (
                        <span className="import-mapping__suggested">
                          <LuSparkles aria-hidden="true" />
                          {t("dashboard.importPage.mapping.suggested")}
                        </span>
                      )}
                    </span>
                    <select value={value} onChange={updateField(field)} aria-invalid={error ? "true" : undefined}>
                      <option value="">{t("dashboard.importPage.mapping.notMapped")}</option>
                      {headers.map((header, index) => (
                        <option key={index} value={String(index)}>
                          {columnLabel(header, index)}
                        </option>
                      ))}
                    </select>
                    {error && <span className="import-panel__field-error">{error}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="import-mapping__group" disabled={!editable || save.pending || isLoadingOptions}>
            <legend>{t("dashboard.importPage.mapping.destinationTitle")}</legend>

            {isLoadingOptions && <Loading size="small" variant="inline" message={t("dashboard.importPage.mapping.loadingOptions")} />}

            {!isLoadingOptions && options.error && (
              <div className="import-panel__alert" role="alert">
                <p>{getApiErrorMessage(options.error, t)}</p>
                <button type="button" className="import-panel__secondary" onClick={() => setOptionsKey((key) => key + 1)}>
                  {t("common.retry")}
                </button>
              </div>
            )}

            {!isLoadingOptions && !options.error && (
              <div className="import-mapping__grid">
                <label className="import-panel__field">
                  <span className="import-panel__label">
                    {t("dashboard.importPage.fields.account")}
                    <span aria-hidden="true">*</span>
                  </span>
                  <select
                    value={accountId}
                    onChange={(event) => {
                      setAccountId(event.target.value);
                      setClientErrors((current) => ({ ...current, account_id: undefined }));
                    }}
                    aria-invalid={errorFor("account_id") ? "true" : undefined}
                  >
                    <option value="">{t("dashboard.importPage.mapping.chooseAccount")}</option>
                    {options.accounts.map((account) => (
                      <option key={account.id} value={String(account.id)}>
                        {account.name}
                        {account.currency_code ? ` (${account.currency_code})` : ""}
                      </option>
                    ))}
                  </select>
                  {errorFor("account_id") && <span className="import-panel__field-error">{errorFor("account_id")}</span>}
                  {options.accounts.length === 0 && (
                    <span className="import-panel__hint">{t("dashboard.importPage.mapping.noAccounts")}</span>
                  )}
                </label>

                <label className="import-panel__field">
                  <span className="import-panel__label">{t("dashboard.importPage.fields.defaultExpenseCategory")}</span>
                  <select value={expenseCategoryId} onChange={(event) => setExpenseCategoryId(event.target.value)}>
                    <option value="">{t("dashboard.importPage.mapping.noDefault")}</option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errorFor("default_expense_category_id") && (
                    <span className="import-panel__field-error">{errorFor("default_expense_category_id")}</span>
                  )}
                </label>

                <label className="import-panel__field">
                  <span className="import-panel__label">{t("dashboard.importPage.fields.defaultIncomeCategory")}</span>
                  <select value={incomeCategoryId} onChange={(event) => setIncomeCategoryId(event.target.value)}>
                    <option value="">{t("dashboard.importPage.mapping.noDefault")}</option>
                    {incomeCategories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errorFor("default_income_category_id") && (
                    <span className="import-panel__field-error">{errorFor("default_income_category_id")}</span>
                  )}
                </label>
              </div>
            )}
          </fieldset>

          {save.error && (
            <div className="import-panel__alert" role="alert">
              <p>{getImportErrorMessage(save.error, t, "mapping")}</p>
              {serverErrors.general.length > 0 && (
                <ul>
                  {serverErrors.general.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="import-panel__actions">
            {onCancel && (
              <button type="button" className="import-panel__secondary" onClick={onCancel} disabled={save.pending}>
                {t("common.cancel")}
              </button>
            )}
            <button
              type="submit"
              className="import-panel__primary"
              disabled={!editable || save.pending || isLoadingOptions || Boolean(options.error)}
            >
              {save.pending ? t("dashboard.importPage.mapping.saving") : t("dashboard.importPage.mapping.save")}
            </button>
          </div>
        </form>
      )}
    </ImportPanel>
  );
}
