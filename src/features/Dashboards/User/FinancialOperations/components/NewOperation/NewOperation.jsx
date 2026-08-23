import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  createIdempotencyKey,
  getApiErrorMessage,
} from "../../../api/apiClient";
import { transactionsApi } from "../../../api/transactionsApi";
import { transfersApi } from "../../../api/transfersApi";

import "./NewOperation.css";

const types = [
  "expense",
  "income",
  "transfer",
];

const today = new Date().toISOString().slice(0, 10);

export default function NewOperation({ accounts, categories, onCreated }) {
  const { t } = useTranslation();

  const [type, setType] =
    useState("expense");

  const [form, setForm] = useState({
    amount: "",
    category_id: "",
    account_id: "",
    to_account_id: "",
    note: "",
    date: today,
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const transferKeyRef = useRef(null);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      account_id: current.account_id || String(accounts[0]?.id ?? ""),
      to_account_id:
        current.to_account_id || String(accounts.find((item) => item.id !== accounts[0]?.id)?.id ?? ""),
    }));
  }, [accounts]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      category_id: String(availableCategories[0]?.id ?? ""),
    }));
  }, [availableCategories]);

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
    setHasError(false);
    transferKeyRef.current = null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    setMessage("");
    setHasError(false);

    const occurredAt = form.date ? `${form.date} 12:00:00` : undefined;

    try {
      if (type === "transfer") {
        transferKeyRef.current ??= createIdempotencyKey();
        await transfersApi.create(
          {
            from_account_id: Number(form.account_id),
            to_account_id: Number(form.to_account_id),
            amount: form.amount,
            description: form.note.trim() || undefined,
            occurred_at: occurredAt,
          },
          transferKeyRef.current,
        );
      } else {
        const payload = {
          account_id: Number(form.account_id),
          category_id: form.category_id ? Number(form.category_id) : undefined,
          amount: form.amount,
          description: form.note.trim() || undefined,
          occurred_at: occurredAt,
        };

        if (type === "income") {
          await transactionsApi.createIncome(payload);
        } else {
          await transactionsApi.createExpense(payload);
        }
      }

      setMessage(t("dashboard.financialOperations.messages.created"));
      setHasError(false);
      setForm((current) => ({ ...current, amount: "", note: "" }));
      transferKeyRef.current = null;
      await onCreated?.();
    } catch (error) {
      setMessage(getApiErrorMessage(error, t));
      setHasError(true);
      if (error instanceof ApiError) setErrors(error.errors);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="new-operation">
      <header className="new-operation__header">
        <h2>
          {t(
            "dashboard.financialOperations.newOperation.title",
          )}
        </h2>
      </header>

      <form
        className="new-operation__form"
        onSubmit={handleSubmit}
      >
        <div className="new-operation__types">
          {types.map((item) => (
            <button
              key={item}
              type="button"
              className={
                type === item
                  ? "new-operation__type new-operation__type--active"
                  : "new-operation__type"
              }
              onClick={() => {
                setType(item);
                transferKeyRef.current = null;
                setMessage("");
                setHasError(false);
                setErrors({});
              }}
              disabled={isSubmitting}
            >
              {t(
                `dashboard.financialOperations.types.${item}`,
              )}
            </button>
          ))}
        </div>

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.amount",
            )}
          </span>

          <input
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            placeholder="0.00"
            min="0.0001"
            step="0.0001"
            disabled={isSubmitting}
            required
          />
          {errors.amount?.map((error) => <small key={error}>{error}</small>)}
        </label>

        {type !== "transfer" && (
        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.category",
            )}
          </span>

          <select
            name="category_id"
            value={form.category_id}
            onChange={handleChange}
            disabled={isSubmitting || availableCategories.length === 0}
            required={type === "expense"}
          >
            {availableCategories.length === 0 && (
              <option value="">
                {t("dashboard.financialOperations.form.noCategories")}
              </option>
            )}
            {availableCategories.map((category) => (
              <option value={category.id} key={category.id}>{category.name}</option>
            ))}
          </select>
          {errors.category_id?.map((error) => <small key={error}>{error}</small>)}
        </label>
        )}

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.account",
            )}
          </span>

          <select
            name="account_id"
            value={form.account_id}
            onChange={handleChange}
            disabled={isSubmitting || accounts.length === 0}
            required
          >
            {accounts.length === 0 && (
              <option value="">
                {t("dashboard.financialOperations.form.noAccounts")}
              </option>
            )}
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name} ({account.current_balance} {account.currency_code})
              </option>
            ))}
          </select>
          {errors.account_id?.map((error) => <small key={error}>{error}</small>)}
        </label>

        {type === "transfer" && (
          <label className="new-operation__field">
            <span>{t("dashboard.financialOperations.form.destinationAccount")}</span>
            <select
              name="to_account_id"
              value={form.to_account_id}
              onChange={handleChange}
              disabled={isSubmitting || accounts.length < 2}
              required
            >
              <option value="">
                {t("dashboard.financialOperations.form.selectDestinationAccount")}
              </option>
              {accounts
                .filter((account) => String(account.id) !== String(form.account_id))
                .map((account) => (
                  <option value={account.id} key={account.id}>{account.name}</option>
                ))}
            </select>
            {errors.to_account_id?.map((error) => <small key={error}>{error}</small>)}
          </label>
        )}

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.note",
            )}
          </span>

          <input
            type="text"
            name="note"
            value={form.note}
            onChange={handleChange}
            placeholder={t(
              "dashboard.financialOperations.form.notePlaceholder",
            )}
            disabled={isSubmitting}
          />
        </label>

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.date",
            )}
          </span>

          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
        </label>

        <button
          type="submit"
          className="new-operation__submit"
          disabled={isSubmitting || accounts.length === 0}
        >
          {isSubmitting
            ? t("common.saving")
            : t("dashboard.financialOperations.form.submit")}
        </button>

        {message && (
          <p className={hasError ? "new-operation__message new-operation__message--error" : "new-operation__message"} role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
