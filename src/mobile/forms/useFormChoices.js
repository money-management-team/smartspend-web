import { useMemo } from "react";

import { keys, loadAccounts, loadCategories } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { buildAccountList } from "../models/accounts.js";
import { buildCategoryList } from "../models/categories.js";

const none = async () => null;

/*
 * The choices a form offers: the accounts (GET /accounts) and categories
 * (GET /categories) the screens already read, from the same store, so a form
 * opened from a list costs no second request. A form that needs neither reads
 * nothing. A list that cannot be read leaves its field without choices and says
 * so; nothing is guessed.
 */
export function useFormChoices(needs) {
  const accounts = useResource(keys.accounts, needs.accounts ? loadAccounts : none, { enabled: Boolean(needs.accounts) });
  const categories = useResource(keys.categories, needs.categories ? loadCategories : none, { enabled: Boolean(needs.categories) });

  const accountItems = useMemo(() => {
    if (!needs.accounts || accounts.data === undefined) return null;
    const list = buildAccountList(accounts.data);
    return list ? list.groups.flatMap((group) => group.items) : null;
  }, [needs.accounts, accounts.data]);

  const categoryItems = useMemo(() => {
    if (!needs.categories || categories.data === undefined) return null;
    try {
      return buildCategoryList(categories.data);
    } catch {
      return null;
    }
  }, [needs.categories, categories.data]);

  const sources = [needs.accounts && { resource: accounts, items: accountItems }, needs.categories && { resource: categories, items: categoryItems }].filter(Boolean);
  const loading = sources.some(({ resource }) => resource.loading);
  const failed = !loading && sources.find(({ resource, items }) => resource.status === "error" || items === null);

  return {
    accounts: accountItems ?? [],
    categories: categoryItems ?? [],
    loading,
    error: failed ? failed.resource.error ?? { code: "MALFORMED_RESPONSE" } : null,
    stale: sources.some(({ resource }) => resource.stale),
    retrying: sources.some(({ resource }) => resource.refreshing),
    retry: () => sources.forEach(({ resource }) => resource.reload()),
  };
}
