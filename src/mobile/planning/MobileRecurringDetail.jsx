import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import DraftLinks from "../forms/DraftLinks.jsx";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { getRecurringDetailsPath } from "../../routes/Path.js";
import { keys, ruleLoader } from "../data/loaders.js";
import { isAccountId } from "../data/readApi.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildRuleDetail } from "../models/recurring.js";
import { MOBILE_RECURRING, accountDetailPath, categoryDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import StateChip from "../ui/StateChip.jsx";
import { OCCURRENCE_TONES } from "./occurrenceTones.js";
import PlanChip from "./PlanChip.jsx";
import RecordScreen from "./RecordScreen.jsx";
import RuleOccurrences from "./RuleOccurrences.jsx";
import { cadenceText, typeText } from "./ruleText.js";

const keyOf = keys.rule;

function Fact({ label, children }) {
  return (
    <div className="sm-stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/*
 * The rule's own next open occurrence, as the backend sent it with the rule (`schedule.next_occurrence`): its date, its
 * status, whether it is overdue and what it would post. Mobile does not pick the occurrence or work out its date.
 */
function NextOccurrence({ rule, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const next = rule.nextOccurrence;
  const due = next ? formatDay(next.dueDate, locale) : null;

  let body;
  if (!rule.scheduleKnown) body = <p className="sm-text sm-muted" data-sm-next="unknown">{t("ruleView.next.unknown")}</p>;
  else if (!next) body = <p className="sm-text sm-muted" data-sm-next="none">{t("ruleView.next.none")}</p>;
  else {
    body = (
      <dl className="sm-stats sm-stats-stacked" data-sm-next={next.status ?? "unknown"} data-sm-overdue={next.overdue ? "true" : undefined}>
        <Fact label={t("ruleView.next.due")}>
          {due ? <bdi>{due}</bdi> : "—"}
          {next.overdue && <> <span className="sm-chip sm-plan-chip" data-sm-tone="bad" data-sm-overdue-chip="true">{t("ruleView.overdue")}</span></>}
        </Fact>
        <Fact label={t("ruleView.next.status")}><StateChip state={next.status} known={next.statusKnown} labels="ruleView.occurrenceStatus" tones={OCCURRENCE_TONES} /></Fact>
        <Fact label={t("ruleView.next.amount")}><Money plain value={next.amount} currency={next.currency} /></Fact>
        {next.attempts !== null && (next.status === "failed" || next.attempts > 1) && <Fact label={t("ruleView.next.attempts")}><bdi dir="ltr">{next.attempts}</bdi></Fact>}
        {next.failureReason && <Fact label={t("ruleView.next.reason")}><span className="sm-user-text">{next.failureReason}</span></Fact>}
      </dl>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-rule-next" data-sm-section="rule-next">
      <h2 id="sm-rule-next" className="sm-card-title">{t("ruleView.next.title")}</h2>
      {body}
      {next && <p className="sm-text sm-muted sm-fine">{t("ruleView.next.hint")}</p>}
    </section>
  );
}

function Detail({ rule, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const day = (value) => formatDay(value, locale);
  const cadence = cadenceText(rule, t);
  const type = typeText(rule, t);
  const mode = rule.mode ? (rule.modeKnown ? t(`planning.recurring.mode.${rule.mode}`) : rule.mode.replace(/_/g, " ")) : null;
  const noteKey = ["paused", "completed", "archived"].includes(rule.status) ? rule.status : null;
  const from = { from: `${location.pathname}${location.search}` };

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-rule-title">
        <h2 id="sm-rule-title" className="sm-card-title sm-user-text">{rule.name ?? t("planning.recurring.untitled")}</h2>
        <p className="sm-chips-inline">
          <span className="sm-chip">{t("planning.recurring.ruleChip")}</span>
          <PlanChip state={rule.status} known={rule.statusKnown} />
          {rule.nextOccurrence?.overdue && <span className="sm-chip sm-plan-chip" data-sm-tone="bad" data-sm-overdue-chip="true">{t("ruleView.overdue")}</span>}
        </p>
        <p className="sm-balance-label">{t("planning.recurring.amount")}</p>
        <Money className="sm-hero-money" value={rule.amount} currency={rule.currency} />
        {type && <p className="sm-hero-note"><bdi>{type}{cadence ? ` · ${cadence}` : ""}</bdi></p>}
      </section>

      <div className="sm-card" role="note" data-sm-note="rule">
        <p className="sm-text">{t("planning.recurring.ruleNote")}</p>
        {noteKey && <p className="sm-text" data-sm-note-status={noteKey}>{t(`ruleView.note.${noteKey}`)}</p>}
      </div>

      <NextOccurrence rule={rule} locale={locale} />

      <section className="sm-card" aria-labelledby="sm-rule-facts">
        <h2 id="sm-rule-facts" className="sm-card-title">{t("planning.recurring.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("planning.recurring.nextDue")}>{day(rule.nextDue) ? <bdi>{day(rule.nextDue)}</bdi> : t("planning.recurring.noNextDue")}</Fact>
          {rule.openOccurrences !== null && <Fact label={t("planning.recurring.open")}><bdi dir="ltr">{rule.openOccurrences}</bdi></Fact>}
          {mode && <Fact label={t("planning.recurring.mode.label")}><bdi>{mode}</bdi></Fact>}
          {rule.accountName && (
            <Fact label={t("planning.recurring.account")}>
              {isAccountId(rule.accountId) ? <Link to={accountDetailPath(rule.accountId)} state={from}><bdi className="sm-user-text">{rule.accountName}</bdi></Link> : <bdi className="sm-user-text">{rule.accountName}</bdi>}
            </Fact>
          )}
          {rule.categoryName && (
            <Fact label={t("planning.recurring.category")}>
              {isAccountId(rule.categoryId) ? <Link to={categoryDetailPath(rule.categoryId)} state={from}><bdi className="sm-user-text">{rule.categoryName}</bdi></Link> : <bdi className="sm-user-text">{rule.categoryName}</bdi>}
            </Fact>
          )}
          {day(rule.startDate) && <Fact label={t("planning.recurring.start")}><bdi>{day(rule.startDate)}</bdi></Fact>}
          {day(rule.endDate) && <Fact label={t("planning.recurring.end")}><bdi>{day(rule.endDate)}</bdi></Fact>}
          {rule.maxOccurrences !== null && <Fact label={t("planning.recurring.max")}><bdi dir="ltr">{rule.maxOccurrences}</bdi></Fact>}
          {day(rule.lastProcessedAt) && <Fact label={t("planning.recurring.last")}><bdi>{day(rule.lastProcessedAt)}</bdi></Fact>}
          {rule.owner && <Fact label={t("ruleView.owner")}><bdi className="sm-user-text">{rule.owner}</bdi></Fact>}
        </dl>
      </section>

      <RuleOccurrences rule={rule} locale={locale} timeZone={timeZone} />

      {(rule.description || rule.notes) && (
        <section className="sm-card" aria-labelledby="sm-rule-notes">
          <h2 id="sm-rule-notes" className="sm-card-title">{t("planning.notes")}</h2>
          {rule.description && <p className="sm-text sm-user-text">{rule.description}</p>}
          {rule.notes && <p className="sm-text sm-user-text">{rule.notes}</p>}
        </section>
      )}

      <section className="sm-card" aria-labelledby="sm-rule-changes">
        <h2 id="sm-rule-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <p className="sm-text sm-muted">{t("planning.recurring.changesBody")}</p>
        <DraftLinks ids={{ ruleId: rule.id }} actions={rule.status === "active" ? ["recurring-confirm", "recurring-skip", "recurring-edit"] : rule.archived || rule.status === "completed" ? [] : ["recurring-edit"]} />
        <Link className="sm-link-row" to={getRecurringDetailsPath(rule.id)}>
          <span>{t("planning.recurring.openFullOne")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/* One recurring rule, read-only (GET /recurring-transactions/{id}); the page rules are in RecordScreen. */
export default function MobileRecurringDetail() {
  const { ruleId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;

  return <RecordScreen screen="rule" recordId={ruleId} keyOf={keyOf} loaderOf={ruleLoader} build={buildRuleDetail} backFallback={MOBILE_RECURRING} strings="planning.recurring" render={(rule) => <Detail rule={rule} locale={locale} timeZone={timeZone} />} />;
}
