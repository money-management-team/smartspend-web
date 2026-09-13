import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { LuX } from "react-icons/lu";

import AccountsHeader from "./components/AccountsHeader/AccountsHeader";
import AccountFilters from "./components/AccountFilters/AccountFilters";
import AccountCard from "./components/AccountCard/AccountCard";
import AccountForm from "./components/AccountForm/AccountForm";
import ArchiveAccountDialog from "./components/ArchiveAccountDialog/ArchiveAccountDialog";
import { accountsApi } from "../api/accountsApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { getApiErrorMessage, getStoredWorkspace } from "../api/apiClient";

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

// The session workspace (the one new accounts are created in); omitted when
// unknown, in which case the backend lists every workspace the user can access.
const getListQuery = () => ({ id_workspace: getStoredWorkspace()?.id });

export default function Accounts() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  // Name of the account just archived, for the success notice (translated at
  // render). The details page passes it in when it archives and comes back.
  const [archivedName, setArchivedName] = useState(
    () => location.state?.archivedAccountName ?? "",
  );
  const saveRequestRef = useRef(null);

  // Drop the one-time notice from history so a reload doesn't show it again.
  useEffect(() => {
    if (location.state?.archivedAccountName) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  // Bumped to refetch the list (retry, or after a mutation left it unsure).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    accountsApi
      .list(getListQuery(), { signal: controller.signal })
      .then((response) => {
        setAccounts(response.data?.accounts ?? []);
        setError("");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError" || controller.signal.aborted) return;
        setError(getApiErrorMessage(requestError, t));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey, t]);

  const reloadAccounts = () => {
    setIsLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  const filteredAccounts = useMemo(
    () =>
      activeFilter === "all"
        ? accounts
        : accounts.filter((account) => account.type === activeFilter),
    [accounts, activeFilter],
  );

  // Called by ArchiveAccountDialog; errors are shown inside the dialog.
  const handleArchive = async () => {
    const account = archiveTarget;

    try {
      await accountsApi.archive(account.id);
    } catch (requestError) {
      // Already gone from this user's view: drop the stale card.
      if (requestError?.code === "NOT_FOUND") reloadAccounts();
      throw requestError;
    }

    // Only active accounts are listed, so the archived one leaves the list.
    setAccounts((current) => current.filter((item) => item.id !== account.id));
    setArchiveTarget(null);
    setArchivedName(account.name);
  };

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const accountBeingEdited = formState?.account;
    const saveRequest = (async () => {
      if (accountBeingEdited) {
        let response;

        try {
          response = await accountsApi.update(accountBeingEdited.id, values);
        } catch (requestError) {
          if (requestError?.code === "NOT_FOUND") reloadAccounts();
          throw requestError;
        }

        const updatedAccount = response?.data?.account;

        if (isAccountEntity(updatedAccount, accountBeingEdited.id)) {
          setAccounts((current) =>
            current.map((account) =>
              account.id === updatedAccount.id ? updatedAccount : account,
            ),
          );
        } else {
          reloadAccounts();
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
          reloadAccounts();
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

  const openCreateForm = () => setFormState({ account: null });

  return (
    <div className="accounts-page">
      <AccountsHeader onAdd={openCreateForm} />

      {archivedName && (
        <div className="accounts-page__notice" role="status">
          <p>{t("dashboard.accounts.archiveSuccess", { name: archivedName })}</p>
          <button
            type="button"
            onClick={() => setArchivedName("")}
            aria-label={t("common.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

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

        {!isLoading && !error && accounts.length === 0 && (
          <div className="accounts-page__state">
            <p>{t("dashboard.accounts.states.emptyAll")}</p>
            <button type="button" onClick={openCreateForm}>
              {t("dashboard.accounts.add")}
            </button>
          </div>
        )}

        {!isLoading && !error && accounts.length > 0 && filteredAccounts.length === 0 && (
          <p className="accounts-page__state">{t("dashboard.accounts.states.empty")}</p>
        )}

        {!isLoading && !error && filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onEdit={() => setFormState({ account })}
            onArchive={() => setArchiveTarget(account)}
            isArchiving={archiveTarget?.id === account.id}
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

      {archiveTarget && (
        <ArchiveAccountDialog
          account={archiveTarget}
          onConfirm={handleArchive}
          onClose={() => setArchiveTarget(null)}
        />
      )}
    </div>
  );
}
