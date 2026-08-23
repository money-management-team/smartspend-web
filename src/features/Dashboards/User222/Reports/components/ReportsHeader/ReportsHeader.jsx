import {
  LuFileText,
  LuFileSpreadsheet,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./ReportsHeader.css";

export default function ReportsHeader() {
  const { t } = useTranslation();

  const handleExportPDF = () => {
    console.log("Export PDF");
  };

  const handleExportExcel = () => {
    console.log("Export Excel");
  };

  return (
    <header className="reports-header">
      <div className="reports-header__copy">
        <h1>
          {t("dashboard.reports.title")}
        </h1>

        <p>
          {t("dashboard.reports.subtitle")}
        </p>
      </div>

      <div className="reports-header__actions">
        <button
          type="button"
          className="reports-header__export reports-header__export--secondary"
          onClick={handleExportPDF}
        >
          <LuFileText />

          <span>
            {t(
              "dashboard.reports.exportPdf",
            )}
          </span>
        </button>

        <button
          type="button"
          className="reports-header__export reports-header__export--primary"
          onClick={handleExportExcel}
        >
          <LuFileSpreadsheet />

          <span>
            {t(
              "dashboard.reports.exportExcel",
            )}
          </span>
        </button>
      </div>
    </header>
  );
}