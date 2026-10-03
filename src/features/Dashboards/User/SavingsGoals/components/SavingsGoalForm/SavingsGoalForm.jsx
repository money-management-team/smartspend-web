import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuLock } from "react-icons/lu";

import { getStoredWorkspace, toMoneyString } from "../../../api/apiClient";
import {
  getTodayInputValue,
  toAmountInput,
} from "../../../FinancialOperations/transactionHelpers";
import {
  NAME_MAX,
  NOTES_MAX,
  getCurrencyOptions,
  getGoalErrorMessage,
  toDateOnly,
  validateGoalForm,
} from "../../savingsGoalHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./SavingsGoalForm.css";

// Backend fields shown in the error block rather than under an input.
const GENERAL_FIELDS = ["workspace_id", "metadata"];

function toFormValues(goal) {
  if (goal) {
    return {
      name: goal.name ?? "",
      target_amount: toAmountInput(goal.target_amount),
      currency_code: goal.currency_code ?? "",
      target_date: toDateOnly(goal.target_date),
      notes: goal.notes ?? "",
    };
  }

  return {
    name: "",
    target_amount: "",
    // The workspace's base currency when known (resolveWorkspaceId caches it).
    currency_code: getStoredWorkspace()?.base_currency_code || "ILS",
    target_date: "",
    notes: "",
  };
}

/*
 * Create: the full payload; the parent adds `workspace_id`. No account is
 * chosen: the backend creates the goal's own savings account.
 * Edit: only the changed editable fields (name, target_amount, target_date,
 * notes). The currency is never sent: the goal's account already holds money
 * in it. Clearing the date or the notes sends `null`.
 */
function buildPayload(form, goal) {
  const notes = form.notes.trim();

  if (!goal) {
    return {
      name: form.name.trim(),
      target_amount: form.target_amount.trim(),
      currency_code: form.currency_code,
      ...(form.target_date ? { target_date: form.target_date } : {}),
      ...(notes ? { notes } : {}),
    };
  }

  const original = toFormValues(goal);
  const payload = {};

  if (form.name.trim() !== original.name.trim()) payload.name = form.name.trim();
  if (toMoneyString(form.target_amount.trim()) !== toMoneyString(goal.target_amount)) {
    payload.target_amount = form.target_amount.trim();
  }
  if (form.target_date !== original.target_date) payload.target_date = form.target_date || null;
  if (notes !== original.notes.trim()) payload.notes = notes || null;

  return payload;
}

/*
 * Create / edit savings goal modal. `onSave(payload)` performs the request
 * and throws on failure; errors are shown here. An archived goal never reaches
 * this form (the parents only open it while the goal can be edited).
 */
export default function SavingsGoalForm({ goal, onSave, onClose }) {
  const { t } = useTranslation();
  const isEditing = Boolean(goal);
  const [form, setForm] = useState(() => toFormValues(goal));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRef = useRef(false);
  const [currencyOptions] = useState(() => getCurrencyOptions(form.currency_code));
  const [today] = useState(getTodayInputValue);

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const nextErrors = validateGoalForm(form, { isEditing, today, t });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = buildPayload(form, goal);

    if (isEditing && Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    pendingRef.current = true;
    setIsSaving(true);
    setErrors({});
    setMessage("");

    try {
      await onSave(payload);
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        if (error?.code === "VALIDATION_ERROR") setErrors(error.errors ?? {});
        setMessage(getGoalErrorMessage(error, t, "save"));
      }
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  const optional = t("dashboard.transactions.form.optional");

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog savings-goal-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="savings-goal-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="savings-goal-form-title">
            {t(
              isEditing
                ? "dashboard.savingsGoals.form.editTitle"
                : "dashboard.savingsGoals.form.createTitle",
            )}
          </h2>
          <button type="button" onClick={close} disabled={isSaving} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        {!isEditing && (
          <p className="savings-goal-form__note" role="note">
            <LuInfo aria-hidden="true" />
            <span>{t("dashboard.savingsGoals.form.accountHint")}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t("dashboard.savingsGoals.fields.name")}</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={isSaving}
              maxLength={NAME_MAX}
              placeholder={t("dashboard.savingsGoals.form.namePlaceholder")}
              aria-invalid={errors.name ? true : undefined}
              dir="auto"
              required
              autoFocus
            />
            {fieldErrors("name")}
          </label>

          <div className={`savings-goal-form__row${isEditing ? " savings-goal-form__row--single" : ""}`}>
            <label>
              <span>{t("dashboard.savingsGoals.fields.targetAmount")}</span>
              <input
                name="target_amount"
                value={form.target_amount}
                onChange={handleChange}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                dir="ltr"
                disabled={isSaving}
                aria-invalid={errors.target_amount ? true : undefined}
                required
              />
              {fieldErrors("target_amount")}
            </label>

            {!isEditing && (
              <label>
                <span>{t("dashboard.savingsGoals.fields.currency")}</span>
                <select
                  name="currency_code"
                  value={form.currency_code}
                  onChange={handleChange}
                  disabled={isSaving}
                  aria-invalid={errors.currency_code ? true : undefined}
                  aria-describedby="savings-goal-form-currency-hint"
                  dir="ltr"
                  required
                >
                  {currencyOptions.map((currency) => (
                    <option value={currency} key={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                {fieldErrors("currency_code")}
              </label>
            )}
          </div>

          {isEditing ? (
            <div className="savings-goal-form__fixed" role="note">
              <dl>
                <div>
                  <dt>{t("dashboard.savingsGoals.fields.currency")}</dt>
                  <dd>
                    <bdi dir="ltr">{goal.currency_code}</bdi>
                  </dd>
                </div>
              </dl>
              <p>
                <LuLock aria-hidden="true" />
                <span>{t("dashboard.savingsGoals.form.fixedCurrencyHint")}</span>
              </p>
              <p>
                <LuInfo aria-hidden="true" />
                <span>{t("dashboard.savingsGoals.form.targetChangeHint")}</span>
              </p>
            </div>
          ) : (
            <em className="account-form-modal__hint" id="savings-goal-form-currency-hint">
              {t("dashboard.savingsGoals.form.currencyHint")}
            </em>
          )}

          <label>
            <span>
              {t("dashboard.savingsGoals.fields.targetDate")} ({optional})
            </span>
            <input
              type="date"
              name="target_date"
              value={form.target_date}
              onChange={handleChange}
              min={isEditing ? undefined : today}
              disabled={isSaving}
              aria-invalid={errors.target_date ? true : undefined}
            />
            {fieldErrors("target_date")}
          </label>

          <label>
            <span>
              {t("dashboard.savingsGoals.fields.notes")} ({optional})
            </span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              maxLength={NOTES_MAX}
              placeholder={t("dashboard.savingsGoals.form.notesPlaceholder")}
              disabled={isSaving}
              aria-invalid={errors.notes ? true : undefined}
              dir="auto"
            />
            {fieldErrors("notes")}
          </label>

          {message && (
            <div className="account-form-modal__error" role="alert">
              <p dir="auto">{message}</p>
              {GENERAL_FIELDS.map((field) => fieldErrors(field))}
            </div>
          )}

          <footer>
            <button type="button" onClick={close} disabled={isSaving}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={isSaving} aria-busy={isSaving || undefined}>
              {isSaving
                ? t("common.saving")
                : t(isEditing ? "common.save" : "dashboard.savingsGoals.form.submitCreate")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
