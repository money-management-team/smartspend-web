import { useState } from "react";
import { useTranslation } from "react-i18next";

import "./ProfileSettings.css";

const initialForm = {
  fullName: "Layla Haddad",
  email: "layla@smartspend.io",
  phone: "+962 7 9000 1122",
  currency: "USD",
};

export default function ProfileSettings() {
  const { t } = useTranslation();

  const [form, setForm] =
    useState(initialForm);

  const [isSaving, setIsSaving] =
    useState(false);

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      /*
       * لاحقاً عند ربط Laravel:
       *
       * await api.put(
       *   "/user/profile",
       *   form,
       * );
       */

      console.log(
        "Save profile:",
        form,
      );
    } catch (error) {
      console.error(
        "Failed to save profile",
        error,
      );
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
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              autoComplete="name"
            />
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
            />
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
            />
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
              onChange={handleChange}
            >
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