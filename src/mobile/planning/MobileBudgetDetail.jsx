import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import DraftLinks from "../forms/DraftLinks.jsx";

import { getBudgetDetailsPath } from "../../routes/Path.js";
import { budgetLoader, keys } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildBudgetDetail } from "../models/budgets.js";
import { MOBILE_ACTIVITY, MOBILE_BUDGETS } from "../navigation.js";
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

const STATUS_HINTS = ["safe", "warning", "near_limit", "exceeded"];

// The expenses of this budget's period, in Activity (which filters by type, dates and category): a link, not a read.
function expensesPathOf(budget) {
  if (!budget.periodStart || !budget.periodEnd) return null;
  const params = new URLSearchParams({ type: "expense", date_from: budget.periodStart, date_to: budget.periodEnd });
  if (budget.scope === "category" && budget.categoryId) params.set("category_id", budget.categoryId);
  return `${MOBILE_ACTIVITY}?${params}`;
}

function Detail({ budget, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const expensesPath = expensesPathOf(budget);
  const progress = budget.progress;
  const start = formatDay(budget.periodStart, locale);
  const end = formatDay(budget.periodEnd, locale);
  const scope = budget.scope === "category" ? (budget.categoryName ? t("planning.budgets.scopeCategory", { name: budget.categoryName }) : t("planning.budgets.scopeCategoryPlain")) : t("planning.budgets.scopeGeneral");

  return (
    <>
      <section className="sm-card sm-hero sm-detail-hero" aria-labelledby="sm-budget-title">
        <h2 id="sm-budget-title" className="sm-card-title sm-user-text">{budget.name ?? t("planning.budgets.untitled")}</h2>
        <p className="sm-chips-inline">
          <span className="sm-chip"><bdi>{scope}</bdi></span>
          {budget.archived ? <PlanChip state="archived" known /> : <PlanChip state={progress?.status ?? null} known={progress?.statusKnown ?? false} />}
        </p>
        <p className="sm-balance-label">{t("planning.budgets.limit")}</p>
        <Money className="sm-hero-money" value={budget.limit} currency={budget.currency} />
        {/* The bar belongs with the limit it measures; the sentence is Desktop's own reading of the backend's status word. */}
        {progress && <Progress percent={progress.percent} tone={toneOf(progress.status, progress.statusKnown)} spoken={progress.percent ? t("planning.budgets.percentSpoken", { value: progress.percent.text }) : ""} />}
        {/* What was spent and what remains, next to the bar they explain: the backend's own figures. */}
        {progress && (
          <dl className="sm-budget-figures">
            <div data-sm-figure="spent"><dt>{t("planning.budgets.spent")}</dt><dd><Money plain value={progress.spent} currency={budget.currency} /></dd></div>
            <div data-sm-figure="remaining"><dt>{t("planning.budgets.remaining")}</dt><dd><Money value={progress.remaining} currency={budget.currency} /></dd></div>
          </dl>
        )}
        {progress?.statusKnown && STATUS_HINTS.includes(progress.status) && <p className="sm-hero-note" data-sm-hint={progress.status}>{t(`budgetView.hint.${progress.status}`)}</p>}
        {start && end && <p className="sm-hero-note"><bdi>{t("planning.range", { from: start, to: end })}</bdi></p>}
      </section>

      <section className="sm-card" aria-labelledby="sm-budget-progress">
        <h2 id="sm-budget-progress" className="sm-card-title">{t("planning.budgets.progress")}</h2>
        {progress ? (
          <>
            {/* Spent and remaining are in the summary above; this card is the period's count, days and state. */}
            <dl className="sm-stats sm-stats-stacked">
              {progress.expensesCount !== null && <Fact label={t("planning.budgets.expenses")}><bdi dir="ltr">{progress.expensesCount}</bdi></Fact>}
              {progress.daysRemaining !== null && <Fact label={t("planning.budgets.daysLeft")}><bdi dir="ltr">{progress.daysRemaining}</bdi></Fact>}
              {progress.hasStarted === false && <Fact label={t("planning.budgets.period")}>{t("planning.budgets.notStarted")}</Fact>}
              {progress.hasEnded === true && <Fact label={t("planning.budgets.period")}>{t("planning.budgets.ended")}</Fact>}
            </dl>
          </>
        ) : (
          <p className="sm-text sm-muted" data-sm-progress="unavailable">{t(budget.archived ? "planning.budgets.progressArchived" : "planning.progressUnavailable")}</p>
        )}
        {expensesPath && (
          <Link className="sm-link-row" to={expensesPath} state={{ from: `${location.pathname}${location.search}` }} data-sm-action="budget-expenses">
            <span className="sm-row-main">
              <span className="sm-row-title">{t("budgetView.expenses")}</span>
              <span className="sm-row-meta">{t(budget.scope === "category" && budget.categoryId ? "budgetView.expensesHintCategory" : "budgetView.expensesHintAll")}</span>
            </span>
            <Chevron />
          </Link>
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
        <DraftLinks ids={{ budgetId: budget.id }} actions={!budget.archived ? ["budget-edit"] : []} />
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
