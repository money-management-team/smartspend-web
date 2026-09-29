import { useMemo, useRef, useState } from "react";
import {
  LuArrowRight,
  LuCheck,
  LuLock,
  LuPencil,
  LuShieldCheck,
  LuTriangleAlert,
  LuX,
} from "react-icons/lu";
import { useTranslation } from "react-i18next";

import logo from "../../../../../../assets/smart-spend-logo.png";
import {
  getAmountError,
  getTransactionErrorMessage,
  isInsufficientBalanceError,
} from "../../transactionHelpers";
import {
  getDisplayLocale,
  isNegativeMoney,
} from "../../../Accounts/accountHelpers";
import { formatMoney, subtractMoney, sumMoney } from "../../../utils/formatters";

// The dialog's buttons are the capture card's (.capture-action).
import "../CaptureStep/CaptureStep.css";
import "./ReviewOperationDialog.css";

// Codes after which it is unknown whether the operation was recorded.
const UNKNOWN_OUTCOME = ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "MALFORMED_RESPONSE"];

/*
 * Receipt-style confirmation: the last step of every input method. Nothing is
 * recorded until the confirm button is pressed here, and the amount, note,
 * category and date can still be corrected in place first.
 *
 * `onConfirm(operation)` performs POST /transactions/income|expense and
 * throws on failure; errors stay inside the dialog.
 */
export default function ReviewOperationDialog({
  draft,
  account,
  categories,
  onConfirm,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const pendingRef = useRef(false);

  const [operation, setOperation] = useState(draft);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  const isExpense = operation.type === "expense";

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === operation.type),
    [categories, operation.type],
  );

  const category = availableCategories.find(
    (item) => String(item.id) === String(operation.category_id),
  );

  // Balances stay the backend's decimal strings; the arithmetic is exact.
  const balance = account?.current_balance ?? "0";
  const amountForMath = getAmountError(operation.amount) ? "0" : operation.amount;
  const balanceAfter = isExpense
    ? subtractMoney(balance, amountForMath)
    : sumMoney([balance, amountForMath]);
  const isOverBalance = isExpense && isNegativeMoney(balanceAfter);

  const change = (name, value) => {
    setOperation((previous) => ({ ...previous, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFeedback(null);
  };

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const validate = () => {
    const nextErrors = {};
    const amountError = getAmountError(operation.amount);

    if (amountError) nextErrors.amount = t(`dashboard.transactions.validation.${amountError}`);
    if (isExpense && !operation.category_id) {
      nextErrors.category_id = t("dashboard.transactions.validation.categoryRequired");
    }

    return nextErrors;
  };

  const handleConfirm = async () => {
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setIsEditing(true);
      return;
    }

    pendingRef.current = true;
    setIsSaving(true);
    setErrors({});
    setFeedback(null);

    try {
      await onConfirm(operation);
      // The page closes the dialog and shows the result.
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        setFeedback({
          text: getTransactionErrorMessage(error, t, "create"),
          hint: isInsufficientBalanceError(error)
            ? t("dashboard.transactions.errors.insufficientBalanceHint")
            : UNKNOWN_OUTCOME.includes(error?.code)
              ? t("dashboard.transactions.errors.unknownOutcome")
              : "",
          details: Object.values(error?.errors ?? {}).flat(),
        });
      }

      pendingRef.current = false;
      setIsSaving(false);
    }
  };

  const line = (label, value) => (
    <div className="receipt__line">
      <span>{label}</span>
      <b dir="auto">{value}</b>
    </div>
  );

  return (
    <div
      className="review-dialog"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="review-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-operation-title"
        aria-describedby="review-operation-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="review-dialog__close"
          onClick={close}
          disabled={isSaving}
          aria-label={t("common.close")}
        >
          <LuX aria-hidden="true" />
        </button>

        <header className="review-dialog__header">
          <span className="review-dialog__header-icon" aria-hidden="true">
            <LuShieldCheck />
          </span>

          <div>
            <span className="review-dialog__badge">
              {t("dashboard.financialOperations.review.badge")}
            </span>
            <h2 id="review-operation-title">
              {t("dashboard.financialOperations.review.title")}
            </h2>
            <p id="review-operation-description">
              {t("dashboard.financialOperations.review.description")}
            </p>
          </div>
        </header>

        <div className="receipt">
          <div className="receipt__brand">
            <div>
              <img src={logo} alt="" aria-hidden="true" />
              <div>
                {/* The brand name is not translated, as in the sidebar. */}
                <strong>Smart Spend</strong>
                <span>
                  {t(`dashboard.financialOperations.newOperation.${operation.type}`)}
                </span>
              </div>
            </div>

            <span className="receipt__status">
              <LuLock aria-hidden="true" />
              {t("dashboard.financialOperations.review.badge")}
            </span>
          </div>

          <div className="receipt__dots" aria-hidden="true" />

          <div className="receipt__total">
            <span>{t("dashboard.financialOperations.review.total")}</span>

            {isEditing ? (
              <div className="receipt__total-edit">
                <input
                  value={operation.amount}
                  onChange={(event) => change("amount", event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  dir="ltr"
                  aria-label={t("dashboard.transactions.fields.amount")}
                  aria-invalid={errors.amount ? true : undefined}
                />
                <b>{account?.currency_code}</b>
              </div>
            ) : (
              <strong dir="ltr">
                {formatMoney(operation.amount, account?.currency_code, locale)}
              </strong>
            )}

            {errors.amount && <small role="alert">{errors.amount}</small>}
          </div>

          <div className="receipt__lines">
            <div className="receipt__line">
              <span>{t("dashboard.transactions.fields.description")}</span>

              {isEditing ? (
                <input
                  value={operation.description}
                  onChange={(event) => change("description", event.target.value)}
                  maxLength={255}
                  dir="auto"
                  aria-label={t("dashboard.transactions.fields.description")}
                />
              ) : (
                <b dir="auto">
                  {operation.description ||
                    t("dashboard.financialOperations.review.noDescription")}
                </b>
              )}
            </div>

            <div className="receipt__line">
              <span>{t("dashboard.transactions.fields.category")}</span>

              {isEditing ? (
                <select
                  value={operation.category_id}
                  onChange={(event) => change("category_id", event.target.value)}
                  aria-label={t("dashboard.transactions.fields.category")}
                  aria-invalid={errors.category_id ? true : undefined}
                >
                  <option value="" disabled={isExpense}>
                    {t("dashboard.financialOperations.review.noCategory")}
                  </option>
                  {availableCategories.map((item) => (
                    <option value={String(item.id)} key={item.id}>{item.name}</option>
                  ))}
                </select>
              ) : (
                <b dir="auto">
                  {category?.name ?? t("dashboard.financialOperations.review.noCategory")}
                </b>
              )}
            </div>

            {errors.category_id && (
              <div className="receipt__line receipt__line--error" role="alert">
                <span />
                <b>{errors.category_id}</b>
              </div>
            )}

            {line(
              t("dashboard.transactions.fields.account"),
              account
                ? `${account.name}${
                    account.last_four_digits ? ` •••• ${account.last_four_digits}` : ""
                  }`
                : "—",
            )}

            {line(
              t("dashboard.financialOperations.review.method"),
              t(`dashboard.financialOperations.review.methods.${operation.method}`),
            )}

            <div className="receipt__line">
              <span>{t("dashboard.transactions.fields.date")}</span>

              {isEditing ? (
                <input
                  type="date"
                  value={operation.date}
                  onChange={(event) => change("date", event.target.value)}
                  aria-label={t("dashboard.transactions.fields.date")}
                />
              ) : (
                <b dir="ltr">{operation.date}</b>
              )}
            </div>

            {operation.reference_number &&
              line(
                t("dashboard.transactions.fields.referenceNumber"),
                operation.reference_number,
              )}
          </div>

          <div className="receipt__divider" aria-hidden="true">
            <i />
            <span>✦</span>
            <i />
          </div>

          <div className="receipt__balance">
            <div>
              <span>{t("dashboard.financialOperations.review.balanceBefore")}</span>
              <b dir="ltr">{formatMoney(balance, account?.currency_code, locale)}</b>
            </div>

            <LuArrowRight className="receipt__balance-arrow" aria-hidden="true" />

            <div>
              <span>{t("dashboard.financialOperations.review.balanceAfter")}</span>
              <b dir="ltr">{formatMoney(balanceAfter, account?.currency_code, locale)}</b>
            </div>
          </div>

          {isOverBalance && (
            <p className="receipt__warning">
              <LuTriangleAlert aria-hidden="true" />
              {t("dashboard.financialOperations.review.insufficient")}
            </p>
          )}
        </div>

        {feedback && (
          <div className="review-dialog__error" role="alert">
            <p dir="auto">{feedback.text}</p>
            {feedback.hint && <p>{feedback.hint}</p>}
            {feedback.details.map((detail) => (
              <p key={detail} dir="auto">{detail}</p>
            ))}
          </div>
        )}

        <footer className="review-dialog__actions">
          <button
            type="button"
            className="capture-action capture-action--soft"
            onClick={() => setIsEditing((value) => !value)}
            disabled={isSaving}
          >
            {isEditing ? <LuCheck aria-hidden="true" /> : <LuPencil aria-hidden="true" />}
            {t(
              isEditing
                ? "dashboard.financialOperations.review.saveChanges"
                : "dashboard.financialOperations.review.edit",
            )}
          </button>

          <button
            type="button"
            className="capture-action"
            onClick={handleConfirm}
            disabled={isSaving}
            aria-busy={isSaving || undefined}
          >
            {isSaving
              ? t("dashboard.financialOperations.review.confirming")
              : t(`dashboard.financialOperations.review.confirm.${operation.type}`)}
          </button>
        </footer>
      </section>
    </div>
  );
}
