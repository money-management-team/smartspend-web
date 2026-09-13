import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowDownLeft, LuArrowUpRight, LuInfo, LuTriangleAlert } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { accountsApi } from "../../../api/accountsApi";
import { ApiError, getApiErrorMessage, getStoredWorkspace } from "../../../api/apiClient";
import { getDisplayLocale, isNegativeMoney } from "../../../Accounts/accountHelpers";
import { getAmountError, getTodayInputValue } from "../../../FinancialOperations/transactionHelpers";
import { formatMoney, subtractMoney } from "../../../utils/formatters";
import {
  COUNTERPARTY_MAX,
  DEBT_DIRECTIONS,
  NOTES_MAX,
  buildCreatePayload,
  getCreateErrorHint,
  getCurrencyOptions,
  getDebtErrorMessage,
  getEligibleAccounts,
  isUnknownOutcome,
  validateDebtForm,
} from "../../debtHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./DebtForm.css";

// Fields with their own input; errors for any other backend field (e.g.
// `workspace_id`, `metadata`) are listed in the error block instead.
const FORM_FIELDS = [
  "direction",
  "counterparty_name",
  "original_amount",
  "currency_code",
  "issued_at",
  "due_date",
  "account_id",
  "notes",
];

// Same icons as DebtBadge: what the debt means for the user (payable: money
// they will pay out; receivable: money coming back to them).
const DIRECTION_ICONS = { payable: LuArrowUpRight, receivable: LuArrowDownLeft };

function emptyForm() {
  return {
    // Chosen explicitly: a debt recorded in the wrong direction would invert
    // the opening movement.
    direction: "",
    counterparty_name: "",
    original_amount: "",
    // The workspace's base currency when known (resolveWorkspaceId caches it).
    currency_code: getStoredWorkspace()?.base_currency_code || "ILS",
    issued_at: getTodayInputValue(),
    due_date: "",
    // Off by default: an account is never attached without the user asking.
    with_movement: false,
    account_id: "",
    notes: "",
  };
}

/*
 * New debt modal (POST /debts). Without the opening movement the debt is
 * informational only. With it, the chosen account goes in `account_id` and the
 * backend posts the movement itself: payable → money received into the
 * account, receivable → money lent out of it. No transaction is created and no
 * balance is changed here.
 *
 * `onSave(payload, { account })` performs the request and throws on failure;
 * errors are shown here. `onOutdated` is called when the outcome of a failed
 * request is unknown (the debt may have been recorded).
 */
export default function DebtForm({ onSave, onOutdated, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRef = useRef(false);
  const [currencyOptions] = useState(() => getCurrencyOptions(form.currency_code));
  // The session workspace, the one the debt is created in.
  const [workspaceId] = useState(() => getStoredWorkspace()?.id);

  /* ---------- Accounts (only once the opening movement is requested) ---------- */

  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState({ key: null, accounts: [], error: null });
  const withMovement = form.with_movement;

  useEffect(() => {
    if (!withMovement) return undefined;

    const controller = new AbortController();

    accountsApi
      .list({ id_workspace: workspaceId }, { signal: controller.signal })
      .then((response) => {
        const accounts = response?.data?.accounts;

        setOptions(
          Array.isArray(accounts)
            ? { key: reloadKey, accounts, error: null }
            : { key: reloadKey, accounts: [], error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setOptions({ key: reloadKey, accounts: [], error });
      });

    return () => controller.abort();
  }, [withMovement, workspaceId, reloadKey]);

  const isLoadingOptions = withMovement && options.key !== reloadKey;
  const eligibleAccounts = getEligibleAccounts(options.accounts, form.currency_code);
  // A chosen account that is no longer listed (other currency, reloaded list)
  // counts as no choice.
  const selectedAccount = withMovement
    ? (eligibleAccounts.find((account) => String(account.id) === form.account_id) ?? null)
    : null;

  /* ---------- Handlers ---------- */

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const resetFeedback = (...fields) => {
    setErrors((current) => ({
      ...current,
      ...Object.fromEntries(fields.map((field) => [field, undefined])),
    }));
    setMessage("");
    setHint("");
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    setForm((current) => ({ ...current, [name]: nextValue }));
    resetFeedback(name, ...(name === "with_movement" || name === "currency_code" ? ["account_id"] : []));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    // POST /debts has no Idempotency-Key, so a second request would record the
    // debt (and its movement) twice.
    if (pendingRef.current) return;

    const values = { ...form, account_id: selectedAccount ? String(selectedAccount.id) : "" };
    const nextErrors = validateDebtForm(values, { t });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    pendingRef.current = true;
    setIsSaving(true);
    setErrors({});
    setMessage("");
    setHint("");

    try {
      await onSave(buildCreatePayload(values), { account: selectedAccount });
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        if (error?.code === "VALIDATION_ERROR") setErrors(error.errors ?? {});
        setMessage(getDebtErrorMessage(error, t, "create"));
        setHint(getCreateErrorHint(error, t, { withMovement: values.with_movement }));

        if (isUnknownOutcome(error)) onOutdated?.();
        // The account may be gone or its balance changed: list it again.
        if (values.with_movement && ["NOT_FOUND", "VALIDATION_ERROR"].includes(error?.code)) {
          setReloadKey((key) => key + 1);
        }
      }
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  };

  /* ---------- Render ---------- */

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  const otherErrors = Object.keys(errors)
    .filter((field) => !FORM_FIELDS.includes(field))
    .map((field) => fieldErrors(field));

  const optional = t("dashboard.transactions.form.optional");
  const amount = form.original_amount.trim();
  const hasValidAmount = !getAmountError(amount);
  const money = (value, currency = form.currency_code) => formatMoney(value, currency, locale);
  const accountLabel = (account) =>
    `${account.name ?? `#${account.id}`} · ${money(account.current_balance, account.currency_code)}`;

  // Receivable + movement takes money out of the account. A comparison of two
  // decimal strings, never float math; the backend makes the final decision.
  const exceedsBalance =
    form.direction === "receivable" &&
    selectedAccount != null &&
    hasValidAmount &&
    selectedAccount.allow_negative_balance !== true &&
    isNegativeMoney(subtractMoney(selectedAccount.current_balance ?? "0", amount));

  const movementNote = !withMovement
    ? "movementOff"
    : form.direction
      ? `movementOn.${form.direction}`
      : "movementOn.chooseDirection";

  const canSubmit = !isSaving && !(withMovement && (isLoadingOptions || options.error));

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog debt-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="debt-form-title">{t("dashboard.debts.form.title")}</h2>
          <button type="button" onClick={close} disabled={isSaving} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="debt-form__directions" disabled={isSaving}>
            <legend>{t("dashboard.debts.fields.direction")}</legend>
            <div className="debt-form__direction-options">
              {DEBT_DIRECTIONS.map((direction) => {
                const Icon = DIRECTION_ICONS[direction];

                return (
                  <label
                    key={direction}
                    className={`debt-form__direction debt-form__direction--${direction}${
                      form.direction === direction ? " debt-form__direction--selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="direction"
                      value={direction}
                      checked={form.direction === direction}
                      onChange={handleChange}
                      aria-invalid={errors.direction ? true : undefined}
                    />
                    <span className="debt-form__direction-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="debt-form__direction-copy">
                      <strong>{t(`dashboard.debts.form.directions.${direction}.title`)}</strong>
                      <span>{t(`dashboard.debts.form.directions.${direction}.description`)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {fieldErrors("direction")}
          </fieldset>

          <label>
            <span>{t("dashboard.debts.fields.counterparty")}</span>
            <input
              name="counterparty_name"
              value={form.counterparty_name}
              onChange={handleChange}
              disabled={isSaving}
              maxLength={COUNTERPARTY_MAX}
              placeholder={t("dashboard.debts.form.counterpartyPlaceholder")}
              aria-invalid={errors.counterparty_name ? true : undefined}
              autoComplete="off"
              dir="auto"
              required
            />
            {fieldErrors("counterparty_name")}
          </label>

          <div className="debt-form__row">
            <label>
              <span>{t("dashboard.debts.fields.originalAmount")}</span>
              <input
                name="original_amount"
                value={form.original_amount}
                onChange={handleChange}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                dir="ltr"
                disabled={isSaving}
                aria-invalid={errors.original_amount ? true : undefined}
                required
              />
              {fieldErrors("original_amount")}
            </label>

            <label>
              <span>{t("dashboard.debts.fields.currency")}</span>
              <select
                name="currency_code"
                value={form.currency_code}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={errors.currency_code ? true : undefined}
                dir="ltr"
                required
              >
                {currencyOptions.map((currency) => (
                  <option value={currency} key={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              {fieldErrors("currency_code")}
            </label>
          </div>

          <div className="debt-form__row">
            <label>
              <span>
                {t("dashboard.debts.fields.issuedAt")} ({optional})
              </span>
              <input
                type="date"
                name="issued_at"
                value={form.issued_at}
                max={form.due_date || undefined}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={errors.issued_at ? true : undefined}
              />
              {fieldErrors("issued_at")}
            </label>

            <label>
              <span>
                {t("dashboard.debts.fields.dueDate")} ({optional})
              </span>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                min={form.issued_at || undefined}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={errors.due_date ? true : undefined}
              />
              {fieldErrors("due_date")}
            </label>
          </div>

          <div className={`debt-form__movement${withMovement ? " debt-form__movement--on" : ""}`}>
            <label className="account-form-modal__check">
              <input
                type="checkbox"
                name="with_movement"
                checked={withMovement}
                onChange={handleChange}
                disabled={isSaving}
                aria-describedby="debt-form-movement-note"
              />
              <span>{t("dashboard.debts.form.recordMovement")}</span>
            </label>

            <p className="debt-form__note" id="debt-form-movement-note">
              <LuInfo aria-hidden="true" />
              <span>{t(`dashboard.debts.form.${movementNote}`)}</span>
            </p>

            {withMovement && isLoadingOptions && <Loading message={t("dashboard.debts.form.loadingAccounts")} />}

            {withMovement && !isLoadingOptions && options.error && (
              <div className="account-form-modal__error debt-form__options-error" role="alert">
                <p>{getApiErrorMessage(options.error, t)}</p>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                  {t("common.retry")}
                </button>
              </div>
            )}

            {withMovement && !isLoadingOptions && !options.error && (
              <label>
                <span>{t("dashboard.debts.fields.account")}</span>
                <select
                  name="account_id"
                  value={selectedAccount ? form.account_id : ""}
                  onChange={handleChange}
                  disabled={isSaving || eligibleAccounts.length === 0}
                  aria-invalid={errors.account_id ? true : undefined}
                  aria-describedby="debt-form-account-hint"
                  required
                >
                  <option value="" disabled>
                    {eligibleAccounts.length === 0
                      ? t("dashboard.debts.form.noAccounts", { currency: form.currency_code })
                      : t("dashboard.debts.form.selectAccount")}
                  </option>
                  {eligibleAccounts.map((account) => (
                    <option value={String(account.id)} key={account.id}>
                      {accountLabel(account)}
                    </option>
                  ))}
                </select>
                <em className="account-form-modal__hint" id="debt-form-account-hint">
                  {t("dashboard.debts.form.accountHint", { currency: form.currency_code })}
                </em>
                {fieldErrors("account_id")}
              </label>
            )}

            {selectedAccount && hasValidAmount && DEBT_DIRECTIONS.includes(form.direction) && (
              <p className="debt-form__effect" role="status">
                {t(`dashboard.debts.form.effect.${form.direction}`, { account: selectedAccount.name ?? "" })}{" "}
                <bdi dir="ltr" className={`debt-form__effect-amount debt-form__effect-amount--${form.direction}`}>
                  {form.direction === "payable" ? "+" : "−"}
                  {money(amount)}
                </bdi>
              </p>
            )}

            {exceedsBalance && (
              <p className="debt-form__warning" role="status">
                <LuTriangleAlert aria-hidden="true" />
                <span>
                  {t("dashboard.debts.form.exceedsBalance", {
                    balance: money(selectedAccount.current_balance, selectedAccount.currency_code),
                  })}
                </span>
              </p>
            )}
          </div>

          <label>
            <span>
              {t("dashboard.debts.fields.notes")} ({optional})
            </span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              maxLength={NOTES_MAX}
              placeholder={t("dashboard.debts.form.notesPlaceholder")}
              disabled={isSaving}
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
            <button type="button" onClick={close} disabled={isSaving}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={!canSubmit} aria-busy={isSaving || undefined}>
              {isSaving
                ? t("common.saving")
                : t(withMovement ? "dashboard.debts.form.submitWithMovement" : "dashboard.debts.form.submit")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
