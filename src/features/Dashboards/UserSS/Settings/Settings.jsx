import { useState } from "react";
import { useTranslation } from "react-i18next";

import SettingsTabs from "./components/SettingsTabs/SettingsTabs";
import ProfileSettings from "./components/ProfileSettings/ProfileSettings";

import "./Settings.css";

export default function Settings() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] =
    useState("profile");

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1>
          {t("dashboard.settings.title")}
        </h1>

        <p>
          {t("dashboard.settings.subtitle")}
        </p>
      </header>

      <SettingsTabs
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "profile" && (
        <ProfileSettings />
      )}

      {activeTab === "security" && (
        <section className="settings-placeholder">
          <h2>
            {t(
              "dashboard.settings.security.title",
            )}
          </h2>
        </section>
      )}

      {activeTab === "preferences" && (
        <section className="settings-placeholder">
          <h2>
            {t(
              "dashboard.settings.preferences.title",
            )}
          </h2>
        </section>
      )}
    </div>
  );
}