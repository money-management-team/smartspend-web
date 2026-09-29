import { useMemo, useState } from "react";
import { LuArrowRight, LuWalletCards } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getNewTransferPath } from "../../../../../../routes/Path";
import { getApiErrorMessage } from "../../../api/apiClient";
import { getAmountError, getTodayInputValue } from "../../transactionHelpers";

import "./NewOperation.css";

const OPERATION_TYPES = ["expense", "income"];

const emptyForm = () => ({
  amount: "",
  category_id: "",
  note: "",
  reference_number: "",
  date: getTodayInputValue(),
});

/*
 * Manual entry panel of the capture card. It collects the operation and hands
 * it to the review dialog, which is what actually posts it
 * (POST /transactions/income|expense) — every input method ends at the same
 * review step, so nothing is recorded straight from a form.
 *
 * Transfers are not recorded here: they move money between two accounts and
 * are neither income nor expense, so they live in the Transfers section.
 */
export default function NewOperation({
  account,
  categories,
  initialType = "expense",
  isLoadingOptions = false,
  optionsError = null,
  onRetryOptions,
  onRequireAccount,
  onReview,
}) {
  const { t } = useTranslation();

  const [type, setType] = useState(() =>
    OPERATION_TYPES.includes(initialType) ? initialType : "expense",
  );
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const isExpense = type === "expense";

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  // Income: "" means no category (optional). Expense: must be chosen.
  const selectedCategoryId = availableCategories.some(
    (category) => String(category.id) === String(form.category_id),
  )
    ? String(form.category_id)
    : "";

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const selectType = (item) => {
    if (item === type) return;
    setType(item);
    setErrors({});
  };

  const validate = () => {
    const nextErrors = {};
    const amountError = getAmountError(form.amount);

    if (amountError) nextErrors.amount = t(`dashboard.transactions.validation.${amountError}`);
    if (isExpense && !selectedCategoryId) {
      nextErrors.category_id = t("dashboard.transactions.validation.categoryRequired");
    }

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!onRequireAccount()) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onReview({
      type,
      method: "manual",
      amount: form.amount.trim(),
      category_id: selectedCategoryId,
      description: form.note.trim(),
      reference_number: form.reference_number.trim(),
      date: form.date,
      // Clears the panel once the operation is actually recorded.
      onRecorded: () => setForm(emptyForm()),
    });
  };

  return (
    <form className="capture-panel new-operation" onSubmit={handleSubmit} noValidate>
      <div className="new-operation__heading">
        <span className="capture-panel__kicker">
          {t("dashboard.financialOperations.manual.kicker")}
        </span>

        <h3>{t("dashboard.financialOperations.manual.title")}</h3>
        <p>{t("dashboard.financialOperations.manual.description")}</p>
      </div>

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
          >
            {t(`dashboard.financialOperations.newOperation.${item}`)}
          </button>
        ))}
      </div>

      {optionsError && (
        <p className="new-operation__error" role="alert">
          {getApiErrorMessage(optionsError, t)}{" "}
          <button type="button" className="new-operation__link" onClick={onRetryOptions}>
            {t("common.retry")}
          </button>
        </p>
      )}

      <label className="new-operation__amount">
        <span>{t("dashboard.transactions.fields.amount")}</span>

        <div>
          <input
            name="amount"
            value={form.amount}
            onChange={handleChange}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            aria-invalid={errors.amount ? true : undefined}
            required
          />
          {account && <b>{account.currency_code}</b>}
        </div>

        {errors.amount && <small>{errors.amount}</small>}
      </label>

      <div className="new-operation__grid">
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
          />
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
            disabled={isLoadingOptions || availableCategories.length === 0}
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

          {errors.category_id && <small>{errors.category_id}</small>}
        </label>

        <label className="new-operation__field">
          <span>{t("dashboard.transactions.fields.date")}</span>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
          />
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
          />
        </label>

        {/* The account comes from step 1, so it is shown, not chosen again. */}
        <div className="new-operation__field new-operation__account">
          <span>{t("dashboard.transactions.fields.account")}</span>

          <div>
            <LuWalletCards aria-hidden="true" />
            <bdi>
              {account
                ? account.name
                : t("dashboard.financialOperations.captureStep.chooseAccountAbove")}
            </bdi>
          </div>
        </div>
      </div>

      <div className="new-operation__footer">
        <button type="submit" className="capture-action" disabled={isLoadingOptions}>
          {t(`dashboard.financialOperations.review.open.${type}`)}
          <LuArrowRight aria-hidden="true" />
        </button>

        {/* Transfers move money between two accounts, so they are recorded in
            their own section instead of being duplicated here. */}
        <p className="new-operation__transfer-hint">
          {t("dashboard.financialOperations.newOperation.transferHint")}{" "}
          <Link className="new-operation__link" to={getNewTransferPath()}>
            {t("dashboard.transfers.add")}
          </Link>
        </p>
      </div>
    </form>
  );
}
