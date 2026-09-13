import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuTriangleAlert } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { accountsApi } from "../../../api/accountsApi";
import { ApiError, getApiErrorMessage, getStoredWorkspace } from "../../../api/apiClient";
import { savingsGoalsApi } from "../../../api/savingsGoalsApi";
import { getDisplayLocale, isNegativeMoney } from "../../../Accounts/accountHelpers";
import {
  createIdempotentAttempt,
  getAmountError,
  getTodayInputValue,
  toOccurredAt,
} from "../../../FinancialOperations/transactionHelpers";
import { formatMoney, subtractMoney } from "../../../utils/formatters";
import {
  ACCOUNT_FIELD,
  DESCRIPTION_MAX,
  getEligibleAccounts,
  getGoalCurrency,
  getGoalErrorMessage,
  getGoalProgress,
  getGoalStatus,
  getMovementErrorHint,
  validateMovementForm,
} from "../../savingsGoalHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./GoalMovementForm.css";

// Backend field → form field.
const FIELD_OF = { occurred_at: "date" };

const API_METHOD = { contribution: "contribute", withdrawal: "withdraw" };

/*
 * Adds money to a goal (POST /savings-goals/{id}/contributions) or takes it
 * out (POST /savings-goals/{id}/withdrawals). Both are real transfers in the
 * ledger between the goal's own savings account and another account, so:
 * - every submission carries an Idempotency-Key that stays the same while the
 *   details are unchanged (double click, retry after a timeout), and is only
 *   renewed after a success or a definitive rejection;
 * - nothing is added to or subtracted from the goal here: `onCompleted`
 *   receives the backend's response (`savings_goal` with its recalculated
 *   progress), which the page uses as the new state.
 *
 * `type` is "contribution" or "withdrawal". `onOutdated` is called after a
 * failure that may mean the page no longer shows the goal's real state.
 */
export default function GoalMovementForm({ type, goal, onCompleted, onOutdated, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const isContribution = type === "contribution";
  const accountField = ACCOUNT_FIELD[type];
  const currency = getGoalCurrency(goal);
  const savedAmount = getGoalProgress(goal)?.saved_amount;

  const [today] = useState(getTodayInputValue);
  const [form, setForm] = useState(() => ({
    [accountField]: "",
    amount: "",
    date: today,
    description: "",
  }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRef = useRef(false);
  const [attempt] = useState(() => createIdempotentAttempt(`goal-${type}`));

  /* ---------- Accounts ---------- */

  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState({ key: null, accounts: [], error: null });
  // The goal's own workspace: money only moves between its accounts.
  const workspaceId = goal.workspace_id ?? getStoredWorkspace()?.id;
  const goalAccountId = goal.account?.id;

  // Fetched on every open, so the balances shown are the ledger's current ones.
  useEffect(() => {
    const controller = new AbortController();

    accountsApi
      .list({ id_workspace: workspaceId }, { signal: controller.signal })
      .then((response) => {
        const accounts = response.data?.accounts;

        setOptions(
          Array.isArray(accounts)
            ? {
                key: reloadKey,
                accounts: getEligibleAccounts(accounts, { currency, goalAccountId }),
                error: null,
              }
            : {
                key: reloadKey,
                accounts: [],
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setOptions({ key: reloadKey, accounts: [], error });
      });

    return () => controller.abort();
  }, [workspaceId, currency, goalAccountId, reloadKey]);

  const isLoadingOptions = options.key !== reloadKey;

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

  const buildPayload = () => {
    const payload = {
      [accountField]: Number(form[accountField]),
      amount: form.amount.trim(),
    };

    if (form.description.trim()) payload.description = form.description.trim();
    // Today is left to the backend (it records "now"); another day is sent at
    // midday so no time zone can shift it.
    if (form.date && form.date !== today) payload.occurred_at = toOccurredAt(form.date);

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const nextErrors = validateMovementForm(form, { type, t });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = buildPayload();
    // Unchanged details keep the previous attempt's key, so a retry after an
    // unknown outcome is replayed instead of moving the money again.
    const idempotencyKey = attempt.keyFor({ goalId: goal.id, type, ...payload });

    pendingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    setMessage("");
    setHint("");

    let response;

    try {
      response = await savingsGoalsApi[API_METHOD[type]](goal.id, payload, idempotencyKey);
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
        setMessage(getGoalErrorMessage(error, t, type));
        setHint(getMovementErrorHint(error, t, type));
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

  const money = (value) => formatMoney(value, currency, locale);
  const accountLabel = (account) =>
    `${account.name ?? `#${account.id}`} · ${formatMoney(
      account.current_balance,
      account.currency_code,
      locale,
    )}`;

  // A comparison of two decimal strings, never float math; the backend makes
  // the final decision (the amount is not blocked here).
  const isAboveSaved =
    !isContribution &&
    savedAmount != null &&
    !getAmountError(form.amount) &&
    isNegativeMoney(subtractMoney(savedAmount, form.amount.trim()));

  const canSubmit =
    !isSubmitting && !isLoadingOptions && !options.error && options.accounts.length > 0;
  const titleId = `goal-movement-form-title-${type}`;
  const optional = t("dashboard.transactions.form.optional");

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog goal-movement-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="goal-movement-form__title">
            <h2 id={titleId}>{t(`dashboard.savingsGoals.movementForm.${type}.title`)}</h2>
            <p dir="auto">{goal.name}</p>
          </div>
          <button type="button" onClick={close} disabled={isSubmitting} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <div className="goal-movement-form__note" role="note">
          <LuInfo aria-hidden="true" />
          <div>
            <p>{t(`dashboard.savingsGoals.movementForm.${type}.explanation`)}</p>
            {isContribution && getGoalStatus(goal) === "achieved" && (
              <p>{t("dashboard.savingsGoals.movementForm.contribution.overfundHint")}</p>
            )}
            {!isContribution && getGoalStatus(goal) === "achieved" && (
              <p>{t("dashboard.savingsGoals.movementForm.withdrawal.achievedHint")}</p>
            )}
          </div>
        </div>

        {savedAmount != null && (
          <dl className="goal-movement-form__balance">
            <div>
              <dt>{t("dashboard.savingsGoals.fields.savedAmount")}</dt>
              <dd>
                <bdi dir="ltr">{money(savedAmount)}</bdi>
              </dd>
            </div>
          </dl>
        )}

        {isLoadingOptions && <Loading message={t("dashboard.savingsGoals.movementForm.loadingAccounts")} />}

        {!isLoadingOptions && options.error && (
          <div className="account-form-modal__error goal-movement-form__options-error" role="alert">
            <p>{getApiErrorMessage(options.error, t)}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoadingOptions && !options.error && (
          <form onSubmit={handleSubmit} noValidate>
            <label>
              <span>
                {t(
                  isContribution
                    ? "dashboard.savingsGoals.fields.sourceAccount"
                    : "dashboard.savingsGoals.fields.destinationAccount",
                )}
              </span>
              <select
                name={accountField}
                value={form[accountField]}
                onChange={handleChange}
                disabled={isSubmitting || options.accounts.length === 0}
                aria-invalid={errors[accountField] ? true : undefined}
                aria-describedby={`goal-movement-form-account-hint-${type}`}
                required
              >
                <option value="" disabled>
                  {options.accounts.length === 0
                    ? t("dashboard.savingsGoals.movementForm.noAccounts")
                    : t("dashboard.transactions.form.selectAccount")}
                </option>
                {options.accounts.map((account) => (
                  <option value={String(account.id)} key={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </select>
              <em className="account-form-modal__hint" id={`goal-movement-form-account-hint-${type}`}>
                {t("dashboard.savingsGoals.movementForm.accountHint", { currency })}
              </em>
              {fieldErrors(accountField)}
            </label>

            <div className="goal-movement-form__row">
              <label>
                <span>{t("dashboard.savingsGoals.fields.amount")}</span>
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
                    {t("dashboard.savingsGoals.movementForm.currencyHint", { currency })}
                  </em>
                )}
                {fieldErrors("amount")}
              </label>

              <label>
                <span>{t("dashboard.savingsGoals.fields.date")}</span>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  max={today}
                  disabled={isSubmitting}
                  aria-invalid={errors.date ? true : undefined}
                />
                {fieldErrors("date")}
              </label>
            </div>

            {isAboveSaved && (
              <p className="goal-movement-form__warning" role="status">
                <LuTriangleAlert aria-hidden="true" />
                <span>
                  {t("dashboard.savingsGoals.movementForm.withdrawal.aboveSaved", {
                    amount: money(savedAmount),
                  })}
                </span>
              </p>
            )}

            <label>
              <span>
                {t("dashboard.savingsGoals.fields.description")} ({optional})
              </span>
              <input
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder={t(`dashboard.savingsGoals.movementForm.${type}.descriptionPlaceholder`)}
                maxLength={DESCRIPTION_MAX}
                dir="auto"
                disabled={isSubmitting}
                aria-invalid={errors.description ? true : undefined}
              />
              {fieldErrors("description")}
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
                    ? `dashboard.savingsGoals.movementForm.${type}.submitting`
                    : `dashboard.savingsGoals.movementForm.${type}.submit`,
                )}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
