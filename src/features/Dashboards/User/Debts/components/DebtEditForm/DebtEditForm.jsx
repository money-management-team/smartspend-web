import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuLock } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatMoney } from "../../../utils/formatters";
import {
  COUNTERPARTY_MAX,
  NOTES_MAX,
  buildUpdatePayload,
  getDebtActions,
  getDebtErrorMessage,
  toEditValues,
  validateEditForm,
} from "../../debtHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet; rows and the fixed-fields
// box from the create form's.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "../DebtForm/DebtForm.css";

// Fields with their own input; errors for any other backend field (e.g.
// `metadata`) are listed in the error block instead.
const FORM_FIELDS = ["counterparty_name", "original_amount", "issued_at", "due_date", "notes"];

/*
 * Edit debt modal (PATCH /debts/{id}). Only counterparty, original amount,
 * dates and notes are editable, and only the changed ones are sent. The
 * direction, currency and workspace are fixed and shown read-only.
 * `original_amount` is locked once the debt has a payment (the backend
 * rejects it too); when it does change, the backend recalculates
 * `remaining_amount`. An archived debt never reaches this form.
 *
 * `onSave(payload)` performs the request and throws on failure; errors are
 * shown here.
 */
export default function DebtEditForm({ debt, onSave, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const { amountLocked } = getDebtActions(debt);
  const [form, setForm] = useState(() => toEditValues(debt));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRef = useRef(false);

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

    const nextErrors = validateEditForm(form, { amountLocked, t });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = buildUpdatePayload(form, debt, { amountLocked });

    if (Object.keys(payload).length === 0) {
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
        setMessage(getDebtErrorMessage(error, t, "save"));
      }
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  const otherErrors = Object.keys(errors)
    .filter((field) => !FORM_FIELDS.includes(field))
    .map((field) => fieldErrors(field));

  const optional = t("dashboard.transactions.form.optional");

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog debt-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-edit-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="debt-form__title">
            <h2 id="debt-edit-form-title">{t("dashboard.debts.editForm.title")}</h2>
            <p dir="auto">{debt.counterparty_name}</p>
          </div>
          <button type="button" onClick={close} disabled={isSaving} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t("dashboard.debts.fields.counterparty")}</span>
            <input
              name="counterparty_name"
              value={form.counterparty_name}
              onChange={handleChange}
              disabled={isSaving}
              maxLength={COUNTERPARTY_MAX}
              aria-invalid={errors.counterparty_name ? true : undefined}
              autoComplete="off"
              dir="auto"
              required
              autoFocus
            />
            {fieldErrors("counterparty_name")}
          </label>

          {!amountLocked && (
            <label>
              <span>{t("dashboard.debts.fields.originalAmount")}</span>
              <input
                name="original_amount"
                value={form.original_amount}
                onChange={handleChange}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                dir="ltr"
                disabled={isSaving}
                aria-invalid={errors.original_amount ? true : undefined}
                aria-describedby="debt-edit-form-amount-hint"
                required
              />
              <em className="account-form-modal__hint" id="debt-edit-form-amount-hint">
                {t("dashboard.debts.editForm.amountHint")}
              </em>
              {fieldErrors("original_amount")}
            </label>
          )}

          <div className="debt-form__fixed" role="note">
            <dl>
              <div>
                <dt>{t("dashboard.debts.fields.direction")}</dt>
                <dd>{translateEnum(t, i18n, "dashboard.debts.direction", debt.direction) || "—"}</dd>
              </div>
              <div>
                <dt>{t("dashboard.debts.fields.currency")}</dt>
                <dd>
                  <bdi dir="ltr">{debt.currency_code || "—"}</bdi>
                </dd>
              </div>
              {amountLocked && (
                <div>
                  <dt>{t("dashboard.debts.fields.originalAmount")}</dt>
                  <dd>
                    <bdi dir="ltr">{formatMoney(debt.original_amount, debt.currency_code, locale)}</bdi>
                  </dd>
                </div>
              )}
            </dl>
            <p>
              <LuLock aria-hidden="true" />
              <span>{t("dashboard.debts.editForm.fixedHint")}</span>
            </p>
            {amountLocked && (
              <p>
                <LuInfo aria-hidden="true" />
                <span>{t("dashboard.debts.editForm.amountLocked")}</span>
              </p>
            )}
          </div>

          <div className="debt-form__row">
            <label>
              <span>
                {t("dashboard.debts.fields.issuedAt")} ({optional})
              </span>
              <input
                type="date"
                name="issued_at"
                value={form.issued_at}
                max={form.due_date || undefined}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={errors.issued_at ? true : undefined}
              />
              {fieldErrors("issued_at")}
            </label>

            <label>
              <span>
                {t("dashboard.debts.fields.dueDate")} ({optional})
              </span>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                min={form.issued_at || undefined}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={errors.due_date ? true : undefined}
              />
              {fieldErrors("due_date")}
            </label>
          </div>

          <label>
            <span>
              {t("dashboard.debts.fields.notes")} ({optional})
            </span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              maxLength={NOTES_MAX}
              placeholder={t("dashboard.debts.form.notesPlaceholder")}
              disabled={isSaving}
              aria-invalid={errors.notes ? true : undefined}
              dir="auto"
            />
            {fieldErrors("notes")}
          </label>

          {message && (
            <div className="account-form-modal__error" role="alert">
              <p dir="auto">{message}</p>
              {otherErrors}
            </div>
          )}

          <footer>
            <button type="button" onClick={close} disabled={isSaving}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={isSaving} aria-busy={isSaving || undefined}>
              {isSaving ? t("common.saving") : t("common.save")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
