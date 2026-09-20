import { LuArrowRight, LuFileText, LuWalletCards } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../../../../../routes/Path";

import "./StatementCapture.css";

/*
 * Statement upload. Files are not parsed here: the import wizard already
 * uploads the file, maps its columns and records the rows, so this panel
 * hands over to it instead of duplicating the flow.
 */
export default function StatementCapture({ account }) {
  const { t } = useTranslation();

  return (
    <div className="capture-panel statement-capture">
      <div className="statement-capture__surface">
        <span className="statement-capture__visual" aria-hidden="true">
          <LuFileText />
        </span>

        <div className="statement-capture__copy">
          <span className="capture-panel__kicker">
            {t("dashboard.financialOperations.statement.kicker")}
          </span>

          <h3>{t("dashboard.financialOperations.statement.title")}</h3>
          <p>{t("dashboard.financialOperations.statement.description")}</p>

          {account && (
            <span className="capture-panel__account">
              <LuWalletCards aria-hidden="true" />
              {t("dashboard.financialOperations.captureStep.useAccount")}
              <b dir="auto">{account.name}</b>
            </span>
          )}
        </div>
      </div>

      <div className="statement-capture__actions">
        <Link className="capture-action" to={PATH.USER.IMPORT}>
          {t("dashboard.financialOperations.statement.action")}
          <LuArrowRight aria-hidden="true" />
        </Link>

        <Link className="capture-action capture-action--soft" to={PATH.USER.IMPORT_HISTORY}>
          {t("dashboard.financialOperations.statement.history")}
        </Link>
      </div>
    </div>
  );
}
