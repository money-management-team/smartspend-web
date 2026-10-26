import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { PATH } from "../../routes/Path.js";
import { keys, loadAccounts } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { currencyName, isCurrencyCode } from "../money/decimal.js";
import { buildAccountList } from "../models/accounts.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import AccountRow from "./AccountRow.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * Mobile Accounts: the user's active accounts from GET /accounts, in groups
 * per currency. Each balance is the backend's own, in the account's currency;
 * a group has a count of accounts and no total. Read-only: creating, editing
 * and archiving accounts stay in the full version.
 */
export default function MobileAccounts() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const { workspace } = useAuthContext();
  const accounts = useResource(keys.accounts, loadAccounts);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const primary = isCurrencyCode(workspace?.base_currency_code) ? workspace.base_currency_code : null;
  const list = useMemo(() => (accounts.data === undefined ? null : buildAccountList(accounts.data, primary)), [accounts.data, primary]);

  if (accounts.loading) {
    return (
      <section className="sm-page" data-sm-screen="accounts" data-sm-state="loading" aria-busy="true">
        <Skeleton lines={5} label={t("accounts.loading")} />
      </section>
    );
  }

  if (accounts.status === "error" || !list) {
    return (
      <section className="sm-page" data-sm-screen="accounts" data-sm-state="error">
        <ErrorPanel error={accounts.error ?? MALFORMED} onRetry={accounts.reload} retrying={accounts.refreshing} />
      </section>
    );
  }

  const fullVersion = (
    <Link className="sm-link-row" to={PATH.USER.ACCOUNTS}>
      <span>{t("accounts.openFull")}</span>
      <Chevron />
    </Link>
  );

  if (list.count === 0) {
    return (
      <section className="sm-page" data-sm-screen="accounts" data-sm-state="empty">
        {accounts.stale && <StaleNotice error={accounts.error} updatedAt={accounts.updatedAt} onRetry={accounts.reload} retrying={accounts.refreshing} />}
        <div className="sm-card">
          <h2 className="sm-card-title">{t("accounts.empty.title")}</h2>
          <p className="sm-text">{t("accounts.empty.body")}</p>
          {fullVersion}
        </div>
      </section>
    );
  }

  return (
    <section className="sm-page" data-sm-screen="accounts" data-sm-state={accounts.stale ? "stale" : "ready"} data-sm-stale={accounts.stale ? "true" : undefined}>
      <div className="sm-greeting">
        <p className="sm-text" data-sm-count={list.count}>{t("accounts.count", { count: list.count })}</p>
        <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={accounts.reload} disabled={accounts.refreshing} aria-busy={accounts.refreshing}>
          {t(accounts.refreshing ? "home.refreshing" : "home.refresh")}
        </button>
      </div>

      {accounts.stale && <StaleNotice error={accounts.error} updatedAt={accounts.updatedAt} onRetry={accounts.reload} retrying={accounts.refreshing} />}

      {list.groups.map((group, index) => {
        const id = `sm-accounts-group-${index}`;

        return (
          <section key={group.currency ?? "none"} className="sm-card" aria-labelledby={id} data-sm-currency={group.currency ?? "none"}>
            <h2 id={id} className="sm-card-title">
              {group.currency ? (
                <>
                  <bdi dir="ltr">{group.currency}</bdi> <span className="sm-muted">{currencyName(group.currency, locale)}</span>
                </>
              ) : (
                t("accounts.noCurrency")
              )}
            </h2>
            <ul className="sm-list">
              {group.items.map((account, itemIndex) => (
                <li key={account.id ?? `row-${itemIndex}`}><AccountRow account={account} /></li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="sm-card">
        <p className="sm-text sm-muted">{t("accounts.readOnly")}</p>
        {fullVersion}
      </div>
    </section>
  );
}
