import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { accountsApi } from "../../../api/accountsApi";
import { categoriesApi } from "../../../api/categoriesApi";
import { getApiErrorMessage, getStoredWorkspace } from "../../../api/apiClient";
import { transfersApi } from "../../../api/transfersApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import {
  createIdempotentAttempt,
  getAmountError,
  getTodayInputValue,
  toOccurredAt,
} from "../../../FinancialOperations/transactionHelpers";
import { formatMoney } from "../../../utils/formatters";
import {
  getFeeError,
  getTransferErrorHint,
  getTransferErrorMessage,
  isTransferEntity,
} from "../../transferHelpers";

// Same modal shell as the other dashboard dialogs; the error block comes from
// the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./TransferForm.css";

// Backend field → form field.
const FIELD_OF = { occurred_at: "date" };

const emptyForm = () => ({
  from_account_id: "",
  to_account_id: "",
  amount: "",
  fee_amount: "",
  fee_category_id: "",
  fee_description: "",
  description: "",
  reference_number: "",
  date: getTodayInputValue(),
});

const isSelectable = (account) => account?.id != null && account.status !== "archived";

/*
 * Creates a transfer between two accounts (POST /transfers). A transfer is
 * neither income nor expense; an optional fee is a real expense booked on the
 * source account through an expense category. Every submission carries an
 * Idempotency-Key that stays the same while the details are unchanged, so a
 * double click or a retry after a timeout can't move the money twice.
 *
 * `onCreated(transfer)` runs after a 201; the page shows the notice and
 * refetches. Accounts and categories come from the shared API modules.
 */
export default function TransferForm({ onCreated, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRef = useRef(false);
  const [attempt] = useState(() => createIdempotentAttempt("transfer"));

  /* ---------- Accounts and expense categories ---------- */

  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState({
    key: null,
    accounts: [],
    categories: [],
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    // The session workspace, the one the user works in; when it is unknown,
    // the backend lists every workspace the user manages.
    const workspaceId = getStoredWorkspace()?.id;

    Promise.all([
      accountsApi.list({ id_workspace: workspaceId }, { signal }),
      categoriesApi.list({ workspace_id: workspaceId, type: "expense" }, { signal }),
    ])
      .then(([accountsResponse, categoriesResponse]) => {
        setOptions({
          key: reloadKey,
          accounts: (accountsResponse.data?.accounts ?? []).filter(isSelectable),
          // A fee is an expense: income categories are never offered.
          categories: (categoriesResponse.data?.categories ?? []).filter(
            (category) => category?.type === "expense",
          ),
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        setOptions({ key: reloadKey, accounts: [], categories: [], error });
      });

    return () => controller.abort();
  }, [reloadKey]);

  const isLoadingOptions = options.key !== reloadKey;

  /* ---------- Derived selections ---------- */

  const sourceAccount =
    options.accounts.find((account) => String(account.id) === form.from_account_id) ?? null;

  // The same account twice is refused by the backend, and a transfer between
  // different currencies isn't supported: neither can be picked here.
  const destinationAccounts = sourceAccount
    ? options.accounts.filter(
        (account) =>
          String(account.id) !== String(sourceAccount.id) &&
          account.currency_code === sourceAccount.currency_code,
      )
    : [];

  const hasFee = /[1-9]/.test(form.fee_amount);
  const currency = sourceAccount?.currency_code ?? "";
  const canSubmit =
    !isSubmitting &&
    !isLoadingOptions &&
    !options.error &&
    Boolean(form.from_account_id) &&
    Boolean(form.to_account_id);

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      // A new source can make the destination invalid (same account, or a
      // different currency), so the choice is made again.
      ...(name === "from_account_id" ? { to_account_id: "" } : {}),
    }));
    setErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === "from_account_id" ? { to_account_id: undefined } : {}),
      ...(name === "fee_amount" ? { fee_category_id: undefined } : {}),
    }));
    setMessage("");
    setHint("");
  };

  const validate = () => {
    const nextErrors = {};
    const amountError = getAmountError(form.amount);
    const feeError = getFeeError(form.fee_amount);

    if (!form.from_account_id) {
      nextErrors.from_account_id = [t("dashboard.transfers.validation.fromRequired")];
    }
    if (!form.to_account_id) {
      nextErrors.to_account_id = [t("dashboard.transfers.validation.toRequired")];
    } else if (form.to_account_id === form.from_account_id) {
      nextErrors.to_account_id = [t("dashboard.transfers.validation.sameAccount")];
    }
    if (amountError) {
      nextErrors.amount = [t(`dashboard.transactions.validation.${amountError}`)];
    }
    if (feeError) {
      nextErrors.fee_amount = [t(`dashboard.transactions.validation.${feeError}`)];
    }
    if (hasFee && !form.fee_category_id) {
      nextErrors.fee_category_id = [t("dashboard.transfers.validation.feeCategoryRequired")];
    }

    return nextErrors;
  };

  const buildPayload = () => {
    const payload = {
      from_account_id: Number(form.from_account_id),
      to_account_id: Number(form.to_account_id),
      amount: form.amount.trim(),
    };

    if (hasFee) {
      payload.fee_amount = form.fee_amount.trim();
      payload.fee_category_id = Number(form.fee_category_id);
      if (form.fee_description.trim()) payload.fee_description = form.fee_description.trim();
    }
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.reference_number.trim()) payload.reference_number = form.reference_number.trim();
    if (form.date) payload.occurred_at = toOccurredAt(form.date);

    return payload;
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

    const payload = buildPayload();
    // Unchanged details keep the previous attempt's key, so a retry after an
    // unknown outcome is replayed instead of transferring again.
    const idempotencyKey = attempt.keyFor(payload);

    pendingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    setMessage("");
    setHint("");

    let response;

    try {
      response = await transfersApi.create(payload, idempotencyKey);
      attempt.settle(null);
    } catch (error) {
      attempt.settle(error);

      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        if (error?.code === "VALIDATION_ERROR") {
          setErrors(
            Object.fromEntries(
              Object.entries(error.errors ?? {}).map(([key, value]) => [
                FIELD_OF[key] ?? key,
                value,
              ]),
            ),
          );
        }
        setMessage(getTransferErrorMessage(error, t, "create"));
        setHint(getTransferErrorHint(error, t, "create"));
      }

      pendingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    const transfer = response?.data?.transfer;

    pendingRef.current = false;
    setIsSubmitting(false);
    // Balances come back from the backend; nothing is adjusted here.
    onCreated(isTransferEntity(transfer) ? transfer : null);
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  const accountLabel = (account) =>
    `${account.name ?? `#${account.id}`} · ${formatMoney(
      account.current_balance,
      account.currency_code,
      locale,
    )}`;

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog transfer-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="transfer-form-title">{t("dashboard.transfers.form.title")}</h2>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <p className="transfer-form__note" role="note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.transfers.form.explanation")}</span>
        </p>

        {isLoadingOptions && <Loading message={t("dashboard.transfers.form.loadingOptions")} />}

        {!isLoadingOptions && options.error && (
          <div className="account-form-modal__error transfer-form__options-error" role="alert">
            <p>{getApiErrorMessage(options.error, t)}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoadingOptions && !options.error && (
          <form onSubmit={handleSubmit} noValidate>
            <label>
              <span>{t("dashboard.transfers.fields.fromAccount")}</span>
              <select
                name="from_account_id"
                value={form.from_account_id}
                onChange={handleChange}
                disabled={isSubmitting || options.accounts.length === 0}
                aria-invalid={errors.from_account_id ? true : undefined}
                required
              >
                <option value="" disabled>
                  {options.accounts.length === 0
                    ? t("dashboard.transfers.form.noAccounts")
                    : t("dashboard.transfers.form.selectAccount")}
                </option>
                {options.accounts.map((account) => (
                  <option value={String(account.id)} key={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </select>
              {fieldErrors("from_account_id")}
            </label>

            <label>
              <span>{t("dashboard.transfers.fields.toAccount")}</span>
              <select
                name="to_account_id"
                value={form.to_account_id}
                onChange={handleChange}
                disabled={isSubmitting || destinationAccounts.length === 0}
                aria-invalid={errors.to_account_id ? true : undefined}
                aria-describedby="transfer-form-destination-hint"
                required
              >
                <option value="" disabled>
                  {!sourceAccount
                    ? t("dashboard.transfers.form.selectSourceFirst")
                    : destinationAccounts.length === 0
                      ? t("dashboard.transfers.form.noDestination")
                      : t("dashboard.transfers.form.selectAccount")}
                </option>
                {destinationAccounts.map((account) => (
                  <option value={String(account.id)} key={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </select>
              <em className="account-form-modal__hint" id="transfer-form-destination-hint">
                {t("dashboard.transfers.form.sameCurrencyHint")}
              </em>
              {fieldErrors("to_account_id")}
              {fieldErrors("currency_code")}
            </label>

            <div className="transfer-form__row">
              <label>
                <span>{t("dashboard.transfers.fields.amount")}</span>
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
                {currency && (
                  <em className="account-form-modal__hint">
                    {t("dashboard.transfers.form.currencyHint", { currency })}
                  </em>
                )}
                {fieldErrors("amount")}
              </label>

              <label>
                <span>{t("dashboard.transfers.fields.date")}</span>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-invalid={errors.date ? true : undefined}
                />
                {fieldErrors("date")}
              </label>
            </div>

            <label>
              <span>
                {t("dashboard.transfers.fields.fee")} ({t("dashboard.transactions.form.optional")})
              </span>
              <input
                name="fee_amount"
                value={form.fee_amount}
                onChange={handleChange}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                dir="ltr"
                disabled={isSubmitting}
                aria-invalid={errors.fee_amount ? true : undefined}
                aria-describedby="transfer-form-fee-hint"
              />
              <em className="account-form-modal__hint" id="transfer-form-fee-hint">
                {t("dashboard.transfers.form.feeHint")}
              </em>
              {fieldErrors("fee_amount")}
            </label>

            {hasFee && (
              <>
                <label>
                  <span>{t("dashboard.transfers.fields.feeCategory")}</span>
                  <select
                    name="fee_category_id"
                    value={form.fee_category_id}
                    onChange={handleChange}
                    disabled={isSubmitting || options.categories.length === 0}
                    aria-invalid={errors.fee_category_id ? true : undefined}
                    required
                  >
                    <option value="" disabled>
                      {options.categories.length === 0
                        ? t("dashboard.transfers.form.noExpenseCategories")
                        : t("dashboard.transfers.form.selectFeeCategory")}
                    </option>
                    {options.categories.map((category) => (
                      <option value={String(category.id)} key={category.id}>
                        {category.name ?? `#${category.id}`}
                      </option>
                    ))}
                  </select>
                  {fieldErrors("fee_category_id")}
                </label>

                <label>
                  <span>
                    {t("dashboard.transfers.fields.feeDescription")} (
                    {t("dashboard.transactions.form.optional")})
                  </span>
                  <input
                    name="fee_description"
                    value={form.fee_description}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    maxLength={500}
                    dir="auto"
                  />
                  {fieldErrors("fee_description")}
                </label>
              </>
            )}

            <label>
              <span>
                {t("dashboard.transfers.fields.description")} (
                {t("dashboard.transactions.form.optional")})
              </span>
              <input
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder={t("dashboard.transfers.form.descriptionPlaceholder")}
                maxLength={500}
                dir="auto"
                disabled={isSubmitting}
              />
              {fieldErrors("description")}
            </label>

            <label>
              <span>
                {t("dashboard.transfers.fields.referenceNumber")} (
                {t("dashboard.transactions.form.optional")})
              </span>
              <input
                name="reference_number"
                value={form.reference_number}
                onChange={handleChange}
                maxLength={100}
                dir="auto"
                disabled={isSubmitting}
              />
              {fieldErrors("reference_number")}
            </label>

            {message && (
              <div className="account-form-modal__error" role="alert">
                <p dir="auto">{message}</p>
                {hint && <p>{hint}</p>}
                {fieldErrors("idempotency_key")}
              </div>
            )}

            <footer>
              <button type="button" onClick={close} disabled={isSubmitting}>
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={!canSubmit} aria-busy={isSubmitting || undefined}>
                {t(
                  isSubmitting
                    ? "dashboard.transfers.form.submitting"
                    : "dashboard.transfers.form.submit",
                )}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
