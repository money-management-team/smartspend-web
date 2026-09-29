import { LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./DebtsHeader.css";

export default function DebtsHeader({ onNewDebt }) {
  const { t } = useTranslation();

  return (
    <header className="debts-header">
      <div className="debts-header__copy">
        <h1>{t("dashboard.debts.title")}</h1>
        <p>{t("dashboard.debts.subtitle")}</p>
      </div>

      <button type="button" className="debts-header__button" onClick={onNewDebt}>
        <LuPlus aria-hidden="true" />
        <span>{t("dashboard.debts.newDebt")}</span>
      </button>
    </header>
  );
}
