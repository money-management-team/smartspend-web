import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  getNewTransferPath,
  getTransactionDetailsPath,
} from "../../../../../../routes/Path";
import { getApiErrorMessage } from "../../../api/apiClient";
import { transactionsApi } from "../../../api/transactionsApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";
import {
  createIdempotentAttempt,
  getAmountError,
  getTodayInputValue,
  getTransactionErrorMessage,
  isInsufficientBalanceError,
  isTransactionEntity,
  toOccurredAt,
} from "../../transactionHelpers";

import "./NewOperation.css";

const OPERATION_TYPES = ["expense", "income"];

const UNKNOWN_OUTCOME = ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "MALFORMED_RESPONSE"];

const emptyForm = () => ({
  amount: "",
  category_id: "",
  account_id: "",
  note: "",
  reference_number: "",
  date: getTodayInputValue(),
});

/*
 * Records income and expenses (POST /transactions/income|expense). Every write
 * carries an Idempotency-Key that stays the same while the user retries the
 * same payload, so a double click or a retry after a timeout can't record the
 * money twice.
 *
 * Transfers are not recorded here: they move money between two accounts and
 * are neither income nor expense, so they live in the Transfers section.
 */
export default function NewOperation({
  accounts,
  categories,
  initialType = "expense",
  isLoadingOptions = false,
  optionsError = null,
  onRetryOptions,
  onCreated,
}) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  const [type, setType] = useState(() =>
    OPERATION_TYPES.includes(initialType) ? initialType : "expense",
  );
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  // { tone: "success" | "error", text, hint?, transactionId? }
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRef = useRef(false);
  const [attempt] = useState(() => createIdempotentAttempt("operation"));

  const isExpense = type === "expense";

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  const sourceAccount =
    accounts.find((account) => String(account.id) === String(form.account_id)) ??
    accounts[0] ??
    null;
  const sourceAccountId = String(sourceAccount?.id ?? "");

  // Income: "" means no category (optional). Expense: must be chosen.
  const selectedCategoryId = availableCategories.some(
    (category) => String(category.id) === String(form.category_id),
  )
    ? String(form.category_id)
    : "";

  const isSubmitDisabled =
    isSubmitting ||
    isLoadingOptions ||
    !sourceAccountId ||
    (isExpense && availableCategories.length === 0);

  const clearFeedback = () => {
    setFeedback(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    clearFeedback();
  };

  const selectType = (item) => {
    if (item === type || pendingRef.current) return;
    setType(item);
    setErrors({});
    clearFeedback();
  };

  const validate = () => {
    const nextErrors = {};
    const amountError = getAmountError(form.amount);

    if (amountError) nextErrors.amount = [t(`dashboard.transactions.validation.${amountError}`)];
    if (!sourceAccountId) nextErrors.account_id = [t("dashboard.transactions.validation.accountRequired")];
    if (isExpense && !selectedCategoryId) {
      nextErrors.category_id = [t("dashboard.transactions.validation.categoryRequired")];
    }

    return nextErrors;
  };

  const buildRequest = () => {
    const payload = {
      account_id: Number(sourceAccountId),
      category_id: selectedCategoryId ? Number(selectedCategoryId) : undefined,
      amount: form.amount.trim(),
      description: form.note.trim() || undefined,
      reference_number: form.reference_number.trim() || undefined,
      occurred_at: toOccurredAt(form.date),
    };

    return {
      payload,
      send: (key) =>
        type === "income"
          ? transactionsApi.createIncome(payload, key)
          : transactionsApi.createExpense(payload, key),
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const { payload, send } = buildRequest();
    const idempotencyKey = attempt.keyFor({ type, ...payload });

    pendingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    clearFeedback();

    let response;

    try {
      response = await send(idempotencyKey);
      attempt.settle(null);
    } catch (error) {
      attempt.settle(error);

      if (error?.code === "VALIDATION_ERROR") setErrors(error.errors ?? {});
      setFeedback({
        tone: "error",
        text:
          error?.code === "UNAUTHENTICATED"
            ? getApiErrorMessage(error, t)
            : getTransactionErrorMessage(error, t, "create"),
        hint: isInsufficientBalanceError(error)
          ? t("dashboard.transactions.errors.insufficientBalanceHint")
          : UNKNOWN_OUTCOME.includes(error?.code)
            ? t("dashboard.transactions.errors.unknownOutcome")
            : "",
      });
      pendingRef.current = false;
      setIsSubmitting(false);

      // The outcome is unknown: refresh so the list shows it if it was saved.
      if (UNKNOWN_OUTCOME.includes(error?.code)) onCreated?.();
      return;
    }

    const created = response?.data?.transaction;
    setFeedback({
      tone: "success",
      text: t(
        type === "income"
          ? "dashboard.financialOperations.messages.incomeCreated"
          : "dashboard.financialOperations.messages.expenseCreated",
      ),
      transactionId: isTransactionEntity(created) ? created.id : null,
    });
    setForm((current) => ({
      ...current,
      amount: "",
      note: "",
      reference_number: "",
    }));

    pendingRef.current = false;
    setIsSubmitting(false);
    // Balances and the list come back from the backend; nothing is
    // recalculated here.
    onCreated?.();
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  return (
    <section className="new-operation" id="new-operation">
      <header className="new-operation__header">
        <h2>{t("dashboard.financialOperations.newOperation.title")}</h2>
      </header>

      <form className="new-operation__form" onSubmit={handleSubmit} noValidate>
        <div
          className="new-operation__types"
          role="group"
          aria-label={t("dashboard.transactions.fields.type")}
        >
          {OPERATION_TYPES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={type === item}
              className={
                type === item
                  ? "new-operation__type new-operation__type--active"
                  : "new-operation__type"
              }
              onClick={() => selectType(item)}
              disabled={isSubmitting}
            >
              {t(`dashboard.financialOperations.newOperation.${item}`)}
            </button>
          ))}
        </div>

        {optionsError && (
          <p className="new-operation__message new-operation__message--error" role="alert">
            {getApiErrorMessage(optionsError, t)}{" "}
            <button type="button" className="new-operation__link" onClick={onRetryOptions}>
              {t("common.retry")}
            </button>
          </p>
        )}

        <label className="new-operation__field">
          <span>{t("dashboard.transactions.fields.amount")}</span>
          <input
            name="amount"
            value={form.amount}
            onChange={handleChange}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            disabled={isSubmitting}
            aria-invalid={errors.amount ? true : undefined}
            required
          />
          {fieldErrors("amount")}
          {fieldErrors("currency_code")}
        </label>

        <label className="new-operation__field">
          <span>
            {t("dashboard.transactions.fields.category")}
            {!isExpense && ` (${t("dashboard.transactions.form.optional")})`}
          </span>

          <select
            name="category_id"
            value={selectedCategoryId}
            onChange={handleChange}
            disabled={isSubmitting || availableCategories.length === 0}
            aria-invalid={errors.category_id ? true : undefined}
            required={isExpense}
          >
            {availableCategories.length === 0 ? (
              <option value="">{t("dashboard.financialOperations.form.noCategories")}</option>
            ) : (
              <option value="" disabled={isExpense}>
                {t(
                  isExpense
                    ? "dashboard.transactions.form.selectCategory"
                    : "dashboard.transactions.form.noCategory",
                )}
              </option>
            )}
            {availableCategories.map((category) => (
              <option value={category.id} key={category.id}>{category.name}</option>
            ))}
          </select>
          {fieldErrors("category_id")}
        </label>

        <label className="new-operation__field">
          <span>{t("dashboard.transactions.fields.account")}</span>

          <select
            name="account_id"
            value={sourceAccountId}
            onChange={handleChange}
            disabled={isSubmitting || accounts.length === 0}
            aria-invalid={errors.account_id ? true : undefined}
            required
          >
            {accounts.length === 0 && (
              <option value="">{t("dashboard.financialOperations.form.noAccounts")}</option>
            )}
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name} ({formatMoney(account.current_balance, account.currency_code, locale)})
              </option>
            ))}
          </select>
          {fieldErrors("account_id")}
        </label>

        <label className="new-operation__field">
          <span>{t("dashboard.financialOperations.form.note")}</span>
          <input
            type="text"
            name="note"
            value={form.note}
            onChange={handleChange}
            placeholder={t("dashboard.financialOperations.form.notePlaceholder")}
            maxLength={255}
            dir="auto"
            disabled={isSubmitting}
          />
          {fieldErrors("description")}
        </label>

        <label className="new-operation__field">
          <span>
            {t("dashboard.transactions.fields.referenceNumber")} (
            {t("dashboard.transactions.form.optional")})
          </span>
          <input
            type="text"
            name="reference_number"
            value={form.reference_number}
            onChange={handleChange}
            maxLength={100}
            dir="auto"
            disabled={isSubmitting}
          />
          {fieldErrors("reference_number")}
        </label>

        <label className="new-operation__field">
          <span>{t("dashboard.transactions.fields.date")}</span>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
          {fieldErrors("occurred_at")}
        </label>

        <button
          type="submit"
          className="new-operation__submit"
          disabled={isSubmitDisabled}
          aria-busy={isSubmitting || undefined}
        >
          {isSubmitting
            ? t("common.saving")
            : t(`dashboard.financialOperations.form.submit.${type}`)}
        </button>

        {feedback && (
          <div
            className={
              feedback.tone === "error"
                ? "new-operation__message new-operation__message--error"
                : "new-operation__message"
            }
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            <p dir="auto">{feedback.text}</p>
            {feedback.hint && <p>{feedback.hint}</p>}
            {errors.idempotency_key?.map((error) => <p key={error}>{error}</p>)}
            {feedback.transactionId != null && (
              <Link
                className="new-operation__link"
                to={getTransactionDetailsPath(feedback.transactionId)}
              >
                {t("dashboard.financialOperations.messages.viewTransaction")}
              </Link>
            )}
          </div>
        )}

        {/* Transfers move money between two accounts, so they are recorded in
            their own section instead of being duplicated here. */}
        <p className="new-operation__transfer-hint">
          {t("dashboard.financialOperations.newOperation.transferHint")}{" "}
          <Link className="new-operation__link" to={getNewTransferPath()}>
            {t("dashboard.transfers.add")}
          </Link>
        </p>
      </form>
    </section>
  );
}
