import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { accountsApi } from "../../../api/accountsApi";
import { categoriesApi } from "../../../api/categoriesApi";
import { getApiErrorMessage, toMoneyString } from "../../../api/apiClient";
import {
  REASON_MAX,
  REASON_MIN,
  createIdempotentAttempt,
  getAmountError,
  getPrimaryAccount,
  getTransactionErrorMessage,
  isInsufficientBalanceError,
  toAmountInput,
  toDateInputValue,
  toOccurredAt,
} from "../../transactionHelpers";

// Same modal shell as the other dashboard dialogs; the textarea and error
// block styles live with the reverse dialog.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./CorrectTransactionForm.css";

// Backend field → form field.
const FIELD_OF = { occurred_at: "date" };
const UNKNOWN_OUTCOME = ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "MALFORMED_RESPONSE"];

const toFormValues = (transaction, timeZone) => ({
  account_id: String(getPrimaryAccount(transaction)?.id ?? ""),
  category_id: transaction.category_id != null ? String(transaction.category_id) : "",
  amount: toAmountInput(transaction.amount),
  description: transaction.description ?? "",
  reference_number: transaction.reference_number ?? "",
  date: toDateInputValue(transaction.occurred_at, timeZone),
});

// Only what the user changed; cleared optional text is sent as null.
function buildChanges(form, initial) {
  const changes = {};
  const text = (value) => value.trim();

  if (form.account_id !== initial.account_id) changes.account_id = Number(form.account_id);
  if (form.category_id !== initial.category_id) {
    changes.category_id = form.category_id ? Number(form.category_id) : null;
  }
  if (toMoneyString(form.amount.trim()) !== toMoneyString(initial.amount)) {
    changes.amount = form.amount.trim();
  }
  if (text(form.description) !== text(initial.description)) {
    changes.description = text(form.description) || null;
  }
  if (text(form.reference_number) !== text(initial.reference_number)) {
    changes.reference_number = text(form.reference_number) || null;
  }
  if (form.date && form.date !== initial.date) changes.occurred_at = toOccurredAt(form.date);

  return changes;
}

/*
 * Correction of a posted income/expense (PATCH /transactions/{id}). This is
 * not an in-place edit: the backend reverses the original and posts a NEW
 * replacement with a new id. `onSave(payload, idempotencyKey)` performs the
 * request (and navigation) and throws on failure.
 */
export default function CorrectTransactionForm({ transaction, onSave, onClose }) {
  const { t } = useTranslation();
  const { user, workspace } = useAuthContext();
  const timeZone = user?.timezone ?? workspace?.timezone;
  const isExpense = transaction.type === "expense";

  const [initial] = useState(() => toFormValues(transaction, timeZone));
  const [form, setForm] = useState(initial);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRef = useRef(false);
  const [attempt] = useState(() => createIdempotentAttempt("correction"));

  // Account and category choices, from the same workspace as the transaction.
  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState({ key: null, accounts: [], categories: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const workspaceId = transaction.workspace_id ?? undefined;

    Promise.all([
      accountsApi.list({ id_workspace: workspaceId }, { signal }),
      categoriesApi.list({ type: transaction.type, workspace_id: workspaceId }, { signal }),
    ])
      .then(([accountsResponse, categoriesResponse]) => {
        setOptions({
          key: reloadKey,
          accounts: accountsResponse.data?.accounts ?? [],
          categories: categoriesResponse.data?.categories ?? [],
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        setOptions({ key: reloadKey, accounts: [], categories: [], error });
      });

    return () => controller.abort();
  }, [reloadKey, transaction.type, transaction.workspace_id]);

  const isLoadingOptions = options.key !== reloadKey;

  // Keep the current account/category selectable even if it has since been
  // archived (only active ones are listed); it just can't be picked again.
  const primaryAccount = getPrimaryAccount(transaction);
  const accountOptions = [...options.accounts];
  if (initial.account_id && !accountOptions.some((item) => String(item.id) === initial.account_id)) {
    accountOptions.unshift({ ...primaryAccount, id: initial.account_id, unavailable: true });
  }
  const categoryOptions = options.categories.filter((item) => item.type === transaction.type);
  if (initial.category_id && !categoryOptions.some((item) => String(item.id) === initial.category_id)) {
    categoryOptions.unshift({
      ...(transaction.category ?? {}),
      id: initial.category_id,
      unavailable: true,
    });
  }

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined, changes: undefined }));
    setMessage("");
    setHint("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;

    const nextErrors = {};
    const amountError = getAmountError(form.amount);
    const trimmedReason = reason.trim();
    const changes = buildChanges(form, initial);

    if (!form.account_id) nextErrors.account_id = [t("dashboard.transactions.validation.accountRequired")];
    if (isExpense && !form.category_id) {
      nextErrors.category_id = [t("dashboard.transactions.validation.categoryRequired")];
    }
    if (amountError) nextErrors.amount = [t(`dashboard.transactions.validation.${amountError}`)];
    if (trimmedReason.length < REASON_MIN || trimmedReason.length > REASON_MAX) {
      nextErrors.reason = [
        t("dashboard.transactions.validation.reasonLength", { min: REASON_MIN, max: REASON_MAX }),
      ];
    }
    if (Object.keys(nextErrors).length === 0 && Object.keys(changes).length === 0) {
      nextErrors.changes = [t("dashboard.transactions.validation.noChanges")];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = { reason: trimmedReason, ...changes };
    const idempotencyKey = attempt.keyFor({ id: transaction.id, ...payload });

    pendingRef.current = true;
    setIsSaving(true);
    setErrors({});
    setMessage("");
    setHint("");

    try {
      await onSave(payload, idempotencyKey);
      attempt.settle(null);
    } catch (error) {
      attempt.settle(error);

      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        if (error?.code === "VALIDATION_ERROR") {
          setErrors(
            Object.fromEntries(
              Object.entries(error.errors ?? {}).map(([key, value]) => [FIELD_OF[key] ?? key, value]),
            ),
          );
        }
        setMessage(getTransactionErrorMessage(error, t, "correct"));
        setHint(
          isInsufficientBalanceError(error)
            ? t("dashboard.transactions.errors.insufficientBalanceHint")
            : UNKNOWN_OUTCOME.includes(error?.code)
              ? t("dashboard.transactions.errors.unknownOutcome")
              : "",
        );
      }
    } finally {
      pendingRef.current = false;
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
        className="account-form-modal__dialog correct-transaction-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="correct-transaction-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="correct-transaction-title">{t("dashboard.transactions.correctForm.title")}</h2>
          <button type="button" onClick={close} disabled={isSaving} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <p className="correct-transaction-form__note" role="note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.transactions.correctForm.explanation")}</span>
        </p>

        {isLoadingOptions && <Loading message={t("dashboard.transactions.correctForm.loadingOptions")} />}

        {!isLoadingOptions && options.error && (
          <div className="account-form-modal__error correct-transaction-form__options-error" role="alert">
            <p>{getApiErrorMessage(options.error, t)}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoadingOptions && !options.error && (
          <form onSubmit={handleSubmit} noValidate>
            <label>
              <span>{t("dashboard.transactions.fields.account")}</span>
              <select
                name="account_id"
                value={form.account_id}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={errors.account_id ? true : undefined}
              >
                {!form.account_id && <option value="">{t("dashboard.transactions.form.selectAccount")}</option>}
                {accountOptions.map((account) => (
                  <option value={String(account.id)} key={account.id}>
                    {account.name ?? `#${account.id}`}
                    {account.currency_code ? ` (${account.currency_code})` : ""}
                    {account.unavailable ? ` — ${t("dashboard.transactions.form.unavailableOption")}` : ""}
                  </option>
                ))}
              </select>
              {fieldErrors("account_id")}
            </label>

            <label>
              <span>
                {t("dashboard.transactions.fields.category")}
                {!isExpense && ` (${t("dashboard.transactions.form.optional")})`}
              </span>
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={errors.category_id ? true : undefined}
              >
                <option value="" disabled={isExpense}>
                  {t(
                    isExpense
                      ? "dashboard.transactions.form.selectCategory"
                      : "dashboard.transactions.form.noCategory",
                  )}
                </option>
                {categoryOptions.map((category) => (
                  <option value={String(category.id)} key={category.id}>
                    {category.name ?? `#${category.id}`}
                    {category.unavailable ? ` — ${t("dashboard.transactions.form.unavailableOption")}` : ""}
                  </option>
                ))}
              </select>
              {fieldErrors("category_id")}
            </label>

            <div className="correct-transaction-form__row">
              <label>
                <span>{t("dashboard.transactions.fields.amount")}</span>
                <input
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  disabled={isSaving}
                  inputMode="decimal"
                  autoComplete="off"
                  dir="ltr"
                  aria-invalid={errors.amount ? true : undefined}
                  aria-describedby="correct-transaction-currency"
                />
                <em className="account-form-modal__hint" id="correct-transaction-currency">
                  {t("dashboard.transactions.correctForm.currencyHint", {
                    currency: transaction.currency_code ?? "",
                  })}
                </em>
                {fieldErrors("amount")}
                {fieldErrors("currency_code")}
              </label>

              <label>
                <span>{t("dashboard.transactions.fields.date")}</span>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  disabled={isSaving}
                  aria-invalid={errors.date ? true : undefined}
                />
                {fieldErrors("date")}
              </label>
            </div>

            <label>
              <span>{t("dashboard.transactions.fields.description")}</span>
              <input
                name="description"
                value={form.description}
                onChange={handleChange}
                disabled={isSaving}
                maxLength={255}
                dir="auto"
              />
              {fieldErrors("description")}
            </label>

            <label>
              <span>{t("dashboard.transactions.fields.referenceNumber")}</span>
              <input
                name="reference_number"
                value={form.reference_number}
                onChange={handleChange}
                disabled={isSaving}
                maxLength={100}
                dir="auto"
              />
              {fieldErrors("reference_number")}
            </label>

            <label>
              <span>{t("dashboard.transactions.correctForm.reason")}</span>
              <textarea
                name="reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setErrors((current) => ({ ...current, reason: undefined }));
                  setMessage("");
                }}
                disabled={isSaving}
                maxLength={REASON_MAX}
                rows={3}
                placeholder={t("dashboard.transactions.correctForm.reasonPlaceholder")}
                aria-invalid={errors.reason ? true : undefined}
                dir="auto"
              />
              <em className="account-form-modal__hint">
                {t("dashboard.transactions.validation.reasonHint", {
                  length: reason.trim().length,
                  min: REASON_MIN,
                  max: REASON_MAX,
                })}
              </em>
              {fieldErrors("reason")}
            </label>

            {errors.changes && (
              <p className="account-form-modal__error" role="alert">{errors.changes[0]}</p>
            )}

            {message && (
              <div className="account-form-modal__error" role="alert">
                <p dir="auto">{message}</p>
                {hint && <p>{hint}</p>}
                {fieldErrors("idempotency_key")}
              </div>
            )}

            <footer>
              <button type="button" onClick={close} disabled={isSaving}>
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={isSaving} aria-busy={isSaving || undefined}>
                {t(
                  isSaving
                    ? "dashboard.transactions.correctForm.saving"
                    : "dashboard.transactions.correctForm.submit",
                )}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
