import { useTranslation } from "react-i18next";
import { LuLockKeyhole, LuSlidersHorizontal, LuUserRound } from "react-icons/lu";

import "./SettingsTabs.css";

const tabs = [
  "profile",
  "security",
  "preferences",
];
const icons = { profile: LuUserRound, security: LuLockKeyhole, preferences: LuSlidersHorizontal };

export default function SettingsTabs({
  activeTab,
  onChange,
}) {
  const { t } = useTranslation();

  return (
    <nav
      className="settings-tabs"
      aria-label={t(
        "dashboard.settings.tabs.label",
      )}
    >
      {tabs.map((tab) => {
        const Icon = icons[tab];
        return (
        <button
          key={tab}
          type="button"
          className={`settings-tab ${
            activeTab === tab
              ? "settings-tab--active"
              : ""
          }`}
          aria-current={activeTab === tab ? "page" : undefined}
          onClick={() =>
            onChange(tab)
          }
        >
          <Icon aria-hidden="true" /><bdi>
            {t(
              `dashboard.settings.tabs.${tab}`,
            )}
          </bdi>
        </button>
      );})}
    </nav>
  );
}
