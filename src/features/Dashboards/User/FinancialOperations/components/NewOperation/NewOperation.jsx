import { useState } from "react";
import { useTranslation } from "react-i18next";

import "./NewOperation.css";

const types = [
  "expense",
  "income",
  "transfer",
];

export default function NewOperation() {
  const { t } = useTranslation();

  const [type, setType] =
    useState("expense");

  const [form, setForm] = useState({
    amount: "",
    category: "food",
    account: "checking",
    note: "",
    date: "2026-08-12",
  });

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    console.log({
      type,
      ...form,
    });
  };

  return (
    <section className="new-operation">
      <header className="new-operation__header">
        <h2>
          {t(
            "dashboard.financialOperations.newOperation.title",
          )}
        </h2>
      </header>

      <form
        className="new-operation__form"
        onSubmit={handleSubmit}
      >
        <div className="new-operation__types">
          {types.map((item) => (
            <button
              key={item}
              type="button"
              className={
                type === item
                  ? "new-operation__type new-operation__type--active"
                  : "new-operation__type"
              }
              onClick={() =>
                setType(item)
              }
            >
              {t(
                `dashboard.financialOperations.types.${item}`,
              )}
            </button>
          ))}
        </div>

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.amount",
            )}
          </span>

          <input
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            placeholder="0.00"
          />
        </label>

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.category",
            )}
          </span>

          <select
            name="category"
            value={form.category}
            onChange={handleChange}
          >
            <option value="food">
              {t(
                "dashboard.financialOperations.categories.food",
              )}
            </option>

            <option value="software">
              {t(
                "dashboard.financialOperations.categories.software",
              )}
            </option>

            <option value="transport">
              {t(
                "dashboard.financialOperations.categories.transport",
              )}
            </option>

            <option value="utilities">
              {t(
                "dashboard.financialOperations.categories.utilities",
              )}
            </option>
          </select>
        </label>

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.account",
            )}
          </span>

          <select
            name="account"
            value={form.account}
            onChange={handleChange}
          >
            <option value="checking">
              {t(
                "dashboard.financialOperations.accounts.checking",
              )}
            </option>

            <option value="savings">
              {t(
                "dashboard.financialOperations.accounts.savings",
              )}
            </option>

            <option value="wallet">
              {t(
                "dashboard.financialOperations.accounts.wallet",
              )}
            </option>
          </select>
        </label>

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.note",
            )}
          </span>

          <input
            type="text"
            name="note"
            value={form.note}
            onChange={handleChange}
            placeholder={t(
              "dashboard.financialOperations.form.notePlaceholder",
            )}
          />
        </label>

        <label className="new-operation__field">
          <span>
            {t(
              "dashboard.financialOperations.form.date",
            )}
          </span>

          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
          />
        </label>

        <button
          type="submit"
          className="new-operation__submit"
        >
          {t(
            "dashboard.financialOperations.form.submit",
          )}
        </button>
      </form>
    </section>
  );
}