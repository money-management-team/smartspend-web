import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { categoryLoader, keys } from "../data/loaders.js";
import { isAccountId, sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { sendCategoryCreate, sendCategoryUpdate } from "../data/writeApi.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { CATEGORY_TYPES, NAME_MAX, buildCategoryDetail } from "../models/categories.js";
import { buildCreatePayload, buildUpdatePayload, confirmCreate, confirmUpdate, fieldErrorsOf, validateName, validateType, workspaceIdForBody } from "../models/categoryForm.js";
import { MOBILE_CATEGORIES, backPathFrom, categoryDetailPath } from "../navigation.js";
import RecordScreen from "../planning/RecordScreen.jsx";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import CategoryOutcome from "./CategoryOutcome.jsx";
import { useCategoryMutation } from "./useCategoryMutation.js";
import { useLeaveGuard } from "./useLeaveGuard.js";

const REJECTION_KEYS = { VALIDATION_ERROR: "validation", FORBIDDEN: "forbidden", NOT_FOUND: "notFound" };

/*
 * The category form, for a new category or a rename.
 *
 *   create: name and type, sent as POST /categories with the session's workspace;
 *   edit:   the name only, sent as PATCH /categories/{id} { name } when it changed.
 *
 * Locked here, and said so: the type of an existing category (changing it changes
 * what its existing transactions mean), its colour and icon, and archiving. No
 * parent is offered: no parent field is documented for a write.
 *
 * Validation runs before anything is sent; the server's own 422 messages are
 * shown under the field they name and in the summary at the top, which takes the
 * focus. While a request runs everything is disabled; the outcome rules are in
 * useCategoryMutation.js.
 */
function CategoryForm({ mode, category, backTo }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const navigate = useNavigate();
  const ids = useId();
  const mutation = useCategoryMutation();
  // Seeded once: a later read of the same category does not overwrite what is being typed.
  const [name, setName] = useState(() => (mode === "edit" ? category.name ?? "" : ""));
  const [type, setType] = useState("");
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef(null);
  // Where the person was in the form when a navigation was held: "Keep editing" puts the focus back there.
  const lastFieldRef = useRef(null);
  const [workspaceId] = useState(() => (mode === "create" ? workspaceIdForBody(sessionWorkspace()) : null));

  const original = mode === "edit" ? category.name ?? "" : "";
  const dirty = mode === "edit" ? name.trim() !== original.trim() : name.trim() !== "" || type !== "";
  const local = { name: validateName(name), type: mode === "create" ? validateType(type) : null };
  const server = mutation.phase === "rejected" && mutation.code === "VALIDATION_ERROR" ? fieldErrorsOf(mutation.rejection) : { name: null, type: null };
  const nameError = server.name ?? (attempted && local.name ? t(`categories.form.validation.${local.name}`, { max: NAME_MAX }) : null);
  const typeError = server.type ?? (attempted && local.type ? t("categories.form.validation.typeRequired") : null);
  const rejected = mutation.phase === "rejected";
  const blocked = mode === "create" && workspaceId === null;
  const showSummary = (attempted && (local.name || local.type)) || rejected;

  // Unsaved edits, or a request on its way: every navigation away is held and asked about (useLeaveGuard.js).
  const editing = mutation.phase === "editing" || mutation.phase === "rejected";
  const guard = useLeaveGuard((dirty && editing) || mutation.submitting);

  // A new problem (on submit, or the server's answer) moves the focus to the summary.
  const problemSignal = `${attempted && (local.name || local.type) ? "local" : ""}:${rejected ? mutation.code : ""}`;
  useEffect(() => {
    if (problemSignal !== ":") summaryRef.current?.focus();
  }, [problemSignal]);

  if (mutation.phase === "confirmed" || mutation.phase === "unknown" || mutation.phase === "changed") {
    return <CategoryOutcome kind={mutation.phase} mode={mode} category={mutation.category} categoryId={category?.id} code={mutation.code} status={mutation.status} />;
  }

  const submit = (event) => {
    event.preventDefault();
    if (mutation.submitting || blocked) return;

    setAttempted(true);
    if (local.name || local.type) return;
    if (mode === "edit" && !dirty) return;

    if (mode === "create") {
      const payload = buildCreatePayload({ workspaceId, name, type });
      mutation.start({
        operation: "create",
        send: () => sendCategoryCreate(payload),
        prove: (data) => confirmCreate(data, { name: payload.name, type: payload.type, workspaceId }),
        // The workspace it was sent for must still be the session's when the answer arrives, or the answer is not shown as this screen's.
        stillCurrent: () => workspaceIdForBody(sessionWorkspace()) === workspaceId,
      });
    } else {
      const payload = buildUpdatePayload({ name });
      mutation.start({ operation: "update", send: () => sendCategoryUpdate(category.id, payload), prove: (data) => confirmUpdate(data, category.id, payload.name) });
    }
  };

  // Only the form's own fields: the leave dialog is portalled, and its focus events reach this form through React.
  const rememberFocus = (event) => {
    if (event.currentTarget.contains(event.target)) lastFieldRef.current = event.target;
  };
  // Cancel is a navigation like any other: with a draft, the guard asks first.
  const cancel = () => navigate(backTo);
  const focusField = (id) => (event) => {
    event.preventDefault();
    document.getElementById(id)?.focus();
  };
  const nameId = `${ids}-name`;
  const typeId = `${ids}-type`;
  const rejectionText = rejected ? t(`categories.form.rejected.${REJECTION_KEYS[mutation.code] ?? "other"}`) : null;
  const serverMessage = rejected && mutation.code === "VALIDATION_ERROR" && mutation.rejection?.message ? mutation.rejection.message.slice(0, 300) : null;

  return (
    <form className="sm-cat-form" onSubmit={submit} onFocusCapture={rememberFocus} noValidate aria-busy={mutation.submitting} data-sm-form={mode} data-sm-phase={mutation.phase}>
      {showSummary && (
        <div className="sm-card sm-error sm-cat-summary" role="alert" tabIndex={-1} ref={summaryRef} aria-labelledby={`${ids}-summary`} data-sm-summary={rejected ? `rejected:${mutation.code}` : "local"}>
          <h2 id={`${ids}-summary`} className="sm-card-title">{t(rejected ? "categories.form.summaryRejected" : "categories.form.summary")}</h2>
          {rejectionText && <p className="sm-text">{rejectionText}</p>}
          {serverMessage && <p className="sm-text"><bdi className="sm-user-text">{serverMessage}</bdi></p>}
          {(nameError || typeError) && (
            <ul className="sm-cat-summary-list">
              {nameError && <li><a href={`#${nameId}`} onClick={focusField(nameId)}>{t("categories.form.name")}: {nameError}</a></li>}
              {typeError && <li><a href={`#${typeId}-${CATEGORY_TYPES[0]}`} onClick={focusField(`${typeId}-${CATEGORY_TYPES[0]}`)}>{t("categories.form.type")}: {typeError}</a></li>}
            </ul>
          )}
        </div>
      )}

      {blocked && (
        <div className="sm-card" role="note" data-sm-note="no-workspace">
          <p className="sm-text">{t("categories.form.noWorkspace")}</p>
        </div>
      )}

      <fieldset className="sm-card sm-fieldset sm-cat-fields" disabled={mutation.submitting || blocked}>
        <legend className="sm-sr">{t(mode === "create" ? "categories.form.createLegend" : "categories.form.editLegend")}</legend>

        <div className="sm-field">
          <label className="sm-label" htmlFor={nameId}>
            {t("categories.form.name")} <span className="sm-required">{t("categories.form.required")}</span>
          </label>
          <input
            id={nameId}
            className="sm-input"
            type="text"
            dir="auto"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError ? "true" : undefined}
            aria-describedby={nameError ? `${nameId}-error` : `${nameId}-hint`}
            aria-required="true"
          />
          {nameError ? <p id={`${nameId}-error`} className="sm-text sm-form-error">{nameError}</p> : <p id={`${nameId}-hint`} className="sm-text sm-muted sm-fine">{t("categories.form.nameHint", { max: NAME_MAX })}</p>}
        </div>

        {mode === "create" ? (
          <fieldset className="sm-fieldset" aria-describedby={typeError ? `${typeId}-error` : undefined} aria-invalid={typeError ? "true" : undefined}>
            <legend className="sm-label">
              {t("categories.form.type")} <span className="sm-required">{t("categories.form.required")}</span>
            </legend>
            {CATEGORY_TYPES.map((value) => (
              <label key={value} className="sm-choice sm-cat-choice">
                <input id={`${typeId}-${value}`} type="radio" name={typeId} value={value} checked={type === value} onChange={() => setType(value)} />
                <span>{t(`categories.type.${value}`)}</span>
              </label>
            ))}
            {typeError ? <p id={`${typeId}-error`} className="sm-text sm-form-error">{typeError}</p> : <p className="sm-text sm-muted sm-fine">{t("categories.form.typeHint")}</p>}
          </fieldset>
        ) : (
          <div className="sm-field" data-sm-locked="type">
            <span className="sm-label">{t("categories.form.type")}</span>
            <p className="sm-text">{category.typeKnown ? t(`categories.type.${category.type}`) : category.type ?? t("categories.type.missing")}</p>
            <p className="sm-text sm-muted sm-fine">{t("categories.form.typeLocked")}</p>
          </div>
        )}

        <p className="sm-text sm-muted sm-fine">{t(mode === "create" ? "categories.form.notHereCreate" : "categories.form.notHereEdit")}</p>
      </fieldset>

      <div className="sm-cat-actions">
        <button type="submit" className="sm-button" disabled={mutation.submitting || blocked || (mode === "edit" && !dirty)} aria-busy={mutation.submitting} data-sm-action="submit">
          {t(mutation.submitting ? `categories.form.${mode}Busy` : `categories.form.${mode}Submit`)}
        </button>
        <button type="button" className="sm-button sm-button-quiet" onClick={cancel} disabled={mutation.submitting} data-sm-action="cancel">
          {t("categories.form.cancel")}
        </button>
      </div>
      {mutation.submitting && <p className="sm-text sm-muted sm-fine" role="status">{t("categories.form.sending")}</p>}

      <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t(mutation.submitting ? "categories.form.leaveSendingTitle" : "categories.form.discardTitle")} returnFocusRef={lastFieldRef}>
        <p className="sm-text">{t(mutation.submitting ? "categories.form.leaveSendingBody" : "categories.form.discardBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t(mutation.submitting ? "categories.form.stayWhileSending" : "categories.form.keepEditing")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t(mutation.submitting ? "categories.form.leaveAnyway" : "categories.form.discard")}</button>
        </div>
      </MobileSheet>
    </form>
  );
}

/* A new category. Nothing is read first; the workspace is the session's own. */
export function MobileCategoryCreate() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const backTo = backPathFrom(location.state, MOBILE_CATEGORIES);

  return (
    <section className="sm-page" data-sm-screen="category-new">
      <Link className="sm-link-row sm-back" to={backTo}>
        <Chevron back />
        <span>{t("categories.detail.back")}</span>
      </Link>
      <CategoryForm mode="create" backTo={backTo} />
    </section>
  );
}

/*
 * A rename. The category is read first (GET /categories/{id}); only one the person
 * may change gets a form. The record the form starts from is kept for the life of
 * the form: a later read (the one a write triggers by forgetting what was read)
 * neither overwrites the draft nor takes the outcome screen away.
 */
export function MobileCategoryEdit() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { categoryId } = useParams();
  const location = useLocation();
  const backTo = backPathFrom(location.state, categoryDetailPath(categoryId));
  const loader = useMemo(() => categoryLoader(categoryId), [categoryId]);
  const resource = useResource(keys.category(categoryId), loader, { enabled: isAccountId(categoryId) });
  const record = useMemo(() => (resource.data !== undefined && isAccountId(categoryId) ? buildCategoryDetail(resource.data, categoryId) : null), [resource.data, categoryId]);
  const [frozen, setFrozen] = useState(null);

  // Adjusted during render, as React recommends: a new address forgets the old record, a first good read keeps this one.
  if (frozen && frozen.id !== String(categoryId)) setFrozen(null);
  else if (!frozen && record?.manageable) setFrozen(record);

  if (frozen && frozen.id === String(categoryId)) {
    return (
      <section className="sm-page" data-sm-screen="category-edit" data-sm-record={frozen.id} data-sm-state="ready">
        <Link className="sm-link-row sm-back" to={backTo}>
          <Chevron back />
          <span>{t("categories.detail.backToCategory")}</span>
        </Link>
        <CategoryForm key={frozen.id} mode="edit" category={frozen} backTo={backTo} />
      </section>
    );
  }

  return (
    <RecordScreen
      screen="category-edit"
      recordId={categoryId}
      keyOf={keys.category}
      loaderOf={categoryLoader}
      build={buildCategoryDetail}
      backFallback={MOBILE_CATEGORIES}
      strings="categories.detail"
      render={() => (
        <div className="sm-card" role="note" data-sm-note="not-manageable">
          <p className="sm-text">{t("categories.cannotChange")}</p>
        </div>
      )}
    />
  );
}
