import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import DraftLinks from "../forms/DraftLinks.jsx";

import { getSavingsGoalDetailsPath } from "../../routes/Path.js";
import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { goalLoader, keys } from "../data/loaders.js";
import { isAccountId } from "../data/readApi.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildGoalDetail } from "../models/goals.js";
import { MOBILE_GOALS, accountDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import PlanChip from "./PlanChip.jsx";
import Progress from "./Progress.jsx";
import { toneOf } from "./tones.js";
import GoalMovements from "./GoalMovements.jsx";
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

function Detail({ goal, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const progress = goal.progress;
  const date = formatDay(goal.targetDate, locale);
  const achieved = formatDay(goal.achievedAt, locale);

  return (
    <>
      <section className="sm-card sm-hero sm-detail-hero" aria-labelledby="sm-goal-title" data-sm-status={goal.status ?? "none"}>
        <h2 id="sm-goal-title" className="sm-card-title sm-user-text">{goal.name ?? t("planning.goals.untitled")}</h2>
        <p className="sm-chips-inline">
          <PlanChip state={goal.status} known={goal.statusKnown} />
          {progress?.status && goal.status !== "achieved" && <PlanChip state={progress.status} known={progress.statusKnown} />}
          {progress?.deadlinePassed === true && <span className="sm-chip" data-sm-deadline="passed">{t("planning.goals.deadlinePassed")}</span>}
        </p>
        <p className="sm-balance-label">{t("planning.goals.saved")}</p>
        <Money className="sm-hero-money" value={progress?.saved ?? null} currency={goal.currency} />
        {/* The bar belongs with the figure it is a picture of: the backend's percentage, and its words for people who cannot see it. */}
        {progress && <Progress percent={progress.percent} tone={toneOf(progress.status, progress.statusKnown)} spoken={progress.percent ? t("planning.goals.percentSpoken", { value: progress.percent.text }) : ""} />}
        {/* Target and remaining under the bar they explain: the backend's own figures. */}
        <dl className="sm-goal-figures">
          <div data-sm-figure="target"><dt>{t("planning.goals.target")}</dt><dd><Money plain value={goal.target} currency={goal.currency} /></dd></div>
          {progress && <div data-sm-figure="remaining"><dt>{t("planning.goals.remaining")}</dt><dd><Money plain value={progress.remaining} currency={goal.currency} /></dd></div>}
        </dl>
        {/* When: the target date and the backend's days-left count. */}
        {(date || progress?.daysRemaining != null) && (
          <dl className="sm-goal-when">
            {date && <div><dt>{t("planning.goals.targetDate")}</dt><dd><bdi>{date}</bdi></dd></div>}
            {progress?.daysRemaining != null && <div data-sm-days><dt>{t("planning.goals.daysLeft")}</dt><dd><bdi dir="ltr">{progress.daysRemaining}</bdi></dd></div>}
          </dl>
        )}
      </section>

      <section className="sm-card" aria-labelledby="sm-goal-progress">
        <h2 id="sm-goal-progress" className="sm-card-title">{t("planning.goals.progress")}</h2>
        {progress ? (
          <>
            {/* Target, remaining, the date and days left are in the summary above; this card is the contributions, the achievement and the account. */}
            <dl className="sm-stats sm-stats-stacked">
              {progress.contributionsCount !== null && <Fact label={t("planning.goals.contributions")}><bdi dir="ltr">{progress.contributionsCount}</bdi></Fact>}
              {achieved && <Fact label={t("planning.goals.achievedOn")}><bdi>{achieved}</bdi></Fact>}
              {goal.accountName && (
                <Fact label={t("planning.goals.account")}>
                  {isAccountId(goal.accountId) ? (
                    <Link to={accountDetailPath(goal.accountId)} state={{ from: `${location.pathname}${location.search}` }}><bdi className="sm-user-text">{goal.accountName}</bdi></Link>
                  ) : (
                    <bdi className="sm-user-text">{goal.accountName}</bdi>
                  )}
                </Fact>
              )}
            </dl>
          </>
        ) : (
          <p className="sm-text sm-muted" data-sm-progress="unavailable">{t("planning.progressUnavailable")}</p>
        )}
      </section>

      <GoalMovements goal={goal} locale={locale} timeZone={timeZone} />

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
  const { user, workspace } = useAuthContext();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;

  return <RecordScreen screen="goal" recordId={goalId} keyOf={keyOf} loaderOf={goalLoader} build={buildGoalDetail} backFallback={MOBILE_GOALS} strings="planning.goals" render={(goal) => <Detail goal={goal} locale={locale} timeZone={timeZone} />} />;
}
