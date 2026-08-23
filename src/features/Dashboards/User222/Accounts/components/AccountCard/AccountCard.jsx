import {
  LuLandmark,
  LuWalletCards,
  LuBanknote,
  LuPencil,
  LuTrash2,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./AccountCard.css";

const accountIcons = {
  bank: LuLandmark,
  wallet: LuWalletCards,
  cash: LuBanknote,
  savings: LuLandmark,
  custom: LuWalletCards,
};

const formatAmount = (amount, currency) => {
  const number = Number(amount) || 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "ILS",
  }).format(number);
};

export default function AccountCard({
  account,
  onEdit,
  onArchive,
}) {
  const { t } = useTranslation();

  const Icon = accountIcons[account.type] ?? LuWalletCards;

  const amount = Number(account.current_balance ?? account.opening_balance ?? 0);
  const isNegative = amount < 0;

  return (
    <article
      className="account-card"
    >
      {/* =========================
          HEADER
      ========================= */}

      <header className="account-card__header">
        <span className="account-card__icon">
          <Icon />
        </span>

        <div className="account-card__identity">
          <strong>
            {account.name}
          </strong>

          {account.last_four_digits && (
            <small>
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
            isNegative
              ? "account-card__amount account-card__amount--negative"
              : "account-card__amount"
          }
          dir="ltr"
        >
          {formatAmount(amount, account.currency_code)}
        </strong>

        <span className="account-card__updated">
          {account.currency_code} ·{" "}
          {t(
            "dashboard.accounts.updatedToday",
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
          aria-label={t(
            "dashboard.accounts.archive",
            { defaultValue: "Archive account" },
          )}
        >
          <LuTrash2 />
        </button>
      </footer>
    </article>
  );
}
