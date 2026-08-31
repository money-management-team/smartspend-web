import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ApiError,
  getApiErrorMessage,
  toMoneyString,
} from "../../../api/apiClient";

import "./SavingsGoalForm.css";

export default function SavingsGoalForm({ goal, onSave, onClose }) {
  const { t } = useTranslation();
  const isEditing = Boolean(goal);
  const [form, setForm] = useState({
    name: goal?.name ?? "",
    target_amount: goal?.target_amount ?? "",
    currency_code: goal?.currency_code ?? "ILS",
    target_date: goal?.target_date ?? "",
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
      ? { target_amount: toMoneyString(form.target_amount) }
      : {
          name: form.name.trim(),
          target_amount: toMoneyString(form.target_amount),
          currency_code: form.currency_code,
          target_date: form.target_date || undefined,
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
    <div className="savings-goal-form-modal" role="presentation" onMouseDown={onClose}>
      <section
        className="savings-goal-form-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="savings-goal-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="savings-goal-form-title">
              {t(isEditing ? "dashboard.savingsGoals.form.editTitle" : "dashboard.savingsGoals.form.createTitle")}
            </h2>
            {isEditing && <p>{goal.name}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
        </header>

        <form onSubmit={handleSubmit}>
          {!isEditing && (
            <label>
              <span>{t("dashboard.savingsGoals.form.name")}</span>
              <input name="name" value={form.name} onChange={handleChange} required />
              {errors.name?.map((error) => <small key={error}>{error}</small>)}
            </label>
          )}

          <label>
            <span>{t("dashboard.savingsGoals.form.targetAmount")}</span>
            <input
              type="number"
              name="target_amount"
              value={form.target_amount}
              onChange={handleChange}
              min="0.0001"
              step="0.0001"
              required
            />
            {errors.target_amount?.map((error) => <small key={error}>{error}</small>)}
          </label>

          {!isEditing && (
            <>
              <label>
                <span>{t("dashboard.savingsGoals.form.currency")}</span>
                <select name="currency_code" value={form.currency_code} onChange={handleChange}>
                  {["ILS", "USD", "EUR", "JOD"].map((currency) => (
                    <option value={currency} key={currency}>{currency}</option>
                  ))}
                </select>
                {errors.currency_code?.map((error) => <small key={error}>{error}</small>)}
              </label>

              <label>
                <span>{t("dashboard.savingsGoals.form.targetDate")}</span>
                <input type="date" name="target_date" value={form.target_date} onChange={handleChange} />
                {errors.target_date?.map((error) => <small key={error}>{error}</small>)}
              </label>
            </>
          )}

          {message && <p className="savings-goal-form-modal__error" role="alert">{message}</p>}

          <footer>
            <button type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" disabled={isSaving}>{isSaving ? t("common.saving") : t("common.save")}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
