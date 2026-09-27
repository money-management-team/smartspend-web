import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuShieldCheck,
  LuEye,
  LuEyeOff,
  LuMonitor,
  LuSmartphone,
  LuCheck,
} from "react-icons/lu";

import { ApiError, getApiErrorMessage } from "../../../api/apiClient";
import { authApi } from "../../../api/authApi";
import "./SecuritySettings.css";

export default function SecuritySettings() {
  const { t } = useTranslation();

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  // Devices state
  const [devices, setDevices] = useState([
    {
      id: 1,
      titleKey: "dashboard.settings.security.devices.device1Title",
      descKey: "dashboard.settings.security.devices.device1Desc",
      isCurrent: true,
      icon: "monitor",
    },
    {
      id: 2,
      titleKey: "dashboard.settings.security.devices.device2Title",
      descKey: "dashboard.settings.security.devices.device2Desc",
      isCurrent: false,
      icon: "phone",
    },
    {
      id: 3,
      titleKey: "dashboard.settings.security.devices.device3Title",
      descKey: "dashboard.settings.security.devices.device3Desc",
      isCurrent: false,
      icon: "monitor",
    },
  ]);

  const handleLogoutDevice = (id) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  const handleLogoutAllOther = () => {
    setDevices((prev) => prev.filter((d) => d.isCurrent));
  };

  const handleCancel = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("");
    setHasError(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage(t("dashboard.settings.security.validation.newRequired"));
      setHasError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(t("dashboard.settings.security.validation.mismatch"));
      setHasError(true);
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setHasError(false);

    try {
      const response = await authApi.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });

      setMessage(
        response.message ?? t("dashboard.settings.security.success"),
      );
      setHasError(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        setMessage(
          error.errors?.current_password?.[0] ??
            error.errors?.password?.[0] ??
            getApiErrorMessage(error, t),
        );
      } else {
        setMessage(getApiErrorMessage(error, t));
      }
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="security-settings">
      {/* Header */}
      <header className="security-settings__header">
        <div className="security-settings__header-icon-box">
          <LuShieldCheck />
        </div>
        <div className="security-settings__header-text">
          <h2>{t("dashboard.settings.security.title")}</h2>
          <p>{t("dashboard.settings.security.headerSubtitle")}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="security-settings__form">
        {/* Section 1: Change Password */}
        <div className="security-section">
          <div className="security-section__top">
            <div>
              <h3 className="security-section__title">
                {t("dashboard.settings.security.changePassword")}
              </h3>
              <p className="security-section__desc">
                {t("dashboard.settings.security.changePasswordSubtitle")}
              </p>
            </div>
            <span className="security-section__note">
              {t("dashboard.settings.security.lastChanged")}
            </span>
          </div>

          <div className="security-password-grid">
            {/* Current Password */}
            <label className="settings-field">
              <span>
                {t("dashboard.settings.security.fields.currentPassword")}
              </span>
              <div className="security-input-wrapper">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="security-eye-btn"
                  onClick={() => setShowCurrent((p) => !p)}
                  aria-label="Toggle password visibility"
                >
                  {showCurrent ? <LuEyeOff /> : <LuEye />}
                </button>
              </div>
            </label>

            {/* New Password */}
            <label className="settings-field">
              <span>{t("dashboard.settings.security.fields.newPassword")}</span>
              <div className="security-input-wrapper">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t(
                    "dashboard.settings.security.fields.newPassword",
                  )}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="security-eye-btn"
                  onClick={() => setShowNew((p) => !p)}
                  aria-label="Toggle password visibility"
                >
                  {showNew ? <LuEyeOff /> : <LuEye />}
                </button>
              </div>
            </label>

            {/* Confirm Password */}
            <label className="settings-field">
              <span>
                {t("dashboard.settings.security.fields.confirmPassword")}
              </span>
              <div className="security-input-wrapper">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t(
                    "dashboard.settings.security.fields.confirmPassword",
                  )}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="security-eye-btn"
                  onClick={() => setShowConfirm((p) => !p)}
                  aria-label="Toggle password visibility"
                >
                  {showConfirm ? <LuEyeOff /> : <LuEye />}
                </button>
              </div>
            </label>
          </div>

          {/* Strength Bars */}
          <div className="security-strength">
            <span className="security-strength__label">
              • {t("dashboard.settings.security.strength.strong")}
            </span>
            <div className="security-strength__bars">
              <span className="security-strength__bar security-strength__bar--active" />
              <span className="security-strength__bar security-strength__bar--active" />
              <span className="security-strength__bar security-strength__bar--active" />
              <span className="security-strength__bar security-strength__bar--active" />
            </div>
          </div>
        </div>

        {/* Section 2: Two-Factor Authentication */}
        <div className="security-2fa-card">
          <div className="security-2fa-card__info">
            <div className="security-2fa-card__title-row">
              <h4>{t("dashboard.settings.security.twoFactor.title")}</h4>
              <span className="security-badge security-badge--recommended">
                {t("dashboard.settings.security.twoFactor.recommended")}
              </span>
              {twoFactorEnabled && (
                <span className="security-badge security-badge--enabled">
                  <LuCheck />
                  {t("dashboard.settings.security.twoFactor.enabledGoogle")}
                </span>
              )}
            </div>
            <p className="security-2fa-card__desc">
              {t("dashboard.settings.security.twoFactor.subtitle")}
            </p>
          </div>

          <label className="security-switch">
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={(e) => setTwoFactorEnabled(e.target.checked)}
            />
            <span className="security-switch__slider" />
          </label>
        </div>

        {/* Section 3: Active Devices & Sessions */}
        <div className="security-section">
          <div className="security-section__top">
            <div>
              <h3 className="security-section__title">
                {t("dashboard.settings.security.devices.title")}
              </h3>
              <p className="security-section__desc">
                {t("dashboard.settings.security.devices.subtitle")}
              </p>
            </div>
            <button
              type="button"
              className="security-devices__logout-all-btn"
              onClick={handleLogoutAllOther}
            >
              {t("dashboard.settings.security.devices.logoutAll")}
            </button>
          </div>

          <div className="security-devices-list">
            {devices.map((device) => (
              <div key={device.id} className="security-device-item">
                <div className="security-device-item__icon-box">
                  {device.icon === "phone" ? <LuSmartphone /> : <LuMonitor />}
                </div>

                <div className="security-device-item__info">
                  <div className="security-device-item__name-row">
                    <span className="security-device-item__name">
                      {t(device.titleKey)}
                    </span>
                    {device.isCurrent && (
                      <span className="security-device-item__active-badge">
                        • {t("dashboard.settings.security.devices.activeNow")}
                      </span>
                    )}
                  </div>
                  <span className="security-device-item__meta">
                    {t(device.descKey)}
                  </span>
                </div>

                <div className="security-device-item__action">
                  {device.isCurrent ? (
                    <span className="security-badge security-badge--current">
                      {t("dashboard.settings.security.devices.currentSession")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="security-device-item__logout-btn"
                      onClick={() => handleLogoutDevice(device.id)}
                    >
                      {t("dashboard.settings.security.devices.logout")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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

        {/* Footer */}
        <div className="security-settings__footer">
          <div className="profile-settings__synced-badge">
            <LuCheck className="profile-settings__synced-icon" />
            <span>{t("dashboard.settings.security.securityBadge")}</span>
          </div>

          <div className="profile-settings__btn-group">
            <button
              type="submit"
              className="security-settings__save-btn"
              disabled={isSubmitting}
            >
              <LuShieldCheck />
              <span>
                {isSubmitting
                  ? t("dashboard.settings.security.submitting")
                  : t("dashboard.settings.security.updateSecurity")}
              </span>
            </button>

            <button
              type="button"
              className="profile-settings__cancel"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {t("dashboard.settings.security.cancel")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
