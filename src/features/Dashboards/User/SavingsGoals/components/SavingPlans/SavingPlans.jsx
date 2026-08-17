import {
  LuSparkles,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./SavingPlans.css";

const planKeys = [
  "fast",
  "balanced",
  "comfortable",
];

function formatMoney(
  value,
  language,
) {
  const isArabic =
    language
      ?.toLowerCase()
      .startsWith("ar");

  const formatted =
    new Intl.NumberFormat(
      isArabic
        ? "ar-EG"
        : "en-US",
    ).format(value);

  return isArabic
    ? `$US ${formatted}`
    : `$${formatted}`;
}

export default function SavingPlans({
  plans,
  activePlan,
}) {
  const { t, i18n } = useTranslation();

  const language =
    i18n.resolvedLanguage ||
    i18n.language;

  return (
    <section className="saving-plans">
      <header className="saving-plans__header">
        <LuSparkles />

        <h3>
          {t(
            "dashboard.savingsGoals.plans.title",
          )}
        </h3>
      </header>

      <div className="saving-plans__grid">
        {planKeys.map((key) => {
          const active =
            activePlan === key;

          return (
            <button
              type="button"
              key={key}
              className={`saving-plan ${
                active
                  ? "saving-plan--active"
                  : ""
              }`}
            >
              <span className="saving-plan__name">
                {t(
                  `dashboard.savingsGoals.plans.${key}`,
                )}
              </span>

              <strong
                className="saving-plan__amount"
                dir="ltr"
              >
                {formatMoney(
                  plans[key],
                  language,
                )}
              </strong>

              <small>
                /{" "}
                {t(
                  "dashboard.savingsGoals.plans.month",
                )}
              </small>
            </button>
          );
        })}
      </div>
    </section>
  );
}