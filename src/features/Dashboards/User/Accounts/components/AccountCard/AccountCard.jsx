import {
  LuLandmark,
  LuWalletCards,
  LuCreditCard,
  LuBanknote,
  LuPencil,
  LuTrash2,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./AccountCard.css";

const accountIcons = {
  bank: LuLandmark,
  wallet: LuWalletCards,
  credit: LuCreditCard,
  cash: LuBanknote,
};

const formatAmount = (amount) => {
  const absoluteAmount =
    Math.abs(amount).toLocaleString(
      "en-US",
    );

  return amount < 0
    ? `-$${absoluteAmount}`
    : `$${absoluteAmount}`;
};

export default function AccountCard({
  account,
}) {
  const { t } = useTranslation();

  const Icon =
    accountIcons[account.type];

  const isNegative =
    account.amount < 0;

  const handleEdit = () => {
    console.log(
      "Edit account:",
      account.id,
    );
  };

  const handleDelete = () => {
    console.log(
      "Delete account:",
      account.id,
    );
  };

  return (
    <article
      className={`account-card ${
        account.type === "credit"
          ? "account-card--credit"
          : ""
      }`}
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
            {t(
              `dashboard.accounts.items.${account.key}.name`,
            )}
          </strong>

          {account.provider && (
            <small>
              {account.provider}
            </small>
          )}
        </div>

        <span className="account-card__type">
          {t(
            `dashboard.accounts.types.${account.type}`,
          )}
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
          {formatAmount(
            account.amount,
          )}
        </strong>

        <span className="account-card__updated">
          USD ·{" "}
          {t(
            "dashboard.accounts.updatedToday",
          )}
        </span>
      </div>

      {/* =========================
          CREDIT LIMIT
      ========================= */}

      {account.type === "credit" && (
        <div className="account-card__credit">
          <div className="account-card__credit-meta">
            <span>
              {t(
                "dashboard.accounts.creditLimit",
              )}
            </span>

            <strong>
              $
              {account.creditLimit.toLocaleString(
                "en-US",
              )}
            </strong>
          </div>

          <div className="account-card__progress">
            <span
              style={{
                width: `${account.progress}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* =========================
          ACTIONS
      ========================= */}

      <footer className="account-card__actions">
        <button
          type="button"
          className="account-card__edit"
          onClick={handleEdit}
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
          onClick={handleDelete}
          aria-label={t(
            "dashboard.accounts.delete",
          )}
        >
          <LuTrash2 />
        </button>
      </footer>
    </article>
  );
}