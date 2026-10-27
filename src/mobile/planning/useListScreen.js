import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { pageLoader } from "./lists.js";
import { usePagedList } from "./usePagedList.js";

/*
 * What every Planning list screen does the same way, once.
 *
 * The filters live in the address (the Desktop list's parameter names), so Back
 * from a record returns to the same view. How many pages are loaded lives in the
 * router state of that history entry, not in storage: Back shows as much again.
 * A filter change replaces the entry and starts at page 1.
 */
export function useListScreen(list) {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = list.readFilters(location.search);
  const signature = list.signatureOf(filters);
  const filtered = list.isFiltered(filters);
  const pages = Number.isInteger(location.state?.pages) && location.state.pages > 1 && location.state.pages <= 50 ? location.state.pages : 1;
  // The canonical text is what the keys and queries are built from, so equal filters are one list.
  const normalized = useMemo(() => list.readFilters(signature === "default" ? "" : signature), [list, signature]);
  const loaderFor = useCallback((page) => pageLoader(list, normalized, page), [list, normalized]);
  const paged = usePagedList({ keyOf: list.keyOf, signature, pages, perPage: list.perPage, loaderFor, build: list.build });

  const setFilters = useCallback(
    (next) => {
      const search = list.toSearchParams(next).toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true, state: null });
    },
    [navigate, location.pathname, list],
  );
  const loadMore = () => navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { ...location.state, pages: pages + 1 } });
  const refresh = () => {
    if (pages > 1) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    paged.reload();
  };

  return { list: paged, filters, filtered, pages, setFilters, loadMore, refresh, reset: () => setFilters(list.readFilters("")), here: `${location.pathname}${location.search}` };
}
