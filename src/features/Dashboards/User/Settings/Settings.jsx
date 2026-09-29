import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSettings2, LuShieldCheck } from "react-icons/lu";

import SettingsTabs from "./components/SettingsTabs/SettingsTabs";
import ProfileSettings from "./components/ProfileSettings/ProfileSettings";
import ChangePassword from "./components/ChangePassword/ChangePassword";
import Preferences from "./components/Preferences/Preferences";

import "./Settings.css";

export default function Settings() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] =
    useState("profile");

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <span className="settings-page__eyebrow"><LuSettings2 aria-hidden="true" /> SMARTSPEND</span>
        <h1>
          {t("dashboard.settings.title")}
        </h1>

        <p>
          {t("dashboard.settings.subtitle")}
        </p>
        <span className="settings-page__hero-mark" aria-hidden="true"><LuShieldCheck /></span>
      </header>

      <div className="settings-page__layout">
        <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />
        <div className="settings-page__content" aria-live="polite">

      {activeTab === "profile" && (
        <ProfileSettings />
      )}

      {activeTab === "security" && (
        <ChangePassword />
      )}

      {activeTab === "preferences" && (
        <Preferences />
      )}
        </div>
      </div>
    </div>
  );
}
