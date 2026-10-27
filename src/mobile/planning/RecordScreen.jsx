import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { isAccountId } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { backPathFrom, backStateFrom } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const NOT_FOUND = Object.freeze({ code: "NOT_FOUND" });

/*
 * The page of one Planning record (a budget, a goal, a recurring rule), read-only.
 * What every one of them does the same way, once:
 *
 * - the id in the address is untrusted: digits only, or the page says "not found"
 *   without reading anything;
 * - the response must be for the record in the address (the model's builder
 *   refuses another id), or the page is an error, never someone else's figures;
 * - a record the person may not see and one that does not exist are reported in
 *   the same words (hideExistence), so the page never says which;
 * - loading, error with Retry, and "stale" (an earlier read, marked as such) are
 *   drawn here, and `render` only ever sees a good record.
 */
export default function RecordScreen({ screen, recordId, keyOf, loaderOf, build, backFallback, strings, render }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const valid = isAccountId(recordId);
  const loader = useMemo(() => loaderOf(recordId), [loaderOf, recordId]);
  const resource = useResource(keyOf(recordId), loader, { enabled: valid });
  const record = useMemo(() => (valid && resource.data !== undefined ? build(resource.data, recordId) : null), [valid, resource.data, recordId, build]);
  const backTo = backPathFrom(location.state, backFallback);
  const backState = backStateFrom(location.state);
  const back = (
    <Link className="sm-link-row sm-back" to={backTo} state={backState}>
      <Chevron back />
      <span>{t(`${strings}.back`)}</span>
    </Link>
  );

  if (!valid) {
    return (
      <section className="sm-page" data-sm-screen={screen} data-sm-state="error">
        <ErrorPanel error={NOT_FOUND} />
        {back}
      </section>
    );
  }

  if (resource.loading) {
    return (
      <section className="sm-page" data-sm-screen={screen} data-sm-state="loading" aria-busy="true">
        <Skeleton lines={5} label={t(`${strings}.loading`)} />
      </section>
    );
  }

  if (resource.status === "error" || !record) {
    return (
      <section className="sm-page" data-sm-screen={screen} data-sm-state="error">
        <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} hideExistence />
        {back}
      </section>
    );
  }

  return (
    <section className="sm-page" data-sm-screen={screen} data-sm-record={record.id} data-sm-state={resource.stale ? "stale" : "ready"} data-sm-stale={resource.stale ? "true" : undefined}>
      {back}
      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
      {render(record)}
    </section>
  );
}
