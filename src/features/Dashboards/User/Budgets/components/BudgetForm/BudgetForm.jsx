import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ApiError,
  getApiErrorMessage,
  toMoneyString,
} from "../../../api/apiClient";

import "./BudgetForm.css";

function getDefaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const toDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    period_start: toDateInput(start),
    period_end: toDateInput(end),
  };
}

export default function BudgetForm({ budget, categories, onSave, onClose }) {
  const { t } = useTranslation();
  const isEditing = Boolean(budget);
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [form, setForm] = useState({
    name: budget?.name ?? "",
    category_id: budget?.category?.id ? String(budget.category.id) : "",
    amount_limit: budget?.amount_limit ?? "",
    currency_code: budget?.currency_code ?? "ILS",
    period_start: budget?.period_start ?? defaultPeriod.period_start,
    period_end: budget?.period_end ?? defaultPeriod.period_end,
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setMessage("");

    const payload = isEditing
      ? { amount_limit: toMoneyString(form.amount_limit) }
      : {
          name: form.name.trim(),
          category_id: form.category_id ? Number(form.category_id) : undefined,
          amount_limit: toMoneyString(form.amount_limit),
          currency_code: form.currency_code,
          period_start: form.period_start,
          period_end: form.period_end,
        };

    try {
      await onSave(payload);
    } catch (error) {
      setMessage(getApiErrorMessage(error, t));
      if (error instanceof ApiError) setErrors(error.errors);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="budget-form-modal" role="presentation" onMouseDown={onClose}>
      <section
        className="budget-form-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="budget-form-modal__header">
          <div>
            <h2 id="budget-form-title">
              {t(isEditing ? "dashboard.budgets.form.editTitle" : "dashboard.budgets.form.createTitle")}
            </h2>
            {isEditing && <p>{budget.name}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
        </header>

        <form className="budget-form-modal__form" onSubmit={handleSubmit}>
          {!isEditing && (
            <>
              <label>
                <span>{t("dashboard.budgets.form.name")}</span>
                <input name="name" value={form.name} onChange={handleChange} required />
                {errors.name?.map((error) => <small key={error}>{error}</small>)}
              </label>

              <label>
                <span>{t("dashboard.budgets.form.category")}</span>
                <select name="category_id" value={form.category_id} onChange={handleChange}>
                  <option value="">{t("dashboard.budgets.form.general")}</option>
                  {categories.map((category) => (
                    <option value={category.id} key={category.id}>{category.name}</option>
                  ))}
                </select>
                {errors.category_id?.map((error) => <small key={error}>{error}</small>)}
              </label>
            </>
          )}

          <label>
            <span>{t("dashboard.budgets.form.limit")}</span>
            <input
              type="number"
              name="amount_limit"
              value={form.amount_limit}
              onChange={handleChange}
              min="0.0001"
              step="0.0001"
              required
            />
            {errors.amount_limit?.map((error) => <small key={error}>{error}</small>)}
          </label>

          {!isEditing && (
            <>
              <label>
                <span>{t("dashboard.budgets.form.currency")}</span>
                <select name="currency_code" value={form.currency_code} onChange={handleChange}>
                  {["ILS", "USD", "EUR", "JOD"].map((currency) => (
                    <option value={currency} key={currency}>{currency}</option>
                  ))}
                </select>
                {errors.currency_code?.map((error) => <small key={error}>{error}</small>)}
              </label>

              <div className="budget-form-modal__dates">
                <label>
                  <span>{t("dashboard.budgets.form.startDate")}</span>
                  <input type="date" name="period_start" value={form.period_start} onChange={handleChange} required />
                  {errors.period_start?.map((error) => <small key={error}>{error}</small>)}
                </label>
                <label>
                  <span>{t("dashboard.budgets.form.endDate")}</span>
                  <input type="date" name="period_end" value={form.period_end} onChange={handleChange} required />
                  {errors.period_end?.map((error) => <small key={error}>{error}</small>)}
                </label>
              </div>
            </>
          )}

          {message && <p className="budget-form-modal__error" role="alert">{message}</p>}

          <footer className="budget-form-modal__footer">
            <button type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? t("common.saving") : t("common.save")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
