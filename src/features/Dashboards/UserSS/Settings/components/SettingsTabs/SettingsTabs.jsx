import { useTranslation } from "react-i18next";

import "./SettingsTabs.css";

const tabs = [
  "profile",
  "security",
  "preferences",
];

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
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`settings-tab ${
            activeTab === tab
              ? "settings-tab--active"
              : ""
          }`}
          onClick={() =>
            onChange(tab)
          }
        >
          <bdi>
            {t(
              `dashboard.settings.tabs.${tab}`,
            )}
          </bdi>
        </button>
      ))}
    </nav>
  );
}