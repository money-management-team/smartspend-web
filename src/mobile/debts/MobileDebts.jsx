import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { DEBT_DIRECTIONS, DEBT_FILTER_STATUSES } from "../models/debts.js";
import { debtDetailPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import { DEBT_LIST } from "../planning/lists.js";
import PagedListView from "../planning/PagedListView.jsx";
import { useListScreen } from "../planning/useListScreen.js";
import Chevron from "../ui/Chevron.jsx";
import StateChip from "../ui/StateChip.jsx";
import { DEBT_TONES } from "./debtTones.js";


function DebtRow({ debt, from, pages, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const due = formatDay(debt.dueDate, locale);

  return (
    <Link className="sm-row sm-plan-row" to={debtDetailPath(debt.id)} state={{ from, pages }} data-sm-debt={debt.id} data-sm-status={debt.status ?? "none"}>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{debt.counterparty ?? t("debts.unnamed")}</span>
        <span className="sm-row-meta">{debt.direction ? t(`debts.direction.${debt.direction}`) : t("debts.direction.unknown")}{due && <> · {t("debts.due")} <bdi>{due}</bdi></>}</span>
        <span className="sm-chips-inline">
          <StateChip state={debt.status} known={debt.statusKnown} labels="debts.status" tones={DEBT_TONES} />
        </span>
        <span className="sm-plan-figures">
          <span>{t("debts.remaining")} <Money plain value={debt.remaining} currency={debt.currency} /></span>
          <span>{t("debts.original")} <Money plain value={debt.original} currency={debt.currency} /></span>
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * Debts, read-only: GET /debts a page at a time, by direction and status. The
 * amounts and the status (including "overdue") are the backend's; nothing is
 * added up across currencies, and recording a payment is not offered here.
 */
export default function MobileDebts() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(DEBT_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <FilterTabs
        tight
        label={t("debts.filterDirection")}
        value={filters.direction}
        options={[{ value: "", label: t("debts.all") }, ...DEBT_DIRECTIONS.map((value) => ({ value, label: t(`debts.direction.${value}`) }))]}
        onChange={(direction) => setFilters({ ...filters, direction })}
      />
      <FilterTabs
        label={t("debts.filterStatus")}
        value={filters.status}
        options={[{ value: "", label: t("debts.all") }, ...DEBT_FILTER_STATUSES.map((value) => ({ value, label: t(`debts.status.${value}`) }))]}
        onChange={(status) => setFilters({ ...filters, status })}
      />
    </div>
  );

  return (
    <PagedListView
      screen="debts"
      list={screen.list}
      toolbar={toolbar}
      filtered={screen.filtered}
      onResetFilters={screen.reset}
      strings="debts"
      pages={screen.pages}
      perPage={DEBT_LIST.perPage}
      onLoadMore={screen.loadMore}
      onRefresh={screen.refresh}
      fullPath={PATH.USER.DEBTS}
      renderRow={(debt) => <DebtRow debt={debt} from={screen.here} pages={screen.pages} locale={locale} />}
    />
  );
}
