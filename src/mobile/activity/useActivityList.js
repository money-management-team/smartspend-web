import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { activityLoader, keys } from "../data/loaders.js";
import { ACTIVITY_PER_PAGE } from "../data/readApi.js";
import { useResourceStore } from "../identity/storeContext.js";
import { buildActivityPage, filterSignature, filtersToQuery, groupByDay, mergePages, readActivityFilters } from "../models/activity.js";

const FRESH_MS = 60_000;

/*
 * The pages of one Activity list, 1..pages, read from the identity scope's
 * store and combined into one list.
 *
 * Every page is its own read, keyed by the filters it was asked with and its
 * page number. A response can therefore only land in the entry of the
 * question it answered: changing a filter changes the keys, so an answer to the
 * previous filters can never appear under the new ones, and the reads still in
 * flight for the old filters are cancelled when the screen moves on.
 *
 * Paging is the server's (page n of per_page 20). Nothing is filtered or sorted
 * in the browser, the total is the paginator's own number, and a transaction
 * that turns up on two pages (the list moved while paging) is shown once.
 */
export function useActivityList(filters, pages, timeZone) {
  const store = useResourceStore();
  const signature = filterSignature(filters);
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  // The canonical text is what the keys and queries are built from, so equal filters are one list.
  const normalized = useMemo(() => readActivityFilters(signature === "all" ? "" : signature), [signature]);
  const loaderFor = useCallback((page) => activityLoader(filtersToQuery(normalized, page, ACTIVITY_PER_PAGE)), [normalized]);
  const pagesRef = useRef(pages);

  useEffect(() => {
    pagesRef.current = pages;

    for (let page = 1; page <= pages; page += 1) {
      const entry = store.get(keys.activity(signature, page));
      const fresh = entry.status === "ready" && Date.now() - entry.updatedAt < FRESH_MS;
      const running = entry.status === "loading" || entry.status === "refreshing";
      if (!fresh && !running) store.load(keys.activity(signature, page), loaderFor(page));
    }
  }, [store, signature, pages, loaderFor]);

  // Moving to other filters (or leaving) stops what this list was still waiting for.
  useEffect(
    () => () => {
      for (let page = 1; page <= pagesRef.current; page += 1) store.cancel(keys.activity(signature, page));
    },
    [store, signature],
  );

  const state = useMemo(() => {
    void version;
    const read = [];

    for (let page = 1; page <= pages; page += 1) {
      const entry = store.get(keys.activity(signature, page));
      let value = null;
      let parseError = null;

      if (entry.data !== undefined) {
        try {
          value = buildActivityPage(entry.data, { page, perPage: ACTIVITY_PER_PAGE }, { timeZone });
        } catch (error) {
          parseError = error;
        }
      }

      read.push({ page, status: entry.status, error: entry.error ?? parseError, updatedAt: entry.updatedAt, value });
    }

    const first = read[0];
    const loaded = read.filter((item) => item.value);
    const { items } = mergePages(loaded.map((item) => item.value));
    const last = read.at(-1);

    return {
      first,
      loading: first.status === "idle" || first.status === "loading",
      failed: first.status === "error" || (first.value === null && first.parseError !== null),
      stale: read.some((item) => item.status === "stale" && item.value),
      refreshing: read.some((item) => item.status === "refreshing"),
      items,
      groups: groupByDay(items),
      total: first.value?.total ?? null,
      lastPage: first.value?.lastPage ?? null,
      loadingMore: pages > 1 && (last.status === "loading" || last.status === "idle"),
      moreError: pages > 1 && last.value === null && last.status !== "loading" && last.status !== "idle" ? last.error ?? new Error("x") : null,
      moreErrorPage: last.page,
      canLoadMore: Boolean(last.value) && last.value.page < last.value.lastPage,
      updatedAt: first.updatedAt,
      error: first.error,
    };
  }, [store, signature, pages, timeZone, version]);

  const reload = useCallback(() => {
    // Older pages would not line up with a fresh first page, so they are forgotten.
    store.drop((key) => key.startsWith(`activity:${signature}:`) && !key.endsWith(":1"));
    return store.load(keys.activity(signature, 1), loaderFor(1));
  }, [store, signature, loaderFor]);

  const retryPage = useCallback((page) => store.load(keys.activity(signature, page), loaderFor(page)), [store, signature, loaderFor]);

  return { ...state, reload, retryPage };
}
