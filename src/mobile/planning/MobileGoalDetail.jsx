import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import DraftLinks from "../forms/DraftLinks.jsx";

import { getSavingsGoalDetailsPath } from "../../routes/Path.js";
import { goalLoader, keys } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildGoalDetail } from "../models/goals.js";
import { MOBILE_GOALS } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import PlanChip from "./PlanChip.jsx";
import Progress from "./Progress.jsx";
import { toneOf } from "./tones.js";
import RecordScreen from "./RecordScreen.jsx";
import { SmartPlanSection } from "./smartSavingsGate.js";

const keyOf = keys.goal;

function Fact({ label, children }) {
  return (
    <div className="sm-stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Detail({ goal, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const progress = goal.progress;
  const date = formatDay(goal.targetDate, locale);
  const achieved = formatDay(goal.achievedAt, locale);

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-goal-title">
        <h2 id="sm-goal-title" className="sm-card-title sm-user-text">{goal.name ?? t("planning.goals.untitled")}</h2>
        <p className="sm-chips-inline">
          <PlanChip state={goal.status} known={goal.statusKnown} />
          {progress?.status && goal.status !== "achieved" && <PlanChip state={progress.status} known={progress.statusKnown} />}
          {progress?.deadlinePassed === true && <span className="sm-chip">{t("planning.goals.deadlinePassed")}</span>}
        </p>
        <p className="sm-balance-label">{t("planning.goals.saved")}</p>
        <Money className="sm-hero-money" value={progress?.saved ?? null} currency={goal.currency} />
        <p className="sm-hero-note">{t("planning.goals.target")} <Money value={goal.target} currency={goal.currency} /></p>
      </section>

      <section className="sm-card" aria-labelledby="sm-goal-progress">
        <h2 id="sm-goal-progress" className="sm-card-title">{t("planning.goals.progress")}</h2>
        {progress ? (
          <>
            <Progress percent={progress.percent} tone={toneOf(progress.status, progress.statusKnown)} spoken={progress.percent ? t("planning.goals.percentSpoken", { value: progress.percent.text }) : ""} />
            <dl className="sm-stats sm-stats-stacked">
              <Fact label={t("planning.goals.remaining")}><Money value={progress.remaining} currency={goal.currency} /></Fact>
              {date && <Fact label={t("planning.goals.targetDate")}><bdi>{date}</bdi></Fact>}
              {progress.daysRemaining !== null && <Fact label={t("planning.goals.daysLeft")}><bdi dir="ltr">{progress.daysRemaining}</bdi></Fact>}
              {progress.contributionsCount !== null && <Fact label={t("planning.goals.contributions")}><bdi dir="ltr">{progress.contributionsCount}</bdi></Fact>}
              {achieved && <Fact label={t("planning.goals.achievedOn")}><bdi>{achieved}</bdi></Fact>}
              {goal.accountName && <Fact label={t("planning.goals.account")}><bdi className="sm-user-text">{goal.accountName}</bdi></Fact>}
            </dl>
          </>
        ) : (
          <p className="sm-text sm-muted" data-sm-progress="unavailable">{t("planning.progressUnavailable")}</p>
        )}
      </section>

      {goal.notes && (
        <section className="sm-card" aria-labelledby="sm-goal-notes">
          <h2 id="sm-goal-notes" className="sm-card-title">{t("planning.notes")}</h2>
          <p className="sm-text sm-user-text">{goal.notes}</p>
        </section>
      )}

      {SmartPlanSection && !goal.archived && (
        <Suspense fallback={<Skeleton lines={2} label={t("planning.goals.plan.loading")} />}>
          <SmartPlanSection goal={goal} locale={locale} />
        </Suspense>
      )}

      <section className="sm-card" aria-labelledby="sm-goal-changes">
        <h2 id="sm-goal-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <p className="sm-text sm-muted">{t("planning.goals.changesBody")}</p>
        <DraftLinks ids={{ goalId: goal.id }} actions={goal.archived ? [] : goal.status === "active" ? ["goal-contribute", "goal-withdraw", "goal-plan", "goal-edit"] : ["goal-withdraw", "goal-edit"]} />
        <Link className="sm-link-row" to={getSavingsGoalDetailsPath(goal.id)}>
          <span>{t("planning.goals.openFullOne")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/* One savings goal, read-only (GET /savings-goals/{id}); the page rules are in RecordScreen. */
export default function MobileGoalDetail() {
  const { goalId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="goal" recordId={goalId} keyOf={keyOf} loaderOf={goalLoader} build={buildGoalDetail} backFallback={MOBILE_GOALS} strings="planning.goals" render={(goal) => <Detail goal={goal} locale={locale} />} />;
}
