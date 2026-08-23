import {
  LuPercent,
  LuHash,
  LuCircleDollarSign,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./ReportsSummary.css";

const summary = [
  {
    key: "savingsRate",
    value: "79%",
    icon: LuPercent,
    primary: true,
  },

  {
    key: "topCategory",
    valueKey: "travel",
    icon: LuHash,
  },

  {
    key: "averageSpend",
    value: "$52",
    icon: LuCircleDollarSign,
  },
];

export default function ReportsSummary() {
  const { t } = useTranslation();

  return (
    <section className="reports-summary">
      {summary.map(
        ({
          key,
          value,
          valueKey,
          icon: Icon,
          primary,
        }) => (
          <article
            className={`reports-summary-card ${
              primary
                ? "reports-summary-card--primary"
                : ""
            }`}
            key={key}
          >
            <div className="reports-summary-card__top">
              <span className="reports-summary-card__label">
                {t(
                  `dashboard.reports.summary.${key}`,
                )}
              </span>

              <span className="reports-summary-card__icon">
                <Icon />
              </span>
            </div>

            <strong className="reports-summary-card__value">
              {valueKey
                ? t(
                    `dashboard.reports.categories.${valueKey}`,
                  )
                : value}
            </strong>
          </article>
        ),
      )}
    </section>
  );
}