import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { GOAL_LIFECYCLES } from "../models/goals.js";
import { goalDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import FilterTabs from "./FilterTabs.jsx";
import { GOAL_LIST } from "./lists.js";
import PagedListView from "./PagedListView.jsx";
import PlanChip from "./PlanChip.jsx";
import Progress from "./Progress.jsx";
import { toneOf } from "./tones.js";
import { useListScreen } from "./useListScreen.js";

export function GoalRow({ goal, from, pages, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const progress = goal.progress;
  const date = formatDay(goal.targetDate, locale);

  return (
    <Link className="sm-row sm-plan-row" to={goalDetailPath(goal.id)} state={{ from, pages }} data-sm-goal={goal.id} data-sm-status={goal.status ?? "none"}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{goal.name ?? t("planning.goals.untitled")}</span>
        {date && <span className="sm-row-meta">{t("planning.goals.targetDate")} <bdi>{date}</bdi></span>}
        <span className="sm-chips-inline">
          <PlanChip state={goal.status} known={goal.statusKnown} />
          {progress && goal.status !== "achieved" && progress.status && <PlanChip state={progress.status} known={progress.statusKnown} />}
        </span>
        {progress && <Progress percent={progress.percent} tone={toneOf(progress.status, progress.statusKnown)} spoken={progress.percent ? t("planning.goals.percentSpoken", { value: progress.percent.text }) : ""} />}
        <span className="sm-plan-figures">
          <span>{t("planning.goals.saved")} <Money plain value={progress?.saved ?? null} currency={goal.currency} /></span>
          <span>{t("planning.goals.target")} <Money plain value={goal.target} currency={goal.currency} /></span>
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * Mobile Savings goals, read-only: GET /savings-goals, a page at a time, by
 * lifecycle. Saved and the percentage are the backend's own (they come from the
 * goal's savings account); Mobile never says a goal is achieved because two
 * numbers happen to match.
 */
export default function MobileGoals() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(GOAL_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <FilterTabs
        label={t("planning.goals.filterStatus")}
        value={filters.status}
        options={GOAL_LIFECYCLES.map((value) => ({ value, label: t(`planning.state.${value}`) }))}
        onChange={(status) => setFilters({ ...filters, status })}
      />
    </div>
  );

  return (
    <PagedListView
      screen="goals"
      list={screen.list}
      toolbar={toolbar}
      filtered={screen.filtered}
      onResetFilters={screen.reset}
      strings="planning.goals"
      pages={screen.pages}
      perPage={GOAL_LIST.perPage}
      onLoadMore={screen.loadMore}
      onRefresh={screen.refresh}
      fullPath={PATH.USER.SAVINGS_GOALS}
      renderRow={(goal) => <GoalRow goal={goal} from={screen.here} pages={screen.pages} locale={locale} />}
    />
  );
}
