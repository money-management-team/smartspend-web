import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

const pageFrom = (value) => (/^[1-9]\d{0,3}$/.test(value ?? "") ? parseInt(value, 10) : 1);

/*
 * One page of a server-paged list, read with GET, with Newer and Older to move
 * between the server's pages. The page number lives in the address (`param`),
 * so Back and Forward return to it. Nothing is sorted, filtered or counted in
 * the browser; the total shown is the paginator's own.
 *
 * `keyOf(page)`, `loaderOf(page)` and `build(data)` must be stable.
 */
export default function PagedRead({ name, keyOf, loaderOf, build, renderItem, empty, label, param = "page", enabled = true, previousLabel, nextLabel }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params.get(param));
  const loader = useMemo(() => loaderOf(page), [loaderOf, page]);
  const resource = useResource(keyOf(page), loader, { enabled });
  const result = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return build(resource.data);
    } catch {
      return null;
    }
  }, [resource.data, build]);

  const go = (next) =>
    setParams((current) => {
      const copy = new URLSearchParams(current);
      if (next === 1) copy.delete(param);
      else copy.set(param, String(next));
      return copy;
    });

  if (!enabled) return null;
  if (resource.loading) return <Skeleton lines={4} label={label} />;
  if (resource.status === "error" || !result) return <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} />;

  return (
    <div className="sm-paged" data-sm-list={name} data-sm-page={result.page}>
      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
      {result.items.length === 0 ? (
        <p className="sm-text sm-muted" data-sm-empty={name}>{empty}</p>
      ) : (
        <ul className="sm-list" aria-label={label}>
          {result.items.map((item) => <li key={item.id}>{renderItem(item)}</li>)}
        </ul>
      )}
      {(result.page > 1 || result.lastPage > result.page) && (
        <div className="sm-actions sm-paged-nav">
          <button type="button" className="sm-button sm-button-quiet" disabled={result.page <= 1} onClick={() => go(result.page - 1)}>{previousLabel ?? t("assist.newer")}</button>
          <span className="sm-text sm-muted sm-fine"><bdi dir="ltr">{result.page}</bdi> / <bdi dir="ltr">{result.lastPage}</bdi></span>
          <button type="button" className="sm-button sm-button-quiet" disabled={result.page >= result.lastPage} onClick={() => go(result.page + 1)}>{nextLabel ?? t("assist.older")}</button>
        </div>
      )}
    </div>
  );
}
