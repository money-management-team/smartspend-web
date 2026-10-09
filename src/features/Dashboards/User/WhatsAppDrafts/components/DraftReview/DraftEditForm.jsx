import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LuRotateCcw, LuSave } from "react-icons/lu";

import { DraftStatusBadge } from "../DraftStatus/DraftStatus.jsx";

const x = "dashboard.whatsappDrafts.review";

function ErrorText({ id, code }) {
  const { t } = useTranslation();
  if (!code) return null;
  return <p className="wad-field-error" id={id} role="alert">{t(`${x}.fieldErrors.${code}`)}</p>;
}

/*
 * The edit form of a draft the backend lets the user edit. Values are strings
 * the whole way: the amount is a text input with a decimal keyboard (a number
 * input would round-trip through a float), the date is the calendar date as
 * typed (no UTC conversion) and the currency is only displayed, taken from the
 * selected account. Saving sends the changed fields only and never confirms.
 */
export default function DraftEditForm({
  draft, form, fieldErrors, saveState, saveMessage, choices, dirty, onChange, onSave, onReset, disabled,
}) {
  const { t } = useTranslation();
  const id = useId();
  const saving = saveState.phase === "saving";
  const locked = disabled || saving;
  const timeZone = draft.review_values.workspace_timezone;

  const accounts = choices.accounts;
  const selectedAccount = accounts.find((account) => String(account.id) === form.account_id);
  const currency = selectedAccount?.currency_code ?? draft.review_values.currency_code ?? "";
  const stale = (list, value) => value !== "" && !list.some((item) => String(item.id) === value);

  const submit = (event) => {
    event.preventDefault();
    if (!locked) onSave();
  };

  return (
    <form className="wad-card wad-form" onSubmit={submit} aria-busy={saving} noValidate aria-labelledby={`${id}-title`}>
      <header className="wad-card__head">
        <h2 id={`${id}-title`}>{t(`${x}.formTitle`)}</h2>
        <div className="wad-card__badges">
          {dirty && <span className="wad-chip wad-chip--warn">{t(`${x}.unsaved`)}</span>}
          <DraftStatusBadge status={draft.status} />
        </div>
      </header>

      <div className="wad-form__grid">
        <div className="wad-input wad-input--wide">
          <label htmlFor={`${id}-amount`}>{t(`${x}.amount`)}</label>
          <div className="wad-input__amount">
            <input
              id={`${id}-amount`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              value={form.amount}
              placeholder="0.00"
              disabled={locked}
              aria-invalid={fieldErrors.amount ? "true" : undefined}
              aria-describedby={fieldErrors.amount ? `${id}-amount-error` : `${id}-amount-hint`}
              onChange={(event) => onChange("amount", event.target.value)}
            />
            <span className="wad-input__currency" dir="ltr">{currency || "—"}</span>
          </div>
          <p className="wad-hint" id={`${id}-amount-hint`}>{t(`${x}.currencyHint`)}</p>
          <ErrorText id={`${id}-amount-error`} code={fieldErrors.amount} />
        </div>

        <div className="wad-input">
          <label htmlFor={`${id}-account`}>{t(`${x}.account`)}</label>
          <select
            id={`${id}-account`}
            value={form.account_id}
            disabled={locked || choices.loading}
            aria-invalid={fieldErrors.account_id ? "true" : undefined}
            aria-describedby={fieldErrors.account_id ? `${id}-account-error` : undefined}
            onChange={(event) => onChange("account_id", event.target.value)}
          >
            <option value="">{choices.loading ? t(`${x}.loading`) : t(`${x}.choose`)}</option>
            {stale(accounts, form.account_id) && !choices.loading && (
              <option value={form.account_id}>{draft.account?.name ?? t(`${x}.unavailable`)}</option>
            )}
            {accounts.map((account) => (
              <option key={account.id} value={String(account.id)}>{account.name} · {account.currency_code}</option>
            ))}
          </select>
          <ErrorText id={`${id}-account-error`} code={fieldErrors.account_id} />
        </div>

        <div className="wad-input">
          <label htmlFor={`${id}-category`}>{t(`${x}.category`)}</label>
          <select
            id={`${id}-category`}
            value={form.category_id}
            disabled={locked || choices.loading}
            aria-invalid={fieldErrors.category_id ? "true" : undefined}
            aria-describedby={fieldErrors.category_id ? `${id}-category-error` : undefined}
            onChange={(event) => onChange("category_id", event.target.value)}
          >
            <option value="">{choices.loading ? t(`${x}.loading`) : t(`${x}.choose`)}</option>
            {stale(choices.categories, form.category_id) && !choices.loading && (
              <option value={form.category_id}>{draft.category?.name ?? t(`${x}.unavailable`)}</option>
            )}
            {choices.categories.map((category) => (
              <option key={category.id} value={String(category.id)}>{category.name}</option>
            ))}
          </select>
          <ErrorText id={`${id}-category-error`} code={fieldErrors.category_id} />
        </div>

        <div className="wad-input">
          <label htmlFor={`${id}-date`}>{t(`${x}.date`)}</label>
          <input
            id={`${id}-date`}
            type="date"
            value={form.transaction_date}
            required
            disabled={locked}
            aria-invalid={fieldErrors.transaction_date ? "true" : undefined}
            aria-describedby={fieldErrors.transaction_date ? `${id}-date-error` : undefined}
            onChange={(event) => onChange("transaction_date", event.target.value)}
          />
          <ErrorText id={`${id}-date-error`} code={fieldErrors.transaction_date} />
        </div>

        <div className="wad-input">
          <label htmlFor={`${id}-time`}>
            {t(`${x}.time`)} <span className="wad-optional">{t(`${x}.optional`)}</span>
          </label>
          <div className="wad-input__row">
            <input
              id={`${id}-time`}
              type="time"
              value={form.transaction_time}
              disabled={locked}
              aria-invalid={fieldErrors.transaction_time ? "true" : undefined}
              aria-describedby={`${id}-time-hint${fieldErrors.transaction_time ? ` ${id}-time-error` : ""}`}
              onChange={(event) => onChange("transaction_time", event.target.value)}
            />
            {form.transaction_time !== "" && (
              <button type="button" className="wad-button wad-button--ghost" disabled={locked} onClick={() => onChange("transaction_time", "")}>
                {t(`${x}.clearTime`)}
              </button>
            )}
          </div>
          <p className="wad-hint" id={`${id}-time-hint`}>
            {timeZone ? t(`${x}.timeHint`, { zone: timeZone }) : t(`${x}.timeHintNoZone`)}
          </p>
          <ErrorText id={`${id}-time-error`} code={fieldErrors.transaction_time} />
        </div>

        <div className="wad-input wad-input--wide">
          <label htmlFor={`${id}-description`}>
            {t(`${x}.description`)} <span className="wad-optional">{t(`${x}.optional`)}</span>
          </label>
          <textarea
            id={`${id}-description`}
            rows={3}
            value={form.description}
            disabled={locked}
            aria-invalid={fieldErrors.description ? "true" : undefined}
            aria-describedby={fieldErrors.description ? `${id}-description-error` : undefined}
            onChange={(event) => onChange("description", event.target.value)}
          />
          <ErrorText id={`${id}-description-error`} code={fieldErrors.description} />
        </div>
      </div>

      <p className="wad-note">{t(`${x}.saveNote`)}</p>

      {saveState.phase === "error" && saveMessage && (
        <p className="wad-error" role="alert">{saveMessage}</p>
      )}

      <div className="wad-form__actions">
        <button type="submit" className="wad-button wad-button--primary" disabled={locked || !dirty}>
          <LuSave aria-hidden="true" />
          {saving ? t(`${x}.saving`) : t(`${x}.save`)}
        </button>
        <button type="button" className="wad-button" disabled={locked || !dirty} onClick={onReset}>
          <LuRotateCcw aria-hidden="true" />
          {t(`${x}.cancelEdit`)}
        </button>
      </div>
    </form>
  );
}
