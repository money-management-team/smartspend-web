import { useState } from "react";

import AccountsHeader from "./components/AccountsHeader/AccountsHeader";
import AccountFilters from "./components/AccountFilters/AccountFilters";
import AccountCard from "./components/AccountCard/AccountCard";

import "./Accounts.css"; 
const x = 10;

const accounts = [
  {
    id: 1,
    key: "checking",
    type: "bank",
    amount: 18420,
    provider: "Mercury Bank",
  },
  {
    id: 2,
    key: "savings",
    type: "bank",
    amount: 32750,
    provider: "Mercury Bank",
  },
  {
    id: 3,
    key: "appleWallet",
    type: "wallet",
    amount: 1240,
    provider: "Apple Pay",
  },
  {
    id: 4,
    key: "platinum",
    type: "credit",
    amount: -2380,
    provider: "Visa",
    creditLimit: 15000,
    progress: 16,
  },
  {
    id: 5,
    key: "cash",
    type: "cash",
    amount: 860,
  },
];

export default function Accounts() {
  const [activeFilter, setActiveFilter] =
    useState("all");

  const filteredAccounts =
    activeFilter === "all"
      ? accounts
      : accounts.filter(
          (account) =>
            account.type === activeFilter,
        );

  return (
    <div className="accounts-page">
      <AccountsHeader />

      <AccountFilters
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />

      <section className="accounts-page__grid">
        {filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
          />
        ))}
      </section>
    </div>
  );
}