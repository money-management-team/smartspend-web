import { useTranslation } from "react-i18next";

import "./AccountFilters.css";

const filters = [
  "all",
  "bank",
  "credit",
  "wallet",
  "cash",
];

export default function AccountFilters({
  activeFilter,
  onChange,
}) {
  const { t } = useTranslation();

  return (
    <div className="account-filters">
      {filters.map((filter) => {
        const isActive =
          filter === activeFilter;

        return (
          <button
            type="button"
            key={filter}
            aria-pressed={isActive}
            className={`account-filter ${
              isActive
                ? "account-filter--active"
                : ""
            }`}
            onClick={() =>
              onChange(filter)
            }
          >
            {t(
              `dashboard.accounts.filters.${filter}`,
            )}
          </button>
        );
      })}
    </div>
  );
}