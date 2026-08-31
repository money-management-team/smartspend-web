import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, getApiErrorMessage } from "../../../api/apiClient";
import { authApi } from "../../../api/authApi";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";

import "./ProfileSettings.css";

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { user, workspace, updateUser } = useAuthContext();

  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    currency: workspace?.base_currency_code ?? "ILS",
  }));

  const [isSaving, setIsSaving] =
    useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
    setHasError(false);
  };

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setErrors({});
    setMessage("");
    setHasError(false);

    try {
      const response = await authApi.updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      });

      setForm((current) => ({
        ...current,
        name: response.data.name ?? current.name,
        email: response.data.email ?? current.email,
        phone: response.data.phone ?? "",
      }));
      updateUser(response.data);
      setMessage(response.message ?? t("dashboard.settings.profile.saved"));
      setHasError(false);
    } catch (error) {
      setMessage(getApiErrorMessage(error, t));
      setHasError(true);
      if (error instanceof ApiError) setErrors(error.errors);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="profile-settings">
      <header className="profile-settings__header">
        <h2>
          {t(
            "dashboard.settings.profile.title",
          )}
        </h2>
      </header>

      <form
        className="profile-settings__form"
        onSubmit={handleSubmit}
      >
        <div className="profile-settings__grid">
          {/* Full name */}

          <label className="settings-field">
            <span>
              {t(
                "dashboard.settings.profile.fields.fullName",
              )}
            </span>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              disabled={isSaving}
              required
            />
            {errors.name?.map((error) => <small key={error}>{error}</small>)}
          </label>

          {/* Email */}

          <label className="settings-field">
            <span>
              {t(
                "dashboard.settings.profile.fields.email",
              )}
            </span>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={isSaving}
              required
            />
            {errors.email?.map((error) => <small key={error}>{error}</small>)}
          </label>

          {/* Phone */}

          <label className="settings-field">
            <span>
              {t(
                "dashboard.settings.profile.fields.phone",
              )}
            </span>

            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              dir="ltr"
              disabled={isSaving}
            />
            {errors.phone?.map((error) => <small key={error}>{error}</small>)}
          </label>

          {/* Currency */}

          <label className="settings-field">
            <span>
              {t(
                "dashboard.settings.profile.fields.currency",
              )}
            </span>

            <select
              name="currency"
              value={form.currency}
              disabled
            >
              <option value="ILS">
                ILS
              </option>

              <option value="USD">
                USD
              </option>

              <option value="EUR">
                EUR
              </option>

              <option value="SAR">
                SAR
              </option>

              <option value="AED">
                AED
              </option>

              <option value="JOD">
                JOD
              </option>
            </select>
          </label>
        </div>

        {message && (
          <p
            className={hasError ? "profile-settings__message profile-settings__message--error" : "profile-settings__message"}
            role="status"
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          className="profile-settings__save"
          disabled={isSaving}
        >
          {isSaving
            ? t(
                "dashboard.settings.profile.saving",
              )
            : t(
                "dashboard.settings.profile.save",
              )}
        </button>
      </form>
    </section>
  );
}
