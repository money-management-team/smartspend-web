import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuUser, LuCheck } from "react-icons/lu";

import { ApiError, getApiErrorMessage } from "../../../api/apiClient";
import { authApi } from "../../../api/authApi";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { useEmailVerification } from "../../../../../../contexts/emailVerification/useEmailVerification";

import "./ProfileSettings.css";

const getUserInitials = (name) => {
  const nameParts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (nameParts.length === 0) return "LH";
  if (nameParts.length === 1) {
    return Array.from(nameParts[0]).slice(0, 2).join("").toLocaleUpperCase();
  }
  return `${Array.from(nameParts[0])[0]}${Array.from(nameParts.at(-1))[0]}`.toLocaleUpperCase();
};

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { user, workspace, updateUser } = useAuthContext();
  const { refresh: refreshEmailStatus } = useEmailVerification();

  const userInitials = getUserInitials(user?.name);
  const displayName = user?.name || "لينا صقلا";

  const [form, setForm] = useState(() => ({
    name: user?.name ?? "لينا صقلا",
    email: user?.email ?? "lina@smartspend.io",
    phone: user?.phone ?? "+970 567023312",
    currency: workspace?.base_currency_code ?? "USD",
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
    setHasError(false);
  };

  const handleCancel = () => {
    setForm({
      name: user?.name ?? "لينا صقلا",
      email: user?.email ?? "lina@smartspend.io",
      phone: user?.phone ?? "+970 567023312",
      currency: workspace?.base_currency_code ?? "USD",
    });
    setErrors({});
    setMessage("");
    setHasError(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

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

      if ((response.data.email ?? null) !== (user?.email ?? null)) {
        refreshEmailStatus();
      }
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
      {/* Header */}
      <header className="profile-settings__header">
        <div className="profile-settings__header-icon-box">
          <LuUser />
        </div>
        <div className="profile-settings__header-text">
          <h2>{t("dashboard.settings.profile.title")}</h2>
          <p>{t("dashboard.settings.profile.headerSubtitle")}</p>
        </div>
      </header>

      {/* User Info Row */}
      <div className="profile-settings__user-card">
        <div className="profile-settings__avatar">{userInitials}</div>
        <div className="profile-settings__user-meta">
          <span className="profile-settings__user-name">{displayName}</span>
          <span className="profile-settings__user-role">
            {t("dashboard.settings.profile.activeAccount")}
          </span>
        </div>
      </div>

      <form className="profile-settings__form" onSubmit={handleSubmit}>
        <div className="profile-settings__grid">
          {/* Full name */}
          <label className="settings-field">
            <span>{t("dashboard.settings.profile.fields.fullName")}</span>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              disabled={isSaving}
              required
            />
            {errors.name?.map((error) => (
              <small key={error}>{error}</small>
            ))}
          </label>

          {/* Email */}
          <label className="settings-field">
            <span>{t("dashboard.settings.profile.fields.email")}</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={isSaving}
              required
            />
            {errors.email?.map((error) => (
              <small key={error}>{error}</small>
            ))}
          </label>

          {/* Phone */}
          <label className="settings-field">
            <span>{t("dashboard.settings.profile.fields.phone")}</span>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              dir="ltr"
              disabled={isSaving}
            />
            {errors.phone?.map((error) => (
              <small key={error}>{error}</small>
            ))}
          </label>

          {/* Preferred Currency */}
          <label className="settings-field">
            <span>{t("dashboard.settings.profile.fields.currency")}</span>
            <select
              name="currency"
              value={form.currency}
              onChange={handleChange}
              disabled={isSaving}
            >
              <option value="USD">
                {t("dashboard.settings.profile.currencies.usd")}
              </option>
              <option value="ILS">
                {t("dashboard.settings.profile.currencies.ils")}
              </option>
              <option value="EUR">
                {t("dashboard.settings.profile.currencies.eur")}
              </option>
              <option value="SAR">
                {t("dashboard.settings.profile.currencies.sar")}
              </option>
              <option value="AED">
                {t("dashboard.settings.profile.currencies.aed")}
              </option>
              <option value="JOD">
                {t("dashboard.settings.profile.currencies.jod")}
              </option>
            </select>
          </label>
        </div>

        {message && (
          <p
            className={
              hasError
                ? "profile-settings__message profile-settings__message--error"
                : "profile-settings__message"
            }
            role="status"
          >
            {message}
          </p>
        )}

        {/* Footer actions */}
        <div className="profile-settings__footer">
          <div className="profile-settings__synced-badge">
            <LuCheck className="profile-settings__synced-icon" />
            <span>{t("dashboard.settings.profile.syncedBadge")}</span>
          </div>

          <div className="profile-settings__btn-group">
            <button
              type="submit"
              className="profile-settings__save"
              disabled={isSaving}
            >
              {isSaving
                ? t("dashboard.settings.profile.saving")
                : t("dashboard.settings.profile.save")}
            </button>

            <button
              type="button"
              className="profile-settings__cancel"
              onClick={handleCancel}
              disabled={isSaving}
            >
              {t("dashboard.settings.profile.cancel")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
