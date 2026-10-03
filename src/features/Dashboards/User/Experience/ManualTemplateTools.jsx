import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PATH } from "../../../../routes/Path";
import { useExperience } from "./useExperience";
import {
  newLocalId,
  normalizeTemplate,
  templateIsEligible,
} from "./experienceStore";

export default function ManualTemplateTools({
  account,
  accounts,
  categories,
  type,
  form,
  onApply,
}) {
  const { t } = useTranslation("experience"),
    { preferences, update, workspaceId } = useExperience();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(() => params.get("template") ?? ""),
    [name, setName] = useState("");
  const [message, setMessage] = useState(null),
    [isSaving, setSaving] = useState(false);
  const apply = () => {
    const template = preferences.templates.find((row) => row.id === selected);
    if (!templateIsEligible(template, accounts, categories, workspaceId)) {
      setMessage("templateInvalid");
      return;
    }
    onApply(template);
    setMessage("templateApplied");
  };
  const save = () => {
    const value = normalizeTemplate({
      id: newLocalId(),
      name,
      type,
      account_id: account?.id,
      workspace_id: workspaceId,
      category_id: form.category_id,
      amount: form.amount,
      description: form.note,
      currency_code: account?.currency_code,
    });
    if (
      !value ||
      !templateIsEligible(value, accounts, categories, workspaceId)
    ) {
      setMessage("templateRequired");
      return;
    }
    if (preferences.templates.length >= 20) {
      setMessage("templateLimit");
      return;
    }
    update((state) => ({ ...state, templates: [...state.templates, value] }));
    setSaving(false);
    setName("");
    setMessage(null);
  };
  return (
    <section className="exp-template-mini" aria-label={t("templates")}>
      <div className="exp-toolbar">
        <strong>{t("templates")}</strong>
        <Link to={PATH.USER.QUICK_TEMPLATES} className="exp-muted">
          {t("edit")}
        </Link>
      </div>
      {preferences.templates.length > 0 && (
        <div className="exp-inline-form">
          <label className="exp-field">
            <span className="exp-sr-only">{t("chooseTemplate")}</span>
            <select
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setMessage(null);
              }}
            >
              <option value="">{t("chooseTemplate")}</option>
              {preferences.templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="exp-button exp-button--subtle"
            type="button"
            disabled={!selected}
            onClick={apply}
          >
            {t("apply")}
          </button>
        </div>
      )}
      <button
        type="button"
        className="exp-button exp-button--subtle"
        style={{ marginTop: 12 }}
        disabled={preferences.templates.length >= 20}
        aria-expanded={isSaving}
        onClick={() => setSaving(!isSaving)}
      >
        {t("saveTemplate")}
      </button>
      {isSaving && (
        <div className="exp-inline-form">
          <label>
            <span className="exp-sr-only">{t("name")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder={t("name")}
            />
          </label>
          <button
            type="button"
            className="exp-button"
            disabled={!name.trim()}
            onClick={save}
          >
            {t("save")}
          </button>
        </div>
      )}
      <p className="exp-muted">{t("templateReview")}</p>
      {message && (
        <p
          className={
            message === "templateApplied" ? "exp-success" : "exp-error"
          }
          role="status"
        >
          {t(message)}
        </p>
      )}
    </section>
  );
}
