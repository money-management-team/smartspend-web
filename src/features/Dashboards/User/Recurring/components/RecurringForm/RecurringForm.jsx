import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuLock } from "react-icons/lu";

import { getStoredWorkspace } from "../../../api/apiClient";
import { accountsApi } from "../../../api/accountsApi";
import { categoriesApi } from "../../../api/categoriesApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { isActiveCategory } from "../../../Categories/categoryHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { getAccountLabel } from "../../../Transfers/transferHelpers";
import { formatDate } from "../../../utils/formatters";
import {
  FREQUENCIES,
  INTERVAL_MAX,
  INTERVAL_MIN,
  MAX_OCCURRENCES_MAX,
  MAX_OCCURRENCES_MIN,
  NAME_MAX,
  PROCESSING_MODES,
  RECURRING_TYPES,
  buildCreatePayload,
  buildUpdatePayload,
  getEligibleAccounts,
  getRecurringErrorMessage,
  getRuleCurrency,
  toFormValues,
  validateRuleForm,
} from "../../recurringHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./RecurringForm.css";

// Fields that have an input in each mode; errors on any other field are
// listed in the error block.
const CREATE_INPUTS = [
  "type",
  "account_id",
  "category_id",
  "name",
  "amount",
  "frequency",
  "interval",
  "start_date",
  "end_date",
  "max_occurrences",
  "processing_mode",
  "description",
  "notes",
];
const EDIT_INPUTS = [
  "name",
  "amount",
  "interval",
  "end_date",
  "max_occurrences",
  "processing_mode",
  "description",
  "notes",
];

/*
 * Create / edit a recurring rule. Saving a rule never moves money: it only
 * schedules occurrences.
 *
 * Create: account (active, not a goal's), category of the chosen type
 * (required for income and expense; refetched when the type changes), amount,
 * frequency + interval, start/end dates, max occurrences, processing mode.
 * The currency is the account's.
 *
 * Edit: only name, amount, interval, end date, max occurrences, processing
 * mode, description and notes. The fields that define the rule (type,
 * account, category, currency, frequency, start date, anchor day) are shown
 * read-only: changing them means creating a new rule and archiving this one.
 *
 * `onSave(payload)` performs the request and throws on failure.
 */
export default function RecurringForm({ rule, presetType, onSave, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const isEditing = Boolean(rule);
  const [form, setForm] = useState(() => toFormValues(rule, presetType));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRef = useRef(false);

  /* ---------- Accounts and categories (create only) ---------- */

  const [reloadKey, setReloadKey] = useState(0);
  const accountsKey = isEditing ? null : String(reloadKey);
  const categoriesKey = isEditing ? null : `${form.type}:${reloadKey}`;
  const [accounts, setAccounts] = useState({ key: null, items: [], error: null });
  const [categories, setCategories] = useState({ key: null, items: [], error: null });

  useEffect(() => {
    if (accountsKey == null) return undefined;
    const controller = new AbortController();

    accountsApi
      .list({ id_workspace: getStoredWorkspace()?.id }, { signal: controller.signal })
      .then((response) => {
        setAccounts({
          key: accountsKey,
          items: getEligibleAccounts(response?.data?.accounts ?? []),
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setAccounts({ key: accountsKey, items: [], error });
      });

    return () => controller.abort();
  }, [accountsKey]);

  useEffect(() => {
    if (categoriesKey == null) return undefined;
    const controller = new AbortController();
    const [type] = categoriesKey.split(":");

    categoriesApi
      .list({ workspace_id: getStoredWorkspace()?.id, type }, { signal: controller.signal })
      .then((response) => {
        setCategories({
          key: categoriesKey,
          // An income rule takes an income category, an expense rule an
          // expense one.
          items: (response?.data?.categories ?? []).filter(
            (category) => category?.type === type && isActiveCategory(category),
          ),
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setCategories({ key: categoriesKey, items: [], error });
      });

    return () => controller.abort();
  }, [categoriesKey]);

  const isLoadingAccounts = !isEditing && accounts.key !== accountsKey;
  const isLoadingCategories = !isEditing && categories.key !== categoriesKey;
  const optionsError =
    (!isLoadingAccounts && accounts.error) || (!isLoadingCategories && categories.error) || null;
  const selectedAccount = accounts.items.find((account) => String(account.id) === form.account_id);
  const currency = isEditing ? getRuleCurrency(rule) : (selectedAccount?.currency_code ?? "");

  /* ---------- Changes ---------- */

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const update = (changes) => {
    setForm((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      const next = { ...current };
      Object.keys(changes).forEach((key) => delete next[key]);
      return next;
    });
    setMessage("");
  };

  const handleChange = (event) => update({ [event.target.name]: event.target.value });

  // The category list follows the type, so the chosen category is cleared.
  const changeType = (type) => {
    if (type !== form.type) update({ type, category_id: "" });
  };

  /* ---------- Submit ---------- */

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const nextErrors = validateRuleForm(form, { isEditing, t });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = isEditing ? buildUpdatePayload(form, rule) : buildCreatePayload(form);

    if (isEditing && Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    pendingRef.current = true;
    setIsSaving(true);
    setErrors({});
    setMessage("");

    try {
      await onSave(payload);
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        if (error?.code === "VALIDATION_ERROR") setErrors(error.errors ?? {});
        setMessage(getRecurringErrorMessage(error, t, "save"));
      }
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  const inputs = isEditing ? EDIT_INPUTS : CREATE_INPUTS;
  const generalErrorFields = Object.keys(errors).filter((field) => !inputs.includes(field));
  const optional = t("dashboard.transactions.form.optional");
  const disabled = isSaving;

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog recurring-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="recurring-form-title">
            {t(isEditing ? "dashboard.recurring.form.editTitle" : "dashboard.recurring.form.createTitle")}
          </h2>
          <button type="button" onClick={close} disabled={isSaving} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <p className="recurring-form__note" role="note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.recurring.form.ruleHint")}</span>
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {!isEditing && (
            <fieldset className="recurring-form__types">
              <legend>{t("dashboard.recurring.fields.type")}</legend>
              <div role="radiogroup" aria-label={t("dashboard.recurring.fields.type")}>
                {RECURRING_TYPES.map((type) => (
                  <label
                    key={type}
                    className={`recurring-form__type recurring-form__type--${type}${form.type === type ? " recurring-form__type--active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type}
                      checked={form.type === type}
                      onChange={() => changeType(type)}
                      disabled={disabled}
                    />
                    <span>{t(`dashboard.recurring.types.${type}`)}</span>
                  </label>
                ))}
              </div>
              {fieldErrors("type")}
            </fieldset>
          )}

          {isEditing && (
            <div className="recurring-form__fixed" role="note">
              <dl>
                <div>
                  <dt>{t("dashboard.recurring.fields.type")}</dt>
                  <dd>{translateEnum(t, i18n, "dashboard.recurring.types", rule.type)}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.recurring.fields.account")}</dt>
                  <dd dir="auto">{getAccountLabel(rule.account, rule.account_id)}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.recurring.fields.category")}</dt>
                  <dd dir="auto">{rule.category?.name ?? (rule.category_id != null ? `#${rule.category_id}` : "—")}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.recurring.fields.currency")}</dt>
                  <dd>
                    <bdi dir="ltr">{currency || "—"}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>{t("dashboard.recurring.fields.frequency")}</dt>
                  <dd>{translateEnum(t, i18n, "dashboard.recurring.frequencies", rule.frequency) || "—"}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.recurring.fields.startDate")}</dt>
                  <dd>
                    <bdi>{formatDate(rule.start_date, locale)}</bdi>
                  </dd>
                </div>
                {rule.anchor_day != null && (
                  <div>
                    <dt>{t("dashboard.recurring.fields.anchorDay")}</dt>
                    <dd>
                      <bdi>{rule.anchor_day}</bdi>
                    </dd>
                  </div>
                )}
              </dl>
              <p>
                <LuLock aria-hidden="true" />
                <span>{t("dashboard.recurring.form.fixedFieldsHint")}</span>
              </p>
            </div>
          )}

          {!isEditing && (
            <div className="recurring-form__row">
              <label>
                <span>{t("dashboard.recurring.fields.account")}</span>
                <select
                  name="account_id"
                  value={form.account_id}
                  onChange={handleChange}
                  disabled={disabled || isLoadingAccounts}
                  aria-invalid={errors.account_id ? true : undefined}
                  required
                >
                  <option value="">
                    {isLoadingAccounts ? t("common.loading") : t("dashboard.recurring.form.chooseAccount")}
                  </option>
                  {accounts.items.map((account) => (
                    <option value={String(account.id)} key={account.id}>
                      {account.name} ({account.currency_code})
                    </option>
                  ))}
                </select>
                {fieldErrors("account_id")}
                {fieldErrors("currency_code")}
                {!isLoadingAccounts && !accounts.error && accounts.items.length === 0 && (
                  <em className="account-form-modal__hint">{t("dashboard.recurring.form.noAccounts")}</em>
                )}
              </label>

              <label>
                <span>{t("dashboard.recurring.fields.category")}</span>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  disabled={disabled || isLoadingCategories}
                  aria-invalid={errors.category_id ? true : undefined}
                  required
                >
                  <option value="">
                    {isLoadingCategories ? t("common.loading") : t("dashboard.recurring.form.chooseCategory")}
                  </option>
                  {categories.items.map((category) => (
                    <option value={String(category.id)} key={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {fieldErrors("category_id")}
                {!isLoadingCategories && !categories.error && categories.items.length === 0 && (
                  <em className="account-form-modal__hint">
                    {t(`dashboard.recurring.form.noCategories.${form.type}`)}
                  </em>
                )}
              </label>
            </div>
          )}

          {optionsError && (
            <div className="account-form-modal__error" role="alert">
              <p dir="auto">{getRecurringErrorMessage(optionsError, t)}</p>
              <button
                type="button"
                className="recurring-form__retry"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                {t("common.retry")}
              </button>
            </div>
          )}

          <label>
            <span>{t("dashboard.recurring.fields.name")}</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={disabled}
              maxLength={NAME_MAX}
              placeholder={t("dashboard.recurring.form.namePlaceholder")}
              aria-invalid={errors.name ? true : undefined}
              dir="auto"
              required
              autoFocus
            />
            {fieldErrors("name")}
          </label>

          <label>
            <span>
              {t("dashboard.recurring.fields.amount")}
              {currency && (
                <>
                  {" "}
                  (<bdi dir="ltr">{currency}</bdi>)
                </>
              )}
            </span>
            <input
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              disabled={disabled}
              aria-invalid={errors.amount ? true : undefined}
              required
            />
            {fieldErrors("amount")}
            <em className="account-form-modal__hint">
              {t(isEditing ? "dashboard.recurring.form.amountChangeHint" : "dashboard.recurring.form.currencyHint")}
            </em>
          </label>

          <div className="recurring-form__row">
            {!isEditing && (
              <label>
                <span>{t("dashboard.recurring.fields.frequency")}</span>
                <select
                  name="frequency"
                  value={form.frequency}
                  onChange={handleChange}
                  disabled={disabled}
                  aria-invalid={errors.frequency ? true : undefined}
                  required
                >
                  {FREQUENCIES.map((frequency) => (
                    <option value={frequency} key={frequency}>
                      {t(`dashboard.recurring.frequencies.${frequency}`)}
                    </option>
                  ))}
                </select>
                {fieldErrors("frequency")}
              </label>
            )}

            <label>
              <span>{t("dashboard.recurring.fields.interval")}</span>
              <input
                type="number"
                name="interval"
                value={form.interval}
                onChange={handleChange}
                min={INTERVAL_MIN}
                max={INTERVAL_MAX}
                step={1}
                inputMode="numeric"
                dir="ltr"
                disabled={disabled}
                aria-invalid={errors.interval ? true : undefined}
                required
              />
              {fieldErrors("interval")}
              {FREQUENCIES.includes(form.frequency) && /^\d+$/.test(String(form.interval).trim()) && (
                <em className="account-form-modal__hint">
                  {t(`dashboard.recurring.every.${form.frequency}`, { count: Number(form.interval) })}
                </em>
              )}
            </label>
          </div>

          <div className="recurring-form__row">
            {!isEditing && (
              <label>
                <span>{t("dashboard.recurring.fields.startDate")}</span>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  disabled={disabled}
                  aria-invalid={errors.start_date ? true : undefined}
                  required
                />
                {fieldErrors("start_date")}
              </label>
            )}

            <label>
              <span>
                {t("dashboard.recurring.fields.endDate")} ({optional})
              </span>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={handleChange}
                min={form.start_date || undefined}
                disabled={disabled}
                aria-invalid={errors.end_date ? true : undefined}
              />
              {fieldErrors("end_date")}
            </label>

            <label>
              <span>
                {t("dashboard.recurring.fields.maxOccurrences")} ({optional})
              </span>
              <input
                type="number"
                name="max_occurrences"
                value={form.max_occurrences}
                onChange={handleChange}
                min={MAX_OCCURRENCES_MIN}
                max={MAX_OCCURRENCES_MAX}
                step={1}
                inputMode="numeric"
                dir="ltr"
                disabled={disabled}
                aria-invalid={errors.max_occurrences ? true : undefined}
              />
              {fieldErrors("max_occurrences")}
            </label>
          </div>

          <fieldset className="recurring-form__modes">
            <legend>{t("dashboard.recurring.fields.processingMode")}</legend>
            {PROCESSING_MODES.map((mode) => (
              <label
                key={mode}
                className={`recurring-form__mode${form.processing_mode === mode ? " recurring-form__mode--active" : ""}`}
              >
                <input
                  type="radio"
                  name="processing_mode"
                  value={mode}
                  checked={form.processing_mode === mode}
                  onChange={handleChange}
                  disabled={disabled}
                />
                <span>
                  <strong>{t(`dashboard.recurring.processingModes.${mode}`)}</strong>
                  <small>{t(`dashboard.recurring.form.modeHints.${mode}`)}</small>
                </span>
              </label>
            ))}
            {fieldErrors("processing_mode")}
          </fieldset>

          <label>
            <span>
              {t("dashboard.recurring.fields.description")} ({optional})
            </span>
            <input
              name="description"
              value={form.description}
              onChange={handleChange}
              disabled={disabled}
              aria-invalid={errors.description ? true : undefined}
              dir="auto"
            />
            {fieldErrors("description")}
          </label>

          <label>
            <span>
              {t("dashboard.recurring.fields.notes")} ({optional})
            </span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              disabled={disabled}
              aria-invalid={errors.notes ? true : undefined}
              dir="auto"
            />
            {fieldErrors("notes")}
          </label>

          {message && (
            <div className="account-form-modal__error" role="alert">
              <p dir="auto">{message}</p>
              {generalErrorFields.map((field) => fieldErrors(field))}
            </div>
          )}

          <footer>
            <button type="button" onClick={close} disabled={isSaving}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving || (!isEditing && (isLoadingAccounts || isLoadingCategories))}
              aria-busy={isSaving || undefined}
            >
              {isSaving
                ? t("common.saving")
                : t(isEditing ? "common.save" : "dashboard.recurring.form.submitCreate")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
