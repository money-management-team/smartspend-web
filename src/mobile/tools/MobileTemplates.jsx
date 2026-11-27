import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import { newEntryPath } from "../forms/actionRoutes.js";
import { useFormChoices } from "../forms/useFormChoices.js";
import { amountError, normalizeAmount, textError } from "../forms/validation.js";
import { spendable } from "../forms/workflows.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Money from "../money/Money.jsx";
import { MOBILE_TEMPLATES } from "../navigation.js";
import { newLocalId, useDevicePreferences } from "../preferences/deviceStore.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";

const NEEDS = Object.freeze({ accounts: true, categories: true });
const EMPTY = Object.freeze({ name: "", type: "expense", account_id: "", category_id: "", amount: "", description: "" });

function TemplateForm({ initial, choices, onSave, onCancel }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [values, setValues] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const dirty = Object.keys(EMPTY).some((key) => values[key] !== initial[key]);
  const guard = useLeaveGuard(dirty);
  const errors = {
    name: textError(values.name, { required: true, max: 80 }),
    amount: amountError(values.amount, { required: false }),
    description: textError(values.description, { max: 255 }),
  };
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value, ...(name === "type" ? { category_id: "" } : {}) }));
  const accounts = choices.accounts.filter(spendable);
  const categories = choices.categories.filter((category) => category.type === values.type && category.active !== false);
  const account = accounts.find((item) => item.id === values.account_id);

  const save = (event) => {
    event.preventDefault();
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({ ...values, amount: normalizeAmount(values.amount) });
  };
  const errorOf = (name) => (attempted && errors[name] ? t(`forms.errors.${errors[name]}`, { max: name === "name" ? 80 : 255 }) : null);

  return (
    <form className="sm-card sm-draft-form" onSubmit={save} noValidate data-sm-form="template">
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-name`}>{t("templates.name")} <span className="sm-required">{t("forms.required")}</span></label>
        <input id={`${ids}-name`} className="sm-input" dir="auto" value={values.name} onChange={set("name")} aria-invalid={errorOf("name") ? "true" : undefined} />
        {errorOf("name") && <p className="sm-text sm-form-error">{errorOf("name")}</p>}
      </div>
      <fieldset className="sm-fieldset sm-field">
        <legend className="sm-label">{t("forms.fields.entryType")}</legend>
        {["expense", "income"].map((type) => (
          <label key={type} className="sm-choice sm-cat-choice">
            <input type="radio" name={`${ids}-type`} value={type} checked={values.type === type} onChange={set("type")} />
            <span>{t(`forms.options.entryType.${type}`)}</span>
          </label>
        ))}
      </fieldset>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-account`}>{t("forms.fields.account_id")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <select id={`${ids}-account`} className="sm-select" value={values.account_id} onChange={set("account_id")}>
          <option value="">{t("forms.none")}</option>
          {accounts.map((item) => <option key={item.id} value={item.id}>{`${item.name ?? t("forms.unnamed")} · ${item.currency ?? "—"}`}</option>)}
        </select>
      </div>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-category`}>{t("forms.fields.category_id")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <select id={`${ids}-category`} className="sm-select" value={values.category_id} onChange={set("category_id")}>
          <option value="">{t("forms.none")}</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name ?? t("forms.unnamed")}</option>)}
        </select>
      </div>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-amount`}>{t("forms.fields.amount")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <span className="sm-amount-input">
          <input id={`${ids}-amount`} className="sm-input" inputMode="decimal" dir="ltr" value={values.amount} onChange={set("amount")} aria-invalid={errorOf("amount") ? "true" : undefined} />
          <bdi dir="ltr" className="sm-amount-currency">{account?.currency ?? "—"}</bdi>
        </span>
        {errorOf("amount") && <p className="sm-text sm-form-error">{errorOf("amount")}</p>}
      </div>
      <div className="sm-field">
        <label className="sm-label" htmlFor={`${ids}-description`}>{t("forms.fields.description")} <span className="sm-muted sm-fine">{t("forms.optional")}</span></label>
        <input id={`${ids}-description`} className="sm-input" dir="auto" value={values.description} onChange={set("description")} />
        {errorOf("description") && <p className="sm-text sm-form-error">{errorOf("description")}</p>}
      </div>
      <p className="sm-text sm-muted sm-fine">{t("templates.localOnly")}</p>
      <div className="sm-actions sm-form-actions">
        <button type="submit" className="sm-button" data-sm-action="save-template">{t("templates.save")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={onCancel} data-sm-action="cancel-template">{t("forms.cancel")}</button>
      </div>
      <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t("forms.discardTitle")}>
        <p className="sm-text">{t("templates.discardBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={guard.stay}>{t("forms.keepEditing")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
        </div>
      </MobileSheet>
    </form>
  );
}

/*
 * Quick entries: shortcuts saved on this device, for this person and workspace,
 * that open the expense or income form already filled in. A template holds only
 * what was typed into it; using one sends nothing (the form ends at its review,
 * like every Mobile form), and an account or category that no longer exists is
 * caught by the form's own checks.
 */
export default function MobileTemplates() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const prefs = useDevicePreferences();
  const choices = useFormChoices(NEEDS);
  const [editing, setEditing] = useState(null); // null | "new" | template id
  const [removing, setRemoving] = useState(null);
  const removeRef = useRef(null);
  const current = editing && editing !== "new" ? prefs.templates.find((item) => item.id === editing) : null;

  const save = (values) => {
    prefs.change((state) => ({
      templates: current ? state.templates.map((item) => (item.id === current.id ? { ...values, id: current.id } : item)) : [...state.templates, { ...values, id: newLocalId() }],
    }));
    setEditing(null);
  };
  const remove = () => {
    prefs.change((state) => ({ templates: state.templates.filter((item) => item.id !== removing) }));
    setRemoving(null);
  };

  if (editing) {
    return (
      <section className="sm-page" data-sm-screen="templates" data-sm-state="editing">
        <h2 className="sm-card-title">{t(current ? "templates.editTitle" : "templates.newTitle")}</h2>
        <TemplateForm key={editing} initial={current ? { ...EMPTY, ...current } : EMPTY} choices={choices} onSave={save} onCancel={() => setEditing(null)} />
      </section>
    );
  }

  return (
    <section className="sm-page" data-sm-screen="templates" data-sm-state="list">
      <div className="sm-card">
        <p className="sm-text sm-muted">{t("templates.intro")}</p>
        {!prefs.persisted && <p className="sm-text sm-muted sm-fine" data-sm-note="not-persisted">{t("home.notRemembered")}</p>}
        <button type="button" className="sm-button" onClick={() => setEditing("new")} disabled={prefs.templates.length >= 20} data-sm-action="new-template">{t("templates.new")}</button>
      </div>
      {prefs.templates.length === 0 ? (
        <p className="sm-text sm-muted sm-card" data-sm-empty="templates">{t("templates.empty")}</p>
      ) : (
        <ul className="sm-card sm-list">
          {prefs.templates.map((template) => {
            const account = choices.accounts.find((item) => item.id === template.account_id);
            return (
              <li key={template.id} className="sm-row sm-template-row" data-sm-template={template.id}>
                <span className="sm-row-main">
                  <span className="sm-row-title sm-user-text">{template.name}</span>
                  <span className="sm-row-meta">
                    {t(`forms.options.entryType.${template.type}`)}
                    {template.amount && <> · <Money plain value={template.amount} currency={account?.currency} /></>}
                    {account?.name && <> · <bdi className="sm-user-text">{account.name}</bdi></>}
                  </span>
                </span>
                <span className="sm-template-actions">
                  <Link className="sm-button sm-button-small" to={newEntryPath(template.type)} state={{ template: template.id, from: MOBILE_TEMPLATES }} data-sm-action="use-template">{t("templates.use")}<Chevron /></Link>
                  <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => setEditing(template.id)} data-sm-action="edit-template">{t("templates.edit")}</button>
                  <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={(event) => { removeRef.current = event.currentTarget; setRemoving(template.id); }} data-sm-action="delete-template">{t("templates.delete")}</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <MobileSheet open={removing !== null} onClose={() => setRemoving(null)} titleId="sm-template-delete" title={t("templates.deleteTitle")} returnFocusRef={removeRef}>
        <p className="sm-text">{t("templates.deleteBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={() => setRemoving(null)}>{t("templates.keep")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={remove} data-sm-action="confirm-delete">{t("templates.delete")}</button>
        </div>
      </MobileSheet>
    </section>
  );
}
