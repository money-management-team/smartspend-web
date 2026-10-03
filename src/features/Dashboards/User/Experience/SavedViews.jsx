import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuBookmark, LuPlus, LuTrash2 } from "react-icons/lu";
import { useExperience } from "./useExperience";
import { newLocalId, sanitizeFilters } from "./experienceStore";

export default function SavedViews({ scope, filters, onApply }) {
  const { t } = useTranslation("experience");
  const { preferences, update } = useExperience();
  const [isOpen, setIsOpen] = useState(false),
    [name, setName] = useState("");
  const views = preferences.savedViews.filter((item) => item.scope === scope);
  const save = (event) => {
    event.preventDefault();
    if (!name.trim() || preferences.savedViews.length >= 30) return;
    const view = {
      id: newLocalId(),
      name: name.trim(),
      scope,
      filters: sanitizeFilters(scope, filters),
    };
    update((state) => ({ ...state, savedViews: [...state.savedViews, view] }));
    setName("");
    setIsOpen(false);
  };
  return (
    <section className="exp-saved" aria-label={t("savedViews")}>
      <div className="exp-toolbar">
        <strong>
          <LuBookmark aria-hidden="true" />
          {t("savedViews")}
        </strong>
        <span className="exp-muted">{t("deviceOnly")}</span>
        <button
          type="button"
          className="exp-button exp-button--subtle"
          aria-expanded={isOpen}
          disabled={preferences.savedViews.length >= 30}
          onClick={() => setIsOpen(!isOpen)}
        >
          <LuPlus aria-hidden="true" />
          {t("saveView")}
        </button>
      </div>
      {isOpen && (
        <form className="exp-inline-form" onSubmit={save}>
          <label>
            <span className="exp-sr-only">{t("viewName")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("viewName")}
              maxLength={80}
              required
              autoFocus
            />
          </label>
          <button className="exp-button" type="submit">
            {t("save")}
          </button>
          <button
            className="exp-button exp-button--subtle"
            type="button"
            onClick={() => setIsOpen(false)}
          >
            {t("cancel")}
          </button>
        </form>
      )}
      {views.length > 0 && (
        <ul className="exp-chips">
          {views.map((view) => (
            <li key={view.id}>
              <button
                type="button"
                onClick={() => onApply(sanitizeFilters(scope, view.filters))}
              >
                {view.name}
              </button>
              <button
                type="button"
                aria-label={`${t("delete")} ${view.name}`}
                onClick={() =>
                  update((state) => ({
                    ...state,
                    savedViews: state.savedViews.filter(
                      (row) => row.id !== view.id,
                    ),
                  }))
                }
              >
                <LuTrash2 aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!preferences.persisted && (
        <p className="exp-muted" role="status">
          {t("storageUnavailable")}
        </p>
      )}
    </section>
  );
}
