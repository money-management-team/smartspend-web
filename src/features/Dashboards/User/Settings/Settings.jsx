import { useState } from "react";
import { useTranslation } from "react-i18next";

import SettingsTabs from "./components/SettingsTabs/SettingsTabs";
import ProfileSettings from "./components/ProfileSettings/ProfileSettings";
import SecuritySettings from "./components/SecuritySettings/SecuritySettings";
import PreferencesSettings from "./components/PreferencesSettings/PreferencesSettings";
import AISettings from "./components/AISettings/AISettings";

import "./Settings.css";

export default function Settings() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1>{t("dashboard.settings.title")}</h1>
        <p>{t("dashboard.settings.subtitle")}</p>
      </header>

      <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && <ProfileSettings />}
      {activeTab === "security" && <SecuritySettings />}
      {activeTab === "preferences" && <PreferencesSettings />}
      {activeTab === "ai" && <AISettings />}
    </div>
  );
}