import { LuArchive, LuPencil } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { getAccountDetailsPath } from "../../../../../../routes/Path";
import { formatDate, formatMoney } from "../../../utils/formatters";
import {
  getAccountColor,
  renderAccountIcon,
  getDisplayLocale,
  isNegativeMoney,
} from "../../accountHelpers";

import "./AccountCard.css";

export default function AccountCard({
  account,
  onEdit,
  onArchive,
  isArchiving = false,
}) {
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  const color = getAccountColor(account);
  // Balances stay the backend's decimal strings; formatMoney is display-only.
  const balance = account.current_balance;

  return (
    <article
      className={`account-card${color ? " account-card--colored" : ""}`}
      style={color ? { "--account-color": color } : undefined}
      aria-busy={isArchiving || undefined}
    >
      {/* =========================
          HEADER
      ========================= */}

      <header className="account-card__header">
        <span className="account-card__icon" aria-hidden="true">
          {renderAccountIcon(account)}
        </span>

        <div className="account-card__identity">
          {/* Stretched over the whole card: the card opens the details page. */}
          <Link
            className="account-card__link"
            to={getAccountDetailsPath(account.id)}
          >
            <strong>
              {account.name}
            </strong>
          </Link>

          {account.last_four_digits && (
            <small dir="ltr">
              •••• {account.last_four_digits}
            </small>
          )}
        </div>

        <span className="account-card__type">
          {t(`dashboard.accounts.types.${account.type}`, {
            defaultValue: account.type,
          })}
        </span>
      </header>

      {/* =========================
          AMOUNT
      ========================= */}

      <div className="account-card__balance">
        <strong
          className={
            isNegativeMoney(balance)
              ? "account-card__amount account-card__amount--negative"
              : "account-card__amount"
          }
          dir="ltr"
        >
          {formatMoney(balance, account.currency_code, locale)}
        </strong>

        <span className="account-card__updated">
          {account.currency_code}
          {account.updated_at && (
            <>
              {" · "}
              {t("dashboard.accounts.updatedOn", {
                date: formatDate(account.updated_at, locale, timeZone),
              })}
            </>
          )}
        </span>
      </div>

      {/* =========================
          ACTIONS
      ========================= */}

      <footer className="account-card__actions">
        <button
          type="button"
          className="account-card__edit"
          onClick={onEdit}
          disabled={isArchiving}
        >
          <LuPencil />

          <span>
            {t(
              "dashboard.accounts.edit",
            )}
          </span>
        </button>

        <button
          type="button"
          className="account-card__delete"
          onClick={onArchive}
          disabled={isArchiving}
          aria-label={t("dashboard.accounts.archiveNamed", {
            name: account.name,
          })}
          title={t("dashboard.accounts.archive")}
        >
          <LuArchive />
        </button>
      </footer>
    </article>
  );
}
