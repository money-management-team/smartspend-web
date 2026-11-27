import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { RULE_STATUSES } from "../models/recurring.js";
import { recurringDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import StateChip from "../ui/StateChip.jsx";
import FilterTabs from "./FilterTabs.jsx";
import { RULE_LIST } from "./lists.js";
import { OCCURRENCE_TONES } from "./occurrenceTones.js";
import PagedListView from "./PagedListView.jsx";
import PlanChip from "./PlanChip.jsx";
import { cadenceText, typeText } from "./ruleText.js";
import { useListScreen } from "./useListScreen.js";

export function RuleRow({ rule, from, pages, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const next = formatDay(rule.nextDue, locale);
  const cadence = cadenceText(rule, t);
  const type = typeText(rule, t);
  // The backend's word on the rule's next open occurrence: only what needs a look is shown (overdue, due, failed), a plain "scheduled" says nothing new.
  const upcoming = rule.nextOccurrence;
  // "Overdue" already says an occurrence is due, so a "Due" chip beside it would only repeat it.
  const attention = upcoming && upcoming.status && upcoming.status !== "scheduled" && !(upcoming.overdue && upcoming.status === "due") ? upcoming : null;

  return (
    <Link className="sm-row sm-plan-row" to={recurringDetailPath(rule.id)} state={{ from, pages }} data-sm-rule={rule.id} data-sm-status={rule.status ?? "none"} data-sm-overdue={upcoming?.overdue ? "true" : undefined}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{rule.name ?? t("planning.recurring.untitled")}</span>
        <span className="sm-row-meta">{[type, cadence].filter(Boolean).map((part, index) => <span key={part}>{index > 0 && " · "}<bdi>{part}</bdi></span>)}</span>
        {next ? <span className="sm-row-meta">{t("planning.recurring.nextDue")} <bdi>{next}</bdi></span> : rule.status === "active" ? <span className="sm-row-meta">{t("planning.recurring.noNextDue")}</span> : null}
        {(rule.status !== "active" || upcoming?.overdue || attention) && (
          <span className="sm-chips-inline">
            {rule.status !== "active" && <PlanChip state={rule.status} known={rule.statusKnown} />}
            {upcoming?.overdue && <span className="sm-chip sm-plan-chip" data-sm-tone="bad" data-sm-overdue-chip="true">{t("ruleView.overdue")}</span>}
            {attention && rule.status === "active" && <StateChip state={attention.status} known={attention.statusKnown} labels="ruleView.occurrenceStatus" tones={OCCURRENCE_TONES} />}
          </span>
        )}
      </span>
      <span className="sm-row-end">
        <span className="sm-row-amount"><Money plain value={rule.amount} currency={rule.currency} /></span>
        <Chevron />
      </span>
    </Link>
  );
}

/*
 * Mobile Recurring rules, read-only: GET /recurring-transactions by status and
 * type. A rule is not a transaction: its row is not a ledger row, its amount is
 * what it would post (unsigned, with its type in words), and the next date is the
 * backend's. Confirming, skipping, pausing and resuming move money or change the
 * schedule and stay in the full version.
 */
export default function MobileRecurring() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(RULE_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <FilterTabs
        label={t("planning.recurring.filterStatus")}
        value={filters.status}
        options={RULE_STATUSES.map((value) => ({ value, label: t(`planning.state.${value}`) }))}
        onChange={(status) => setFilters({ ...filters, status })}
      />
      <FilterTabs
        label={t("planning.recurring.filterType")}
        value={filters.type}
        options={[
          { value: "", label: t("planning.recurring.typeAll") },
          { value: "income", label: t("planning.recurring.type.income") },
          { value: "expense", label: t("planning.recurring.type.expense") },
        ]}
        onChange={(type) => setFilters({ ...filters, type })}
      />
    </div>
  );

  return (
    <PagedListView
      screen="recurring"
      list={screen.list}
      toolbar={toolbar}
      filtered={screen.filtered}
      onResetFilters={screen.reset}
      strings="planning.recurring"
      pages={screen.pages}
      perPage={RULE_LIST.perPage}
      onLoadMore={screen.loadMore}
      onRefresh={screen.refresh}
      fullPath={PATH.USER.RECURRING}
      renderRow={(rule) => <RuleRow rule={rule} from={screen.here} pages={screen.pages} locale={locale} />}
    />
  );
}
