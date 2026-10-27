import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";

import { getAccountDetailsPath } from "../../routes/Path.js";
import { accountLoader, keys, movementsLoader } from "../data/loaders.js";
import { isAccountId, MOVEMENTS_PER_PAGE } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildAccountDetail } from "../models/accounts.js";
import { buildMovementPage } from "../models/movements.js";
import { MOBILE_ACCOUNTS, activityDetailPath } from "../navigation.js";
import { useAuthContext } from "../../contexts/auth/useAuthContext";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import { typeKey } from "./typeKey.js";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const NOT_FOUND = Object.freeze({ code: "NOT_FOUND" });

function Fact({ label, children }) {
  return (
    <div className="sm-stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// One page of movements. The pages stack: "Load more" (shown under the last page only) adds the next one.
function MovementsPage({ account, page, last, onMore, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const loader = useMemo(() => movementsLoader(account.id, page), [account.id, page]);
  const result = useResource(keys.movements(account.id, page), loader);
  const parsed = useMemo(() => {
    if (result.data === undefined) return { value: null, error: null };

    try {
      return { value: buildMovementPage(result.data, { id: account.id, workspaceId: account.workspaceId, currency: account.currency }, { page, perPage: MOVEMENTS_PER_PAGE }), error: null };
    } catch (error) {
      return { value: null, error };
    }
  }, [result.data, account.id, account.workspaceId, account.currency, page]);

  // "Load more" removes the button that had focus: the new rows take it, so a keyboard or screen reader user lands on them.
  const listRef = useRef(null);
  const ready = !result.loading && parsed.value !== null;
  useEffect(() => {
    if (page > 1 && ready) listRef.current?.focus();
  }, [page, ready]);

  if (result.loading) return <Skeleton lines={3} label={t("movements.loading")} />;

  if (result.status === "error" || parsed.error) {
    return <ErrorPanel error={result.error ?? parsed.error ?? MALFORMED} onRetry={result.reload} retrying={result.refreshing} compact />;
  }

  const { rows, lastPage, total } = parsed.value;

  return (
    <>
      {result.stale && <StaleNotice error={result.error} updatedAt={result.updatedAt} onRetry={result.reload} retrying={result.refreshing} />}
      {page === 1 && rows.length === 0 && <p className="sm-text sm-muted" data-sm-section="empty">{t("movements.empty")}</p>}
      {rows.length > 0 && (
        <ul className="sm-list" data-sm-page={page} ref={listRef} tabIndex={-1} aria-label={t("movements.pageLabel", { page })}>
          {rows.map((row) => {
            const date = formatDay(row.occurredAt, locale, timeZone);
            const kind = row.isReversal ? "reversal" : row.type === "transfer" ? (row.direction === "in" ? "transferIn" : "transferOut") : typeKey(row.type);
            const label = row.title ?? t(`movements.kind.${kind}`, { defaultValue: t(`types.${typeKey(row.type)}`) });

            return (
              <li key={row.id} data-sm-direction={row.direction}>
                <Link className="sm-row" to={activityDetailPath(row.id)} state={{ from: `${location.pathname}${location.search}` }}>
                <span className="sm-row-main">
                  <span className="sm-row-title sm-user-text">{label}</span>
                  <span className="sm-row-meta">
                    {t(`movements.kind.${kind}`, { defaultValue: t(`types.${typeKey(row.type)}`) })}
                    {row.counterpart ? <> · <bdi dir="auto">{row.counterpart}</bdi></> : null}
                    {date ? <> · <bdi>{date}</bdi></> : null}
                    {row.reversed ? ` · ${t("movements.reversed")}` : ""}
                  </span>
                </span>
                <span className="sm-row-end">
                  <span className="sm-row-amount">
                    <Money plain plus value={row.amount} currency={account.currency} />
                  </span>
                  <Chevron />
                </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {last && page < lastPage && (
        <button type="button" className="sm-button sm-button-quiet" onClick={onMore} data-sm-more={page + 1}>
          {t("movements.more")}
        </button>
      )}
      {last && page >= lastPage && total > MOVEMENTS_PER_PAGE && <p className="sm-text sm-muted sm-fine">{t("movements.end")}</p>}
    </>
  );
}

function Movements({ account, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [pages, setPages] = useState(1);

  // Without a workspace or a currency the lines of a movement cannot be matched to this account.
  if (!account.workspaceId || !account.currency) {
    return (
      <section className="sm-card" aria-labelledby="sm-movements-title">
        <h2 id="sm-movements-title" className="sm-card-title">{t("movements.title")}</h2>
        <p className="sm-text sm-muted" data-sm-section="unavailable">{t("movements.unavailable")}</p>
      </section>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-movements-title">
      <h2 id="sm-movements-title" className="sm-card-title">{t("movements.title")}</h2>
      {Array.from({ length: pages }, (_, index) => (
        <MovementsPage key={index + 1} account={account} page={index + 1} last={index + 1 === pages} onMore={() => setPages(index + 2)} locale={locale} timeZone={timeZone} />
      ))}
    </section>
  );
}

function Detail({ account, resource, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const yesNo = (value) => (value === true ? t("detail.yes") : value === false ? t("detail.no") : "—");
  const created = formatDay(account.createdAt, locale, timeZone);
  const name = account.name ?? t("accounts.untitled");

  return (
    <section className="sm-page" data-sm-screen="account-detail" data-sm-account={account.id} data-sm-state={resource.stale ? "stale" : "ready"} data-sm-stale={resource.stale ? "true" : undefined}>
      <Link className="sm-link-row sm-back" to={MOBILE_ACCOUNTS}>
        <Chevron back />
        <span>{t("detail.back")}</span>
      </Link>

      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}

      <section className="sm-card sm-hero" aria-labelledby="sm-account-name">
        <h2 id="sm-account-name" className="sm-card-title sm-user-text">{name}</h2>
        <p className="sm-hero-note">
          {t(`types.${typeKey(account.isGoal ? "savings_goal" : account.type)}`)}
          {account.status ? ` · ${t(account.archived ? "detail.statusArchived" : "detail.statusActive")}` : ""}
        </p>
        <p className="sm-balance-label">{t("detail.balance")}</p>
        <Money className="sm-hero-money" value={account.balance} currency={account.currency} />
        <p className="sm-hero-note">{t("detail.balanceNote")}</p>
      </section>

      {account.archived && (
        <div className="sm-card" role="note">
          <p className="sm-text">{t("detail.archivedNote")}</p>
        </div>
      )}

      <section className="sm-card" aria-labelledby="sm-account-facts">
        <h2 id="sm-account-facts" className="sm-card-title">{t("detail.about")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("detail.currency")}><bdi dir="ltr">{account.currency ?? "—"}</bdi></Fact>
          <Fact label={t("detail.opening")}><Money value={account.openingBalance} currency={account.currency} /></Fact>
          <Fact label={t("detail.negative")}>{yesNo(account.allowsNegative)}</Fact>
          {account.lowBalanceThreshold != null && <Fact label={t("detail.threshold")}><Money value={account.lowBalanceThreshold} currency={account.currency} /></Fact>}
          {account.lastFour && <Fact label={t("detail.lastFour")}><bdi dir="ltr">•••• {account.lastFour}</bdi></Fact>}
          {account.isDefault === true && <Fact label={t("detail.default")}>{t("detail.yes")}</Fact>}
          {created && <Fact label={t("detail.created")}><bdi>{created}</bdi></Fact>}
        </dl>
      </section>

      <Movements account={account} locale={locale} timeZone={timeZone} />

      <section className="sm-card" aria-labelledby="sm-account-changes">
        <h2 id="sm-account-changes" className="sm-card-title">{t("detail.changesTitle")}</h2>
        <p className="sm-text sm-muted">{t("detail.changesBody")}</p>
        <Link className="sm-link-row" to={getAccountDetailsPath(account.id)}>
          <span>{t("detail.openFull")}</span>
          <Chevron />
        </Link>
      </section>
    </section>
  );
}

/*
 * One account, read-only: its confirmed balance, a few facts, and its
 * movements (from GET /accounts/{id} and GET /transactions?account_id=). The
 * response must be for the account in the address: if it names another, or no,
 * id it is refused, so figures never appear under the wrong account.
 * A missing or forbidden account is reported without saying which.
 */
export default function MobileAccountDetail() {
  const { accountId } = useParams();
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const valid = isAccountId(accountId);
  const loader = useMemo(() => accountLoader(accountId), [accountId]);
  // An address that is not an account id never produces a request.
  const resource = useResource(keys.account(accountId), loader, { enabled: valid });
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;
  const account = useMemo(() => (valid && resource.data !== undefined ? buildAccountDetail(resource.data, accountId) : null), [valid, resource.data, accountId]);

  if (!valid) {
    return (
      <section className="sm-page" data-sm-screen="account-detail" data-sm-state="error">
        <ErrorPanel error={NOT_FOUND} />
        <Link className="sm-link-row sm-back" to={MOBILE_ACCOUNTS}><Chevron back /><span>{t("detail.back")}</span></Link>
      </section>
    );
  }

  if (resource.loading) {
    return (
      <section className="sm-page" data-sm-screen="account-detail" data-sm-state="loading" aria-busy="true">
        <Skeleton lines={5} label={t("detail.loading")} />
      </section>
    );
  }

  if (resource.status === "error" || !account) {
    return (
      <section className="sm-page" data-sm-screen="account-detail" data-sm-state="error">
        <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} hideExistence />
        <Link className="sm-link-row sm-back" to={MOBILE_ACCOUNTS}><Chevron back /><span>{t("detail.back")}</span></Link>
      </section>
    );
  }

  return <Detail account={account} resource={resource} locale={locale} timeZone={timeZone} />;
}
