import { useTranslation } from "react-i18next";
import { LuCalendarRange, LuGlobe, LuInfo } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate } from "../../../utils/formatters";
import { isCurrencyCode, isObject } from "../../reportHelpers";

import "./ReportPeriod.css";

const rangeOf = (period) => ({
  from: period?.date_from ?? period?.from ?? null,
  to: period?.date_to ?? period?.to ?? null,
});

/*
 * The period the backend actually used (`data.period`), which is the source
 * of truth even when it differs from the requested range, plus the previous
 * period it compared against and the report's financial rule.
 */
export default function ReportPeriod({ report, period, previousPeriod, filters, notes }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const current = rangeOf(period);
  const previous = isObject(previousPeriod) ? rangeOf(previousPeriod) : null;
  const currency = filters?.currency ?? filters?.currency_code;
  const groupBy = filters?.group_by;
  const formatRange = ({ from, to }) =>
    t("dashboard.reports.period.range", { from: formatDate(from, locale), to: formatDate(to, locale) });

  return (
    <div className="report-period">
      <div className="report-period__heading">
        <h2>{t(`dashboard.reports.names.${report}`)}</h2>
        <p>{t(`dashboard.reports.descriptions.${report}`)}</p>
      </div>

      <dl className="report-period__facts">
        {(current.from || current.to) && (
          <div className="report-period__fact">
            <dt>
              <LuCalendarRange aria-hidden="true" />
              {t("dashboard.reports.period.current")}
            </dt>
            <dd>{formatRange(current)}</dd>
          </div>
        )}

        {previous && (previous.from || previous.to) && (
          <div className="report-period__fact">
            <dt>{t("dashboard.reports.period.previous")}</dt>
            <dd>{formatRange(previous)}</dd>
          </div>
        )}

        {period?.timezone && (
          <div className="report-period__fact">
            <dt>
              <LuGlobe aria-hidden="true" />
              {t("dashboard.reports.period.timezone")}
            </dt>
            <dd>
              <bdi dir="ltr">{period.timezone}</bdi>
            </dd>
          </div>
        )}

        <div className="report-period__fact">
          <dt>{t("dashboard.reports.filters.currency")}</dt>
          <dd>
            {isCurrencyCode(currency) ? <bdi dir="ltr">{currency}</bdi> : t("dashboard.reports.filters.allCurrencies")}
          </dd>
        </div>

        {groupBy && (
          <div className="report-period__fact">
            <dt>{t("dashboard.reports.filters.groupBy")}</dt>
            <dd>
              {i18n.exists(`dashboard.reports.filters.groupByOptions.${groupBy}`)
                ? t(`dashboard.reports.filters.groupByOptions.${groupBy}`)
                : groupBy}
            </dd>
          </div>
        )}
      </dl>

      {notes.map((note) => (
        <p key={note} className="report-period__note">
          <LuInfo aria-hidden="true" />
          <span>{t(`dashboard.reports.notes.${note}`)}</span>
        </p>
      ))}
    </div>
  );
}
