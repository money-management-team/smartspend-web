import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ApiError,
  createIdempotencyKey,
  getApiErrorMessage,
} from "../../../api/apiClient";

import "../SavingsGoalForm/SavingsGoalForm.css";

export default function ContributionForm({ goal, accounts, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    from_account_id: String(accounts[0]?.id ?? ""),
    amount: "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const idempotencyAttemptRef = useRef(null);
  const sourceAccount =
    accounts.find(
      (account) => String(account.id) === String(form.from_account_id),
    ) ?? accounts[0] ?? null;
  const sourceAccountId = String(sourceAccount?.id ?? "");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
    idempotencyAttemptRef.current = null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setMessage("");

    const payload = {
      from_account_id: Number(sourceAccountId),
      amount: form.amount,
    };
    const fingerprint = JSON.stringify(payload);

    if (idempotencyAttemptRef.current?.fingerprint !== fingerprint) {
      idempotencyAttemptRef.current = {
        fingerprint,
        key: createIdempotencyKey("goal-contribution"),
      };
    }

    try {
      await onSave(payload, idempotencyAttemptRef.current.key);
      idempotencyAttemptRef.current = null;
    } catch (error) {
      setMessage(getApiErrorMessage(error, t));
      if (error instanceof ApiError) setErrors(error.errors);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="contribution-form-modal" role="presentation" onMouseDown={onClose}>
      <section
        className="contribution-form-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contribution-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="contribution-form-title">{t("dashboard.savingsGoals.contribution.title")}</h2>
            <p>{goal.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            <span>{t("dashboard.savingsGoals.contribution.fromAccount")}</span>
            <select name="from_account_id" value={sourceAccountId} onChange={handleChange} required>
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name} ({account.current_balance} {account.currency_code})
                </option>
              ))}
            </select>
            {errors.from_account_id?.map((error) => <small key={error}>{error}</small>)}
          </label>

          <label>
            <span>{t("dashboard.savingsGoals.contribution.amount")}</span>
            <input type="number" name="amount" value={form.amount} onChange={handleChange} min="0.0001" step="0.0001" required />
            {errors.amount?.map((error) => <small key={error}>{error}</small>)}
          </label>

          {accounts.length === 0 && <p className="contribution-form-modal__error">{t("dashboard.savingsGoals.contribution.noAccounts")}</p>}
          {message && <p className="contribution-form-modal__error" role="alert">{message}</p>}

          <footer>
            <button type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" disabled={isSaving || accounts.length === 0}>{isSaving ? t("common.saving") : t("dashboard.savingsGoals.addFunds")}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
