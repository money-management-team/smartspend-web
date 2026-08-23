import SmartCapture from "./components/SmartCapture/SmartCapture";
import NewOperation from "./components/NewOperation/NewOperation";
import Ledger from "./components/Ledger/Ledger";

import { useTranslation } from "react-i18next";

import "./FinancialOperations.css";

export default function FinancialOperations() {
  const { t } = useTranslation();

  return (
    <div className="financial-operations-page">
      <header className="financial-operations-page__header">
        <h1>
          {t("dashboard.financialOperations.title")}
        </h1>

        <p>
          {t("dashboard.financialOperations.subtitle")}
        </p>
      </header>

      <div className="financial-operations-page__layout">
        <aside className="financial-operations-page__side">
          <SmartCapture />

          <NewOperation />
        </aside>

        <Ledger />
      </div>
    </div>
  );
}