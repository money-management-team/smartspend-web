import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  LuChartNoAxesCombined,
  LuCircleCheck,
  LuCircleAlert,
  LuDatabase,
  LuLightbulb,
  LuShieldCheck,
  LuSparkles,
  LuTrash2,
} from "react-icons/lu";

import "./SettingsPanel.css";

const x = "dashboard.aiAssistant.extra";
const FEATURES = [
  { key: "ai_enabled", icon: LuSparkles },
  { key: "insights_enabled", icon: LuLightbulb },
  { key: "forecast_enabled", icon: LuChartNoAxesCombined },
];

function isValidRetention(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 7 && number <= 365;
}

/*
 * Consent, features, preferences and data controls. Each switch writes one
 * setting at once (PUT /ai/settings); retention is saved explicitly.
 */
export default function SettingsPanel({
  settings,
  hasConsent,
  busy,
  draftRetention,
  onDraftRetentionChange,
  onToggle,
  onLanguageChange,
  onSaveRetention,
  onDeleteData,
}) {
  const { t } = useTranslation();
  const retentionHintId = useId();
  const canSaveRetention =
    !busy && isValidRetention(draftRetention) && Number(draftRetention) !== settings.retention_days;

  return (
    <section className="ai-panel" aria-labelledby="ai-settings-title">
      <header className="ai-panel__head">
        <div>
          <h2 id="ai-settings-title">{t(`${x}.settingsTitle`)}</h2>
          <p>{t(`${x}.settingsDescription`)}</p>
        </div>
      </header>

      <div className="ai-settings">
        <div className="ai-settings__main">
          <section className="ai-settings__card" aria-labelledby="ai-settings-features">
            <h3 id="ai-settings-features">{t(`${x}.featuresTitle`)}</h3>

            <ul className="ai-settings__switches">
              {FEATURES.map(({ key, icon: Icon }) => {
                const checked = Boolean(settings[key]) && (key !== "ai_enabled" || hasConsent);
                const labelId = `ai-setting-${key}`;

                return (
                  <li key={key}>
                    <label className="ai-switch-row">
                      <span className="ai-switch-row__icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="ai-switch-row__copy">
                        <strong id={labelId}>{t(`${x}.${key}`)}</strong>
                        <small>{t(`${x}.${key}Description`)}</small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        className="ai-switch"
                        checked={checked}
                        disabled={busy}
                        aria-labelledby={labelId}
                        onChange={(event) => onToggle(key, event.target.checked)}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="ai-settings__card" aria-labelledby="ai-settings-preferences">
            <h3 id="ai-settings-preferences">{t(`${x}.preferencesTitle`)}</h3>

            <div className="ai-settings__fields">
              <label className="ai-field">
                <span>{t(`${x}.language`)}</span>
                <select
                  value={settings.preferred_language ?? ""}
                  disabled={busy}
                  onChange={(event) => onLanguageChange(event.target.value || null)}
                >
                  <option value="">{t(`${x}.automatic`)}</option>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>

              <div className="ai-field">
                <label htmlFor="ai-retention-days">{t(`${x}.retention`)}</label>
                <div className="ai-settings__inline">
                  <input
                    id="ai-retention-days"
                    type="number"
                    min="7"
                    max="365"
                    inputMode="numeric"
                    value={draftRetention}
                    disabled={busy}
                    aria-describedby={retentionHintId}
                    aria-invalid={isValidRetention(draftRetention) ? undefined : "true"}
                    onChange={(event) => onDraftRetentionChange(event.target.value)}
                  />
                  <button
                    type="button"
                    className="ai-button ai-button--secondary"
                    disabled={!canSaveRetention}
                    onClick={onSaveRetention}
                  >
                    {t(`${x}.save`)}
                  </button>
                </div>
                <small id={retentionHintId}>{t(`${x}.retentionHint`)}</small>
              </div>
            </div>
          </section>
        </div>

        <aside className="ai-settings__card ai-settings__privacy" aria-labelledby="ai-settings-privacy">
          <h3 id="ai-settings-privacy">{t(`${x}.privacyTitle`)}</h3>

          <p className={`ai-settings__consent ${hasConsent ? "ai-settings__consent--on" : ""}`}>
            {hasConsent ? <LuCircleCheck aria-hidden="true" /> : <LuCircleAlert aria-hidden="true" />}
            <span>{hasConsent ? t(`${x}.consented`) : t(`${x}.consentNeeded`)}</span>
          </p>

          <ul className="ai-settings__points">
            <li>
              <LuShieldCheck aria-hidden="true" />
              <span>{t(`${x}.activationPointOne`)}</span>
            </li>
            <li>
              <LuDatabase aria-hidden="true" />
              <span>{t(`${x}.activationPointTwo`)}</span>
            </li>
          </ul>

          <div className="ai-settings__danger">
            <strong>{t(`${x}.dangerZone`)}</strong>
            <p>{t(`${x}.deleteDataHint`)}</p>
            <button type="button" className="ai-button ai-button--danger" disabled={busy} onClick={onDeleteData}>
              <LuTrash2 aria-hidden="true" />
              <span>{t(`${x}.deleteData`)}</span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
