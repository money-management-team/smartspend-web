import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { keys, reportLoader } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { REPORT_ITEMS, REPORT_TYPES, barLengths, buildReport, readReportRange, reportQuery, validReportRange } from "../models/reports.js";
import { MOBILE_REPORTS, reportPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import SavedViews from "../tools/SavedViews.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const NOT_FOUND = Object.freeze({ code: "NOT_FOUND" });
const pad = (value) => String(value).padStart(2, "0");

function Figure({ figure, currency }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  if (!figure) return <span className="sm-money-na">{t("money.unavailable")}</span>;
  return figure.kind === "count" ? <bdi dir="ltr">{figure.value}</bdi> : <Money plain value={figure.value} currency={currency} />;
}

/* One summary group of one currency: the table (the numbers), and bars drawn from it (decoration). */
export function SummaryGroup({ group, currency }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const money = group.filter((item) => item.figure?.kind === "money");
  const lengths = barLengths(money.map((item) => item.figure.value));

  return (
    <div className="sm-report-group">
      <dl className="sm-stats sm-stats-stacked">
        {group.map((item) => (
          <div key={item.field} className="sm-stat" data-sm-field={item.field}>
            <dt>{t(`reports.field.${item.field}`)}</dt>
            <dd><Figure figure={item.figure} currency={currency} /></dd>
          </div>
        ))}
      </dl>
      {money.length >= 2 && (
        <div className="sm-bars" aria-hidden="true">
          {money.map((item, index) => (
            <div key={item.field} className="sm-bar-row">
              <span className="sm-bar-label">{t(`reports.field.${item.field}`)}</span>
              <span className="sm-bar-track"><span className="sm-bar-fill" style={{ inlineSize: `${lengths[index] ?? 0}%` }} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RangeForm({ range, onApply }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const id = useId();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [tried, setTried] = useState(false);
  const valid = validReportRange(from, to);

  const lastMonth = () => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    onApply({ from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`, to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}` });
  };

  return (
    <form
      className="sm-card sm-filter-form"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (valid) onApply({ from, to });
      }}
      noValidate
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="sm-card-title">{t("reports.range")}</h2>
      <div className="sm-field-row">
        <div className="sm-field">
          <label className="sm-label" htmlFor={`${id}-from`}>{t("reports.from")}</label>
          <input id={`${id}-from`} className="sm-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-invalid={tried && !valid ? "true" : undefined} />
        </div>
        <div className="sm-field">
          <label className="sm-label" htmlFor={`${id}-to`}>{t("reports.to")}</label>
          <input id={`${id}-to`} className="sm-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-invalid={tried && !valid ? "true" : undefined} />
        </div>
      </div>
      {tried && !valid && <p className="sm-text sm-form-error" role="alert">{t("reports.rangeInvalid")}</p>}
      <div className="sm-actions">
        <button type="submit" className="sm-button">{t("reports.apply")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={() => onApply(null)}>{t("reports.thisMonth")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={lastMonth}>{t("reports.lastMonth")}</button>
      </div>
    </form>
  );
}

/*
 * One report, read-only. The range is in the address (?from=&to=), so Back and
 * a shared link show the same report; the default is this month so far. Every
 * figure is the backend's, per currency, and never added across currencies.
 */
export default function MobileReport() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const { reportType } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const known = REPORT_TYPES.includes(reportType);
  const type = known ? reportType : "overview";
  const range = readReportRange(location.search);
  const { from, to } = range;
  const pageParam = Number.parseInt(new URLSearchParams(location.search).get("page") ?? "1", 10);
  const page = REPORT_ITEMS[type] && pageParam > 1 && pageParam <= 500 ? pageParam : 1;
  const loader = useMemo(() => reportLoader(type, reportQuery(type, { from, to }, page)), [type, from, to, page]);
  const resource = useResource(keys.report(type, from, to, page), loader, { enabled: known });
  const report = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildReport(resource.data, type);
    } catch {
      return null;
    }
  }, [resource.data, type]);

  const setSearch = (next) => navigate({ pathname: location.pathname, search: next.toString() ? `?${next}` : "" }, { replace: true });
  const apply = (next) => setSearch(new URLSearchParams(next ? { from: next.from, to: next.to } : {}));
  const goPage = (next) => {
    const params = new URLSearchParams(location.search);
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    setSearch(params);
  };
  const back = (
    <Link className="sm-link-row sm-back" to={MOBILE_REPORTS}>
      <Chevron back />
      <span>{t("reports.back")}</span>
    </Link>
  );

  if (!known) {
    return (
      <section className="sm-page" data-sm-screen="report" data-sm-state="error">
        <ErrorPanel error={NOT_FOUND} />
        {back}
      </section>
    );
  }

  let body;
  if (resource.loading) body = <Skeleton lines={6} label={t("reports.loading")} />;
  else if (resource.status === "error" || !report) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} />;
  else {
    const spec = REPORT_ITEMS[type];
    body = (
      <>
        {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
        {report.period?.from && report.period?.to && (
          <p className="sm-text sm-muted sm-fine" data-sm-period={`${report.period.from}:${report.period.to}`}>
            {t("reports.periodShown", { from: formatDay(report.period.from, locale) ?? report.period.from, to: formatDay(report.period.to, locale) ?? report.period.to })}
          </p>
        )}
        {report.currencies.length === 0 ? (
          <div className="sm-card" data-sm-report-state="empty">
            <h2 className="sm-card-title">{t("reports.empty.title")}</h2>
            <p className="sm-text">{t("reports.empty.body")}</p>
          </div>
        ) : (
          report.currencies.map((row) => (
            <section key={row.currency} className="sm-card" aria-labelledby={`sm-rep-${row.currency}`} data-sm-currency={row.currency}>
              <h2 id={`sm-rep-${row.currency}`} className="sm-card-title"><bdi dir="ltr">{row.currency}</bdi></h2>
              {row.groups.map((group) => <SummaryGroup key={group[0].field} group={group} currency={row.currency} />)}
            </section>
          ))
        )}
        {report.currencies.length > 1 && <p className="sm-text sm-muted sm-fine">{t("reports.perCurrency")}</p>}

        {spec && (
          <section className="sm-card" aria-labelledby="sm-rep-items">
            <h2 id="sm-rep-items" className="sm-card-title">{t(`reports.items.${type}`)}</h2>
            {report.items.length === 0 ? (
              <p className="sm-text sm-muted" data-sm-items="none">{t("reports.items.none")}</p>
            ) : (
              <ul className="sm-list" data-sm-items={report.items.length}>
                {report.items.map((item) => (
                  <li key={item.key} className="sm-row" data-sm-item={item.key}>
                    <span className="sm-row-main">
                      <span className="sm-row-title sm-user-text">{item.name ?? t("reports.items.unnamed")}</span>
                      <span className="sm-row-meta">
                        {item.figure ? <Money plain value={item.figure} currency={item.currency} /> : <span className="sm-money-na">{t("money.unavailable")}</span>}
                        {item.of && <> {t("reports.items.of")} <Money plain value={item.of} currency={item.currency} /></>}
                        {item.status && <> · {item.status.replace(/_/g, " ")}</>}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {report.pagination && report.pagination.lastPage > 1 && (
              <div className="sm-actions">
                <p className="sm-text sm-muted sm-fine">{t("reports.items.page", { page: report.pagination.page, pages: report.pagination.lastPage, total: report.pagination.total })}</p>
                {report.pagination.page > 1 && <button type="button" className="sm-button sm-button-quiet" onClick={() => goPage(report.pagination.page - 1)}>{t("reports.items.previous")}</button>}
                {report.pagination.page < report.pagination.lastPage && <button type="button" className="sm-button sm-button-quiet" onClick={() => goPage(report.pagination.page + 1)}>{t("reports.items.next")}</button>}
              </div>
            )}
          </section>
        )}
      </>
    );
  }

  return (
    <section className="sm-page" data-sm-screen="report" data-sm-report={type} data-sm-state={resource.loading ? "loading" : report ? "ready" : "error"} aria-busy={resource.loading || undefined}>
      {back}
      <h2 className="sm-subhead">{t(`reports.type.${type}.title`)}</h2>
      <RangeForm key={`${from}:${to}`} range={range} onApply={apply} />
      <SavedViews scope="report" type={type} params={range.custom ? { from, to } : {}} path={reportPath(type)} />
      {body}
      <p className="sm-text sm-muted sm-fine">{t("reports.readOnly")}</p>
      <Link className="sm-link-row" to={PATH.USER.REPORTS}>
        <span>{t("reports.openFull")}</span>
        <Chevron />
      </Link>
    </section>
  );
}
