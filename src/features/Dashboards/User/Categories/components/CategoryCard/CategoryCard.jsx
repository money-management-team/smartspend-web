import { LuArchive, LuLock, LuPencil } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getCategoryDetailsPath } from "../../../../../../routes/Path";
import {
  canManageCategory,
  getCategoryColor,
  isSystemCategory,
  renderCategoryIcon,
} from "../../categoryHelpers";

import "./CategoryCard.css";

/*
 * The whole card opens the details page. Edit / Archive are only rendered for
 * the user's own active categories; system categories show a read-only badge.
 */
export default function CategoryCard({ category, onEdit, onArchive }) {
  const { t } = useTranslation();
  const color = getCategoryColor(category);
  const isSystem = isSystemCategory(category);
  const canManage = canManageCategory(category);

  return (
    <article
      className={`category-card${color ? " category-card--colored" : ""}`}
      style={color ? { "--category-color": color } : undefined}
    >
      <header className="category-card__header">
        <span className="category-card__icon" aria-hidden="true">
          {renderCategoryIcon(category)}
        </span>

        <div className="category-card__identity">
          <Link
            className="category-card__link"
            to={getCategoryDetailsPath(category.id)}
          >
            <strong dir="auto">{category.name}</strong>
          </Link>

          <small>
            {t(
              isSystem
                ? "dashboard.categories.kinds.system"
                : "dashboard.categories.kinds.custom",
            )}
          </small>
        </div>

        <span className={`category-card__type category-card__type--${category.type}`}>
          {t(`dashboard.categories.types.${category.type}`, {
            defaultValue: category.type,
          })}
        </span>
      </header>

      <footer className="category-card__actions">
        {canManage ? (
          <>
            <button
              type="button"
              className="category-card__edit"
              onClick={onEdit}
              aria-label={t("dashboard.categories.editNamed", { name: category.name })}
            >
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.categories.edit")}</span>
            </button>

            <button
              type="button"
              className="category-card__archive"
              onClick={onArchive}
              aria-label={t("dashboard.categories.archiveNamed", {
                name: category.name,
              })}
              title={t("dashboard.categories.archive")}
            >
              <LuArchive aria-hidden="true" />
            </button>
          </>
        ) : (
          <span className="category-card__readonly">
            <LuLock aria-hidden="true" />
            <span>
              {t(
                isSystem
                  ? "dashboard.categories.readOnly"
                  : "dashboard.categories.status.archived",
              )}
            </span>
          </span>
        )}
      </footer>
    </article>
  );
}
