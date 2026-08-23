import { useCallback, useEffect, useMemo, useState } from "react";

import AccountsHeader from "./components/AccountsHeader/AccountsHeader";
import AccountFilters from "./components/AccountFilters/AccountFilters";
import AccountCard from "./components/AccountCard/AccountCard";
import AccountForm from "./components/AccountForm/AccountForm";
import { accountsApi } from "../api/accountsApi";
import { resolveWorkspaceId } from "../api/dashboardApi";

import "./Accounts.css";

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState(null);

  const loadAccounts = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await accountsApi.list({}, { signal });
      setAccounts(response.data?.accounts ?? []);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message);
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAccounts(controller.signal);
    return () => controller.abort();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(
    () =>
      activeFilter === "all"
        ? accounts
        : accounts.filter((account) => account.type === activeFilter),
    [accounts, activeFilter],
  );

  const handleArchive = async (account) => {
    const confirmed = window.confirm(`هل تريد أرشفة الحساب «${account.name}»؟`);
    if (!confirmed) return;

    try {
      await accountsApi.archive(account.id);
      setAccounts((current) => current.filter((item) => item.id !== account.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleSave = async (values) => {
    if (formState?.account) {
      const response = await accountsApi.update(formState.account.id, values);
      const updatedAccount = response.data.account;
      setAccounts((current) =>
        current.map((account) =>
          account.id === updatedAccount.id ? updatedAccount : account,
        ),
      );
    } else {
      const workspaceId = await resolveWorkspaceId();

      if (!workspaceId) {
        throw new Error("تعذر تحديد مساحة العمل الحالية.");
      }

      const response = await accountsApi.create({
        ...values,
        workspace_id: workspaceId,
      });
      setAccounts((current) => [...current, response.data.account]);
    }

    setFormState(null);
  };

  return (
    <div className="accounts-page">
      <AccountsHeader onAdd={() => setFormState({ account: null })} />

      <AccountFilters
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />

      <section className="accounts-page__grid">
        {isLoading && <p className="accounts-page__state">جارٍ تحميل الحسابات...</p>}

        {!isLoading && error && (
          <div className="accounts-page__state accounts-page__state--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => loadAccounts()}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {!isLoading && !error && filteredAccounts.length === 0 && (
          <p className="accounts-page__state">لا توجد حسابات ضمن هذا التصنيف.</p>
        )}

        {!isLoading && !error && filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onEdit={() => setFormState({ account })}
            onArchive={() => handleArchive(account)}
          />
        ))}
      </section>

      {formState && (
        <AccountForm
          account={formState.account}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
