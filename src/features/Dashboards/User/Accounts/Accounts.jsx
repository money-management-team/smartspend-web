import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LuArchive, LuLayers3, LuSearch, LuWallet, LuX } from "react-icons/lu";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "archived" ? "archived" : "active";
  const [accounts, setAccounts] = useState([]);
  const [loadedView, setLoadedView] = useState(null);
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
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  // Bumped to refetch the list (retry, or after a mutation left it unsure).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    accountsApi
      .list({ ...getListQuery(), status: view }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setAccounts(response.data?.accounts ?? []);
        setLoadedView(view);
        setError("");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError" || controller.signal.aborted) return;
        setLoadedView(view);
        setAccounts([]);
        setError(getApiErrorMessage(requestError, t));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey, t, view]);

  const reloadAccounts = () => {
    setIsLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  const listLoading = isLoading || loadedView !== view;
  const visibleAccounts = loadedView === view ? accounts : [];
  const filteredAccounts = activeFilter === "all"
    ? visibleAccounts : visibleAccounts.filter((account) => account.type === activeFilter);

  const selectView = (next) => {
    if (next === view) return;
    setActiveFilter("all");
    setIsLoading(true);
    setSearchParams(next === "archived" ? { view: "archived" } : {});
  };

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
    selectView("archived");
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
          if (view === "active") setAccounts((current) => [...current, createdAccount]);
          else selectView("active");
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

      <div className="accounts-page__overview" aria-label={t("dashboard.accounts.overviewLabel")}>
        <div className="accounts-page__overview-mark"><LuWallet aria-hidden="true" /></div>
        <div><span>{t("dashboard.accounts.overviewLabel")}</span><strong>{listLoading ? "—" : visibleAccounts.length}</strong>
          <small>{t(view === "archived" ? "dashboard.accounts.archivedDescription" : "dashboard.accounts.activeDescription")}</small></div>
        <LuLayers3 className="accounts-page__overview-art" aria-hidden="true" />
      </div>

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

      <nav className="accounts-page__views" aria-label={t("dashboard.accounts.viewsLabel")}>
        <button type="button" aria-current={view === "active" ? "page" : undefined} onClick={() => selectView("active")}
          className={view === "active" ? "is-selected" : ""}><LuWallet aria-hidden="true" />{t("dashboard.accounts.activeView")}</button>
        <button type="button" aria-current={view === "archived" ? "page" : undefined} onClick={() => selectView("archived")}
          className={view === "archived" ? "is-selected" : ""}><LuArchive aria-hidden="true" />{t("dashboard.accounts.archivedView")}</button>
      </nav>
      {view === "archived" && <p className="accounts-page__archive-hint">{t("dashboard.accounts.archivedDescription")}</p>}

      <AccountFilters
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />

        {listLoading && (
          <Loading message={false} />
        )}
      <section className="accounts-page__grid">

        {!listLoading && error && (
          <div className="accounts-page__state accounts-page__state--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={reloadAccounts}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!listLoading && !error && visibleAccounts.length === 0 && (
          <div className="accounts-page__state">
            <LuSearch aria-hidden="true" />
            <p>{t(view === "archived" ? "dashboard.accounts.states.emptyArchived" : "dashboard.accounts.states.emptyAll")}</p>
            {view === "active" && <button type="button" onClick={openCreateForm}>{t("dashboard.accounts.add")}</button>}
          </div>
        )}

        {!listLoading && !error && visibleAccounts.length > 0 && filteredAccounts.length === 0 && (
          <p className="accounts-page__state">{t("dashboard.accounts.states.empty")}</p>
        )}

        {!listLoading && !error && filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onEdit={() => setFormState({ account })}
            onArchive={() => setArchiveTarget(account)}
            isArchiving={archiveTarget?.id === account.id}
            isArchived={view === "archived"}
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
