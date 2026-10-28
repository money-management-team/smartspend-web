import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";

import { getCategoryDetailsPath } from "../../routes/Path.js";
import { categoryLoader, keys } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import { buildCategoryDetail } from "../models/categories.js";
import { MOBILE_CATEGORIES, categoryEditPath } from "../navigation.js";
import RecordScreen from "../planning/RecordScreen.jsx";
import { isWriteOpen } from "../data/writeGate.js";
import Chevron from "../ui/Chevron.jsx";
import WriteClosedNotice from "../ui/WriteClosedNotice.jsx";
import CategoryBadge from "./CategoryBadge.jsx";

const keyOf = keys.category;

function Fact({ label, children }) {
  return (
    <div className="sm-stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Detail({ category, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const type = category.typeKnown ? t(`categories.type.${category.type}`) : category.type ? t("categories.type.unknown", { type: category.type.replace(/_/g, " ") }) : t("categories.type.missing");
  const kind = category.system === true ? t("categories.system") : category.system === false ? t("categories.custom") : t("categories.kindUnknown");

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-cat-title">
        <div className="sm-tx-head">
          <CategoryBadge category={category} />
          <h2 id="sm-cat-title" className="sm-card-title sm-user-text">{category.name ?? t("categories.untitled")}</h2>
        </div>
        <p className="sm-chips-inline">
          <span className="sm-chip">{type}</span>
          <span className="sm-chip">{kind}</span>
          {category.active === false && <span className="sm-chip">{t("categories.archived")}</span>}
        </p>
      </section>

      {category.system === true && (
        <div className="sm-card" role="note" data-sm-note="system">
          <p className="sm-text">{t("categories.systemNote")}</p>
        </div>
      )}
      {category.active === false && (
        <div className="sm-card" role="note" data-sm-note="archived">
          <p className="sm-text">{t("categories.archivedNote")}</p>
        </div>
      )}

      <section className="sm-card" aria-labelledby="sm-cat-facts">
        <h2 id="sm-cat-facts" className="sm-card-title">{t("categories.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("categories.typeLabel")}>{type}</Fact>
          <Fact label={t("categories.kindLabel")}>{kind}</Fact>
          {category.color && (
            <Fact label={t("categories.color")}>
              <span className="sm-cat-swatch" aria-hidden="true" style={{ "--sm-cat-color": category.color }} /> <bdi dir="ltr">{category.color}</bdi>
            </Fact>
          )}
          <Fact label={t("categories.icon")}>{category.icon ? <bdi dir="ltr">{category.icon}</bdi> : t("categories.iconDefault")}</Fact>
          {formatDay(category.createdAt, locale) && <Fact label={t("categories.created")}><bdi>{formatDay(category.createdAt, locale)}</bdi></Fact>}
          {formatDay(category.updatedAt, locale) && <Fact label={t("categories.updated")}><bdi>{formatDay(category.updatedAt, locale)}</bdi></Fact>}
        </dl>
      </section>

      <section className="sm-card" aria-labelledby="sm-cat-changes">
        <h2 id="sm-cat-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        {category.manageable && !isWriteOpen("category.update") ? (
          <WriteClosedNotice operation="category.update" compact />
        ) : category.manageable ? (
          <>
            <p className="sm-text sm-muted">{t("categories.canRename")}</p>
            <Link className="sm-button" to={categoryEditPath(category.id)} state={{ from: `${location.pathname}${location.search}` }} data-sm-action="edit-category">{t("categories.rename")}</Link>
          </>
        ) : (
          <p className="sm-text sm-muted">{t("categories.cannotChange")}</p>
        )}
        <Link className="sm-link-row" to={getCategoryDetailsPath(category.id)}>
          <span>{t("categories.openFullOne")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/*
 * One category (GET /categories/{id}); the page rules are RecordScreen's. Only a
 * category that explicitly says it is not a system one and is active offers a
 * rename; everything else is read-only here, and archiving, changing the type,
 * colour or icon stay in the full version.
 */
export default function MobileCategoryDetail() {
  const { categoryId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="category" recordId={categoryId} keyOf={keyOf} loaderOf={categoryLoader} build={buildCategoryDetail} backFallback={MOBILE_CATEGORIES} strings="categories.detail" render={(category) => <Detail category={category} locale={locale} />} />;
}
