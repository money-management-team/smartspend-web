import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LuLock } from "react-icons/lu";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { categoryListLoader, keys } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { arrangeCategories, buildCategoryList, categoryFiltersToSearch, readCategoryFilters } from "../models/categories.js";
import { MOBILE_CATEGORY_NEW, MOBILE_PLANNING, categoryDetailPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import CategoryBadge from "./CategoryBadge.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

function TypeChip({ category }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  return <span className="sm-chip" data-sm-type={category.typeKnown ? category.type : "unknown"}>{category.typeKnown ? t(`categories.type.${category.type}`) : category.type ? t("categories.type.unknown", { type: category.type.replace(/_/g, " ") }) : t("categories.type.missing")}</span>;
}

function CategoryRow({ category, from, child = false }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <Link className={`sm-row sm-cat-row${child ? " sm-cat-child" : ""}`} to={categoryDetailPath(category.id)} state={{ from }} data-sm-category={category.id} data-sm-manageable={category.manageable ? "true" : "false"}>
      <CategoryBadge category={category} />
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{category.name ?? t("categories.untitled")}</span>
        <span className="sm-chips-inline">
          <TypeChip category={category} />
          {!category.manageable && (
            <span className="sm-chip sm-cat-lock">
              <LuLock aria-hidden="true" />
              {t("categories.readOnly")}
            </span>
          )}
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

function Section({ id, title, groups, from }) {
  if (groups.length === 0) return null;

  return (
    <section className="sm-card" aria-labelledby={id} data-sm-section={id}>
      <h2 id={id} className="sm-card-title">{title}</h2>
      <ul className="sm-list">
        {groups.map((group) => (
          <li key={group.category.id}>
            <CategoryRow category={group.category} from={from} />
            {/* Named after the parent, so a screen reader says whose subcategories follow. */}
            {group.children.length > 0 && (
              <ul className="sm-list sm-cat-children" aria-label={group.category.name ?? undefined}>
                {group.children.map((child) => (
                  <li key={child.id}><CategoryRow category={child} from={from} child /></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/*
 * Mobile Categories: the active categories of the workspace from GET /categories,
 * the person's own first and the system ones (read-only) after, grouped under a
 * parent only when the data clearly says so. The type filter is the backend's.
 *
 * It shows what a category IS (name, type, icon, colour, system or yours) and
 * nothing about what it holds: the contract has no counts or totals, so there is
 * none, and it is not a ledger.
 */
export default function MobileCategories() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const navigate = useNavigate();
  const filters = readCategoryFilters(location.search);
  const filtered = Boolean(filters.type);
  const loader = useMemo(() => categoryListLoader(filters.type), [filters.type]);
  const resource = useResource(keys.categoryList(filters.type), loader);
  const parsed = useMemo(() => {
    if (resource.data === undefined) return null;

    try {
      return { items: buildCategoryList(resource.data) };
    } catch (error) {
      return { error };
    }
  }, [resource.data]);
  const setType = useCallback((type) => navigate({ pathname: location.pathname, search: categoryFiltersToSearch({ type }) }, { replace: true }), [navigate, location.pathname]);
  const here = `${location.pathname}${location.search}`;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <FilterTabs
        label={t("categories.filterType")}
        value={filters.type}
        options={[{ value: "", label: t("categories.type.all") }, { value: "expense", label: t("categories.type.expense") }, { value: "income", label: t("categories.type.income") }]}
        onChange={setType}
        tight
      />
    </div>
  );

  if (resource.loading) {
    return (
      <section className="sm-page" data-sm-screen="categories" data-sm-state="loading" aria-busy="true">
        {toolbar}
        <Skeleton lines={5} label={t("categories.loading")} />
      </section>
    );
  }

  if (resource.status === "error" || parsed?.error || !parsed) {
    return (
      <section className="sm-page" data-sm-screen="categories" data-sm-state="error">
        {toolbar}
        <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} />
      </section>
    );
  }

  const sections = arrangeCategories(parsed.items);
  const none = parsed.items.length === 0;
  const onlySystem = !none && sections.custom.length === 0;

  return (
    <section className="sm-page" data-sm-screen="categories" data-sm-state={none ? (filtered ? "empty-filtered" : "empty") : resource.stale ? "stale" : "ready"} data-sm-stale={resource.stale ? "true" : undefined}>
      {toolbar}

      <Link className="sm-button" to={MOBILE_CATEGORY_NEW} state={{ from: here }} data-sm-action="new-category">{t("categories.new")}</Link>

      <div className="sm-greeting">
        <p className="sm-text sm-muted">{t("categories.intro")}</p>
        <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={resource.reload} disabled={resource.refreshing} aria-busy={resource.refreshing}>
          {t(resource.refreshing ? "home.refreshing" : "home.refresh")}
        </button>
      </div>

      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}

      {none ? (
        <div className="sm-card">
          <h2 className="sm-card-title">{t(filtered ? "categories.emptyFiltered.title" : "categories.empty.title")}</h2>
          <p className="sm-text">{t(filtered ? "categories.emptyFiltered.body" : "categories.empty.body")}</p>
          {filtered ? <button type="button" className="sm-button sm-button-quiet" onClick={() => setType("")}>{t("categories.showAll")}</button> : <Link className="sm-link-row" to={MOBILE_CATEGORY_NEW}><span>{t("categories.new")}</span><Chevron /></Link>}
        </div>
      ) : (
        <>
          {onlySystem && (
            <div className="sm-card" data-sm-note="only-system">
              <p className="sm-text">{t("categories.onlySystem")}</p>
            </div>
          )}
          <Section id="sm-cat-custom" title={t("categories.yours")} groups={sections.custom} from={here} />
          <Section id="sm-cat-system" title={t("categories.systemTitle")} groups={sections.system} from={here} />
        </>
      )}

      <p className="sm-text sm-muted sm-fine">{t("categories.scope")}</p>
      <Link className="sm-link-row" to={PATH.USER.CATEGORIES}>
        <span>{t("categories.openFull")}</span>
        <Chevron />
      </Link>
      <Link className="sm-link-row sm-back" to={MOBILE_PLANNING}>
        <Chevron back />
        <span>{t("categories.backToPlanning")}</span>
      </Link>
    </section>
  );
}
