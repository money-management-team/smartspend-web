import { manualTemplateForm } from "../../../Experience/experienceStore";
import ManualTemplateTools from "../../../Experience/ManualTemplateTools";
import { useMemo, useState } from "react";
import { LuArrowRight, LuChevronDown } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getNewTransferPath } from "../../../../../../routes/Path";
import { getApiErrorMessage } from "../../../api/apiClient";
import { getAmountError, getTodayInputValue } from "../../transactionHelpers";
import "./NewOperation.css";

const emptyForm = () => ({ amount: "", category_id: "", note: "",
  reference_number: "", date: getTodayInputValue() });

// Presentation changes only: validation, the review payload and onRecorded reset are retained.
export default function NewOperation({ account, accounts, onSelectAccount, categories,
  type = "expense", onTypeChange, isLoadingOptions = false, optionsError = null,
  onRetryOptions, onRequireAccount, onReview }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [validation, setValidation] = useState({ type: null, fields: {} });
  const errors = validation.type === type ? validation.fields : {};
  const isExpense = type === "expense";
  const availableCategories = useMemo(() => categories.filter((category) => category.type === type), [categories, type]);
  const selectedCategoryId = availableCategories.some((category) => String(category.id) === String(form.category_id))
    ? String(form.category_id) : "";
  const clearErrors = () => setValidation({ type: null, fields: {} });
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setValidation((current) => ({ ...current, fields: { ...current.fields, [name]: undefined } }));
  };
  const validate = () => {
    const nextErrors = {};
    const amountError = getAmountError(form.amount);
    if (amountError) nextErrors.amount = t(`dashboard.transactions.validation.${amountError}`);
    if (isExpense && !selectedCategoryId) nextErrors.category_id = t("dashboard.transactions.validation.categoryRequired");
    return nextErrors;
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!onRequireAccount()) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setValidation({ type, fields: nextErrors });
      return;
    }
    clearErrors();
    onReview({ type, method: "manual", amount: form.amount.trim(), category_id: selectedCategoryId,
      description: form.note.trim(), reference_number: form.reference_number.trim(), date: form.date,
      onRecorded: () => setForm(emptyForm()) });
  };
  return (
    <form className="capture-panel new-operation" onSubmit={handleSubmit} noValidate>
      <ManualTemplateTools compact account={account} accounts={accounts} categories={categories}
        type={type} form={form} onApply={(template) => {
          onSelectAccount(template.account_id);
          onTypeChange(template.type);
          setForm(manualTemplateForm(template, getTodayInputValue()));
          clearErrors();
        }} />
      {optionsError && <p className="new-operation__error" role="alert">
        {getApiErrorMessage(optionsError, t)} <button type="button" className="new-operation__link"
          onClick={onRetryOptions}>{t("common.retry")}</button>
      </p>}
      <div className="new-operation__grid">
        <label className="new-operation__amount">
          <span>{t("dashboard.transactions.fields.amount")} <span className="new-operation__required" aria-hidden="true">*</span></span>
          <div>
            <input name="amount" value={form.amount} onChange={handleChange} placeholder="0.00"
              inputMode="decimal" autoComplete="off" dir="ltr"
              aria-invalid={errors.amount ? true : undefined} aria-describedby={errors.amount ? "operation-amount-error" : undefined} required />
            {account && <b>{account.currency_code}</b>}
          </div>
          {errors.amount && <small id="operation-amount-error" role="alert">{errors.amount}</small>}
        </label>
        <label className="new-operation__field">
          <span>{t("dashboard.transactions.fields.category")}
            {isExpense ? <span className="new-operation__required" aria-hidden="true"> *</span>
              : <small className="new-operation__optional"> {t("dashboard.transactions.form.optional")}</small>}
          </span>
          <div className="new-operation__select">
            <select name="category_id" value={selectedCategoryId} onChange={handleChange}
              disabled={isLoadingOptions || availableCategories.length === 0}
              aria-invalid={errors.category_id ? true : undefined}
              aria-describedby={errors.category_id ? "operation-category-error" : undefined} required={isExpense}>
              {availableCategories.length === 0 ? <option value="">{t("dashboard.financialOperations.form.noCategories")}</option>
                : <option value="" disabled={isExpense}>{t(isExpense ? "dashboard.transactions.form.selectCategory"
                  : "dashboard.transactions.form.noCategory")}</option>}
              {availableCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
            <LuChevronDown aria-hidden="true" />
          </div>
          {errors.category_id && <small id="operation-category-error" role="alert">{errors.category_id}</small>}
        </label>
        <label className="new-operation__field">
          <span>{t("dashboard.transactions.fields.date")}</span>
          <input type="date" name="date" value={form.date} onChange={handleChange} required />
        </label>
      </div>
      <details className="new-operation__extras">
        <summary>{t("dashboard.financialOperations.ui.optionalDetails")}<LuChevronDown aria-hidden="true" /></summary>
        <div className="new-operation__extras-fields">
        <label className="new-operation__field">
          <span>{t("dashboard.financialOperations.form.note")}
            <small className="new-operation__optional"> {t("dashboard.transactions.form.optional")}</small>
          </span>
          <input type="text" name="note" value={form.note} onChange={handleChange}
            placeholder={t("dashboard.financialOperations.form.notePlaceholder")} maxLength={255} dir="auto" />
        </label>
        <label className="new-operation__field">
          <span>{t("dashboard.transactions.fields.referenceNumber")} ({t("dashboard.transactions.form.optional")})</span>
          <input type="text" name="reference_number" value={form.reference_number}
            onChange={handleChange} maxLength={100} dir="auto" />
        </label>
        </div>
      </details>
      <div className="new-operation__footer">
        <button type="submit" className="capture-action" disabled={isLoadingOptions}>
          {t(`dashboard.financialOperations.review.open.${type}`)}<LuArrowRight aria-hidden="true" />
        </button>
        <Link className="new-operation__transfer-link" to={getNewTransferPath()}>
          {t("dashboard.financialOperations.ui.transferLink")}
        </Link>
      </div>
    </form>
  );
}
