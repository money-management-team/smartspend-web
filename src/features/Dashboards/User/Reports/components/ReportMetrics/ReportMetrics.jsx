import { useTranslation } from "react-i18next";

import {
  getExtraScalarKeys,
  getFieldLabel,
  getNestedGroups,
  getValueType,
  isCurrencyCode,
  isObject,
  parseDistribution,
  toBarWidth,
  toCurrencyRows,
} from "../../reportHelpers";
import ReportDistribution from "../ReportDistribution/ReportDistribution";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportMetrics.css";

const MAX_TABLE_COLUMNS = 8;
const isSigned = (key) => /(^|_)net(_|$)|net_change|net_position/.test(key);
// A flat object of counts keyed by status/direction is a distribution; one
// keyed by metric names (…_count, total_…) is a set of metrics.
const hasMetricKeys = (value) =>
  Object.keys(value).some((key) => /count|total|amount|balance|percentage|outstanding|saved|target/.test(key));

function MetricCard({ row, fields, currency, depth, t, i18n }) {
  const known = fields.filter((key) => row[key] != null && row[key] !== "");
  const keys = [...known, ...getExtraScalarKeys(row, new Set(["currency_code", ...fields]))];
  const nested = depth < 1 ? getNestedGroups(row, new Set(["currency_code", ...fields])) : [];

  return (
    <article className="report-metrics__card">
      {row.currency_code && (
        <h3>
          <bdi dir="ltr">{row.currency_code}</bdi>
        </h3>
      )}

      {keys.length > 0 && (
        <dl className="report-metrics__list">
          {keys.map((key) => {
            const type = getValueType(key, row[key]);

            return (
              <div className="report-metrics__item" key={key}>
                <dt>{getFieldLabel(key, t, i18n)}</dt>
                <dd>
                  <ReportValue value={row[key]} type={type} currency={currency} tone={isSigned(key)} />
                  {type === "percent" && (
                    <span className="report-metrics__bar" aria-hidden="true">
                      <span style={{ inlineSize: `${toBarWidth(row[key])}%` }} />
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {nested.map(({ key, value }) => (
        <div className="report-metrics__nested" key={key}>
          <h4>{getFieldLabel(key, t, i18n)}</h4>
          <ReportMetrics value={value} depth={depth + 1} currency={currency} />
        </div>
      ))}
    </article>
  );
}

function AutoTable({ rows, currency, t, i18n }) {
  const columns = [];

  rows.forEach((row) => {
    getExtraScalarKeys(row, new Set()).forEach((key) => {
      if (!columns.includes(key) && columns.length < MAX_TABLE_COLUMNS) columns.push(key);
    });
  });

  if (columns.length === 0) return null;

  return (
    <div className="report-metrics__scroll">
      <table className="report-metrics__table">
        <thead>
          <tr>
            {columns.map((key) => (
              <th scope="col" key={key}>
                {getFieldLabel(key, t, i18n)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((key) => (
                <td key={key}>
                  <ReportValue
                    value={row[key]}
                    type={key === "currency_code" ? "text" : getValueType(key, row[key])}
                    currency={isCurrencyCode(row.currency_code) ? row.currency_code : currency}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/*
 * Renders one analytics value by its shape, without assuming more than the
 * backend sent: per-currency rows become one card per currency (never
 * merged), counts by status become a distribution, a list of objects becomes a
 * table, a flat object becomes a single card. `fields` puts documented fields
 * first; every other field is still shown.
 */
export default function ReportMetrics({ value, fields = [], currency = null, depth = 0 }) {
  const { t, i18n } = useTranslation();
  const rows = toCurrencyRows(value);

  // Object keyed by currency whose values are lists: one table per currency.
  if (rows.length > 0 && rows.every((row) => Array.isArray(row.points))) {
    return (
      <div className="report-metrics">
        {rows.map((row) => (
          <article className="report-metrics__card" key={row.currency_code}>
            <h3>
              <bdi dir="ltr">{row.currency_code}</bdi>
            </h3>
            <AutoTable rows={row.points.filter(isObject)} currency={row.currency_code} t={t} i18n={i18n} />
          </article>
        ))}
      </div>
    );
  }

  if (rows.length > 0) {
    return (
      <div className="report-metrics">
        {rows.map((row, index) => (
          <MetricCard
            key={row.currency_code ?? index}
            row={row}
            fields={fields}
            currency={isCurrencyCode(row.currency_code) ? row.currency_code : currency}
            depth={depth}
            t={t}
            i18n={i18n}
          />
        ))}
      </div>
    );
  }

  if (!isObject(value) || !hasMetricKeys(value)) {
    const distribution = parseDistribution(value);
    if (distribution.length > 0) return <ReportDistribution groups={distribution} />;
  }

  if (Array.isArray(value)) {
    const objects = value.filter(isObject);
    if (objects.length > 0) return <AutoTable rows={objects} currency={currency} t={t} i18n={i18n} />;

    const scalars = value.filter((item) => item != null && typeof item !== "object");
    return scalars.length > 0 ? <p className="report-metrics__scalar">{scalars.join(", ")}</p> : null;
  }

  if (isObject(value)) {
    return (
      <div className="report-metrics">
        <MetricCard row={value} fields={fields} currency={currency} depth={depth} t={t} i18n={i18n} />
      </div>
    );
  }

  if (value == null || value === "") return null;

  return (
    <p className="report-metrics__scalar">
      <ReportValue value={value} type={getValueType("", value)} currency={currency} />
    </p>
  );
}
