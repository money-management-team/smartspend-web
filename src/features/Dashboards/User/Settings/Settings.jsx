import DisplayPreferences from "../Experience/DisplayPreferences";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LuSettings2, LuShieldCheck } from "react-icons/lu";

import SettingsTabs from "./components/SettingsTabs/SettingsTabs";
import { SETTINGS_TABS } from "./components/SettingsTabs/tabKeys.js";
import ProfileSettings from "./components/ProfileSettings/ProfileSettings";
import ChangePassword from "./components/ChangePassword/ChangePassword";
import Preferences from "./components/Preferences/Preferences";
import WhatsAppIntegration from "./components/WhatsAppIntegration/WhatsAppIntegration";
import SavingsReminders from "./components/SavingsReminders/SavingsReminders";
import { SMART_SAVINGS_ENABLED } from "../SavingsGoals/smartSavingsFlag";

import "./Settings.css";

// `smartSavingsEnabled` defaults to the build flag; tests pass it.
export default function Settings({ smartSavingsEnabled = SMART_SAVINGS_ENABLED }) {
  const { t } = useTranslation();

  // The tab lives in `?tab=` so a refresh or a shared link opens the same one.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = SETTINGS_TABS.includes(requestedTab) ? requestedTab : "profile";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <span className="settings-page__eyebrow">
          <LuSettings2 aria-hidden="true" /> SMARTSPEND
        </span>
        <h1>{t("dashboard.settings.title")}</h1>

        <p>{t("dashboard.settings.subtitle")}</p>
        <span className="settings-page__hero-mark" aria-hidden="true">
          <LuShieldCheck />
        </span>
      </header>

      <div className="settings-page__layout">
        <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />
        <div className="settings-page__content" aria-live="polite">
          {activeTab === "profile" && <ProfileSettings />}

          {activeTab === "security" && <ChangePassword />}

          {activeTab === "integrations" && <WhatsAppIntegration />}

          {activeTab === "preferences" && (
            <>
              <Preferences />
              {/* Unreleased: savings reminders exist only with smart savings. */}
              {smartSavingsEnabled && <SavingsReminders />}
              <DisplayPreferences />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
