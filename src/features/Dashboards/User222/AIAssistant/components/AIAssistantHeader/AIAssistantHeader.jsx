import {
  useTranslation,
} from "react-i18next";

import "./AIAssistantHeader.css";

export default function AIAssistantHeader() {
  const { t } =
    useTranslation();

  return (
    <header className="ai-assistant-header">
      <h1>
        {t(
          "dashboard.aiAssistant.title",
        )}
      </h1>

      <p>
        {t(
          "dashboard.aiAssistant.subtitle",
        )}
      </p>
    </header>
  );
}