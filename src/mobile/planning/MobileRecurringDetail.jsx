import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { getRecurringDetailsPath } from "../../routes/Path.js";
import { keys, ruleLoader } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildRuleDetail } from "../models/recurring.js";
import { MOBILE_RECURRING } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import PlanChip from "./PlanChip.jsx";
import RecordScreen from "./RecordScreen.jsx";
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

function Detail({ rule, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const day = (value) => formatDay(value, locale);
  const cadence = cadenceText(rule, t);
  const type = typeText(rule, t);
  const mode = rule.mode ? (rule.modeKnown ? t(`planning.recurring.mode.${rule.mode}`) : rule.mode.replace(/_/g, " ")) : null;

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-rule-title">
        <h2 id="sm-rule-title" className="sm-card-title sm-user-text">{rule.name ?? t("planning.recurring.untitled")}</h2>
        <p className="sm-chips-inline">
          <span className="sm-chip">{t("planning.recurring.ruleChip")}</span>
          <PlanChip state={rule.status} known={rule.statusKnown} />
        </p>
        <p className="sm-balance-label">{t("planning.recurring.amount")}</p>
        <Money className="sm-hero-money" value={rule.amount} currency={rule.currency} />
        {type && <p className="sm-hero-note"><bdi>{type}{cadence ? ` · ${cadence}` : ""}</bdi></p>}
      </section>

      <div className="sm-card" role="note" data-sm-note="rule">
        <p className="sm-text">{t("planning.recurring.ruleNote")}</p>
      </div>

      <section className="sm-card" aria-labelledby="sm-rule-facts">
        <h2 id="sm-rule-facts" className="sm-card-title">{t("planning.recurring.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("planning.recurring.nextDue")}>{day(rule.nextDue) ? <bdi>{day(rule.nextDue)}</bdi> : t("planning.recurring.noNextDue")}</Fact>
          {rule.openOccurrences !== null && <Fact label={t("planning.recurring.open")}><bdi dir="ltr">{rule.openOccurrences}</bdi></Fact>}
          {mode && <Fact label={t("planning.recurring.mode.label")}><bdi>{mode}</bdi></Fact>}
          {rule.accountName && <Fact label={t("planning.recurring.account")}><bdi className="sm-user-text">{rule.accountName}</bdi></Fact>}
          {rule.categoryName && <Fact label={t("planning.recurring.category")}><bdi className="sm-user-text">{rule.categoryName}</bdi></Fact>}
          {day(rule.startDate) && <Fact label={t("planning.recurring.start")}><bdi>{day(rule.startDate)}</bdi></Fact>}
          {day(rule.endDate) && <Fact label={t("planning.recurring.end")}><bdi>{day(rule.endDate)}</bdi></Fact>}
          {rule.maxOccurrences !== null && <Fact label={t("planning.recurring.max")}><bdi dir="ltr">{rule.maxOccurrences}</bdi></Fact>}
          {day(rule.lastProcessedAt) && <Fact label={t("planning.recurring.last")}><bdi>{day(rule.lastProcessedAt)}</bdi></Fact>}
        </dl>
      </section>

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
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="rule" recordId={ruleId} keyOf={keyOf} loaderOf={ruleLoader} build={buildRuleDetail} backFallback={MOBILE_RECURRING} strings="planning.recurring" render={(rule) => <Detail rule={rule} locale={locale} />} />;
}
