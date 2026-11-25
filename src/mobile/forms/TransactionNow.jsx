import { useMemo } from "react";
import { Link } from "react-router-dom";

import StatusChip from "../activity/StatusChip.jsx";
import { keys, transactionLoader } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { buildTransactionDetail } from "../models/activity.js";
import { activityDetailPath } from "../navigation.js";

/* One transaction's status as SmartSpend reads it now (GET /transactions/{id}); never taken from the write's answer alone. */
export default function TransactionNow({ side, id, label, t }) {
  const loader = useMemo(() => transactionLoader(id), [id]);
  const resource = useResource(keys.transaction(id), loader);
  const detail = useMemo(() => (resource.data !== undefined ? buildTransactionDetail(resource.data, id) : null), [resource.data, id]);

  return (
    <div className="sm-stat" data-sm-transaction-now={side} data-sm-state={resource.loading ? "loading" : detail?.status ? "ready" : "unavailable"} data-sm-status-now={detail?.status ?? undefined}>
      <dt>{label} · <Link to={activityDetailPath(id)}>#{id}</Link></dt>
      <dd>{resource.loading ? <span className="sm-muted">{t("forms.entryResult.loadingStatus")}</span> : detail?.status ? <StatusChip status={detail.status} known={detail.statusKnown} /> : <span className="sm-muted">{t("transfers.result.balanceUnavailable")}</span>}</dd>
    </div>
  );
}
