import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  LuArchive,
  LuArrowLeft,
  LuInfo,
  LuLock,
  LuPencil,
  LuX,
} from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH } from "../../../../routes/Path";
import { categoriesApi } from "../api/categoriesApi";
import { ApiError, getStoredWorkspace } from "../api/apiClient";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import CategoryForm from "../Categories/components/CategoryForm/CategoryForm";
import ArchiveCategoryDialog from "../Categories/components/ArchiveCategoryDialog/ArchiveCategoryDialog";
import {
  CATEGORY_ICONS,
  canManageCategory,
  getCategoryColor,
  getCategoryErrorMessage,
  isActiveCategory,
  isSystemCategory,
  renderCategoryIcon,
} from "../Categories/categoryHelpers";
import { formatDate } from "../utils/formatters";

import "./CategoryDetails.css";

export default function CategoryDetails() {
  const { categoryId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request, the page is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${categoryId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, category: null, error: null });
  const [isEditing, setIsEditing] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  // Name shown in the "saved" notice, tied to the request it belongs to.
  const [savedNotice, setSavedNotice] = useState({ key: null, name: "" });
  const saveRequestRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    categoriesApi
      .get(categoryId, { signal: controller.signal })
      .then((response) => {
        const category = response.data?.category;

        setResult(
          category && typeof category === "object"
            ? { key: requestKey, category, error: null }
            : {
                key: requestKey,
                category: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, category: null, error });
      });

    return () => controller.abort();
  }, [categoryId, requestKey]);

  const isLoading = result.key !== requestKey;
  const { category, error } = isLoading ? { category: null, error: null } : result;

  // Once the category is gone for this user (404), show the not-available state.
  const markUnavailable = (requestError) => {
    if (requestError?.code === "NOT_FOUND") {
      setIsEditing(false);
      setIsArchiveOpen(false);
      setResult({ key: requestKey, category: null, error: requestError });
    }
  };

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const saveRequest = (async () => {
      let response;

      try {
        response = await categoriesApi.update(category.id, values);
      } catch (requestError) {
        markUnavailable(requestError);
        throw requestError;
      }

      const updatedCategory = response.data?.category;

      if (updatedCategory && typeof updatedCategory === "object") {
        setResult((current) => ({
          ...current,
          category: { ...current.category, ...updatedCategory },
        }));
      } else {
        setReloadKey((key) => key + 1);
      }

      setIsEditing(false);
      setSavedNotice({
        key: requestKey,
        name: updatedCategory?.name ?? values.name ?? category.name,
      });
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      saveRequestRef.current = null;
    }
  };

  const handleArchive = async () => {
    try {
      await categoriesApi.archive(category.id);
    } catch (requestError) {
      markUnavailable(requestError);
      throw requestError;
    }

    // It is no longer an active category: back to the list, which refetches.
    navigate(PATH.USER.CATEGORIES, {
      state: { archivedCategoryName: category.name },
    });
  };

  const backLink = (
    <Link className="category-details__back" to={PATH.USER.CATEGORIES}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.categories.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="category-details">
        {backLink}
        <Loading message={t("dashboard.categories.details.loading")} />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.code === "NOT_FOUND";

    return (
      <div className="category-details">
        {backLink}

        <div className="category-details__state" role="alert">
          <h1>
            {t(
              isNotFound
                ? "dashboard.categories.details.notFoundTitle"
                : "dashboard.categories.details.errorTitle",
            )}
          </h1>
          <p>{getCategoryErrorMessage(error, t)}</p>

          {!isNotFound && (
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const color = getCategoryColor(category);
  const isSystem = isSystemCategory(category);
  const isActive = isActiveCategory(category);
  const canManage = canManageCategory(category);
  const typeLabel = t(`dashboard.categories.types.${category.type}`, {
    defaultValue: category.type,
  });
  const kindLabel = t(
    isSystem ? "dashboard.categories.kinds.system" : "dashboard.categories.kinds.custom",
  );
  const statusLabel = t(
    isActive
      ? "dashboard.categories.status.active"
      : "dashboard.categories.status.archived",
  );

  // System categories are shared; a custom one belongs to one workspace.
  const currentWorkspaceId = getStoredWorkspace()?.id ?? workspace?.id;
  const scopeKey = isSystem
    ? "scopeSystem"
    : category.workspace_id == null
      ? null
      : currentWorkspaceId != null &&
          String(category.workspace_id) === String(currentWorkspaceId)
        ? "scopeCurrent"
        : "scopeOther";

  const date = (value) => formatDate(value, locale, timeZone);

  const rows = [
    ["name", <bdi key="name">{category.name}</bdi>],
    ["type", typeLabel],
    ["kind", kindLabel],
    ["status", statusLabel],
    scopeKey && ["workspace", t(`dashboard.categories.details.${scopeKey}`)],
    [
      "color",
      color ? (
        <span className="category-details__swatch" key="color">
          <span style={{ background: color }} aria-hidden="true" />
          <bdi dir="ltr">{color}</bdi>
        </span>
      ) : (
        t("dashboard.categories.details.none")
      ),
    ],
    [
      "icon",
      category.icon ? (
        <span className="category-details__icon-value" key="icon">
          {renderCategoryIcon(category)}
          <span>
            {CATEGORY_ICONS.includes(category.icon)
              ? t(`dashboard.categories.icons.${category.icon}`)
              : <bdi dir="ltr">{category.icon}</bdi>}
          </span>
        </span>
      ) : (
        t("dashboard.categories.details.defaultIcon")
      ),
    ],
    category.slug && ["slug", <bdi key="slug" dir="ltr">{category.slug}</bdi>],
    category.created_at && ["createdAt", date(category.created_at)],
    category.updated_at && ["updatedAt", date(category.updated_at)],
  ].filter(Boolean);

  return (
    <div className="category-details">
      {backLink}

      {savedNotice.key === requestKey && (
        <div className="category-details__notice" role="status">
          <p dir="auto">
            {t("dashboard.categories.updateSuccess", { name: savedNotice.name })}
          </p>
          <button
            type="button"
            onClick={() => setSavedNotice({ key: null, name: "" })}
            aria-label={t("common.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <header
        className={`category-details__header${color ? " category-details__header--colored" : ""}`}
        style={color ? { "--category-color": color } : undefined}
      >
        <span className="category-details__icon" aria-hidden="true">
          {renderCategoryIcon(category)}
        </span>

        <div className="category-details__identity">
          <h1 dir="auto">{category.name}</h1>

          <div className="category-details__chips">
            <span className={`category-details__chip category-details__chip--${category.type}`}>
              {typeLabel}
            </span>
            <span
              className={`category-details__chip${isSystem ? " category-details__chip--system" : ""}`}
            >
              {isSystem && <LuLock aria-hidden="true" />}
              {kindLabel}
            </span>
            <span
              className={`category-details__chip category-details__chip--${isActive ? "active" : "archived"}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="category-details__actions">
            <button
              type="button"
              className="category-details__action"
              onClick={() => setIsEditing(true)}
            >
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.categories.edit")}</span>
            </button>
            <button
              type="button"
              className="category-details__action category-details__action--archive"
              onClick={() => setIsArchiveOpen(true)}
            >
              <LuArchive aria-hidden="true" />
              <span>{t("dashboard.categories.archive")}</span>
            </button>
          </div>
        )}
      </header>

      {isSystem && (
        <p className="category-details__note category-details__note--system" role="note">
          <LuLock aria-hidden="true" />
          <span>{t("dashboard.categories.details.systemNote")}</span>
        </p>
      )}

      {!isSystem && !isActive && (
        <p className="category-details__note" role="note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.categories.details.archivedNote")}</span>
        </p>
      )}

      <section className="category-details__panel" aria-labelledby="category-details-title">
        <h2 id="category-details-title">{t("dashboard.categories.details.title")}</h2>

        <dl className="category-details__list">
          {rows.map(([key, value]) => (
            <div className="category-details__row" key={key}>
              <dt>{t(`dashboard.categories.details.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isEditing && canManage && (
        <CategoryForm
          category={category}
          onSave={handleSave}
          onClose={() => setIsEditing(false)}
        />
      )}

      {isArchiveOpen && canManage && (
        <ArchiveCategoryDialog
          category={category}
          onConfirm={handleArchive}
          onClose={() => setIsArchiveOpen(false)}
        />
      )}
    </div>
  );
}
