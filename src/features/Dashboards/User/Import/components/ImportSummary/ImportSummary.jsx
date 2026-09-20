import { useTranslation } from "react-i18next";
import { LuFileSpreadsheet, LuShieldCheck } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatFileSize } from "../../../ReportExports/reportExportHelpers";
import { formatDateTime } from "../../../utils/formatters";
import { COUNT_KEYS, isImportEditable } from "../../importHelpers";
import ImportStatusBadge from "../ImportStatusBadge/ImportStatusBadge";

import "./ImportSummary.css";

/*
 * The uploaded file and its import as the backend describes it: status,
 * counts, account and timestamps. Counts are shown as sent (never
 * recalculated); nothing here has moved money.
 */
export default function ImportSummary({ importRecord, actions }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const counts = importRecord.counts ?? {};
  const number = new Intl.NumberFormat(locale);
  const account = importRecord.account;
  const strategy = importRecord.direction_strategy;
  const strategyKey = `dashboard.importPage.directionStrategies.${strategy}`;

  return (
    <section className="import-summary" aria-labelledby="import-summary-title">
      <header className="import-summary__header">
        <span className="import-summary__icon">
          <LuFileSpreadsheet aria-hidden="true" />
        </span>
        <div className="import-summary__file">
          <h2 id="import-summary-title" dir="auto">
            {importRecord.original_filename ?? t("dashboard.importPage.summary.untitled")}
          </h2>
          <p>
            <bdi dir="ltr">{String(importRecord.file_type ?? "").toUpperCase() || "—"}</bdi>
            {" · "}
            <bdi dir="ltr">{formatFileSize(importRecord.file_size, locale)}</bdi>
            {importRecord.file_available === false && <> · {t("dashboard.importPage.summary.fileUnavailable")}</>}
          </p>
        </div>
        <ImportStatusBadge status={importRecord.status} />
        {actions && <div className="import-summary__actions">{actions}</div>}
      </header>

      <p className="import-summary__safe">
        <LuShieldCheck aria-hidden="true" />
        <span>{t("dashboard.importPage.noMoneyMoved")}</span>
      </p>

      {!isImportEditable(importRecord) && (
        <p className="import-summary__locked">{t("dashboard.importPage.summary.locked")}</p>
      )}
      {importRecord.failure_reason && <p className="import-summary__failure">{importRecord.failure_reason}</p>}

      <dl className="import-summary__counts">
        {COUNT_KEYS.filter((key) => counts[key] != null).map((key) => (
          <div key={key} className={`import-summary__count import-summary__count--${key}`}>
            <dt>{t(`dashboard.importPage.counts.${key}`)}</dt>
            <dd>
              <bdi dir="ltr">{number.format(Number(counts[key]) || 0)}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      <dl className="import-summary__meta">
        {account && (
          <div>
            <dt>{t("dashboard.importPage.fields.account")}</dt>
            <dd dir="auto">
              {account.name ?? `#${account.id}`}
              {account.currency_code && (
                <>
                  {" "}
                  (<bdi dir="ltr">{account.currency_code}</bdi>)
                </>
              )}
            </dd>
          </div>
        )}
        {strategy && (
          <div>
            <dt>{t("dashboard.importPage.fields.directionStrategy")}</dt>
            <dd>{i18n.exists(strategyKey) ? t(strategyKey) : strategy}</dd>
          </div>
        )}
        {importRecord.mapped_at && (
          <div>
            <dt>{t("dashboard.importPage.fields.mappedAt")}</dt>
            <dd>{formatDateTime(importRecord.mapped_at, locale)}</dd>
          </div>
        )}
        {importRecord.validated_at && (
          <div>
            <dt>{t("dashboard.importPage.fields.validatedAt")}</dt>
            <dd>{formatDateTime(importRecord.validated_at, locale)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
