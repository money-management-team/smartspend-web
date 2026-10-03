import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuBan, LuTriangleAlert } from "react-icons/lu";

import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_TYPES,
  getCategoryColor,
  getCategoryErrorMessage,
  renderCategoryIcon,
} from "../../categoryHelpers";

// Same modal shell as the account form, so dashboard dialogs look alike.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./CategoryForm.css";

const toFormValues = (category, defaultType) => ({
  name: category?.name ?? "",
  type: category?.type ?? defaultType ?? "expense",
  color: getCategoryColor(category)?.toUpperCase() ?? "",
  icon: category?.icon ?? "",
});

// An empty choice means "none": omitted on create, sent as null on edit.
const toPayloadValues = (form) => ({
  name: form.name.trim(),
  type: form.type,
  color: form.color || null,
  icon: form.icon || null,
});

/*
 * Create: the full payload (without empty optional fields).
 * Edit: only the fields that changed, so untouched values are never sent.
 */
function buildPayload(form, category) {
  const values = toPayloadValues(form);

  if (!category) {
    return Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== null),
    );
  }

  const original = toPayloadValues(toFormValues(category));

  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== original[key]),
  );
}

export default function CategoryForm({ category, defaultType, onSave, onClose }) {
  const { t } = useTranslation();
  const isEditing = Boolean(category);
  const [form, setForm] = useState(() => toFormValues(category, defaultType));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [typeChangeConfirmed, setTypeChangeConfirmed] = useState(false);
  const pendingRef = useRef(false);

  // Keep a stored color/icon selectable even when it isn't a preset.
  const [colorOptions] = useState(() =>
    [...new Set([...CATEGORY_COLORS, form.color].filter(Boolean))],
  );
  const [iconOptions] = useState(() =>
    [...new Set([...CATEGORY_ICONS, form.icon].filter(Boolean))],
  );

  // Moving a category between income and expense changes what its existing
  // transactions mean, so the user has to acknowledge it first.
  const isChangingType = isEditing && form.type !== category.type;
  const needsTypeConfirmation = isChangingType && !typeChangeConfirmed;

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "type") setTypeChangeConfirmed(false);
    updateField(name, value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current || needsTypeConfirmation) return;

    if (!form.name.trim()) {
      setErrors({ name: [t("dashboard.categories.validation.nameRequired")] });
      return;
    }

    if (!CATEGORY_TYPES.includes(form.type)) {
      setErrors({ type: [t("dashboard.categories.validation.typeRequired")] });
      return;
    }

    const payload = buildPayload(form, category);

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
        setMessage(getCategoryErrorMessage(error, t));
      }
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  };

  const fieldErrors = (name) =>
    errors[name]?.map((error) => <small key={error}>{error}</small>);

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog category-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="category-form-title">
            {t(
              isEditing
                ? "dashboard.categories.form.editTitle"
                : "dashboard.categories.form.createTitle",
            )}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={isSaving}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t("dashboard.categories.form.name")}</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={isSaving}
              maxLength={255}
              placeholder={t("dashboard.categories.form.namePlaceholder")}
              aria-invalid={errors.name ? true : undefined}
              dir="auto"
              required
              autoFocus
            />
            {fieldErrors("name")}
          </label>

          <label>
            <span>{t("dashboard.categories.form.type")}</span>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              disabled={isSaving}
              aria-invalid={errors.type ? true : undefined}
            >
              {CATEGORY_TYPES.map((type) => (
                <option value={type} key={type}>
                  {t(`dashboard.categories.types.${type}`)}
                </option>
              ))}
            </select>
            {fieldErrors("type")}
          </label>

          {isChangingType && (
            <div className="category-form__warning" role="alert">
              <p>
                <LuTriangleAlert aria-hidden="true" />
                <span>
                  {t("dashboard.categories.form.typeChangeWarning", {
                    from: t(`dashboard.categories.types.${category.type}`, {
                      defaultValue: category.type,
                    }),
                    to: t(`dashboard.categories.types.${form.type}`),
                  })}
                </span>
              </p>

              <label className="account-form-modal__check">
                <input
                  type="checkbox"
                  checked={typeChangeConfirmed}
                  onChange={(event) => setTypeChangeConfirmed(event.target.checked)}
                  disabled={isSaving}
                />
                <span>{t("dashboard.categories.form.typeChangeConfirm")}</span>
              </label>
            </div>
          )}

          <fieldset className="category-form__group" disabled={isSaving}>
            <legend>{t("dashboard.categories.form.color")}</legend>

            <div className="category-form__choices">
              <label
                className="category-form__choice category-form__swatch category-form__swatch--none"
                title={t("dashboard.categories.form.noColor")}
              >
                <input
                  type="radio"
                  name="color"
                  value=""
                  checked={form.color === ""}
                  onChange={() => updateField("color", "")}
                  aria-label={t("dashboard.categories.form.noColor")}
                />
                <LuBan aria-hidden="true" />
              </label>

              {colorOptions.map((color) => (
                <label
                  className="category-form__choice category-form__swatch"
                  style={{ "--swatch-color": color }}
                  title={color}
                  key={color}
                >
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    checked={form.color === color}
                    onChange={() => updateField("color", color)}
                    aria-label={color}
                  />
                </label>
              ))}
            </div>
            {fieldErrors("color")}
          </fieldset>

          <fieldset className="category-form__group" disabled={isSaving}>
            <legend>{t("dashboard.categories.form.icon")}</legend>

            <div className="category-form__choices">
              <label
                className="category-form__choice category-form__icon"
                title={t("dashboard.categories.form.defaultIcon")}
              >
                <input
                  type="radio"
                  name="icon"
                  value=""
                  checked={form.icon === ""}
                  onChange={() => updateField("icon", "")}
                  aria-label={t("dashboard.categories.form.defaultIcon")}
                />
                {renderCategoryIcon({ type: form.type })}
              </label>

              {iconOptions.map((icon) => {
                const label = CATEGORY_ICONS.includes(icon)
                  ? t(`dashboard.categories.icons.${icon}`)
                  : icon;

                return (
                  <label
                    className="category-form__choice category-form__icon"
                    title={label}
                    key={icon}
                  >
                    <input
                      type="radio"
                      name="icon"
                      value={icon}
                      checked={form.icon === icon}
                      onChange={() => updateField("icon", icon)}
                      aria-label={label}
                    />
                    {renderCategoryIcon({ icon, type: form.type })}
                  </label>
                );
              })}
            </div>
            {fieldErrors("icon")}
          </fieldset>

          {message && (
            <p className="account-form-modal__error" role="alert" dir="auto">
              {message}
            </p>
          )}

          <footer>
            <button type="button" onClick={close} disabled={isSaving}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving || needsTypeConfirmation}
              aria-busy={isSaving || undefined}
            >
              {isSaving ? t("common.saving") : t("common.save")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
