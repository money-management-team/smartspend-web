import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuTriangleAlert } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { accountsApi } from "../../../api/accountsApi";
import { ApiError, getApiErrorMessage, getStoredWorkspace } from "../../../api/apiClient";
import { debtsApi } from "../../../api/debtsApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import {
  getAmountError,
  getTodayInputValue,
  toAmountInput,
} from "../../../FinancialOperations/transactionHelpers";
import { formatMoney } from "../../../utils/formatters";
import {
  NOTES_MAX,
  buildPaymentPayload,
  canAccountPay,
  createPaymentAttempt,
  getDebtErrorMessage,
  getEligibleAccounts,
  getPaymentErrorHint,
  isAboveAmount,
  isPositiveMoney,
  validatePaymentForm,
} from "../../debtHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./DebtPaymentForm.css";

// Fields with their own input; errors for any other backend field (e.g.
// `idempotency_key`, `metadata`) are listed in the error block instead.
const FORM_FIELDS = ["account_id", "amount", "paid_at", "notes"];

// The account receives an error for these, so the list is fetched again
// (it may be gone, or its balance may have changed).
const RELOAD_ACCOUNT_CODES = ["NOT_FOUND", "VALIDATION_ERROR"];

/*
 * Record payment modal (POST /debts/{id}/payments). A payment is a real
 * movement on the chosen account: payable → money leaves it (it needs the
 * balance), receivable → money comes into it. So:
 * - the submission carries an Idempotency-Key kept for the whole intent (see
 *   `createPaymentAttempt`): a double click, a retry after a timeout or a
 *   retry with edited details never records the payment twice;
 * - submit is disabled while pending;
 * - an amount above `remaining_amount` is rejected here (the backend has the
 *   final say);
 * - nothing is recalculated here: `onCompleted` receives the backend's
 *   `payment` and updated `debt`, which the page shows as the new state.
 *
 * `onOutdated` is called after a failure that may mean the page no longer
 * shows the debt's real state (e.g. a payment recorded despite a timeout).
 */
export default function DebtPaymentForm({ debt, onCompleted, onOutdated, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const currency = debt.currency_code;
  const direction = debt.direction;
  const remaining = debt.remaining_amount;

  const [today] = useState(getTodayInputValue);
  const [form, setForm] = useState(() => ({ account_id: "", amount: "", paid_at: today, notes: "" }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRef = useRef(false);
  const [attempt] = useState(() => createPaymentAttempt(debt.id));

  /* ---------- Accounts ---------- */

  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState({ key: null, accounts: [], error: null });
  // The debt's own workspace: its money only moves on that workspace's accounts.
  const workspaceId = debt.workspace_id ?? getStoredWorkspace()?.id;

  // Fetched on every open, so the balances shown are the ledger's current ones.
  useEffect(() => {
    const controller = new AbortController();

    accountsApi
      .list({ id_workspace: workspaceId }, { signal: controller.signal })
      .then((response) => {
        const accounts = response?.data?.accounts;

        setOptions(
          Array.isArray(accounts)
            ? { key: reloadKey, accounts: getEligibleAccounts(accounts, currency), error: null }
            : { key: reloadKey, accounts: [], error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setOptions({ key: reloadKey, accounts: [], error });
      });

    return () => controller.abort();
  }, [workspaceId, currency, reloadKey]);

  const isLoadingOptions = options.key !== reloadKey;
  const payingAccounts = options.accounts.filter((account) => canAccountPay(account, direction));
  // A chosen account that is no longer listed (reloaded list) counts as no choice.
  const selectedAccount =
    payingAccounts.find((account) => String(account.id) === form.account_id) ?? null;

  /* ---------- Handlers ---------- */

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
    setHint("");
  };

  const payRemaining = () => {
    setForm((current) => ({ ...current, amount: toAmountInput(remaining) }));
    setErrors((current) => ({ ...current, amount: undefined }));
    setMessage("");
    setHint("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const values = { ...form, account_id: selectedAccount ? String(selectedAccount.id) : "" };
    const nextErrors = validatePaymentForm(values, { remaining, t });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = buildPaymentPayload(values, { today });
    // The same key for the whole intent until it definitively succeeds or
    // fails; never a fresh one after an unknown outcome.
    const idempotencyKey = attempt.key();

    pendingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    setMessage("");
    setHint("");

    let response;

    try {
      response = await debtsApi.recordPayment(debt.id, payload, idempotencyKey);
      attempt.settle(null);
    } catch (error) {
      attempt.settle(error);

      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        if (error?.code === "VALIDATION_ERROR") setErrors(error.errors ?? {});
        setMessage(getDebtErrorMessage(error, t, "payment"));
        setHint(getPaymentErrorHint(error, t));
        if (RELOAD_ACCOUNT_CODES.includes(error?.code)) setReloadKey((key) => key + 1);
        onOutdated?.(error);
      }

      pendingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    pendingRef.current = false;
    setIsSubmitting(false);
    onCompleted(response?.data ?? {});
  };

  /* ---------- Render ---------- */

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  const otherErrors = Object.keys(errors)
    .filter((field) => !FORM_FIELDS.includes(field))
    .map((field) => fieldErrors(field));

  const money = (value, code = currency) => formatMoney(value, code, locale);
  const accountLabel = (account) => {
    const label = `${account.name ?? `#${account.id}`} · ${money(account.current_balance, account.currency_code)}`;
    return canAccountPay(account, direction)
      ? label
      : `${label} (${t("dashboard.debts.paymentForm.cannotPay")})`;
  };

  const amount = form.amount.trim();
  const hasValidAmount = !getAmountError(amount);
  const isKnownDirection = direction === "payable" || direction === "receivable";
  // Payable: the payment leaves the account. Compared on the decimal strings;
  // the backend makes the final decision (an account may allow negatives).
  const exceedsBalance =
    direction === "payable" &&
    selectedAccount != null &&
    hasValidAmount &&
    selectedAccount.allow_negative_balance !== true &&
    isAboveAmount(amount, selectedAccount.current_balance ?? "0");

  const canSubmit = !isSubmitting && !isLoadingOptions && !options.error && payingAccounts.length > 0;
  const optional = t("dashboard.transactions.form.optional");

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog debt-payment-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-payment-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="debt-payment-form__title">
            <h2 id="debt-payment-form-title">
              {t(`dashboard.debts.paymentForm.title.${isKnownDirection ? direction : "payable"}`)}
            </h2>
            <p dir="auto">{debt.counterparty_name}</p>
          </div>
          <button type="button" onClick={close} disabled={isSubmitting} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        {isKnownDirection && (
          <div className="debt-payment-form__note" role="note">
            <LuInfo aria-hidden="true" />
            <p>{t(`dashboard.debts.paymentForm.explanation.${direction}`)}</p>
          </div>
        )}

        <dl className="debt-payment-form__balance">
          <div>
            <dt>{t("dashboard.debts.fields.remainingAmount")}</dt>
            <dd>
              <bdi dir="ltr">{remaining == null ? "—" : money(remaining)}</bdi>
            </dd>
            {isPositiveMoney(remaining) && !isLoadingOptions && !options.error && (
              <dd>
                <button
                  type="button"
                  className="debt-payment-form__fill"
                  onClick={payRemaining}
                  disabled={isSubmitting}
                >
                  {t("dashboard.debts.paymentForm.payRemaining")}
                </button>
              </dd>
            )}
          </div>
          <div>
            <dt>{t("dashboard.debts.fields.paidAmount")}</dt>
            <dd>
              <bdi dir="ltr">{debt.paid_amount == null ? "—" : money(debt.paid_amount)}</bdi>
            </dd>
          </div>
        </dl>

        {isLoadingOptions && <Loading message={t("dashboard.debts.form.loadingAccounts")} />}

        {!isLoadingOptions && options.error && (
          <div className="account-form-modal__error debt-payment-form__options-error" role="alert">
            <p>{getApiErrorMessage(options.error, t)}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoadingOptions && !options.error && (
          <form onSubmit={handleSubmit} noValidate>
            <label>
              <span>{t("dashboard.debts.paymentForm.account")}</span>
              <select
                name="account_id"
                value={selectedAccount ? form.account_id : ""}
                onChange={handleChange}
                disabled={isSubmitting || payingAccounts.length === 0}
                aria-invalid={errors.account_id ? true : undefined}
                aria-describedby="debt-payment-form-account-hint"
                required
              >
                <option value="" disabled>
                  {options.accounts.length === 0
                    ? t("dashboard.debts.form.noAccounts", { currency })
                    : payingAccounts.length === 0
                      ? t("dashboard.debts.paymentForm.noPayingAccounts", { currency })
                      : t("dashboard.debts.form.selectAccount")}
                </option>
                {options.accounts.map((account) => (
                  <option
                    value={String(account.id)}
                    key={account.id}
                    disabled={!canAccountPay(account, direction)}
                  >
                    {accountLabel(account)}
                  </option>
                ))}
              </select>
              <em className="account-form-modal__hint" id="debt-payment-form-account-hint">
                {t(
                  direction === "payable"
                    ? "dashboard.debts.paymentForm.accountHint.payable"
                    : "dashboard.debts.paymentForm.accountHint.receivable",
                  { currency },
                )}
              </em>
              {fieldErrors("account_id")}
            </label>

            <div className="debt-payment-form__row">
              <label>
                <span>{t("dashboard.debts.paymentForm.amount")}</span>
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
                  aria-describedby="debt-payment-form-amount-hint"
                  required
                />
                <em className="account-form-modal__hint" id="debt-payment-form-amount-hint">
                  {t("dashboard.debts.paymentForm.amountHint", { currency })}
                </em>
                {fieldErrors("amount")}
              </label>

              <label>
                <span>
                  {t("dashboard.debts.paymentForm.date")} ({optional})
                </span>
                <input
                  type="date"
                  name="paid_at"
                  value={form.paid_at}
                  onChange={handleChange}
                  max={today}
                  disabled={isSubmitting}
                  aria-invalid={errors.paid_at ? true : undefined}
                />
                {fieldErrors("paid_at")}
              </label>
            </div>

            {selectedAccount && hasValidAmount && isKnownDirection && (
              <p className="debt-payment-form__effect" role="status">
                {t(`dashboard.debts.paymentForm.effect.${direction}`, { account: selectedAccount.name ?? "" })}{" "}
                <bdi dir="ltr" className={`debt-payment-form__effect-amount debt-payment-form__effect-amount--${direction}`}>
                  {direction === "payable" ? "−" : "+"}
                  {money(amount)}
                </bdi>
              </p>
            )}

            {exceedsBalance && (
              <p className="debt-payment-form__warning" role="status">
                <LuTriangleAlert aria-hidden="true" />
                <span>
                  {t("dashboard.debts.paymentForm.exceedsBalance", {
                    balance: money(selectedAccount.current_balance, selectedAccount.currency_code),
                  })}
                </span>
              </p>
            )}

            <label>
              <span>
                {t("dashboard.debts.fields.notes")} ({optional})
              </span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                maxLength={NOTES_MAX}
                placeholder={t("dashboard.debts.paymentForm.notesPlaceholder")}
                disabled={isSubmitting}
                aria-invalid={errors.notes ? true : undefined}
                dir="auto"
              />
              {fieldErrors("notes")}
            </label>

            {message && (
              <div className="account-form-modal__error" role="alert">
                <p dir="auto">{message}</p>
                {hint && <p>{hint}</p>}
                {otherErrors}
              </div>
            )}

            <footer>
              <button type="button" onClick={close} disabled={isSubmitting}>
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={!canSubmit} aria-busy={isSubmitting || undefined}>
                {t(
                  isSubmitting
                    ? "dashboard.debts.paymentForm.submitting"
                    : `dashboard.debts.paymentForm.submit.${isKnownDirection ? direction : "payable"}`,
                )}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
