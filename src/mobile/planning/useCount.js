import { useMemo } from "react";

import { useResource } from "../data/useResource.js";

/*
 * How many rows a Planning list has, for the overview: the first page of that
 * list, read through the same store key the list screen uses (so opening the
 * list afterwards finds it already read), and reduced to the paginator's own
 * `total` (and those first rows). The rows are validated like the list's, and a response that does not
 * hold together is an error, never a count.
 */
export function useCount({ key, loader, build, perPage }) {
  const resource = useResource(key, loader);

  const parsed = useMemo(() => {
    if (resource.data === undefined) return { total: null, rows: [], malformed: false };

    try {
      const page = build(resource.data, { page: 1, perPage });
      return { total: page.total, rows: Array.isArray(page.rows) ? page.rows : [], malformed: false };
    } catch {
      return { total: null, rows: [], malformed: true };
    }
  }, [resource.data, build, perPage]);

  return {
    loading: resource.loading,
    failed: resource.status === "error" || parsed.malformed,
    stale: resource.stale && parsed.total !== null,
    total: parsed.total,
    // The same validated first-page rows the count came from (the overview previews a few; nothing is read for them).
    rows: parsed.rows,
    error: resource.error,
    updatedAt: resource.updatedAt,
    refreshing: resource.refreshing,
    reload: resource.reload,
  };
}
