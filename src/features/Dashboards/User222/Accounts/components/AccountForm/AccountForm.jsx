import { useState } from "react";

import { ApiError, toMoneyString } from "../../../api/apiClient";

import "./AccountForm.css";

const accountTypes = ["cash", "bank", "wallet", "savings", "custom"];
const currencies = ["ILS", "USD", "EUR", "JOD", "SAR", "AED"];

export default function AccountForm({ account, onSave, onClose }) {
  const isEditing = Boolean(account);
  const [form, setForm] = useState({
    name: account?.name ?? "",
    type: account?.type ?? "cash",
    currency_code: account?.currency_code ?? "ILS",
    opening_balance: account?.opening_balance ?? "0.0000",
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
      ? { name: form.name.trim() }
      : {
          name: form.name.trim(),
          type: form.type,
          currency_code: form.currency_code,
          opening_balance: toMoneyString(form.opening_balance),
        };

    try {
      await onSave(payload);
    } catch (error) {
      setMessage(error.message);
      if (error instanceof ApiError) setErrors(error.errors);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="account-form-modal" role="presentation" onMouseDown={onClose}>
      <section
        className="account-form-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="account-form-title">
            {isEditing ? "تعديل الحساب" : "إضافة حساب جديد"}
          </h2>
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            <span>اسم الحساب</span>
            <input name="name" value={form.name} onChange={handleChange} required />
            {errors.name?.map((error) => <small key={error}>{error}</small>)}
          </label>

          <label>
            <span>نوع الحساب</span>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              disabled={isEditing}
            >
              {accountTypes.map((type) => <option value={type} key={type}>{type}</option>)}
            </select>
            {errors.type?.map((error) => <small key={error}>{error}</small>)}
          </label>

          {!isEditing && (
            <>
              <label>
                <span>العملة</span>
                <select name="currency_code" value={form.currency_code} onChange={handleChange}>
                  {currencies.map((currency) => (
                    <option value={currency} key={currency}>{currency}</option>
                  ))}
                </select>
                {errors.currency_code?.map((error) => <small key={error}>{error}</small>)}
              </label>

              <label>
                <span>الرصيد الافتتاحي</span>
                <input
                  type="number"
                  name="opening_balance"
                  value={form.opening_balance}
                  onChange={handleChange}
                  min="0"
                  step="0.0001"
                  required
                />
                {errors.opening_balance?.map((error) => <small key={error}>{error}</small>)}
              </label>
            </>
          )}

          {message && <p className="account-form-modal__error" role="alert">{message}</p>}

          <footer>
            <button type="button" onClick={onClose}>إلغاء</button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
