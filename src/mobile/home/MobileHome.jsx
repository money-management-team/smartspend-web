import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { PATH } from "../../routes/Path.js";
import AccountRow from "../accounts/AccountRow.jsx";
import { typeKey } from "../accounts/typeKey.js";
import { keys, loadAlerts, loadDashboard } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { currencyName } from "../money/decimal.js";
import { formatDay, formatDayMonth } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildAlertsModel, buildHomeModel } from "../models/home.js";
import { MOBILE_ACCOUNTS, MOBILE_ACTIVITY, MOBILE_PREFIX, activityDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

const ACCOUNT_PREVIEW = 4;
const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

function Unavailable({ children }) {
  return (
    <p className="sm-text sm-muted" data-sm-section="unavailable">{children}</p>
  );
}

function Card({ id, title, children, className = "", action }) {
  return (
    <section className={`sm-card ${className}`.trim()} aria-labelledby={id}>
      <div className="sm-card-head">
        <h2 id={id} className="sm-card-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function BalanceCard({ section, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <Card id="sm-home-balance" title={t(section.multi ? "home.balance.titleMulti" : "home.balance.title")} className="sm-hero">
      {section.state === "ready" && (
        <ul className="sm-balance-list">
          {section.rows.map((row) => (
            <li key={row.currency} className="sm-balance-row" data-sm-currency={row.currency}>
              <span className="sm-balance-label">
                <span className="sm-balance-code" dir="ltr">{row.currency}</span>
                <span className="sm-balance-name">{currencyName(row.currency, locale)}</span>
                {section.multi && row.currency === section.primary && <span className="sm-chip">{t("home.balance.primary")}</span>}
              </span>
              <Money className="sm-hero-money" value={row.balance} currency={row.currency} />
            </li>
          ))}
        </ul>
      )}
      {section.state === "ready" && <p className="sm-hero-note">{t(section.multi ? "home.balance.noteMulti" : "home.balance.note")}</p>}
      {section.state === "empty" && <p className="sm-hero-note">{t("home.balance.empty")}</p>}
      {section.state === "unavailable" && <p className="sm-hero-note" data-sm-section="unavailable">{t("home.balance.unavailable")}</p>}
    </Card>
  );
}

function PeriodChip({ period, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const range = period.from && period.to ? t("home.period.range", { from: formatDayMonth(period.from, locale, timeZone), to: formatDayMonth(period.to, locale, timeZone) }) : null;

  return (
    <p className="sm-period" data-sm-period={period.preset ?? "unknown"}>
      <span className="sm-chip">{period.preset === "month" ? t("home.period.month") : t("home.period.unconfirmed")}</span>
      {range && <span className="sm-muted">{range}</span>}
    </p>
  );
}

function SummaryCard({ balances, period, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <Card id="sm-home-summary" title={t("home.summary.title")}>
      <PeriodChip period={period} locale={locale} timeZone={timeZone} />
      {balances.state === "ready" ? (
        <div className="sm-summary-list">
          {balances.rows.map((row) => (
            <div key={row.currency} className="sm-summary-block" data-sm-currency={row.currency}>
              {balances.multi && <p className="sm-subhead" dir="ltr">{row.currency}</p>}
              <dl className="sm-stats">
                <div className="sm-stat"><dt>{t("home.summary.income")}</dt><dd><Money plus value={row.income} currency={row.currency} /></dd></div>
                <div className="sm-stat"><dt>{t("home.summary.expense")}</dt><dd><Money value={row.expense} currency={row.currency} /></dd></div>
                <div className="sm-stat"><dt>{t("home.summary.net")}</dt><dd><Money plus value={row.net} currency={row.currency} /></dd></div>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <Unavailable>{t(balances.state === "empty" ? "home.summary.empty" : "home.summary.unavailable")}</Unavailable>
      )}
      <p className="sm-text sm-muted sm-fine">{t("home.period.note")}</p>
    </Card>
  );
}

function AccountsCard({ section }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const shown = section.items.slice(0, ACCOUNT_PREVIEW);

  return (
    <Card id="sm-home-accounts" title={t("home.accounts.title")}>
      {section.state === "ready" && (
        <>
          <ul className="sm-list">
            {shown.map((account, index) => (
              <li key={account.id ?? `row-${index}`}><AccountRow account={account} /></li>
            ))}
          </ul>
          <Link className="sm-link-row" to={MOBILE_ACCOUNTS}>
            <span>{t("home.accounts.all")}</span>
            <Chevron />
          </Link>
        </>
      )}
      {section.state === "empty" && (
        <>
          <p className="sm-text">{t("home.accounts.empty")}</p>
          <Link className="sm-link-row" to={PATH.USER.ACCOUNTS}>
            <span>{t("home.accounts.openFull")}</span>
            <Chevron />
          </Link>
        </>
      )}
      {section.state === "unavailable" && <Unavailable>{t("home.accounts.unavailable")}</Unavailable>}
    </Card>
  );
}

function RecentCard({ section, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <Card
      id="sm-home-recent"
      title={t("home.recent.title")}
      action={
        <Link className="sm-card-link" to={MOBILE_ACTIVITY}>
          {t("home.recent.viewAll")}
        </Link>
      }
    >
      {section.state === "ready" && (
        <ul className="sm-list">
          {section.items.map((item, index) => {
            const date = formatDay(item.occurredAt, locale, timeZone);
            const content = (
              <>
                <span className="sm-row-main">
                  <span className="sm-row-title sm-user-text">{item.title ?? t(`types.${typeKey(item.type)}`)}</span>
                  <span className="sm-row-meta">
                    {t(`types.${typeKey(item.type)}`)}
                    {date ? <> · <bdi>{date}</bdi></> : null}
                    {item.reversed ? ` · ${t("movements.reversed")}` : ""}
                  </span>
                </span>
                <span className="sm-row-end">
                  <span className="sm-row-amount">
                    <Money plain plus={item.type === "income"} value={item.amount} currency={item.currency} />
                  </span>
                  {item.id && <Chevron />}
                </span>
              </>
            );

            return (
              <li key={item.id ?? `row-${index}`} data-sm-type={item.type ?? "unknown"}>
                {item.id ? (
                  <Link className="sm-row" to={activityDetailPath(item.id)} state={{ from: MOBILE_PREFIX }}>
                    {content}
                  </Link>
                ) : (
                  <div className="sm-row sm-row-static">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {section.state === "empty" && <Unavailable>{t("home.recent.empty")}</Unavailable>}
      {section.state === "unavailable" && <Unavailable>{t("home.recent.unavailable")}</Unavailable>}
    </Card>
  );
}

function AttentionCard({ alerts }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const model = useMemo(() => buildAlertsModel(alerts.data), [alerts.data]);

  if (alerts.loading) return null;

  if (alerts.status === "error" || (alerts.data !== undefined && !model)) {
    return (
      <Card id="sm-home-attention" title={t("home.attention.title")}>
        <ErrorPanel error={alerts.error ?? MALFORMED} onRetry={alerts.reload} retrying={alerts.refreshing} compact />
      </Card>
    );
  }

  // Nothing to attend to is not a section: it only appears when the backend has something to say.
  if (!model || model.count === 0) return null;

  return (
    <Card id="sm-home-attention" title={t("home.attention.title")} className="sm-attention">
      <p className="sm-text">{t("home.attention.count", { count: model.count })}</p>
      <ul className="sm-list">
        {model.items.map((alert, index) => (
          <li key={index} className="sm-alert" data-sm-severity={alert.severity}>
            <span className="sm-chip sm-chip-severity">{t(`home.attention.${alert.severity}`)}</span>
            <span className="sm-user-text">{alert.message}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/*
 * Mobile Home: read-only, from GET /dashboard (this month) and GET
 * /financial-alerts. Every figure is the backend's, in the currency it
 * reported it in, and nothing is added up across currencies.
 */
export default function MobileHome() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const dashboard = useResource(keys.dashboard, loadDashboard);
  const alerts = useResource(keys.alerts, loadAlerts);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;
  const model = useMemo(() => (dashboard.data === undefined ? null : buildHomeModel(dashboard.data)), [dashboard.data]);
  const name = typeof user?.name === "string" ? user.name.trim() : "";

  if (dashboard.loading) {
    return (
      <section className="sm-page" data-sm-screen="home" data-sm-state="loading" aria-busy="true">
        <Skeleton lines={5} label={t("home.loading")} />
      </section>
    );
  }

  if (dashboard.status === "error" || !model) {
    return (
      <section className="sm-page" data-sm-screen="home" data-sm-state="error">
        <ErrorPanel error={dashboard.error ?? MALFORMED} onRetry={dashboard.reload} retrying={dashboard.refreshing} />
      </section>
    );
  }

  return (
    <section className="sm-page" data-sm-screen="home" data-sm-state={dashboard.stale ? "stale" : "ready"} data-sm-stale={dashboard.stale ? "true" : undefined}>
      <div className="sm-greeting">
        <p className="sm-text">{name ? t("home.hello", { name }) : t("home.helloNoName")}</p>
        <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={dashboard.reload} disabled={dashboard.refreshing} aria-busy={dashboard.refreshing}>
          {t(dashboard.refreshing ? "home.refreshing" : "home.refresh")}
        </button>
      </div>

      {dashboard.stale && <StaleNotice error={dashboard.error} updatedAt={dashboard.updatedAt} onRetry={dashboard.reload} retrying={dashboard.refreshing} />}

      <BalanceCard section={model.balances} locale={locale} />
      <SummaryCard balances={model.balances} period={model.period} locale={locale} timeZone={timeZone} />
      <AccountsCard section={model.accounts} />
      <RecentCard section={model.recent} locale={locale} timeZone={timeZone} />
      <AttentionCard alerts={alerts} />
    </section>
  );
}
