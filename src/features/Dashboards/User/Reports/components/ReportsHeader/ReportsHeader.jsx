import { useTranslation } from "react-i18next";

import "./ReportsHeader.css";

export default function ReportsHeader({ actions = null }) {
  const { t } = useTranslation();

  return (
    <header className="reports-header">
      <div className="reports-header__copy">
        <h1>{t("dashboard.reports.title")}</h1>
        <p>{t("dashboard.reports.subtitle")}</p>
      </div>
      {actions && <div className="reports-header__actions">{actions}</div>}
    </header>
  );
}
