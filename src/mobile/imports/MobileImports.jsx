import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { importLoader, keys } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import { IMPORT_FILTER_STATUSES, buildImportDetail } from "../models/exportsImports.js";
import { MOBILE_IMPORTS, importDetailPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import { IMPORT_LIST } from "../planning/lists.js";
import PagedListView from "../planning/PagedListView.jsx";
import RecordScreen from "../planning/RecordScreen.jsx";
import { useListScreen } from "../planning/useListScreen.js";
import Chevron from "../ui/Chevron.jsx";
import StateChip, { Fact } from "../ui/StateChip.jsx";
import WriteClosedNotice from "../ui/WriteClosedNotice.jsx";

const IMPORT_TONES = { uploaded: "neutral", mapping_required: "warn", validating: "warn", ready_for_review: "warn", partially_valid: "warn", confirmed: "warn", processing: "warn", completed: "good", failed: "bad", cancelled: "neutral", reversed: "neutral" };
const COUNT_KEYS = ["total", "valid", "invalid", "duplicate", "ignored", "imported"];

function ImportRow({ item, from, pages, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const when = formatMoment(item.createdAt, locale);

  return (
    <Link className="sm-row sm-plan-row" to={importDetailPath(item.id)} state={{ from, pages }} data-sm-import={item.id} data-sm-status={item.status ?? "none"}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text"><bdi>{item.fileName ?? t("imports.unnamed")}</bdi></span>
        {when && <span className="sm-row-meta"><bdi>{when}</bdi></span>}
        <span className="sm-chips-inline"><StateChip state={item.status} known={item.statusKnown} labels="imports.status" tones={IMPORT_TONES} /></span>
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * Statement imports, read-only (GET /imports): what was uploaded and where each
 * import stands. Uploading, mapping, fixing rows, confirming, cancelling and
 * reversing are writes and stay in the full version.
 */
export default function MobileImports() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(IMPORT_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <Link className="sm-button sm-button-small sm-new-link" to={"/m/imports/new"} data-sm-action="new-statement">{t("newLinks.statement")}</Link>
      <FilterTabs
        label={t("imports.filterStatus")}
        value={filters.status}
        options={[{ value: "", label: t("imports.all") }, ...IMPORT_FILTER_STATUSES.map((value) => ({ value, label: t(`imports.status.${value}`) }))]}
        onChange={(status) => setFilters({ ...filters, status })}
      />
    </div>
  );

  return (
    <PagedListView
      screen="imports"
      list={screen.list}
      toolbar={toolbar}
      filtered={screen.filtered}
      onResetFilters={screen.reset}
      strings="imports"
      pages={screen.pages}
      perPage={IMPORT_LIST.perPage}
      onLoadMore={screen.loadMore}
      onRefresh={screen.refresh}
      fullPath={PATH.USER.IMPORTS}
      renderRow={(item) => <ImportRow item={item} from={screen.here} pages={screen.pages} locale={locale} />}
    />
  );
}

function ImportDetail({ item, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-import-title">
        <h2 id="sm-import-title" className="sm-card-title sm-user-text"><bdi>{item.fileName ?? t("imports.unnamed")}</bdi></h2>
        <p className="sm-chips-inline"><StateChip state={item.status} known={item.statusKnown} labels="imports.status" tones={IMPORT_TONES} /></p>
        {item.inProgress && <p className="sm-text" role="status" data-sm-import-progress="true">{t("imports.inProgress")}</p>}
        {item.status === "completed" && <p className="sm-text">{t("imports.completedBody")}</p>}
        {item.failureReason && <p className="sm-text sm-form-error" role="alert"><bdi className="sm-user-text">{item.failureReason}</bdi></p>}
      </section>

      <section className="sm-card" aria-labelledby="sm-import-facts">
        <h2 id="sm-import-facts" className="sm-card-title">{t("imports.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          {item.accountName && <Fact label={t("imports.account")}><bdi className="sm-user-text">{item.accountName}</bdi></Fact>}
          {formatMoment(item.createdAt, locale) && <Fact label={t("imports.uploaded")}><bdi>{formatMoment(item.createdAt, locale)}</bdi></Fact>}
          {formatMoment(item.completedAt, locale) && <Fact label={t("imports.finished")}><bdi>{formatMoment(item.completedAt, locale)}</bdi></Fact>}
          {item.counts && COUNT_KEYS.map((key) => (item.counts[key] !== null ? <Fact key={key} label={t(`imports.count.${key}`)}><bdi dir="ltr">{item.counts[key]}</bdi></Fact> : null))}
        </dl>
        {!item.counts && <p className="sm-text sm-muted">{t("imports.noCounts")}</p>}
      </section>

      <section className="sm-card" aria-labelledby="sm-import-changes">
        <h2 id="sm-import-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <WriteClosedNotice operation="import.confirm" compact />
        <Link className="sm-link-row" to={`${PATH.USER.IMPORTS}/${encodeURIComponent(item.id)}`}>
          <span>{t("imports.openFullOne")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/* One import, read-only (GET /imports/{id}). Its status is re-read on Refresh; nothing is polled or confirmed from here. */
export function MobileImportDetail() {
  const { importId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="import-detail" recordId={importId} keyOf={keys.statementImport} loaderOf={importLoader} build={buildImportDetail} backFallback={MOBILE_IMPORTS} strings="imports" render={(item) => <ImportDetail item={item} locale={locale} />} />;
}
