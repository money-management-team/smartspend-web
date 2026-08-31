import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import AccountsHeader from "./components/AccountsHeader/AccountsHeader";
import AccountFilters from "./components/AccountFilters/AccountFilters";
import AccountCard from "./components/AccountCard/AccountCard";
import AccountForm from "./components/AccountForm/AccountForm";
import { accountsApi } from "../api/accountsApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { getApiErrorMessage } from "../api/apiClient";

import "./Accounts.css";
import Loading from "../../../../components/Loading/Loading";

function isAccountEntity(value, expectedId) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.id != null &&
      (expectedId == null || String(value.id) === String(expectedId)),
  );
}

export default function Accounts() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState(null);
  const archiveRequestsRef = useRef(new Map());
  const saveRequestRef = useRef(null);

  const requestAccounts = useCallback(async (signal) => {
    try {
      const response = await accountsApi.list({}, { signal });

      if (signal?.aborted) return false;

      setAccounts(response.data?.accounts ?? []);
      setError("");
      return true;
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(getApiErrorMessage(requestError, t));
      }

      return false;
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [t]);

  const reloadAccounts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    return requestAccounts();
  }, [requestAccounts]);

  useEffect(() => {
    const controller = new AbortController();
    void requestAccounts(controller.signal);
    return () => controller.abort();
  }, [requestAccounts]);

  const filteredAccounts = useMemo(
    () =>
      activeFilter === "all"
        ? accounts
        : accounts.filter((account) => account.type === activeFilter),
    [accounts, activeFilter],
  );

  const handleArchive = async (account) => {
    const pendingRequest = archiveRequestsRef.current.get(account.id);
    if (pendingRequest) return pendingRequest;

    const confirmed = window.confirm(
      t("dashboard.accounts.confirmArchive", { name: account.name }),
    );
    if (!confirmed) return;

    const archiveRequest = (async () => {
      try {
        await accountsApi.archive(account.id);
        setAccounts((current) => current.filter((item) => item.id !== account.id));
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, t));
      } finally {
        archiveRequestsRef.current.delete(account.id);
      }
    })();

    archiveRequestsRef.current.set(account.id, archiveRequest);
    return archiveRequest;
  };

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const accountBeingEdited = formState?.account;
    const saveRequest = (async () => {
      if (accountBeingEdited) {
        const response = await accountsApi.update(accountBeingEdited.id, values);
        const updatedAccount = response?.data?.account;

        if (isAccountEntity(updatedAccount, accountBeingEdited.id)) {
          setAccounts((current) =>
            current.map((account) =>
              account.id === updatedAccount.id ? updatedAccount : account,
            ),
          );
        } else {
          await reloadAccounts();
        }
      } else {
        const workspaceId = await resolveWorkspaceId();
        const response = await accountsApi.create({
          ...values,
          workspace_id: workspaceId,
        });
        const createdAccount = response?.data?.account;

        if (isAccountEntity(createdAccount)) {
          setAccounts((current) => [...current, createdAccount]);
        } else {
          await reloadAccounts();
        }
      }

      setFormState(null);
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      if (saveRequestRef.current === saveRequest) {
        saveRequestRef.current = null;
      }
    }
  };

  return (
    <div className="accounts-page">
      <AccountsHeader onAdd={() => setFormState({ account: null })} />

      <AccountFilters
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />

        {isLoading && (
          <Loading message={false} />
        )}
      <section className="accounts-page__grid">

        {!isLoading && error && (
          <div className="accounts-page__state accounts-page__state--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={reloadAccounts}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !error && filteredAccounts.length === 0 && (
          <p className="accounts-page__state">{t("dashboard.accounts.states.empty")}</p>
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
