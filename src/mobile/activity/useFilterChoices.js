import { useMemo } from "react";

import { keys, loadAccounts, loadCategories } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { buildAccountList } from "../models/accounts.js";
import { idText, isRecord, textOrNull } from "../models/values.js";

// Accounts and categories the person can pick, from the two read-only lists (active ones only).
export function useFilterChoices(enabled) {
  const accounts = useResource(keys.accounts, loadAccounts, { enabled });
  const categories = useResource(keys.categories, loadCategories, { enabled });
  const accountList = useMemo(() => (accounts.data === undefined ? null : buildAccountList(accounts.data)), [accounts.data]);
  const categoryList = useMemo(() => {
    const raw = isRecord(categories.data) && Array.isArray(categories.data.categories) ? categories.data.categories : null;
    if (!raw) return null;

    return raw
      .filter(isRecord)
      .map((item) => ({ id: idText(item.id), name: textOrNull(item.name, 80), type: item.type === "income" || item.type === "expense" ? item.type : null }))
      .filter((item) => item.id && item.name);
  }, [categories.data]);

  return {
    accounts: accountList ? accountList.groups.flatMap((group) => group.items).filter((item) => item.id && item.name) : [],
    categories: categoryList ?? [],
    loading: accounts.loading || categories.loading,
    failed: accounts.status === "error" || categories.status === "error",
  };
}
