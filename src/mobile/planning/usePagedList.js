import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { useResourceStore } from "../identity/storeContext.js";
import { mergePlanningPages } from "../models/planning.js";

const FRESH_MS = 60_000;

/*
 * The pages of one Planning list (budgets, goals or recurring rules), 1..pages,
 * read from the identity scope's store and combined into one list. The same
 * design as Activity's (activity/useActivityList.js): every page is its own
 * read, keyed by the filters it was asked with and its page number, so an
 * answer can only land in the entry of the question it answered, and the reads
 * still in flight for old filters are cancelled when the screen moves on.
 *
 * Paging is the server's. Nothing is filtered or sorted in the browser, the
 * total is the paginator's own number, and a row that turns up on two pages is
 * shown once.
 *
 * `keyOf(signature, page)`, `loaderFor(page)` and `build(response, expected)`
 * must be stable (module functions, or memoised on their inputs).
 */
export function usePagedList({ keyOf, signature, pages, perPage, loaderFor, build }) {
  const store = useResourceStore();
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const pagesRef = useRef(pages);
  const sample = keyOf(signature, 1);
  // Everything this list owns shares this prefix ("budgets:default:"), which is what a refresh forgets.
  const prefix = sample.slice(0, sample.length - 1);

  useEffect(() => {
    pagesRef.current = pages;

    for (let page = 1; page <= pages; page += 1) {
      const entry = store.get(keyOf(signature, page));
      const fresh = entry.status === "ready" && Date.now() - entry.updatedAt < FRESH_MS;
      const running = entry.status === "loading" || entry.status === "refreshing";
      if (!fresh && !running) store.load(keyOf(signature, page), loaderFor(page));
    }
  }, [store, keyOf, signature, pages, loaderFor]);

  // Moving to other filters (or leaving) stops what this list was still waiting for.
  useEffect(
    () => () => {
      for (let page = 1; page <= pagesRef.current; page += 1) store.cancel(keyOf(signature, page));
    },
    [store, keyOf, signature],
  );

  const state = useMemo(() => {
    void version;
    const read = [];

    for (let page = 1; page <= pages; page += 1) {
      const entry = store.get(keyOf(signature, page));
      let value = null;
      let parseError = null;

      if (entry.data !== undefined) {
        try {
          value = build(entry.data, { page, perPage });
        } catch (error) {
          parseError = error;
        }
      }

      read.push({ page, status: entry.status, error: entry.error ?? parseError, parseError, updatedAt: entry.updatedAt, value });
    }

    const first = read[0];
    const loaded = read.filter((item) => item.value);
    const last = read.at(-1);

    return {
      loading: first.status === "idle" || first.status === "loading",
      failed: first.status === "error" || (first.value === null && first.parseError !== null),
      stale: read.some((item) => item.status === "stale" && item.value),
      refreshing: read.some((item) => item.status === "refreshing"),
      items: mergePlanningPages(loaded.map((item) => item.value)),
      total: first.value?.total ?? null,
      loadingMore: pages > 1 && (last.status === "loading" || last.status === "idle"),
      moreError: pages > 1 && last.value === null && last.status !== "loading" && last.status !== "idle" ? last.error ?? new Error("x") : null,
      moreErrorPage: last.page,
      canLoadMore: Boolean(last.value) && last.value.page < last.value.lastPage,
      updatedAt: first.updatedAt,
      error: first.error,
    };
  }, [store, keyOf, signature, pages, perPage, build, version]);

  const reload = useCallback(() => {
    // Older pages would not line up with a fresh first page, so they are forgotten.
    store.drop((key) => key.startsWith(prefix) && !key.endsWith(":1"));
    return store.load(keyOf(signature, 1), loaderFor(1));
  }, [store, keyOf, signature, loaderFor, prefix]);

  const retryPage = useCallback((page) => store.load(keyOf(signature, page), loaderFor(page)), [store, keyOf, signature, loaderFor]);

  return { ...state, reload, retryPage };
}
