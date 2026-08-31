import { useMemo, useRef, useState } from "react";
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

function getLocalDateInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function NewOperation({ accounts, categories, onCreated }) {
  const { t } = useTranslation();

  const [type, setType] =
    useState("expense");

  const [form, setForm] = useState(() => ({
    amount: "",
    category_id: "",
    account_id: "",
    to_account_id: "",
    fee_amount: "",
    fee_category_id: "",
    note: "",
    date: getLocalDateInputValue(),
  }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const transferAttemptRef = useRef(null);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  const sourceAccount =
    accounts.find((account) => String(account.id) === String(form.account_id)) ??
    accounts[0] ??
    null;
  const sourceAccountId = String(sourceAccount?.id ?? "");

  const selectedCategory =
    availableCategories.find(
      (category) => String(category.id) === String(form.category_id),
    ) ?? availableCategories[0] ?? null;
  const selectedCategoryId = String(selectedCategory?.id ?? "");

  const destinationAccounts = accounts.filter(
    (account) =>
      String(account.id) !== sourceAccountId &&
      account.currency_code === sourceAccount?.currency_code,
  );
  const destinationAccount =
    destinationAccounts.find(
      (account) => String(account.id) === String(form.to_account_id),
    ) ?? destinationAccounts[0] ?? null;
  const destinationAccountId = String(destinationAccount?.id ?? "");

  const selectedFeeCategory =
    expenseCategories.find(
      (category) => String(category.id) === String(form.fee_category_id),
    ) ?? expenseCategories[0] ?? null;
  const selectedFeeCategoryId = String(selectedFeeCategory?.id ?? "");
  const hasTransferFee = Number(form.fee_amount) > 0;
  const isSubmitDisabled =
    isSubmitting ||
    !sourceAccountId ||
    (type === "expense" && !selectedCategoryId) ||
    (type === "transfer" &&
      (!destinationAccountId || (hasTransferFee && !selectedFeeCategoryId)));

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === "account_id" ? { to_account_id: undefined } : {}),
      ...(name === "fee_amount" ? { fee_category_id: undefined } : {}),
    }));
    setMessage("");
    setHasError(false);
    transferAttemptRef.current = null;
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
        const payload = {
          from_account_id: Number(sourceAccountId),
          to_account_id: Number(destinationAccountId),
          amount: form.amount,
          description: form.note.trim() || undefined,
          occurred_at: occurredAt,
        };

        if (hasTransferFee) {
          payload.fee_amount = form.fee_amount;
          payload.fee_category_id = Number(selectedFeeCategoryId);
        }

        const fingerprint = JSON.stringify(payload);

        if (transferAttemptRef.current?.fingerprint !== fingerprint) {
          transferAttemptRef.current = {
            fingerprint,
            key: createIdempotencyKey(),
          };
        }

        await transfersApi.create(payload, transferAttemptRef.current.key);
      } else {
        const payload = {
          account_id: Number(sourceAccountId),
          category_id: selectedCategoryId
            ? Number(selectedCategoryId)
            : undefined,
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
    } catch (error) {
      setMessage(getApiErrorMessage(error, t));
      setHasError(true);
      if (error instanceof ApiError) setErrors(error.errors);
      setIsSubmitting(false);
      return;
    }

    setMessage(t("dashboard.financialOperations.messages.created"));
    setHasError(false);
    setForm((current) => ({
      ...current,
      amount: "",
      fee_amount: "",
      note: "",
    }));
    transferAttemptRef.current = null;

    try {
      await onCreated?.();
    } catch (refreshError) {
      console.error("The operation was saved, but refreshing the ledger failed.", refreshError);
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
                if (item === type) return;
                setType(item);
                transferAttemptRef.current = null;
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
            value={selectedCategoryId}
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
            value={sourceAccountId}
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
              value={destinationAccountId}
              onChange={handleChange}
              disabled={isSubmitting || destinationAccounts.length === 0}
              required
            >
              <option value="">
                {t("dashboard.financialOperations.form.selectDestinationAccount")}
              </option>
              {destinationAccounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name} ({account.currency_code})
                </option>
              ))}
            </select>
            {errors.to_account_id?.map((error) => <small key={error}>{error}</small>)}
          </label>
        )}

        {type === "transfer" && (
          <>
            <label className="new-operation__field">
              <span>{t("dashboard.financialOperations.types.fee")}</span>
              <input
                type="number"
                name="fee_amount"
                value={form.fee_amount}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.0001"
                disabled={isSubmitting}
              />
              {errors.fee_amount?.map((error) => <small key={error}>{error}</small>)}
            </label>

            <label className="new-operation__field">
              <span>{t("dashboard.financialOperations.form.category")}</span>
              <select
                name="fee_category_id"
                value={selectedFeeCategoryId}
                onChange={handleChange}
                disabled={isSubmitting || expenseCategories.length === 0}
                required={hasTransferFee}
              >
                {expenseCategories.length === 0 && (
                  <option value="">
                    {t("dashboard.financialOperations.form.noCategories")}
                  </option>
                )}
                {expenseCategories.map((category) => (
                  <option value={category.id} key={category.id}>{category.name}</option>
                ))}
              </select>
              {errors.fee_category_id?.map((error) => <small key={error}>{error}</small>)}
            </label>
          </>
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
          disabled={isSubmitDisabled}
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
