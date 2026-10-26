import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { accountDetailPath } from "../navigation.js";
import Money from "../money/Money.jsx";
import Chevron from "../ui/Chevron.jsx";
import { typeKey } from "./typeKey.js";

/*
 * One account in a list: name, type, and the backend's confirmed balance in the
 * account's own currency. The whole row is the link to the account's page (an
 * account the backend sent without a usable id is shown but not linked), and
 * its accessible name reads the same four things in the same order.
 */
export default function AccountRow({ account }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const name = account.name ?? t("accounts.untitled");
  const linked = Boolean(account.id);
  const content = (
    <>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{name}</span>
        <span className="sm-row-meta">
          {t(`types.${typeKey(account.isGoal ? "savings_goal" : account.type)}`)}
          {account.archived ? ` · ${t("accounts.archived")}` : ""}
        </span>
      </span>
      <span className="sm-row-end">
        <span className="sm-row-amount">
          <Money value={account.balance} currency={account.currency} />
        </span>
        {linked && <Chevron />}
      </span>
    </>
  );

  return linked ? (
    <Link className="sm-row" to={accountDetailPath(account.id)}>
      {content}
    </Link>
  ) : (
    <div className="sm-row sm-row-static">{content}</div>
  );
}
