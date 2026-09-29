import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuLock } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { ApiError, getApiErrorMessage, getStoredWorkspace, toMoneyString } from "../../../api/apiClient";
import { categoriesApi } from "../../../api/categoriesApi";
import { getDisplayLocale, isNegativeMoney } from "../../../Accounts/accountHelpers";
import { isActiveCategory } from "../../../Categories/categoryHelpers";
import { getAmountError, toAmountInput } from "../../../FinancialOperations/transactionHelpers";
import { formatMoney, subtractMoney } from "../../../utils/formatters";
import {
  BUDGET_SCOPES,
  NAME_MAX,
  NOTES_MAX,
  getBudgetErrorMessage,
  getBudgetScope,
  getCurrencyOptions,
  getDefaultPeriod,
  toPeriodDate,
  validateBudgetForm,
} from "../../budgetHelpers";

// Same modal shell as the other dashboard dialogs; textarea and error block
// styles come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./BudgetForm.css";

// Backend fields shown in the error block rather than under an input.
const GENERAL_FIELDS = ["workspace_id", "metadata"];

function toFormValues(budget) {
  if (budget) {
    return {
      name: budget.name ?? "",
      scope: getBudgetScope(budget),
      category_id: budget.category?.id != null ? String(budget.category.id) : "",
      amount_limit: toAmountInput(budget.amount_limit),
      currency_code: budget.currency_code ?? "",
      period_start: toPeriodDate(budget.period_start),
      period_end: toPeriodDate(budget.period_end),
      notes: budget.notes ?? "",
    };
  }

  return {
    name: "",
    scope: "general",
    category_id: "",
    amount_limit: "",
    // The workspace's base currency when known (resolveWorkspaceId caches it).
    currency_code: getStoredWorkspace()?.base_currency_code || "ILS",
    ...getDefaultPeriod(),
    notes: "",
  };
}

/*
 * Create: the full payload. The parent adds `workspace_id`; a general budget
 * has no `category_id`.
 * Edit: only the changed editable fields (name, amount_limit, period, notes).
 * Scope, category and currency are never sent: they define what the budget
 * measures, so changing them means creating a new budget.
 */
function buildPayload(form, budget) {
  const notes = form.notes.trim();

  if (!budget) {
    return {
      name: form.name.trim(),
      ...(form.scope === "category" ? { category_id: Number(form.category_id) } : {}),
      amount_limit: form.amount_limit.trim(),
      currency_code: form.currency_code,
      period_start: form.period_start,
      period_end: form.period_end,
      ...(notes ? { notes } : {}),
    };
  }

  const original = toFormValues(budget);
  const payload = {};

  if (form.name.trim() !== original.name.trim()) payload.name = form.name.trim();
  if (toMoneyString(form.amount_limit.trim()) !== toMoneyString(budget.amount_limit)) {
    payload.amount_limit = form.amount_limit.trim();
  }
  if (form.period_start !== original.period_start) payload.period_start = form.period_start;
  if (form.period_end !== original.period_end) payload.period_end = form.period_end;
  if (notes !== original.notes.trim()) payload.notes = notes || null;

  return payload;
}

/*
 * Create / edit budget modal. `onSave(payload)` performs the request and
 * throws on failure; errors are shown here. An archived budget never reaches
 * this form (the parents only open it for active budgets).
 */
export default function BudgetForm({ budget, onSave, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const isEditing = Boolean(budget);
  const [form, setForm] = useState(() => toFormValues(budget));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRef = useRef(false);
  const [currencyOptions] = useState(() => getCurrencyOptions(form.currency_code));

  /* ---------- Expense categories (category budgets only) ---------- */

  const needsCategories = !isEditing && form.scope === "category";
  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState({
    key: null,
    categories: [],
    error: null,
  });

  useEffect(() => {
    if (!needsCategories) return undefined;

    const controller = new AbortController();

    // Active categories of the session workspace (system ones included); a
    // budget can only measure expenses, so income categories are left out.
    categoriesApi
      .list(
        { workspace_id: getStoredWorkspace()?.id, type: "expense" },
        { signal: controller.signal },
      )
      .then((response) => {
        const categories = response.data?.categories;

        setCategoryOptions(
          Array.isArray(categories)
            ? {
                key: categoriesReloadKey,
                categories: categories.filter(
                  (category) =>
                    category?.id != null &&
                    category.type === "expense" &&
                    isActiveCategory(category),
                ),
                error: null,
              }
            : {
                key: categoriesReloadKey,
                categories: [],
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setCategoryOptions({ key: categoriesReloadKey, categories: [], error });
      });

    return () => controller.abort();
  }, [needsCategories, categoriesReloadKey]);

  const isLoadingCategories = needsCategories && categoryOptions.key !== categoriesReloadKey;

  /* ---------- Handlers ---------- */

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  };

  const handleChange = (event) => updateField(event.target.name, event.target.value);

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const nextErrors = validateBudgetForm(form, { isEditing, t });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = buildPayload(form, budget);

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
        setMessage(getBudgetErrorMessage(error, t, "save"));
      }
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  // Lowering the limit under what is already spent is allowed: the backend
  // recalculates the progress (it may then show as exceeded).
  const spent = budget?.progress?.spent;
  const isLimitBelowSpent =
    isEditing &&
    spent != null &&
    !getAmountError(form.amount_limit) &&
    isNegativeMoney(subtractMoney(form.amount_limit.trim(), spent));

  const scopeLabel = t(`dashboard.budgets.scopes.${form.scope}`);
  const optional = t("dashboard.transactions.form.optional");

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog budget-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="budget-form-title">
            {t(isEditing ? "dashboard.budgets.form.editTitle" : "dashboard.budgets.form.createTitle")}
          </h2>
          <button type="button" onClick={close} disabled={isSaving} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t("dashboard.budgets.fields.name")}</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={isSaving}
              maxLength={NAME_MAX}
              placeholder={t("dashboard.budgets.form.namePlaceholder")}
              aria-invalid={errors.name ? true : undefined}
              dir="auto"
              required
              autoFocus
            />
            {fieldErrors("name")}
          </label>

          {isEditing ? (
            <div className="budget-form__fixed" role="note">
              <dl>
                <div>
                  <dt>{t("dashboard.budgets.fields.scope")}</dt>
                  <dd>
                    {scopeLabel}
                    {budget.category?.name && (
                      <>
                        {" · "}
                        <bdi>{budget.category.name}</bdi>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t("dashboard.budgets.fields.currency")}</dt>
                  <dd>
                    <bdi dir="ltr">{budget.currency_code}</bdi>
                  </dd>
                </div>
              </dl>
              <p>
                <LuLock aria-hidden="true" />
                <span>{t("dashboard.budgets.form.fixedFieldsHint")}</span>
              </p>
            </div>
          ) : (
            <>
              <fieldset className="budget-form__scopes" disabled={isSaving}>
                <legend>{t("dashboard.budgets.fields.scope")}</legend>

                <div className="budget-form__scope-options">
                  {BUDGET_SCOPES.map((scope) => (
                    <label
                      key={scope}
                      className={`budget-form__scope${form.scope === scope ? " budget-form__scope--active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={scope}
                        checked={form.scope === scope}
                        onChange={() => updateField("scope", scope)}
                      />
                      <span>
                        <strong>{t(`dashboard.budgets.scopes.${scope}`)}</strong>
                        <small>{t(`dashboard.budgets.scopeHints.${scope}`)}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {form.scope === "category" && (
                <div className="budget-form__field">
                  <label htmlFor="budget-form-category">{t("dashboard.budgets.fields.category")}</label>

                  {isLoadingCategories && (
                    <Loading size="small" variant="inline" message={t("dashboard.budgets.form.loadingCategories")} />
                  )}

                  {!isLoadingCategories && categoryOptions.error && (
                    <div className="account-form-modal__error budget-form__options-error" role="alert">
                      <p>{getApiErrorMessage(categoryOptions.error, t)}</p>
                      <button type="button" onClick={() => setCategoriesReloadKey((key) => key + 1)}>
                        {t("common.retry")}
                      </button>
                    </div>
                  )}

                  {!isLoadingCategories && !categoryOptions.error && (
                    <select
                      id="budget-form-category"
                      name="category_id"
                      value={form.category_id}
                      onChange={handleChange}
                      disabled={isSaving || categoryOptions.categories.length === 0}
                      aria-invalid={errors.category_id ? true : undefined}
                      required
                    >
                      <option value="" disabled>
                        {categoryOptions.categories.length === 0
                          ? t("dashboard.budgets.form.noCategories")
                          : t("dashboard.budgets.form.selectCategory")}
                      </option>
                      {categoryOptions.categories.map((category) => (
                        <option value={String(category.id)} key={category.id}>
                          {category.name ?? `#${category.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                  {fieldErrors("category_id")}
                </div>
              )}
            </>
          )}

          <div className={`budget-form__row${isEditing ? " budget-form__row--single" : ""}`}>
            <label>
              <span>{t("dashboard.budgets.fields.amountLimit")}</span>
              <input
                name="amount_limit"
                value={form.amount_limit}
                onChange={handleChange}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                dir="ltr"
                disabled={isSaving}
                aria-invalid={errors.amount_limit ? true : undefined}
                required
              />
              {fieldErrors("amount_limit")}
            </label>

            {!isEditing && (
              <label>
                <span>{t("dashboard.budgets.fields.currency")}</span>
                <select
                  name="currency_code"
                  value={form.currency_code}
                  onChange={handleChange}
                  disabled={isSaving}
                  aria-invalid={errors.currency_code ? true : undefined}
                  aria-describedby="budget-form-currency-hint"
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
            )}
          </div>

          {!isEditing && (
            <em className="account-form-modal__hint budget-form__hint" id="budget-form-currency-hint">
              {t("dashboard.budgets.form.currencyHint")}
            </em>
          )}

          {isLimitBelowSpent && (
            <p className="budget-form__note" role="status">
              <LuInfo aria-hidden="true" />
              <span>
                {t("dashboard.budgets.form.limitBelowSpent", {
                  spent: formatMoney(spent, budget.currency_code, locale),
                })}
              </span>
            </p>
          )}

          <div className="budget-form__row">
            <label>
              <span>{t("dashboard.budgets.fields.periodStart")}</span>
              <input
                type="date"
                name="period_start"
                value={form.period_start}
                onChange={handleChange}
                max={form.period_end || undefined}
                disabled={isSaving}
                aria-invalid={errors.period_start ? true : undefined}
                required
              />
              {fieldErrors("period_start")}
            </label>

            <label>
              <span>{t("dashboard.budgets.fields.periodEnd")}</span>
              <input
                type="date"
                name="period_end"
                value={form.period_end}
                onChange={handleChange}
                min={form.period_start || undefined}
                disabled={isSaving}
                aria-invalid={errors.period_end ? true : undefined}
                required
              />
              {fieldErrors("period_end")}
            </label>
          </div>

          <label>
            <span>
              {t("dashboard.budgets.fields.notes")} ({optional})
            </span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              maxLength={NOTES_MAX}
              placeholder={t("dashboard.budgets.form.notesPlaceholder")}
              disabled={isSaving}
              aria-invalid={errors.notes ? true : undefined}
              dir="auto"
            />
            {fieldErrors("notes")}
          </label>

          {message && (
            <div className="account-form-modal__error" role="alert">
              <p dir="auto">{message}</p>
              {GENERAL_FIELDS.map((field) => fieldErrors(field))}
            </div>
          )}

          <footer>
            <button type="button" onClick={close} disabled={isSaving}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={isSaving} aria-busy={isSaving || undefined}>
              {isSaving
                ? t("common.saving")
                : t(isEditing ? "common.save" : "dashboard.budgets.form.submitCreate")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
