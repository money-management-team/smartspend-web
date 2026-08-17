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

export default function MoneyDistribution() {
  const { t } = useTranslation();

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
        <article className="money-account">
          <AccountHeading
            icon={LuCoins}
            label={t("dashboard.user.money.totalCash")}
            amount={t("dashboard.user.money.cashAmount")}
            hideLabel={hideLabel}
          />

          <AccountLine
            name={t("dashboard.user.money.cashOnHand")}
            amount={t("dashboard.user.money.cashAmount")}
            progress={78}
          />
        </article>

        <article className="money-account">
          <AccountHeading
            icon={LuLandmark}
            label={t("dashboard.user.money.totalBank")}
            amount={t("dashboard.user.money.bankAmount")}
            hideLabel={hideLabel}
          />

          <AccountLine
            name={t("dashboard.user.money.checking")}
            note={t("dashboard.user.money.mercuryBank")}
            amount={t("dashboard.user.money.checkingAmount")}
            progress={58}
          />

          <AccountLine
            name={t("dashboard.user.money.businessSavings")}
            note={t("dashboard.user.money.mercuryBank")}
            amount={t("dashboard.user.money.businessSavingsAmount")}
            progress={88}
          />
        </article>

        <article className="money-account money-account--wallet">
          <AccountHeading
            icon={LuWalletCards}
            label={t("dashboard.user.money.totalWallets")}
            amount={t("dashboard.user.money.walletAmount")}
            hideLabel={hideLabel}
          />

          <AccountLine
            name={t("dashboard.user.money.appleWallet")}
            note={t("dashboard.user.money.applePay")}
            amount={t("dashboard.user.money.walletAmount")}
            progress={78}
          />
        </article>
      </div>
    </SectionCard>
  );
}
