import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getApiErrorMessage,
  toMoneyString,
} from "../../../api/apiClient";
import {
  ACCOUNT_CURRENCIES,
  ACCOUNT_TYPES,
  getAccountErrorMessage,
} from "../../accountHelpers";

import "./AccountForm.css";

const toFormValues = (account) => ({
  name: account?.name ?? "",
  type: account?.type ?? "cash",
  currency_code: account?.currency_code ?? "ILS",
  opening_balance: account?.opening_balance ?? "0.0000",
  allow_negative_balance: Boolean(account?.allow_negative_balance),
});

/*
 * Create: the full payload. Edit: only the fields that changed, so an
 * untouched opening balance is never sent (a changed one can be locked → 409).
 * Money stays a 4-decimal string.
 */
function buildPayload(form, account) {
  const values = {
    name: form.name.trim(),
    type: form.type,
    currency_code: form.currency_code,
    opening_balance: toMoneyString(form.opening_balance),
    allow_negative_balance: form.allow_negative_balance,
  };

  if (!account) {
    const { allow_negative_balance, ...createValues } = values;
    return allow_negative_balance ? values : createValues;
  }

  const original = toFormValues(account);
  const originalValues = {
    ...original,
    name: original.name.trim(),
    opening_balance: toMoneyString(original.opening_balance),
  };

  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== originalValues[key]),
  );
}

export default function AccountForm({ account, onSave, onClose }) {
  const { t } = useTranslation();
  const isEditing = Boolean(account);
  const [form, setForm] = useState(() => toFormValues(account));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const close = () => {
    if (!isSaving) onClose();
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    const payload = buildPayload(form, account);

    if (isEditing && Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    setErrors({});
    setMessage("");

    try {
      await onSave(payload);
    } catch (error) {
      if (error?.code === "VALIDATION_ERROR") setErrors(error.errors ?? {});

      if (error?.code === "CONFLICT" && "opening_balance" in payload) {
        const lockedMessage = t("dashboard.accounts.errors.openingBalanceLocked");
        setErrors({ opening_balance: [lockedMessage] });
        setMessage(lockedMessage);
      } else {
        setMessage(
          error?.code === "CONFLICT"
            ? getApiErrorMessage(error, t)
            : getAccountErrorMessage(error, t),
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="account-form-title">
            {t(
              isEditing
                ? "dashboard.accounts.form.editTitle"
                : "dashboard.accounts.form.createTitle",
            )}
          </h2>
          <button type="button" onClick={close} aria-label={t("common.close")}>×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            <span>{t("dashboard.accounts.form.name")}</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={isSaving}
              maxLength={255}
              required
              autoFocus
            />
            {fieldErrors("name")}
          </label>

          <label>
            <span>{t("dashboard.accounts.form.type")}</span>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              disabled={isSaving}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option value={type} key={type}>
                  {t(`dashboard.accounts.types.${type}`)}
                </option>
              ))}
            </select>
            {fieldErrors("type")}
          </label>

          <label>
            <span>{t("dashboard.accounts.form.currency")}</span>
            <select
              name="currency_code"
              value={form.currency_code}
              onChange={handleChange}
              disabled={isSaving}
            >
              {/* Keep an existing account's currency even if it isn't in the list. */}
              {[...new Set([...ACCOUNT_CURRENCIES, form.currency_code])].map((currency) => (
                <option value={currency} key={currency}>{currency}</option>
              ))}
            </select>
            {fieldErrors("currency_code")}
          </label>

          <label>
            <span>{t("dashboard.accounts.form.openingBalance")}</span>
            <input
              type="number"
              name="opening_balance"
              value={form.opening_balance}
              onChange={handleChange}
              min="0"
              step="0.0001"
              dir="ltr"
              disabled={isSaving}
              aria-describedby={isEditing ? "account-form-opening-hint" : undefined}
              required
            />
            {isEditing && (
              <em className="account-form-modal__hint" id="account-form-opening-hint">
                {t("dashboard.accounts.form.openingBalanceHint")}
              </em>
            )}
            {fieldErrors("opening_balance")}
          </label>

          <label className="account-form-modal__check">
            <input
              type="checkbox"
              name="allow_negative_balance"
              checked={form.allow_negative_balance}
              onChange={handleChange}
              disabled={isSaving}
            />
            <span>{t("dashboard.accounts.form.allowNegative")}</span>
            {fieldErrors("allow_negative_balance")}
          </label>

          {message && <p className="account-form-modal__error" role="alert">{message}</p>}

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
