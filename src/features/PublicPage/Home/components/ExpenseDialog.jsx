import { useState } from "react";
import { Check, Wallet } from "lucide-react";

import { useLanding } from "../landingContext";
import { CATEGORIES, parseAmount } from "../landingDemo";
import { Dialog, SampleBadge } from "./Shared";

/* Adds an expense to the page's demo state only. Nothing is sent anywhere. */
export default function ExpenseDialog({ open, onClose, onAdd }) {
  const { t } = useLanding();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food");
  const [error, setError] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null || !description.trim()) { setError(true); return; }
    onAdd({ amount: value, description: description.trim(), category });
    setAmount(""); setDescription(""); setCategory("food"); setError(false); onClose();
  };
  return <Dialog open={open} onClose={onClose} title={t("expense.title")}>
    <p className="dialog-description">{t("expense.description")}</p>
    <form onSubmit={submit} className="expense-form" noValidate>
      <div className="demo-account"><span className="tx-icon"><Wallet size={17} /></span><div><strong>{t("expense.account")}</strong><span>{t("expense.accountMeta")}</span></div><SampleBadge>{t("expense.sample")}</SampleBadge></div>
      <div className="field">
        <label htmlFor="expense-description">{t("expense.what")}</label>
        <input id="expense-description" value={description} maxLength={80} onChange={(event) => { setDescription(event.target.value); setError(false); }} placeholder={t("expense.placeholder")} autoComplete="off" required aria-invalid={error && !description.trim()} aria-describedby={error ? "expense-error" : undefined} />
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="expense-amount">{t("expense.amount")}</label><input id="expense-amount" className="num" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(false); }} placeholder="45.00" dir="ltr" autoComplete="off" required aria-invalid={error && parseAmount(amount) === null} aria-describedby={error ? "expense-error" : "expense-hint"} /></div>
        <div className="field"><label htmlFor="expense-category">{t("expense.category")}</label><select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((value) => <option value={value} key={value}>{t(`categories.${value}`)}</option>)}</select></div>
      </div>
      {!error && <p id="expense-hint" className="field-hint">{t("expense.hint")}</p>}
      {error && <p id="expense-error" className="form-error" role="alert">{t("expense.error")}</p>}
      <button type="submit" className="btn btn-primary btn-block form-submit"><span>{t("expense.submit")}</span><Check size={16} /></button>
      <p className="form-note">{t("expense.note")}</p>
    </form>
  </Dialog>;
}
