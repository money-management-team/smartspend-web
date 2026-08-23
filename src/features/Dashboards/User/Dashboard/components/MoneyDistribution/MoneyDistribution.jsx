import { useTranslation } from "react-i18next";
import {
  LuCoins,
  LuLandmark,
  LuWalletCards,
  LuChevronUp,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";
import ProgressBar from "../shared/ProgressBar";

import "./MoneyDistribution.css";
import { formatMoney } from "../../../utils/formatters";

function AccountHeading({ icon: Icon, label, amount, hideLabel }) {
  return (
    <div className="money-account__heading">
      <span className="money-account__icon">
        <Icon />
      </span>

      <div className="money-account__heading-copy">
        <small>{label}</small>
        <strong>{amount}</strong>
      </div>

      <button type="button" className="money-account__hide">
        {hideLabel}
        <LuChevronUp />
      </button>
    </div>
  );
}

function AccountLine({ name, note, amount, progress }) {
  return (
    <div className="money-account__line">
      <div className="money-account__line-meta">
        <div>
          <span>{name}</span>
          {note && <small>{note}</small>}
        </div>
        <strong>{amount}</strong>
      </div>

      <ProgressBar value={progress} />
    </div>
  );
}

const groups = [
  { type: "cash", icon: LuCoins },
  { type: "bank", icon: LuLandmark },
  { type: "savings", icon: LuLandmark },
  { type: "wallet", icon: LuWalletCards },
  { type: "custom", icon: LuWalletCards },
];

export default function MoneyDistribution({ accounts }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";

  const hideLabel = t("dashboard.user.money.hideAccounts");

  return (
    <SectionCard
      className="money-distribution"
      title={t("dashboard.user.money.title")}
      subtitle={t("dashboard.user.money.subtitle")}
      action={
        <button type="button" className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </button>
      }
    >
      <div className="money-distribution__grid">
        {groups.map(({ type, icon }) => {
          const groupAccounts = accounts.filter((account) => account.type === type);
          if (groupAccounts.length === 0) return null;

          const total = groupAccounts.reduce(
            (sum, account) => sum + Number(account.current_balance || 0),
            0,
          );
          const largestBalance = Math.max(
            ...groupAccounts.map((account) => Math.abs(Number(account.current_balance || 0))),
            1,
          );

          return (
            <article className="money-account" key={type}>
              <AccountHeading
                icon={icon}
                label={t(`dashboard.accounts.types.${type}`)}
                amount={formatMoney(total, groupAccounts[0].currency_code, locale)}
                hideLabel={hideLabel}
              />

              {groupAccounts.map((account) => (
                <AccountLine
                  key={account.id}
                  name={account.name}
                  note={account.currency_code}
                  amount={formatMoney(account.current_balance, account.currency_code, locale)}
                  progress={(Math.abs(Number(account.current_balance || 0)) / largestBalance) * 100}
                />
              ))}
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}
