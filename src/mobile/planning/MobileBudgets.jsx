import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { BUDGET_PROGRESS } from "../models/budgets.js";
import { budgetDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import FilterTabs from "./FilterTabs.jsx";
import { BUDGET_LIST } from "./lists.js";
import PagedListView from "./PagedListView.jsx";
import PlanChip from "./PlanChip.jsx";
import Progress from "./Progress.jsx";
import { toneOf } from "./tones.js";
import { useListScreen } from "./useListScreen.js";

export function BudgetRow({ budget, from, pages, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const progress = budget.progress;
  const scope = budget.scope === "category" ? (budget.categoryName ? t("planning.budgets.scopeCategory", { name: budget.categoryName }) : t("planning.budgets.scopeCategoryPlain")) : t("planning.budgets.scopeGeneral");
  const start = formatDay(budget.periodStart, locale);
  const end = formatDay(budget.periodEnd, locale);

  return (
    <Link className="sm-row sm-plan-row" to={budgetDetailPath(budget.id)} state={{ from, pages }} data-sm-budget={budget.id} data-sm-status={progress?.status ?? "none"}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{budget.name ?? t("planning.budgets.untitled")}</span>
        <span className="sm-row-meta"><bdi>{scope}</bdi>{start && end ? <> · <bdi>{t("planning.range", { from: start, to: end })}</bdi></> : null}</span>
        <span className="sm-chips-inline">
          {budget.archived ? <PlanChip state="archived" known /> : <PlanChip state={progress?.status ?? null} known={progress?.statusKnown ?? false} />}
          {!budget.archived && !budget.statusKnown && <PlanChip state={budget.status} known={false} />}
        </span>
        {progress && <Progress percent={progress.percent} tone={toneOf(progress.status, progress.statusKnown)} spoken={progress.percent ? t("planning.budgets.percentSpoken", { value: progress.percent.text }) : ""} />}
        <span className="sm-plan-figures">
          <span>{t("planning.budgets.spent")} <Money plain value={progress?.spent ?? null} currency={budget.currency} /></span>
          <span>{t("planning.budgets.limit")} <Money plain value={budget.limit} currency={budget.currency} /></span>
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * Mobile Budgets, read-only: GET /budgets, a page at a time, with the lifecycle
 * and progress filters the endpoint supports. Every figure on a row is the
 * backend's `progress` for that budget, in that budget's currency; nothing is
 * added up, so two budgets in two currencies are never one total.
 */
export default function MobileBudgets() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(BUDGET_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <FilterTabs
        label={t("planning.budgets.filterStatus")}
        value={filters.status}
        options={[
          { value: "active", label: t("planning.state.active") },
          { value: "archived", label: t("planning.state.archived") },
        ]}
        onChange={(status) => setFilters({ ...filters, status })}
      />
      <FilterTabs
        label={t("planning.budgets.filterProgress")}
        value={filters.progress_status}
        options={[{ value: "", label: t("planning.budgets.progressAll") }, ...BUDGET_PROGRESS.map((value) => ({ value, label: t(`planning.state.${value}`) }))]}
        onChange={(progress_status) => setFilters({ ...filters, progress_status })}
      />
    </div>
  );

  return (
    <PagedListView
      screen="budgets"
      list={screen.list}
      toolbar={toolbar}
      filtered={screen.filtered}
      onResetFilters={screen.reset}
      strings="planning.budgets"
      pages={screen.pages}
      perPage={BUDGET_LIST.perPage}
      onLoadMore={screen.loadMore}
      onRefresh={screen.refresh}
      fullPath={PATH.USER.BUDGETS}
      renderRow={(budget) => <BudgetRow budget={budget} from={screen.here} pages={screen.pages} locale={locale} />}
    />
  );
}
