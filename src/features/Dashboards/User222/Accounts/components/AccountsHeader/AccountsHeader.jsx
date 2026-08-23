import { LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./AccountsHeader.css";

export default function AccountsHeader({ onAdd }) {
  const { t } = useTranslation();

  return (
    <header className="accounts-header">
      <div className="accounts-header__copy">
        <h1>
          {t("dashboard.accounts.title")}
        </h1>

        <p>
          {t("dashboard.accounts.subtitle")}
        </p>
      </div>

      <button
        type="button"
        className="accounts-header__add"
        onClick={onAdd}
      >
        <LuPlus />

        <span>
          {t("dashboard.accounts.add")}
        </span>
      </button>
    </header>
  );
}
