import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuRotateCcw, LuTriangleAlert } from "react-icons/lu";

import { getApiErrorMessage } from "../../../api/apiClient";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { getCurrencyOptions } from "../../../SavingsGoals/savingsGoalHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../../../Transfers/transferHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import {
  CAPTURE_DESCRIPTION_MAX,
  CAPTURE_EDITABLE_FIELDS,
  CAPTURE_MONEY_FIELDS,
  REFERENCE_NUMBER_MAX,
} from "../../captureConstants";
import {
  buildCaptureUpdatePayload,
  getCaptureChanges,
  getEligibleAccounts,
  getExpenseCategories,
  getReviewValueEntries,
  getReviewValues,
  getReviewVersion,
  humanizeCaptureField,
  isCaptureVersionConflict,
  validateCaptureForm,
} from "../../captureHelpers";

import "./ReviewValues.css";

const FORM_ID = "capture-review-form";

/*
 * The review draft: what the backend will record if this capture is
 * confirmed. Separate from the AI's suggestions in every way — this is the
 * user's data, those are hints.
 *
 * Two presentations of the same section, not two components:
 *
 * - `ready_for_review` → an editable form that saves with
 *   PATCH /ai/expense-captures/{id}. Saving edits the draft only: no
 *   transaction, no ledger entry, no balance and no budget change.
 * - every other status → the read-only list, with no Save action at all, so
 *   nothing ever looks editable when the backend would refuse the edit.
 *
 * The draft values are **owned by the page**, not by this component. That is
 * what lets Confirm save unsaved edits before it posts and then confirm
 * against the version PATCH returned — a sibling component could not see a
 * draft held in here. Everything else about the form (validation, touched
 * fields, saving, conflicts) stays local.
 *
 * The page seeds those values from `review_values` per fetch, so reloading
 * the capture rebuilds them from the server's copy — which is exactly what
 * "Reload latest" means, and why it discards local edits.
 *
 * `accounts` and `categories` name an id; without them the id is shown, which
 * is correct rather than invented.
 */
export default function ReviewValues({
  capture,
  accounts = [],
  categories = [],
  isEditable = false,
  isLoadingOptions = false,
  optionsError = null,
  onRetryOptions,
  onSave,
  onReloadLatest,
  // The draft, owned by the page.
  form,
  onFormChange,
  /*
   * Field errors from a request this component did not make — a Confirm that
   * the backend refused on the saved draft. They are shown on the same
   * controls rather than in a second error renderer somewhere else.
   */
  externalErrors = {},
  /*
   * Another write is in flight. Saving and editing are locked so a PATCH can
   * never race the confirmation that is about to spend the draft, or the
   * discard that is about to abandon it.
   */
  isLocked = false,
  // Reports this form's own save into the page's shared action lock.
  onBusyChange,
}) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const values = getReviewValues(capture);

  // Backend 422 field errors from this component's own save.
  const [serverErrors, setServerErrors] = useState({});
  // A client error is only shown once the user has been near the field, so a
  // draft that arrives incomplete isn't covered in red on arrival.
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  // Synchronous guard: a double click fires twice before React re-renders,
  // and two parallel PATCHes would race over the same review_version.
  const pendingRef = useRef(false);

  const label = (field) => {
    const key = `dashboard.aiCaptures.fields.${field}`;
    return i18n.exists(key) ? t(key) : humanizeCaptureField(field);
  };

  const header = (
    <header className="review-values__header">
      <h2 id="review-values-title">{t("dashboard.aiCaptures.details.review.title")}</h2>
      <p>
        {t(
          isEditable
            ? "dashboard.aiCaptures.details.review.editableDescription"
            : "dashboard.aiCaptures.details.review.description",
        )}
      </p>
    </header>
  );

  /* ---------- Read-only ---------- */

  if (!isEditable) {
    const entries = getReviewValueEntries(capture);

    // The id is the value; a name is a courtesy when the list happens to be
    // loaded. Nothing is fabricated when it isn't.
    const named = (list, id) => {
      const match = list.find((item) => String(item.id) === String(id));
      return match?.name ?? `#${id}`;
    };

    const renderValue = ({ field, value }) => {
      if (field === "account_id") return <bdi dir="auto">{named(accounts, value)}</bdi>;
      if (field === "category_id") return <bdi dir="auto">{named(categories, value)}</bdi>;

      /*
       * Money stays the backend's decimal string ("25.0000"); `formatMoney`
       * is display only and the stored value is never replaced by a float.
       */
      if (CAPTURE_MONEY_FIELDS.includes(field)) {
        return <bdi dir="ltr">{formatMoney(value, values.currency_code, locale)}</bdi>;
      }

      if (field === "transaction_date") {
        return <bdi dir="ltr">{formatDate(value, locale)}</bdi>;
      }

      if (["currency_code", "transaction_time", "reference_number"].includes(field)) {
        return <bdi dir="ltr">{String(value)}</bdi>;
      }

      return <bdi dir="auto">{String(value)}</bdi>;
    };

    return (
      <section className="review-values" aria-labelledby="review-values-title">
        {header}

        {entries.length === 0 ? (
          <p className="review-values__empty">
            {t("dashboard.aiCaptures.details.review.empty")}
          </p>
        ) : (
          <dl className="review-values__list">
            {entries.map((entry) => (
              <div className="review-values__row" key={entry.field}>
                <dt>{label(entry.field)}</dt>
                <dd>{renderValue(entry)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );
  }

  /* ---------- Editable draft ---------- */

  const accountOptions = getEligibleAccounts(accounts);
  const categoryOptions = getExpenseCategories(categories);

  const selectedAccount =
    accountOptions.find((account) => String(account.id) === form.account_id) ?? null;

  /*
   * The saved value is always offered, even when it isn't in the loaded list
   * (archived, another type, still loading). Dropping it would silently clear
   * a field the user never touched, and a save would then wipe it.
   */
  const missingOption = (options, id) =>
    id !== "" && !options.some((option) => String(option.id) === id);

  /*
   * The project's shared currency list, plus the workspace's base currency,
   * plus whatever the draft and the account already use — so a value the
   * backend sent is never dropped from the options.
   */
  const currencyOptions = getCurrencyOptions(
    form.currency_code,
    selectedAccount?.currency_code,
  );

  const clientErrors = validateCaptureForm(form, { t, account: selectedAccount });
  const changes = getCaptureChanges(form, capture);
  const isDirty = Object.keys(changes).length > 0;
  const reviewVersion = getReviewVersion(capture);
  const isConflict = isCaptureVersionConflict(saveError);
  const isUncertain = UNKNOWN_OUTCOME_CODES.includes(saveError?.code);

  /*
   * Save is offered only when it would do something: something changed,
   * nothing is in flight, the form is valid, and there is a version to save
   * against. A stale version also blocks it — resending the same one would
   * just fail again, so the only way forward is an explicit reload.
   */
  const canSave =
    isDirty && !isSaving && !isLocked && !isConflict && reviewVersion != null &&
    Object.keys(clientErrors).length === 0;

  /*
   * A backend error wins over a client one, and an error from Confirm is
   * treated exactly like an error from Save — both name a field of the saved
   * draft that the user has to correct.
   */
  const errorFor = (field) =>
    serverErrors[field] ??
    externalErrors[field] ??
    (submitted || touched[field] ? clientErrors[field] : undefined);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const cleared = [name];

    const next = { ...form, [name]: value };

    /*
     * The account carries the currency, and the backend refuses a draft whose
     * currency isn't the account's. Choosing an account therefore syncs the
     * code — and only the code: the amount is left exactly as it is, because
     * this is not a conversion and no rate is applied.
     */
    if (name === "account_id") {
      const account = accountOptions.find((item) => String(item.id) === value);

      if (account?.currency_code) {
        next.currency_code = account.currency_code;
        cleared.push("currency_code");
      }
    }

    onFormChange(next);

    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(cleared.map((field) => [field, true])),
    }));
    setServerErrors((current) => ({
      ...current,
      ...Object.fromEntries(cleared.map((field) => [field, undefined])),
    }));
    setIsSaved(false);

    /*
     * `saveError` is deliberately NOT cleared here. A stale-version conflict
     * is held in it, and clearing it on a keystroke would re-enable Save with
     * the same stale version — exactly the resend the conflict rule forbids.
     * Only a new save attempt, or the reload the conflict asks for, clears it.
     */
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // A confirmation in flight owns the draft until it answers.
    if (pendingRef.current || isLocked) return;

    setSubmitted(true);
    setIsSaved(false);

    if (Object.keys(clientErrors).length > 0) return;

    // Only the changed fields, plus the newest review_version the backend
    // sent. Null when there is nothing to save or no version to save against.
    const payload = buildCaptureUpdatePayload(form, capture);
    if (!payload) return;

    pendingRef.current = true;
    setIsSaving(true);
    onBusyChange?.(true);
    setServerErrors({});
    setSaveError(null);

    try {
      await onSave(payload);
      // The parent applied the backend's copy; the form keeps what the user
      // typed, which the dirty check now finds equal to the saved draft.
      setIsSaved(true);
      setSubmitted(false);
      setTouched({});
    } catch (error) {
      // 401 is the global session-expired flow; nothing to show here.
      if (error?.code === "UNAUTHENTICATED") return;

      setSaveError(error);

      /*
       * A stale version is a 422 too, but it is not a field the user can fix,
       * so it gets the conflict block instead of an inline error.
       */
      if (error?.code === "VALIDATION_ERROR" && !isCaptureVersionConflict(error)) {
        setServerErrors(error.errors ?? {});
      }
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
      onBusyChange?.(false);
    }
  };

  const fieldError = (field) => {
    const messages = errorFor(field);
    if (!messages) return null;

    return (
      <small className="review-values__field-error" id={`${FORM_ID}-${field}-error`}>
        {messages.map((message) => (
          <span key={message} dir="auto">{message}</span>
        ))}
      </small>
    );
  };

  // Everything the backend rejected that has no control of its own (e.g. a
  // field this form doesn't render). Never dropped silently.
  const otherErrors = Object.entries(serverErrors)
    .filter(([field, messages]) => messages && !CAPTURE_EDITABLE_FIELDS.includes(field))
    .flatMap(([, messages]) => messages);

  const controlProps = (field) => ({
    id: `${FORM_ID}-${field}`,
    name: field,
    value: form[field],
    onChange: handleChange,
    disabled: isSaving || isLocked,
    "aria-invalid": errorFor(field) ? true : undefined,
    "aria-describedby": errorFor(field) ? `${FORM_ID}-${field}-error` : undefined,
  });

  const optional = t("dashboard.transactions.form.optional");

  return (
    <section className="review-values review-values--editable" aria-labelledby="review-values-title">
      {header}

      {optionsError && (
        <p className="review-values__options-error" role="alert">
          {getApiErrorMessage(optionsError, t)}{" "}
          <button type="button" className="review-values__link" onClick={onRetryOptions}>
            {t("common.retry")}
          </button>
        </p>
      )}

      <form id={FORM_ID} className="review-values__form" onSubmit={handleSubmit} noValidate>
        <div className="review-values__grid">
          <label className="review-values__field">
            <span>{label("account_id")}</span>
            <select
              {...controlProps("account_id")}
              disabled={isSaving || isLocked || isLoadingOptions}
            >
              <option value="">
                {t("dashboard.aiCaptures.form.selectAccount")}
              </option>
              {missingOption(accountOptions, form.account_id) && (
                <option value={form.account_id}>{`#${form.account_id}`}</option>
              )}
              {accountOptions.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name ?? `#${account.id}`}
                  {account.currency_code ? ` · ${account.currency_code}` : ""}
                </option>
              ))}
            </select>
            {fieldError("account_id")}
          </label>

          <label className="review-values__field">
            <span>{label("category_id")}</span>
            <select
              {...controlProps("category_id")}
              disabled={isSaving || isLocked || isLoadingOptions}
            >
              <option value="">
                {t("dashboard.aiCaptures.form.selectCategory")}
              </option>
              {missingOption(categoryOptions, form.category_id) && (
                <option value={form.category_id}>{`#${form.category_id}`}</option>
              )}
              {categoryOptions.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name ?? `#${category.id}`}
                </option>
              ))}
            </select>
            {fieldError("category_id")}
          </label>

          {/* The AI's merchant is a suggestion in its own section; what the
              user typed here is never replaced by it. */}
          <label className="review-values__field">
            <span>{label("merchant_name")}</span>
            <input type="text" {...controlProps("merchant_name")} autoComplete="off" dir="auto" />
            {fieldError("merchant_name")}
          </label>

          <label className="review-values__field">
            <span>{label("amount")}</span>
            <input
              type="text"
              {...controlProps("amount")}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
            />
            {fieldError("amount")}
          </label>

          <label className="review-values__field">
            <span>{label("currency_code")}</span>
            <select {...controlProps("currency_code")} dir="ltr">
              <option value="">{t("dashboard.aiCaptures.form.selectCurrency")}</option>
              {currencyOptions.map((currency) => (
                <option value={currency} key={currency}>{currency}</option>
              ))}
            </select>
            {fieldError("currency_code")}
            {selectedAccount?.currency_code && !errorFor("currency_code") && (
              <small className="review-values__hint">
                {t("dashboard.aiCaptures.form.currencyFromAccount", {
                  currency: selectedAccount.currency_code,
                })}
              </small>
            )}
          </label>

          <label className="review-values__field">
            <span>{label("transaction_date")}</span>
            {/* "YYYY-MM-DD" in and out: never locale-formatted before sending. */}
            <input type="date" {...controlProps("transaction_date")} />
            {fieldError("transaction_date")}
          </label>

          <label className="review-values__field">
            <span>
              {label("transaction_time")} ({optional})
            </span>
            {/*
              * Seconds are offered only when the stored value has some: the
              * form never invents `:00` for a time the user typed as HH:mm.
              */}
            <input
              type="time"
              {...controlProps("transaction_time")}
              step={form.transaction_time.length > 5 ? 1 : undefined}
            />
            {fieldError("transaction_time")}
          </label>

          <label className="review-values__field">
            <span>
              {label("reference_number")} ({optional})
            </span>
            <input
              type="text"
              {...controlProps("reference_number")}
              maxLength={REFERENCE_NUMBER_MAX}
              autoComplete="off"
              dir="auto"
            />
            {fieldError("reference_number")}
          </label>

          <label className="review-values__field">
            <span>
              {label("tax_amount")} ({optional})
            </span>
            <input
              type="text"
              {...controlProps("tax_amount")}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
            />
            {fieldError("tax_amount")}
          </label>

          <label className="review-values__field">
            <span>
              {label("fee_amount")} ({optional})
            </span>
            <input
              type="text"
              {...controlProps("fee_amount")}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
            />
            {fieldError("fee_amount")}
          </label>

          <label className="review-values__field review-values__field--wide">
            <span>
              {label("description")} ({optional})
            </span>
            {/* maxLength stops the field at the documented limit rather than
                letting the UI truncate text after the fact. */}
            <textarea
              {...controlProps("description")}
              rows={3}
              maxLength={CAPTURE_DESCRIPTION_MAX}
              dir="auto"
            />
            {fieldError("description")}
          </label>
        </div>

        {otherErrors.length > 0 && (
          <div className="review-values__error" role="alert">
            {otherErrors.map((message) => (
              <p key={message} dir="auto">{message}</p>
            ))}
          </div>
        )}

        {/*
          * A stale review_version: someone else saved this draft after it was
          * loaded here. Nothing is retried automatically, the same version is
          * never resent, and the user's edits are left untouched on screen
          * until they choose to replace them.
          */}
        {isConflict && (
          <div className="review-values__conflict" role="alert">
            <p>
              <LuTriangleAlert aria-hidden="true" />
              <span dir="auto">{t("dashboard.aiCaptures.form.conflict.message")}</span>
            </p>
            <p className="review-values__conflict-warning">
              {t("dashboard.aiCaptures.form.conflict.discards")}
            </p>

            <button type="button" className="review-values__reload" onClick={onReloadLatest}>
              <LuRotateCcw aria-hidden="true" />
              {t("dashboard.aiCaptures.form.conflict.reload")}
            </button>
          </div>
        )}

        {!isConflict && saveError && (
          <div className="review-values__error" role="alert">
            <p dir="auto">
              {t("dashboard.aiCaptures.form.saveFailed")} {getApiErrorMessage(saveError, t)}
            </p>

            {/*
              * A timeout or a dead connection leaves the outcome unknown, so
              * nothing here claims the draft was saved. The edits stay in the
              * form and the user can retry or read the server's copy.
              */}
            {isUncertain && (
              <>
                <p>{t("dashboard.aiCaptures.form.saveUncertain")}</p>
                <button type="button" className="review-values__link" onClick={onReloadLatest}>
                  {t("dashboard.aiCaptures.form.conflict.reload")}
                </button>
              </>
            )}

            <button type="submit" className="review-values__retry" disabled={!canSave}>
              {t("dashboard.aiCaptures.form.retrySave")}
            </button>
          </div>
        )}

        <footer className="review-values__actions">
          <button type="submit" className="review-values__save" disabled={!canSave}>
            {t(isSaving ? "common.saving" : "dashboard.aiCaptures.form.save")}
          </button>

          <p className="review-values__status" role="status">
            {isSaving
              ? t("dashboard.aiCaptures.form.saving")
              : isSaved && !isDirty
                ? (
                    <>
                      <LuCheck aria-hidden="true" />
                      {t("dashboard.aiCaptures.form.saved")}
                    </>
                  )
                : isDirty
                  ? t("dashboard.aiCaptures.form.unsaved")
                  : reviewVersion == null
                    ? t("dashboard.aiCaptures.form.noVersion")
                    : t("dashboard.aiCaptures.form.upToDate")}
          </p>
        </footer>
      </form>
    </section>
  );
}
