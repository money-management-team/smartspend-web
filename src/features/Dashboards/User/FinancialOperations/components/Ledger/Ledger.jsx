import { useState } from "react";

import {
  LuTrash2,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./Ledger.css";

const transactions = [
  {
    id: 1,
    key: "retainer",
    category: "salary",
    account: "checking",
    date: "2026-08-03",
    amount: 4200,
    type: "income",
  },
  {
    id: 2,
    key: "businessSavings",
    category: "transfer",
    account: "checking",
    date: "2026-08-02",
    amount: 1500,
    type: "transfer",
  },
  {
    id: 3,
    key: "wholeFoods",
    category: "groceries",
    account: "platinum",
    date: "2026-08-02",
    amount: -184,
    type: "expense",
  },
  {
    id: 4,
    key: "figma",
    category: "software",
    account: "platinum",
    date: "2026-08-01",
    amount: -144,
    type: "expense",
  },
  {
    id: 5,
    key: "uber",
    category: "transport",
    account: "wallet",
    date: "2026-07-31",
    amount: -62,
    type: "expense",
  },
  {
    id: 6,
    key: "dividend",
    category: "investments",
    account: "savings",
    date: "2026-07-30",
    amount: 810,
    type: "income",
  },
  {
    id: 7,
    key: "nobu",
    category: "food",
    account: "platinum",
    date: "2026-07-29",
    amount: -268,
    type: "expense",
  },
  {
    id: 8,
    key: "electricity",
    category: "utilities",
    account: "checking",
    date: "2026-07-28",
    amount: -132,
    type: "expense",
  },
  {
    id: 9,
    key: "workshop",
    category: "freelance",
    account: "checking",
    date: "2026-07-27",
    amount: 1600,
    type: "income",
  },
  {
    id: 10,
    key: "gym",
    category: "health",
    account: "wallet",
    date: "2026-07-26",
    amount: -89,
    type: "expense",
  },
  {
    id: 11,
    key: "dubai",
    category: "travel",
    account: "platinum",
    date: "2026-07-24",
    amount: -640,
    type: "expense",
  },
  {
    id: 12,
    key: "cash",
    category: "transfer",
    account: "checking",
    date: "2026-07-22",
    amount: 300,
    type: "transfer",
  },
  {
    id: 13,
    key: "coffee",
    category: "food",
    account: "cash",
    date: "2026-07-21",
    amount: -46,
    type: "expense",
  },
  {
    id: 14,
    key: "appStore",
    category: "freelance",
    account: "checking",
    date: "2026-07-20",
    amount: 980,
    type: "income",
  },
];

const filters = [
  "all",
  "expense",
  "income",
  "transfer",
];

export default function Ledger() {
  const { t } = useTranslation();

  const [filter, setFilter] =
    useState("all");

  const filtered =
    filter === "all"
      ? transactions
      : transactions.filter(
          (transaction) =>
            transaction.type === filter,
        );

  const handleDelete = (id) => {
    console.log(
      "Delete transaction",
      id,
    );
  };

  return (
    <section className="ledger">
      <header className="ledger__header">
        <h2>
          {t(
            "dashboard.financialOperations.ledger.title",
          )}{" "}
          ({transactions.length})
        </h2>

        <div className="ledger__filters">
          {filters.map((item) => (
            <button
              type="button"
              key={item}
              className={
                filter === item
                  ? "ledger__filter ledger__filter--active"
                  : "ledger__filter"
              }
              onClick={() =>
                setFilter(item)
              }
            >
              {t(
                `dashboard.financialOperations.filters.${item}`,
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="ledger__list">
        {filtered.map(
          (transaction) => (
            <article
              className="ledger-row"
              key={transaction.id}
            >
              <div className="ledger-row__copy">
                <strong>
                  {t(
                    `dashboard.financialOperations.transactions.${transaction.key}`,
                  )}
                </strong>

                <small>
                  {t(
                    `dashboard.financialOperations.categories.${transaction.category}`,
                  )}
                  {" · "}
                  {t(
                    `dashboard.financialOperations.accounts.${transaction.account}`,
                  )}
                  {" · "}
                  {transaction.date}
                </small>
              </div>

              <strong
                className={`ledger-row__amount ledger-row__amount--${transaction.type}`}
                dir="ltr"
              >
                {transaction.amount > 0 &&
                transaction.type === "income"
                  ? "+"
                  : transaction.amount < 0
                    ? "-"
                    : ""}
                $
                {Math.abs(
                  transaction.amount,
                ).toLocaleString(
                  "en-US",
                )}
              </strong>

              <button
                type="button"
                className="ledger-row__delete"
                onClick={() =>
                  handleDelete(
                    transaction.id,
                  )
                }
                aria-label={t(
                  "dashboard.financialOperations.ledger.delete",
                )}
              >
                <LuTrash2 />
              </button>
            </article>
          ),
        )}
      </div>
    </section>
  );
}