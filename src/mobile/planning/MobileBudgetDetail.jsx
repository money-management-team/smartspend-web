import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { getBudgetDetailsPath } from "../../routes/Path.js";
import { budgetLoader, keys } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildBudgetDetail } from "../models/budgets.js";
import { MOBILE_BUDGETS } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import PlanChip from "./PlanChip.jsx";
import Progress from "./Progress.jsx";
import { toneOf } from "./tones.js";
import RecordScreen from "./RecordScreen.jsx";

const keyOf = keys.budget;

function Fact({ label, children }) {
  return (
    <div className="sm-stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Detail({ budget, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const progress = budget.progress;
  const start = formatDay(budget.periodStart, locale);
  const end = formatDay(budget.periodEnd, locale);
  const scope = budget.scope === "category" ? (budget.categoryName ? t("planning.budgets.scopeCategory", { name: budget.categoryName }) : t("planning.budgets.scopeCategoryPlain")) : t("planning.budgets.scopeGeneral");

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-budget-title">
        <h2 id="sm-budget-title" className="sm-card-title sm-user-text">{budget.name ?? t("planning.budgets.untitled")}</h2>
        <p className="sm-chips-inline">
          <span className="sm-chip"><bdi>{scope}</bdi></span>
          {budget.archived ? <PlanChip state="archived" known /> : <PlanChip state={progress?.status ?? null} known={progress?.statusKnown ?? false} />}
        </p>
        <p className="sm-balance-label">{t("planning.budgets.limit")}</p>
        <Money className="sm-hero-money" value={budget.limit} currency={budget.currency} />
        {start && end && <p className="sm-hero-note"><bdi>{t("planning.range", { from: start, to: end })}</bdi></p>}
      </section>

      <section className="sm-card" aria-labelledby="sm-budget-progress">
        <h2 id="sm-budget-progress" className="sm-card-title">{t("planning.budgets.progress")}</h2>
        {progress ? (
          <>
            <Progress percent={progress.percent} tone={toneOf(progress.status, progress.statusKnown)} spoken={progress.percent ? t("planning.budgets.percentSpoken", { value: progress.percent.text }) : ""} />
            <dl className="sm-stats sm-stats-stacked">
              <Fact label={t("planning.budgets.spent")}><Money plain value={progress.spent} currency={budget.currency} /></Fact>
              <Fact label={t("planning.budgets.remaining")}><Money value={progress.remaining} currency={budget.currency} /></Fact>
              {progress.expensesCount !== null && <Fact label={t("planning.budgets.expenses")}><bdi dir="ltr">{progress.expensesCount}</bdi></Fact>}
              {progress.daysRemaining !== null && <Fact label={t("planning.budgets.daysLeft")}><bdi dir="ltr">{progress.daysRemaining}</bdi></Fact>}
              {progress.hasStarted === false && <Fact label={t("planning.budgets.period")}>{t("planning.budgets.notStarted")}</Fact>}
              {progress.hasEnded === true && <Fact label={t("planning.budgets.period")}>{t("planning.budgets.ended")}</Fact>}
            </dl>
          </>
        ) : (
          <p className="sm-text sm-muted" data-sm-progress="unavailable">{t(budget.archived ? "planning.budgets.progressArchived" : "planning.progressUnavailable")}</p>
        )}
      </section>

      {budget.notes && (
        <section className="sm-card" aria-labelledby="sm-budget-notes">
          <h2 id="sm-budget-notes" className="sm-card-title">{t("planning.notes")}</h2>
          <p className="sm-text sm-user-text">{budget.notes}</p>
        </section>
      )}

      <section className="sm-card" aria-labelledby="sm-budget-changes">
        <h2 id="sm-budget-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <p className="sm-text sm-muted">{t("planning.budgets.changesBody")}</p>
        <Link className="sm-link-row" to={getBudgetDetailsPath(budget.id)}>
          <span>{t("planning.budgets.openFullOne")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/* One budget, read-only (GET /budgets/{id}); the page rules are in RecordScreen. */
export default function MobileBudgetDetail() {
  const { budgetId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="budget" recordId={budgetId} keyOf={keyOf} loaderOf={budgetLoader} build={buildBudgetDetail} backFallback={MOBILE_BUDGETS} strings="planning.budgets" render={(budget) => <Detail budget={budget} locale={locale} />} />;
}
