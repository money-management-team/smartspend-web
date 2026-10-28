import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { TRANSFER_STATUSES } from "../models/transfers.js";
import { transferDetailPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import { TRANSFER_LIST } from "../planning/lists.js";
import PagedListView from "../planning/PagedListView.jsx";
import { useListScreen } from "../planning/useListScreen.js";
import Chevron from "../ui/Chevron.jsx";
import StateChip from "../ui/StateChip.jsx";
import { TRANSFER_TONES } from "./transferTones.js";

const accountName = (account, t) => account?.name ?? (account?.id ? t("transfers.accountNumber", { id: account.id }) : t("transfers.accountUnknown"));

function TransferRow({ transfer, from, pages, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const when = formatMoment(transfer.occurredAt, locale);

  return (
    <Link className="sm-row sm-plan-row" to={transferDetailPath(transfer.id)} state={{ from, pages }} data-sm-transfer={transfer.id} data-sm-status={transfer.status ?? "none"}>
      <span className="sm-row-main">
        <span className="sm-row-title">
          <bdi className="sm-user-text">{accountName(transfer.from, t)}</bdi> <span aria-hidden="true">→</span><span className="sm-sr">{t("transfers.to")}</span> <bdi className="sm-user-text">{accountName(transfer.to, t)}</bdi>
        </span>
        {when && <span className="sm-row-meta"><bdi>{when}</bdi></span>}
        <span className="sm-chips-inline"><StateChip state={transfer.status} known={transfer.statusKnown} labels="transfers.status" tones={TRANSFER_TONES} /></span>
        <span className="sm-plan-figures">
          <span>{t("transfers.amount")} <Money plain value={transfer.amount} currency={transfer.currency} /></span>
          {transfer.hasFee && <span>{t("transfers.fee")} <Money plain value={transfer.fee} currency={transfer.currency} /></span>}
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * Transfers between the person's own accounts, read-only: GET /transfers a page
 * at a time, by status. Making or reversing a transfer is not offered here.
 */
export default function MobileTransfers() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(TRANSFER_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <FilterTabs
        label={t("transfers.filterStatus")}
        value={filters.status}
        options={[{ value: "", label: t("transfers.all") }, ...TRANSFER_STATUSES.map((value) => ({ value, label: t(`transfers.status.${value}`) }))]}
        onChange={(status) => setFilters({ ...filters, status })}
      />
    </div>
  );

  return (
    <PagedListView
      screen="transfers"
      list={screen.list}
      toolbar={toolbar}
      filtered={screen.filtered}
      onResetFilters={screen.reset}
      strings="transfers"
      pages={screen.pages}
      perPage={TRANSFER_LIST.perPage}
      onLoadMore={screen.loadMore}
      onRefresh={screen.refresh}
      fullPath={PATH.USER.TRANSFERS}
      renderRow={(transfer) => <TransferRow transfer={transfer} from={screen.here} pages={screen.pages} locale={locale} />}
    />
  );
}
