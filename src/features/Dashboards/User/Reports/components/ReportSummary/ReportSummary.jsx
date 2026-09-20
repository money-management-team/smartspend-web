import { useTranslation } from "react-i18next";

import {
  getExtraScalarKeys,
  getFieldLabel,
  getNestedGroups,
  getValueType,
  isCurrencyCode,
} from "../../reportHelpers";
import ReportSection from "../ReportSection/ReportSection";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportSummary.css";

const isSigned = (key) => /(^|_)net(_|$)|net_change|net_position/.test(key);

function SummaryFields({ row, fields, currency, t, i18n, hero = false }) {
  return (
    <dl className={`report-summary__fields ${hero ? "report-summary__fields--hero" : ""}`}>
      {fields.map((key) => (
        <div className="report-summary__field" key={key}>
          <dt>{getFieldLabel(key, t, i18n)}</dt>
          <dd>
            <ReportValue
              value={row[key]}
              type={getValueType(key, row[key])}
              currency={currency}
              tone={isSigned(key)}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/*
 * `summary_by_currency`: one card per currency, each figure in its own
 * currency. Amounts in different currencies are never added together and
 * nothing is recalculated. Fields are grouped as the report definition says;
 * any other field the backend sends follows, and nested objects (e.g. cash
 * flow buckets) become their own group.
 */
export default function ReportSummary({ rows, groups }) {
  const { t, i18n } = useTranslation();
  const listed = new Set(["currency_code", ...groups.flatMap((group) => group.fields)]);

  return (
    <ReportSection
      wide
      title={t("dashboard.reports.sections.summary")}
      hint={rows.length > 1 ? t("dashboard.reports.sections.summaryMultiCurrency") : null}
    >
      {rows.length === 0 ? (
        <p className="report-summary__empty">{t("dashboard.reports.states.emptySummary")}</p>
      ) : (
        <div className="report-summary__grid">
          {rows.map((row, index) => {
            const currency = isCurrencyCode(row.currency_code) ? row.currency_code : null;
            const visibleGroups = groups
              .map((group) => ({ ...group, fields: group.fields.filter((key) => key in row && row[key] !== null) }))
              .filter((group) => group.fields.length > 0);
            const extraKeys = getExtraScalarKeys(row, listed);
            const nested = getNestedGroups(row, listed);

            return (
              <article className="report-summary-card" key={row.currency_code ?? index}>
                <header className="report-summary-card__header">
                  <strong>
                    <bdi dir="ltr">{row.currency_code ?? "—"}</bdi>
                  </strong>
                </header>

                {visibleGroups.map((group, groupIndex) => (
                  <div className="report-summary-card__group" key={group.title ?? groupIndex}>
                    {group.title && (
                      <h3>
                        {t(`dashboard.reports.summaryGroups.${group.title}`)}
                        {group.forecast && (
                          <span className="report-summary-card__forecast">{t("dashboard.reports.forecastBadge")}</span>
                        )}
                      </h3>
                    )}
                    <SummaryFields
                      row={row}
                      fields={group.fields}
                      currency={currency}
                      t={t}
                      i18n={i18n}
                      hero={groupIndex === 0 && !group.title}
                    />
                  </div>
                ))}

                {extraKeys.length > 0 && (
                  <div className="report-summary-card__group">
                    {visibleGroups.length > 0 && <h3>{t("dashboard.reports.summaryGroups.other")}</h3>}
                    <SummaryFields row={row} fields={extraKeys} currency={currency} t={t} i18n={i18n} />
                  </div>
                )}

                {nested.map(({ key, value }) => (
                  <div className="report-summary-card__group" key={key}>
                    <h3>{getFieldLabel(key, t, i18n)}</h3>
                    <SummaryFields
                      row={value}
                      fields={getExtraScalarKeys(value, new Set(["currency_code"]))}
                      currency={isCurrencyCode(value.currency_code) ? value.currency_code : currency}
                      t={t}
                      i18n={i18n}
                    />
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      )}
    </ReportSection>
  );
}
