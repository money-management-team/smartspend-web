import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { LuPlus, LuX } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { categoriesApi } from "../api/categoriesApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import {
  ApiError,
  getApiErrorMessage,
  getStoredWorkspace,
} from "../api/apiClient";
import CategoryCard from "./components/CategoryCard/CategoryCard";
import CategoryForm from "./components/CategoryForm/CategoryForm";
import ArchiveCategoryDialog from "./components/ArchiveCategoryDialog/ArchiveCategoryDialog";
import {
  CATEGORY_TYPES,
  canManageCategory,
  isActiveCategory,
  isCategoryEntity,
  isSystemCategory,
} from "./categoryHelpers";

import "./Categories.css";

const FILTERS = ["all", ...CATEGORY_TYPES];

// The session workspace (the one new categories are created in); omitted when
// unknown, in which case the backend lists every workspace the user can access.
// The type filter is applied by the backend.
const getListQuery = (typeFilter) => ({
  workspace_id: getStoredWorkspace()?.id,
  type: typeFilter === "all" ? undefined : typeFilter,
});

const sameId = (left, right) => String(left) === String(right);

export default function Categories() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("all");

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request (filter or retry changed), the list is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${typeFilter}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, categories: [], error: null });

  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  // One-time success message ({ key, name }), translated at render. The
  // details page passes the archived name in when it archives and comes back.
  const [notice, setNotice] = useState(() =>
    location.state?.archivedCategoryName
      ? { key: "archiveSuccess", name: location.state.archivedCategoryName }
      : null,
  );
  const saveRequestRef = useRef(null);

  // Drop the one-time notice from history so a reload doesn't show it again.
  useEffect(() => {
    if (location.state?.archivedCategoryName) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const controller = new AbortController();

    categoriesApi
      .list(getListQuery(typeFilter), { signal: controller.signal })
      .then((response) => {
        const categories = response.data?.categories;

        setResult(
          Array.isArray(categories)
            ? { key: requestKey, categories, error: null }
            : {
                key: requestKey,
                categories: [],
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, categories: [], error });
      });

    return () => controller.abort();
  }, [requestKey, typeFilter]);

  const isLoading = result.key !== requestKey;
  const { categories, error } = isLoading
    ? { categories: [], error: null }
    : result;

  const reloadCategories = () => setReloadKey((key) => key + 1);

  const updateCategories = (update) =>
    setResult((current) => ({ ...current, categories: update(current.categories) }));

  // Whether a category belongs in the list currently shown.
  const isListed = (category) =>
    isActiveCategory(category) &&
    (typeFilter === "all" || category.type === typeFilter);

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const categoryBeingEdited = formState?.category;
    const saveRequest = (async () => {
      if (categoryBeingEdited) {
        let response;

        try {
          response = await categoriesApi.update(categoryBeingEdited.id, values);
        } catch (requestError) {
          // Already gone from this user's view: drop the stale card.
          if (requestError?.code === "NOT_FOUND") reloadCategories();
          throw requestError;
        }

        const updatedCategory = response?.data?.category;

        if (isCategoryEntity(updatedCategory, categoryBeingEdited.id)) {
          // A type change can move it out of the filtered list.
          updateCategories((current) =>
            current.flatMap((category) => {
              if (!sameId(category.id, updatedCategory.id)) return [category];
              const merged = { ...category, ...updatedCategory };
              return isListed(merged) ? [merged] : [];
            }),
          );
        } else {
          reloadCategories();
        }

        setNotice({
          key: "updateSuccess",
          name: updatedCategory?.name ?? values.name ?? categoryBeingEdited.name,
        });
      } else {
        const workspaceId = await resolveWorkspaceId();
        const response = await categoriesApi.create({
          ...values,
          workspace_id: workspaceId,
        });
        const createdCategory = response?.data?.category;

        if (isCategoryEntity(createdCategory)) {
          if (isListed(createdCategory)) {
            updateCategories((current) => [...current, createdCategory]);
          }
        } else {
          reloadCategories();
        }

        setNotice({
          key: "createSuccess",
          name: createdCategory?.name ?? values.name,
        });
      }

      setFormState(null);
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      if (saveRequestRef.current === saveRequest) {
        saveRequestRef.current = null;
      }
    }
  };

  // Called by ArchiveCategoryDialog; errors are shown inside the dialog.
  const handleArchive = async () => {
    const category = archiveTarget;

    try {
      await categoriesApi.archive(category.id);
    } catch (requestError) {
      // Gone, or already archived (422): the list is out of date.
      if (["NOT_FOUND", "VALIDATION_ERROR"].includes(requestError?.code)) {
        reloadCategories();
      }
      throw requestError;
    }

    // Only active categories are listed, so the archived one leaves the list.
    updateCategories((current) =>
      current.filter((item) => !sameId(item.id, category.id)),
    );
    setArchiveTarget(null);
    setNotice({ key: "archiveSuccess", name: category.name });
  };

  const openCreateForm = () => setFormState({ category: null });

  const openEditForm = (category) => {
    if (canManageCategory(category)) setFormState({ category });
  };

  const openArchiveDialog = (category) => {
    if (canManageCategory(category)) setArchiveTarget(category);
  };

  const customCategories = categories.filter((category) => !isSystemCategory(category));
  const systemCategories = categories.filter(isSystemCategory);

  const renderCards = (items) =>
    items.map((category) => (
      <CategoryCard
        key={category.id}
        category={category}
        onEdit={() => openEditForm(category)}
        onArchive={() => openArchiveDialog(category)}
      />
    ));

  return (
    <div className="categories-page">
      <header className="categories-page__header">
        <div className="categories-page__copy">
          <h1>{t("dashboard.categories.title")}</h1>
          <p>{t("dashboard.categories.subtitle")}</p>
        </div>

        <button type="button" className="categories-page__add" onClick={openCreateForm}>
          <LuPlus aria-hidden="true" />
          <span>{t("dashboard.categories.add")}</span>
        </button>
      </header>

      {notice && (
        <div className="categories-page__notice" role="status">
          <p dir="auto">{t(`dashboard.categories.${notice.key}`, { name: notice.name })}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t("common.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        className="categories-page__filters"
        role="group"
        aria-label={t("dashboard.categories.filters.label")}
      >
        {FILTERS.map((filter) => (
          <button
            type="button"
            key={filter}
            aria-pressed={filter === typeFilter}
            className={`categories-page__filter${
              filter === typeFilter ? " categories-page__filter--active" : ""
            }`}
            onClick={() => setTypeFilter(filter)}
          >
            {t(`dashboard.categories.filters.${filter}`)}
          </button>
        ))}
      </div>

      {isLoading && <Loading message={t("dashboard.categories.states.loading")} />}

      {!isLoading && error && (
        <div className="categories-page__state categories-page__state--error" role="alert">
          <p>{getApiErrorMessage(error, t)}</p>
          <button type="button" onClick={reloadCategories}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && categories.length === 0 && (
        <div className="categories-page__state">
          <p>
            {t(
              typeFilter === "all"
                ? "dashboard.categories.states.emptyAll"
                : `dashboard.categories.states.empty.${typeFilter}`,
            )}
          </p>
          <button type="button" onClick={openCreateForm}>
            {t("dashboard.categories.add")}
          </button>
        </div>
      )}

      {!isLoading && !error && categories.length > 0 && (
        <>
          <section
            className="categories-page__section"
            aria-labelledby="categories-custom-title"
          >
            <div className="categories-page__section-head">
              <h2 id="categories-custom-title">
                {t("dashboard.categories.sections.custom")}
                <span className="categories-page__count">{customCategories.length}</span>
              </h2>
              <p>{t("dashboard.categories.sections.customHint")}</p>
            </div>

            <div className="categories-page__grid">
              {customCategories.length > 0 ? (
                renderCards(customCategories)
              ) : (
                <div className="categories-page__state">
                  <p>{t("dashboard.categories.states.emptyCustom")}</p>
                  <button type="button" onClick={openCreateForm}>
                    {t("dashboard.categories.add")}
                  </button>
                </div>
              )}
            </div>
          </section>

          {systemCategories.length > 0 && (
            <section
              className="categories-page__section"
              aria-labelledby="categories-system-title"
            >
              <div className="categories-page__section-head">
                <h2 id="categories-system-title">
                  {t("dashboard.categories.sections.system")}
                  <span className="categories-page__count">{systemCategories.length}</span>
                </h2>
                <p>{t("dashboard.categories.sections.systemHint")}</p>
              </div>

              <div className="categories-page__grid">{renderCards(systemCategories)}</div>
            </section>
          )}
        </>
      )}

      {formState && (
        <CategoryForm
          category={formState.category}
          defaultType={typeFilter === "all" ? undefined : typeFilter}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}

      {archiveTarget && (
        <ArchiveCategoryDialog
          category={archiveTarget}
          onConfirm={handleArchive}
          onClose={() => setArchiveTarget(null)}
        />
      )}
    </div>
  );
}
