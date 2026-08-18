import { LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./AccountsHeader.css";

export default function AccountsHeader() {
  const { t } = useTranslation();

  const handleAddAccount = () => {
    console.log("Add account");
  };

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
        onClick={handleAddAccount}
      >
        <LuPlus />

        <span>
          {t("dashboard.accounts.add")}
        </span>
      </button>
    </header>
  );
}