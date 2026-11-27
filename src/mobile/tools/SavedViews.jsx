import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { textError } from "../forms/validation.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { newLocalId, useDevicePreferences } from "../preferences/deviceStore.js";

/*
 * Saved filters for Activity or a report: a name and the address parameters,
 * on this device, for this person and workspace (preferences/deviceStore.js).
 * Opening one is a link to the same screen with those parameters, so it reads
 * the server again; no result is ever stored. `scope` is "activity" or
 * "report"; for a report, `type` is the report it belongs to.
 */
export default function SavedViews({ scope, params, path, type }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const prefs = useDevicePreferences();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const field = scope === "report" ? "reportViews" : "activityViews";
  const views = prefs[field].filter((view) => scope !== "report" || view.type === type);
  const hasParams = Object.values(params).some(Boolean);
  const nameError = textError(name, { required: true, max: 60 });

  const save = (event) => {
    event.preventDefault();
    if (nameError) return;
    const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value));
    prefs.change((state) => ({ [field]: [...state[field], { id: newLocalId(), name: name.trim(), params: clean, ...(scope === "report" ? { type } : {}) }] }));
    setName("");
    setNaming(false);
  };
  const remove = (id) => prefs.change((state) => ({ [field]: state[field].filter((view) => view.id !== id) }));

  return (
    <div className="sm-saved-views" data-sm-saved={scope}>
      {views.length > 0 && (
        <ul className="sm-chips-inline sm-saved-list" aria-label={t("saved.title")}>
          {views.map((view) => (
            <li key={view.id} className="sm-saved-item">
              <Link className="sm-chip sm-chip-button" to={`${path}?${new URLSearchParams(view.params).toString()}`} data-sm-view={view.id}><bdi className="sm-user-text">{view.name}</bdi></Link>
              <button type="button" className="sm-chip sm-chip-quiet" onClick={() => remove(view.id)} aria-label={t("saved.remove", { name: view.name })} data-sm-action="remove-view">×</button>
            </li>
          ))}
        </ul>
      )}
      {naming ? (
        <form className="sm-saved-form" onSubmit={save} noValidate>
          <label className="sm-label" htmlFor={`${ids}-name`}>{t("saved.name")}</label>
          <input id={`${ids}-name`} className="sm-input" dir="auto" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          <div className="sm-actions">
            <button type="submit" className="sm-button sm-button-small" disabled={Boolean(nameError)} data-sm-action="save-view">{t("saved.save")}</button>
            <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => setNaming(false)}>{t("forms.cancel")}</button>
          </div>
        </form>
      ) : (
        hasParams && views.length < 20 && <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => setNaming(true)} data-sm-action="name-view">{t("saved.saveThese")}</button>
      )}
    </div>
  );
}
