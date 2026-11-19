import { Link } from "react-router-dom";

import CategoryBadge from "../categories/CategoryBadge.jsx";
import { MOBILE_CATEGORIES, categoryDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";

/*
 * A confirmed category archive, as the server answered it (models/categoryForm.js confirmArchive: the same category, now
 * inactive). The write's cached reads were dropped when the answer arrived (forms/useWorkflowSubmit.js), so the Categories
 * list reads again and no longer has it. Nothing is deleted: the category is still readable, and the transactions and
 * budgets that use it keep it.
 */
export default function CategoryArchiveResult({ category, outcomeRef, backTo, t }) {
  return (
    <div className="sm-card sm-transfer-result" role="status" tabIndex={-1} ref={outcomeRef} data-sm-outcome="confirmed" data-sm-category-result={category.id} data-sm-result-kind="archived">
      <h2 className="sm-card-title">{t("forms.categoryResult.archivedTitle")}</h2>
      <p className="sm-text sm-muted">{t("forms.categoryResult.archivedBody")}</p>
      <div className="sm-tx-head">
        <CategoryBadge category={category} />
        <p className="sm-text sm-user-text" data-sm-result="name"><bdi>{category.name}</bdi></p>
      </div>
      <dl className="sm-stats sm-stats-stacked">
        <div className="sm-stat" data-sm-result="type"><dt>{t("categories.typeLabel")}</dt><dd>{category.typeKnown ? t(`categories.type.${category.type}`) : category.type}</dd></div>
        <div className="sm-stat" data-sm-result="status"><dt>{t("transfers.result.status")}</dt><dd>{t("categories.archived")}</dd></div>
      </dl>
      <Link className="sm-link-row" to={categoryDetailPath(category.id)} data-sm-action="open-category">
        <span>{t("forms.categoryResult.open")}</span>
        <Chevron />
      </Link>
      <Link className="sm-link-row" to={backTo ?? MOBILE_CATEGORIES} data-sm-action="after-write">
        <span>{t("categories.outcome.backToList")}</span>
        <Chevron />
      </Link>
    </div>
  );
}
