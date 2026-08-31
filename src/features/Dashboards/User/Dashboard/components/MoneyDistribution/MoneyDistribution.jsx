import { useTranslation } from "react-i18next";
import {
  LuCoins,
  LuLandmark,
  LuWalletCards,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { PATH } from "../../../../../../routes/Path";

import SectionCard from "../shared/SectionCard";
import ProgressBar from "../shared/ProgressBar";

import "./MoneyDistribution.css";
import { formatMoney, sumMoney } from "../../../utils/formatters";

function AccountHeading({ icon: Icon, label, amount }) {
  return (
    <div className="money-account__heading">
      <span className="money-account__icon">
        <Icon />
      </span>

      <div className="money-account__heading-copy">
        <small>{label}</small>
        <strong>{amount}</strong>
      </div>
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

  return (
    <SectionCard
      className="money-distribution"
      title={t("dashboard.user.money.title")}
      subtitle={t("dashboard.user.money.subtitle")}
      action={
        <Link to={PATH.USER.ACCOUNTS} className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </Link>
      }
    >
      <div className="money-distribution__grid">
        {groups.flatMap(({ type, icon }) => {
          const byCurrency = new Map();

          accounts
            .filter((account) => account.type === type)
            .forEach((account) => {
              const currency = account.currency_code ?? "ILS";
              byCurrency.set(currency, [
                ...(byCurrency.get(currency) ?? []),
                account,
              ]);
            });

          return Array.from(byCurrency, ([currency, groupAccounts]) => {
            const total = sumMoney(
              groupAccounts.map((account) => account.current_balance),
            );
            const largestBalance = Math.max(
              ...groupAccounts.map((account) =>
                Math.abs(Number(account.current_balance || 0)),
              ),
              1,
            );

            return (
            <article className="money-account" key={`${type}-${currency}`}>
              <AccountHeading
                icon={icon}
                label={`${t(`dashboard.accounts.types.${type}`)} · ${currency}`}
                amount={formatMoney(total, currency, locale)}
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
          });
        })}
      </div>
    </SectionCard>
  );
}
