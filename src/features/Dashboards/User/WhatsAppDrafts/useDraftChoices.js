import { useEffect, useState } from "react";

import { accountsApi } from "../api/accountsApi.js";
import { categoriesApi } from "../api/categoriesApi.js";

/*
 * The accounts and expense categories a draft may be edited to, from the
 * existing accounts and categories APIs, for the draft's OWN workspace (taken
 * from the backend's draft, never typed by the user). The lists are narrowed
 * the way the backend validates (active, not a savings-goal pot, expense
 * category), but the backend stays the judge: a rejected choice is shown as
 * a field error.
 */
export function useDraftChoices({ workspaceId, enabled, accounts = accountsApi, categories = categoriesApi }) {
  const [result, setResult] = useState({ key: null, accounts: [], categories: [], failed: false });
  const key = enabled ? String(workspaceId) : null;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const options = { signal: controller.signal };

    Promise.all([
      accounts.list({ id_workspace: workspaceId }, options),
      categories.list({ workspace_id: workspaceId, type: "expense" }, options),
    ])
      .then(([accountResponse, categoryResponse]) => {
        if (controller.signal.aborted) return;
        const accountList = Array.isArray(accountResponse?.data?.accounts) ? accountResponse.data.accounts : [];
        const categoryList = Array.isArray(categoryResponse?.data?.categories) ? categoryResponse.data.categories : [];
        setResult({
          key,
          failed: false,
          accounts: accountList.filter((account) => account.status === "active"
            && !account.savings_goal
            && Number(account.workspace_id) === Number(workspaceId)),
          categories: categoryList.filter((category) => category.type === "expense"
            && category.is_active !== false
            && (category.workspace_id == null || Number(category.workspace_id) === Number(workspaceId))),
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key, accounts: [], categories: [], failed: true });
      });

    return () => controller.abort();
  }, [accounts, categories, enabled, key, workspaceId]);

  const ready = key !== null && result.key === key;
  return {
    loading: key !== null && !ready,
    failed: ready && result.failed,
    accounts: ready ? result.accounts : [],
    categories: ready ? result.categories : [],
  };
}
