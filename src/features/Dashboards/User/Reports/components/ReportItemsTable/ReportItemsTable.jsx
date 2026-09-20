import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { OCCURRENCE_STATES } from "../../reportDefinitions";
import {
  getExtraScalarKeys,
  getFieldLabel,
  getValueLabel,
  getValueType,
  isCurrencyCode,
  isObject,
  pickValue,
  toBarWidth,
} from "../../reportHelpers";
import ReportBadge from "../ReportBadge/ReportBadge";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportItemsTable.css";

const MAX_AUTO_COLUMNS = 10;

// First present scalar among `keys`: an object (e.g. a nested next
// occurrence without a date) is never printed.
function pickScalar(row, keys = []) {
  for (const key of keys) {
    const value = pickValue(row, [key]);
    if (value != null && typeof value !== "object") return value;
  }

  return null;
}

function hasColumnValue(column, row) {
  // The name column also carries the link to the row's details page.
  if (column.primary && column.link?.(row)) return true;
  if (column.type === "occurrences") return isObject(pickValue(row, column.keys));
  if (column.type === "progress") return pickScalar(row, [...column.keys, ...(column.statusKeys ?? [])]) != null;
  if (column.type === "range") return pickScalar(row, [...column.keys, ...(column.endKeys ?? [])]) != null;
  return pickScalar(row, column.keys) != null;
}

const getRowCurrency = (row, fallback) => {
  const currency = pickValue(row, ["currency_code", "account.currency_code"]);
  return isCurrencyCode(currency) ? currency : fallback;
};

function Cell({ column, row, currency, t, i18n }) {
  const value = pickScalar(row, column.keys);

  switch (column.type) {
    case "money":
      return <ReportValue value={value} type="money" currency={currency} tone={column.tone} />;
    case "status":
      return <ReportBadge value={value} />;
    case "enum":
      return <bdi>{getValueLabel(value, t, i18n)}</bdi>;
    case "currency":
      return <bdi dir="ltr">{value ?? "—"}</bdi>;
    case "frequency": {
      if (value == null) return "—";
      const interval = Number(pickScalar(row, column.intervalKeys));
      const label = getValueLabel(value, t, i18n);
      return Number.isInteger(interval) && interval > 1
        ? t("dashboard.reports.everyInterval", { interval, unit: label })
        : label;
    }
    case "progress": {
      const status = pickScalar(row, column.statusKeys);
      return (
        <span className="report-items__progress">
          <span className="report-items__progress-top">
            <ReportValue value={value} type="percent" />
            {status && <ReportBadge value={status} />}
          </span>
          {value != null && (
            <span className="report-items__bar" aria-hidden="true">
              <span
                className={status ? `report-items__bar--${status}` : ""}
                style={{ inlineSize: `${toBarWidth(value)}%` }}
              />
            </span>
          )}
        </span>
      );
    }
    case "range":
      return (
        <span className="report-items__range">
          <ReportValue value={value} type="date" />
          <span aria-hidden="true">–</span>
          <ReportValue value={pickScalar(row, column.endKeys)} type="date" />
        </span>
      );
    case "occurrences": {
      const counts = pickValue(row, column.keys);
      const states = [
        ...OCCURRENCE_STATES.filter((state) => counts[state] != null),
        ...Object.keys(counts).filter((state) => !OCCURRENCE_STATES.includes(state) && counts[state] != null),
      ];

      return (
        <span className="report-items__occurrences">
          {states.map((state) => (
            <span key={state} className={`report-items__occurrence report-items__occurrence--${state}`}>
              {getValueLabel(state, t, i18n)} <ReportValue value={counts[state]} type="count" />
            </span>
          ))}
        </span>
      );
    }
    default:
      return <ReportValue value={value} type={column.type} currency={currency} />;
  }
}

// Name of the row, linked to its details page when the backend sent its id.
function PrimaryCell({ column, row }) {
  const { t } = useTranslation();
  const value = pickScalar(row, column.keys);
  const path = column.link?.(row);
  const text = value ?? (path ? t("dashboard.reports.viewDetails") : "—");
  const description = typeof row.description === "string" ? row.description : null;

  return (
    <span className="report-items__primary">
      <span className="report-items__primary-name">
        {path ? <Link to={path}>{text}</Link> : <bdi>{text}</bdi>}
        {row.is_archived === true && <ReportBadge value="archived" />}
      </span>
      {column.id !== "description" && description && description !== value && (
        <small dir="auto">{description}</small>
      )}
    </span>
  );
}

/*
 * `data.items` with the report's own columns (a budget row is not a debt row).
 * A column appears only when a row has a value for it; if none of the
 * documented columns match, the rows' own fields are shown instead of
 * nothing. Money uses each row's currency.
 */
export default function ReportItemsTable({ columns, rows, fallbackCurrency }) {
  const { t, i18n } = useTranslation();
  let visible = columns.filter((column) => rows.some((row) => hasColumnValue(column, row)));

  if (visible.length === 0) {
    const keys = [];
    rows.forEach((row) => {
      getExtraScalarKeys(row, new Set()).forEach((key) => {
        if (!keys.includes(key) && keys.length < MAX_AUTO_COLUMNS) keys.push(key);
      });
    });
    visible = keys.map((key) => ({
      id: key,
      keys: [key],
      type: key === "currency_code" ? "currency" : getValueType(key, rows.find((row) => row[key] != null)?.[key]),
    }));
  }

  return (
    <div className="report-items__scroll">
      <table className="report-items">
        <thead>
          <tr>
            {visible.map((column) => (
              <th scope="col" key={column.id}>
                {getFieldLabel(column.id, t, i18n)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const currency = getRowCurrency(row, fallbackCurrency);

            return (
              <tr key={row.id ?? `${index}-${pickValue(row, ["name", "counterparty_name", "description"]) ?? ""}`}>
                {visible.map((column) => (
                  <td key={column.id} className={column.primary ? "report-items__cell--primary" : ""}>
                    {column.primary ? (
                      <PrimaryCell column={column} row={row} />
                    ) : (
                      <Cell column={column} row={row} currency={currency} t={t} i18n={i18n} />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
