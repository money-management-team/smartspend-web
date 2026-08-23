import { useTranslation } from "react-i18next";

import RecurringOperationRow from "../RecurringOperationRow/RecurringOperationRow";

import "./RecurringSection.css";

export default function RecurringSection({
  titleKey,
  subtitleKey,
  items,
  variant = "default",
}) {
  const { t } = useTranslation();

  return (
    <section
      className={`recurring-section ${
        variant === "due"
          ? "recurring-section--due"
          : ""
      }`}
    >
      <header className="recurring-section__header">
        <h2>
          {t(titleKey)} ({items.length})
        </h2>

        {subtitleKey && (
          <p>
            {t(subtitleKey)}
          </p>
        )}
      </header>

      <div className="recurring-section__list">
        {items.map((item) => (
          <RecurringOperationRow
            key={item.id}
            item={item}
          />
        ))}
      </div>
    </section>
  );
}