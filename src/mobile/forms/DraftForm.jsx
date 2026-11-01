import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { sessionWorkspace } from "../data/readApi.js";
import { isWriteOpen } from "../data/writeGate.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import { useOnline } from "../ui/useOnline.js";
import { useWorkflowSubmit } from "./useWorkflowSubmit.js";
import { normalizeAmount } from "./validation.js";
import { buildWrite } from "./writePayloads.js";
import { FORM_CURRENCIES, accountChoices, categoryChoices, changedFields, currencyFor, effectKeyOf, isDirty, isLocked, isRequired, validateWorkflow, visibleFields } from "./workflows.js";

const MAX_FOR = (field) => (field.kind === "text" || field.kind === "textarea" ? field.max ?? 255 : undefined);

/*
 * One Mobile form, from the first field to the review.
 *
 *   edit -> review [-> sending -> recorded | refused | unknown | changed]
 *
 * "Review" checks every field (the documented rules, workflows.js) and moves the
 * focus to a summary of what is wrong, or shows the review. The review lists
 * what would be sent and what it would do.
 *
 * While the write gate is closed for this form's operation (data/writeGate.js:
 * every operation, in the production-bound source), the review ends where the
 * request would start: the send button is disabled, the reason is next to it,
 * and the full version is one tap away. Nothing is sent.
 *
 * Only when the gate is open does the send button send, once, through
 * useWorkflowSubmit (one Idempotency-Key per submission intent, no retry, no
 * queue, no storage) with the input built by writePayloads.js. The draft lives
 * in this component's state only, so it is gone when the page is left, when the
 * identity changes (the identity boundary remounts everything) and when the tab
 * is closed.
 *
 * The leave guard holds every navigation away while anything was typed and
 * nothing was sent; after a recorded or unknown outcome there is no draft to lose.
 */
export default function DraftForm({ workflow, ctx, choices, backTo, recordSummary }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const navigate = useNavigate();
  const online = useOnline();
  const ids = useId();
  const full = useMemo(() => ({ ...ctx, accounts: choices.accounts, categories: choices.categories }), [ctx, choices.accounts, choices.categories]);
  const [values, setValues] = useState(() => workflow.initial(ctx));
  const [step, setStep] = useState("edit");
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef(null);
  const reviewRef = useRef(null);
  const lastFieldRef = useRef(null);

  const errors = useMemo(() => validateWorkflow(workflow, values, full), [workflow, values, full]);
  const shown = attempted ? errors : {};
  const errorNames = Object.keys(shown);
  const dirty = isDirty(workflow, values, full);
  const sent = useWorkflowSubmit();
  const settled = ["confirmed", "unknown", "changed"].includes(sent.phase);
  const guard = useLeaveGuard(dirty && !settled && !sent.sending);
  const fields = visibleFields(workflow, values, full);
  const operationOpen = isWriteOpen(workflow.operation);
  const effectKey = effectKeyOf(workflow, full);
  const outcomeRef = useRef(null);

  useEffect(() => {
    if (sent.phase !== "idle" && sent.phase !== "sending") outcomeRef.current?.focus();
  }, [sent.phase]);

  const send = () => sent.submit(buildWrite(workflow, values, { ...full, workspaceId: sessionWorkspace()?.id ?? null }));

  const problemSignal = attempted ? errorNames.join(",") : "";
  useEffect(() => {
    if (problemSignal) summaryRef.current?.focus();
  }, [problemSignal]);

  useEffect(() => {
    if (step === "review") reviewRef.current?.focus();
  }, [step]);

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  const toReview = (event) => {
    event.preventDefault();
    setAttempted(true);
    if (Object.keys(validateWorkflow(workflow, values, full)).length === 0) setStep("review");
  };

  const rememberFocus = (event) => {
    if (event.currentTarget.contains(event.target)) lastFieldRef.current = event.target;
  };
  const focusField = (id) => (event) => {
    event.preventDefault();
    document.getElementById(id)?.focus();
  };
  const fieldId = (name) => `${ids}-${name}`;
  const label = (field) => t(`forms.fields.${workflow.labels?.[field.name] ?? field.name}`);
  const errorText = (field, code) => t(`forms.errors.${code}`, { max: field?.max, min: field?.min, field: field ? label(field) : "" });

  const display = (field, value) => {
    if (field.kind === "account") {
      const account = full.accounts.find((item) => item.id === String(value));
      return account ? <><bdi className="sm-user-text">{account.name ?? t("forms.unnamed")}</bdi> <bdi dir="ltr">{account.currency}</bdi></> : null;
    }
    if (field.kind === "category") {
      const category = full.categories.find((item) => item.id === String(value));
      return category ? <bdi className="sm-user-text">{category.name ?? t("forms.unnamed")}</bdi> : null;
    }
    if (field.kind === "amount") {
      const amount = normalizeAmount(value);
      return amount ? <Money plain value={amount} currency={currencyFor(field, values, full) ?? undefined} /> : null;
    }
    if (field.kind === "date") return value ? <bdi>{formatDay(value, locale, "UTC") ?? value}</bdi> : null;
    if (field.kind === "choice") return value ? t(`forms.options.${field.optionKey}.${value}`) : null;
    if (field.kind === "currency") return value ? <bdi dir="ltr">{value}</bdi> : null;
    if (field.kind === "check") return t(value ? "forms.yes" : "forms.no");
    // A password is never shown, not even in the review.
    if (field.kind === "password") return value ? t("forms.passwordEntered") : null;
    if (field.kind === "email") return value?.trim() ? <bdi dir="ltr">{value.trim()}</bdi> : null;
    if (field.kind === "locked") {
      const locked = field.value(full);
      if (!locked) return null;
      return field.optionKey ? t(`forms.options.${field.optionKey}.${locked}`, { defaultValue: locked }) : <bdi dir="auto">{locked}</bdi>;
    }
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed ? <bdi dir="auto" className="sm-user-text">{trimmed}</bdi> : null;
  };

  const leaveSheet = () => (
    <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t("forms.discardTitle")} returnFocusRef={lastFieldRef}>
      <p className="sm-text">{t("forms.discardBody")}</p>
      <div className="sm-actions sm-leave-actions">
        <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t("forms.keepEditing")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
      </div>
    </MobileSheet>
  );

  const changed = new Set(changedFields(workflow, values, full).map((field) => field.name));

  if (step === "review") {
    const rows = fields.filter((field) => field.kind !== "locked" || field.value(full)).map((field) => ({ field, shown: field.kind === "locked" ? display(field) : display(field, values[field.name]) })).filter((row) => row.shown !== null);

    return (
      <section className="sm-form-review" data-sm-step="review" data-sm-workflow={workflow.id} aria-labelledby={`${ids}-review`}>
        <div className="sm-card" tabIndex={-1} ref={reviewRef}>
          <h2 id={`${ids}-review`} className="sm-card-title">{t("forms.reviewTitle")}</h2>
          <p className="sm-text sm-muted">{t(`forms.flows.${workflow.id}.reviewIntro`)}</p>
          {recordSummary}
          {rows.length > 0 && (
            <dl className="sm-stats sm-stats-stacked sm-review-list">
              {rows.map(({ field, shown: value }) => (
                <div key={field.name} className="sm-stat" data-sm-field={field.name} data-sm-changed={changed.has(field.name) ? "true" : undefined}>
                  <dt>{label(field)}{changed.has(field.name) && <span className="sm-chip sm-review-changed">{t("forms.changed")}</span>}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {effectKey && <p className="sm-text sm-review-effect" data-sm-effect={effectKey}>{t(`forms.effects.${effectKey}`)}</p>}
        </div>

        {!operationOpen && (
          <div className="sm-card sm-closed" role="note" data-sm-note="write-closed" data-sm-write={workflow.operation} id={`${ids}-closed`}>
            <h2 className="sm-card-title">{t("forms.notSentTitle")}</h2>
            <p className="sm-text sm-muted">{t("forms.notSentBody")}</p>
            <Link className="sm-link-row" to={workflow.fullPath(full)} data-sm-action="full-version">
              <span>{t(`forms.flows.${workflow.id}.full`)}</span>
              <Chevron />
            </Link>
          </div>
        )}

        {operationOpen && sent.phase !== "idle" && sent.phase !== "sending" && (
          <WriteOutcome outcome={sent} outcomeRef={outcomeRef} backTo={backTo} t={t} />
        )}

        {!settled && (
          <div className="sm-actions sm-form-actions">
            {operationOpen ? (
              <button type="button" className="sm-button" onClick={send} disabled={sent.sending} aria-busy={sent.sending ? "true" : undefined} data-sm-action="send" data-sm-open="true">
                {sent.sending ? t("forms.outcome.sending") : t(`forms.flows.${workflow.id}.send`)}
              </button>
            ) : (
              /* Disabled: no handler, and the write gate answers "closed" for this operation. */
              <button type="button" className="sm-button" disabled aria-describedby={`${ids}-closed`} data-sm-action="send" data-sm-open="false">
                {t(`forms.flows.${workflow.id}.send`)}
              </button>
            )}
            <button type="button" className="sm-button sm-button-quiet" onClick={() => { sent.reset(); setStep("edit"); }} disabled={sent.sending} data-sm-action="edit">
              {t("forms.backToEdit")}
            </button>
          </div>
        )}
        {leaveSheet()}
      </section>
    );
  }

  if (choices.loading) return <Skeleton lines={6} label={t("forms.loadingChoices")} />;

  const formError = shown._form;

  return (
    <form className="sm-draft-form" onSubmit={toReview} onFocusCapture={rememberFocus} noValidate data-sm-step="edit" data-sm-workflow={workflow.id}>
      <div className="sm-closed sm-closed-compact" role="note" data-sm-note="draft-only">
        <p className="sm-text sm-muted">{t("forms.draftOnly")}</p>
      </div>

      {!online && <p className="sm-text sm-muted sm-fine" role="status" data-sm-note="offline-form">{t("forms.offline")}</p>}
      {choices.error && <ErrorPanel error={choices.error} onRetry={choices.retry} retrying={choices.retrying} compact />}
      {choices.stale && !choices.error && <StaleNotice onRetry={choices.retry} retrying={choices.retrying} />}

      {errorNames.length > 0 && (
        <div className="sm-card sm-error sm-cat-summary" role="alert" tabIndex={-1} ref={summaryRef} aria-labelledby={`${ids}-summary`} data-sm-summary="local">
          <h2 id={`${ids}-summary`} className="sm-card-title">{t("forms.summary")}</h2>
          {formError && <p className="sm-text">{t(`forms.errors.${formError}`)}</p>}
          <ul className="sm-cat-summary-list">
            {errorNames.filter((name) => name !== "_form").map((name) => {
              const field = workflow.fields.find((item) => item.name === name);
              return (
                <li key={name}>
                  <a href={`#${fieldId(name)}`} onClick={focusField(fieldId(name))}>{label(field)}: {errorText(field, shown[name])}</a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {recordSummary && <div className="sm-card">{recordSummary}</div>}

      <fieldset className="sm-card sm-fieldset sm-cat-fields">
        <legend className="sm-sr">{t(`forms.flows.${workflow.id}.legend`)}</legend>
        {fields.length === 0 && <p className="sm-text">{t(`forms.flows.${workflow.id}.noFields`)}</p>}
        {fields.map((field) => (
          <Field key={field.name} field={field} id={fieldId(field.name)} label={label(field)} value={values[field.name]} values={values} ctx={full} error={shown[field.name] ? errorText(field, shown[field.name]) : null} onChange={set} display={display} t={t} />
        ))}
      </fieldset>

      <div className="sm-actions sm-form-actions">
        <button type="submit" className="sm-button" data-sm-action="review">{t("forms.review")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={() => navigate(backTo)} data-sm-action="cancel">{t("forms.cancel")}</button>
      </div>
      {leaveSheet()}
    </form>
  );
}

/* The answer to a sent write, as the server gave it; an unknown one claims nothing either way. */
function WriteOutcome({ outcome, outcomeRef, backTo, t }) {
  const kind = outcome.phase;
  const serverMessage = kind === "rejected" && typeof outcome.error?.message === "string" ? outcome.error.message.slice(0, 300) : null;
  const fieldMessages = kind === "rejected" && outcome.error?.errors && typeof outcome.error.errors === "object"
    ? Object.values(outcome.error.errors).flat().filter((item) => typeof item === "string").slice(0, 6).map((item) => item.slice(0, 300))
    : [];
  const bodyKey = kind === "rejected" ? (outcome.code === "RATE_LIMITED" ? "rateLimited" : outcome.code === "NO_WORKSPACE" ? "noWorkspace" : outcome.code === "WRITE_CLOSED" ? "closed" : "rejectedBody") : `${kind}Body`;
  const refused = kind === "rejected";

  return (
    <div
      className={refused ? "sm-card sm-error" : "sm-card"}
      role={kind === "rejected" ? "alert" : "status"}
      tabIndex={-1}
      ref={outcomeRef}
      data-sm-outcome={kind}
      data-sm-code={outcome.code ?? undefined}
    >
      <h2 className="sm-card-title">{t(`forms.outcome.${kind}Title`)}</h2>
      <p className="sm-text">{t(`forms.outcome.${bodyKey}`)}</p>
      {serverMessage && <p className="sm-text sm-muted" dir="auto">{serverMessage}</p>}
      {fieldMessages.length > 0 && (
        <ul className="sm-cat-summary-list">
          {fieldMessages.map((message) => <li key={message} dir="auto">{message}</li>)}
        </ul>
      )}
      {kind !== "rejected" && (
        <Link className="sm-link-row" to={backTo} data-sm-action="after-write">
          <span>{t("forms.outcome.back")}</span>
          <Chevron />
        </Link>
      )}
    </div>
  );
}

function Field({ field, id, label, value, values, ctx, error, onChange, display, t }) {
  const required = isRequired(field, values, ctx);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : field.hint ? hintId : undefined;
  const hint = field.hint ? <p id={hintId} className="sm-text sm-muted sm-fine">{t(`forms.hints.${field.hint}`, { max: MAX_FOR(field) })}</p> : null;
  const errorLine = error ? <p id={errorId} className="sm-text sm-form-error">{error}</p> : null;
  const mark = required ? <span className="sm-required">{t("forms.required")}</span> : <span className="sm-muted sm-fine">{t("forms.optional")}</span>;
  const common = { id, "aria-invalid": error ? "true" : undefined, "aria-describedby": describedBy, "aria-required": required ? "true" : undefined };

  if (isLocked(field, ctx)) {
    const shown = field.kind === "locked" ? display(field) : display(field, value);
    return (
      <div className="sm-field" data-sm-field={field.name} data-sm-locked="true">
        <span className="sm-label">{label}</span>
        <p className="sm-text">{shown ?? t("forms.notSet")}</p>
        {hint}
      </div>
    );
  }

  if (field.kind === "choice") {
    return (
      <fieldset className="sm-fieldset sm-field" data-sm-field={field.name} aria-invalid={error ? "true" : undefined} aria-describedby={describedBy}>
        <legend className="sm-label">{label} {mark}</legend>
        {field.options.map((option, index) => (
          <label key={option} className="sm-choice sm-cat-choice">
            <input id={index === 0 ? id : `${id}-${option}`} type="radio" name={id} value={option} checked={value === option} onChange={() => onChange(field.name, option)} />
            <span>{t(`forms.options.${field.optionKey}.${option}`)}</span>
          </label>
        ))}
        {errorLine ?? hint}
      </fieldset>
    );
  }

  if (field.kind === "check") {
    return (
      <div className="sm-field" data-sm-field={field.name}>
        <label className="sm-choice sm-cat-choice">
          <input {...common} type="checkbox" checked={value === true} onChange={(event) => onChange(field.name, event.target.checked)} />
          <span>{label}</span>
        </label>
        {hint}
      </div>
    );
  }

  let control;
  if (field.kind === "account" || field.kind === "category" || field.kind === "currency") {
    const options =
      field.kind === "account"
        ? accountChoices(field, values, ctx).map((account) => ({ value: account.id, text: `${account.name ?? t("forms.unnamed")} · ${account.currency ?? "—"}` }))
        : field.kind === "category"
          ? categoryChoices(field, values, ctx).map((category) => ({ value: category.id, text: category.name ?? t("forms.unnamed") }))
          : FORM_CURRENCIES.map((code) => ({ value: code, text: code }));
    control = (
      <select {...common} className="sm-select" value={value ?? ""} onChange={(event) => onChange(field.name, event.target.value)}>
        <option value="">{t(required ? "forms.choose" : "forms.none")}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.text}</option>)}
      </select>
    );
    if (field.kind !== "currency" && options.length === 0) control = <>{control}<p className="sm-text sm-muted sm-fine" data-sm-note="no-choices">{t(`forms.noChoices.${field.kind}`)}</p></>;
  } else if (field.kind === "amount") {
    const currency = currencyFor(field, values, ctx);
    const fill = field.fill?.(ctx);
    control = (
      <>
        <span className="sm-amount-input">
          <input {...common} className="sm-input" type="text" inputMode="decimal" dir="ltr" autoComplete="off" value={value ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />
          <bdi dir="ltr" className="sm-amount-currency" aria-hidden={currency ? undefined : "true"}>{currency ?? "—"}</bdi>
        </span>
        {fill && <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => onChange(field.name, fill)} data-sm-action="fill">{t("forms.fillRemaining")}</button>}
      </>
    );
  } else if (field.kind === "date") {
    control = <input {...common} className="sm-input" type="date" dir="ltr" value={value ?? ""} max={field.max === "today" ? ctx.today : undefined} onChange={(event) => onChange(field.name, event.target.value)} />;
  } else if (field.kind === "integer") {
    control = <input {...common} className="sm-input" type="text" inputMode="numeric" dir="ltr" autoComplete="off" value={value ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />;
  } else if (field.kind === "textarea") {
    control = <textarea {...common} className="sm-input sm-textarea" dir="auto" rows={3} value={value ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />;
  } else if (field.kind === "email") {
    control = <input {...common} className="sm-input" type="email" inputMode="email" dir="ltr" autoComplete="email" value={value ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />;
  } else if (field.kind === "password") {
    control = <input {...common} className="sm-input" type="password" dir="ltr" autoComplete={field.autoComplete ?? "off"} value={value ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />;
  } else {
    control = <input {...common} className="sm-input" type="text" dir="auto" autoComplete="off" value={value ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />;
  }

  return (
    <div className="sm-field" data-sm-field={field.name}>
      <label className="sm-label" htmlFor={id}>{label} {mark}</label>
      {control}
      {errorLine ?? hint}
    </div>
  );
}
