import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { accountsApi } from "../../../api/accountsApi.js";
import { whatsappApi } from "../../../api/whatsappApi.js";
import {
  classifyWhatsAppError,
  parseIntegrationResponse,
} from "../../../FinancialOperations/whatsappContract.js";
import {
  WHATSAPP_PREFERENCE_LANGUAGES,
  getWhatsAppErrorMessage,
  isEligibleDefaultAccount,
} from "./whatsappLinking.js";

const x = "dashboard.settings.whatsapp.prefs";

/*
 * Language and default account of a linked number. Only fields the user
 * changed are sent. Accounts come from the existing accounts API for the
 * link's own workspace; the list is filtered to what the backend accepts,
 * and the backend stays the judge (a 422 is shown, and the list reloads).
 * No balances are read or shown.
 */
export default function WhatsAppPreferences({
  integration,
  api = whatsappApi,
  accounts: accountsClient = accountsApi,
  onSaved,
  onDisabled,
}) {
  const { t } = useTranslation();
  const id = useId();
  const [language, setLanguage] = useState(integration.language ?? "");
  const [accountId, setAccountId] = useState(
    integration.default_account_id == null ? "" : String(integration.default_account_id),
  );
  const [accountsReload, setAccountsReload] = useState(0);
  const [accountsResult, setAccountsResult] = useState({ key: null, items: [], failed: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState(null);
  const savingRef = useRef(false);

  const workspaceId = integration.workspace_id;

  useEffect(() => {
    const controller = new AbortController();

    accountsClient
      .list({ id_workspace: workspaceId }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(response?.data?.accounts) ? response.data.accounts : [];
        setAccountsResult({
          key: accountsReload,
          items: list.filter((account) => isEligibleDefaultAccount(account, workspaceId)),
          failed: false,
        });
      })
      .catch((failure) => {
        if (failure?.name === "AbortError" || controller.signal.aborted) return;
        setAccountsResult({ key: accountsReload, items: [], failed: true });
      });

    return () => controller.abort();
  }, [accountsClient, accountsReload, workspaceId]);

  const accountsLoading = accountsResult.key !== accountsReload;
  const savedLanguage = integration.language ?? "";
  const savedAccount = integration.default_account_id == null ? "" : String(integration.default_account_id);
  const dirty = language !== savedLanguage || accountId !== savedAccount;

  // A saved default that is no longer eligible stays visible, labelled as such.
  const knownIds = new Set(accountsResult.items.map((account) => String(account.id)));
  const showStale = !accountsLoading && savedAccount !== "" && !knownIds.has(savedAccount);

  async function save(event) {
    event.preventDefault();
    if (savingRef.current || !dirty) return;
    savingRef.current = true;
    setBusy(true);
    setNotice(false);
    setError(null);

    const values = {};
    if (language !== savedLanguage) values.language = language;
    if (accountId !== savedAccount) values.default_account_id = accountId === "" ? null : Number(accountId);

    try {
      const updated = parseIntegrationResponse(await api.updatePreferences(values));
      setLanguage(updated.language ?? "");
      setAccountId(updated.default_account_id == null ? "" : String(updated.default_account_id));
      setNotice(true);
      onSaved?.(updated);
    } catch (failure) {
      if (failure?.name === "AbortError") return;
      const kind = classifyWhatsAppError(failure);
      if (kind === "disabled") onDisabled?.();
      if (failure?.errors?.default_account_id) setAccountsReload((key) => key + 1);
      setError(getWhatsAppErrorMessage(failure, t, "preferences"));
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  const languageValid = WHATSAPP_PREFERENCE_LANGUAGES.includes(language);

  return (
    <form className="wa-panel wa-prefs" onSubmit={save} aria-busy={busy}>
      <h3>{t(`${x}.title`)}</h3>

      <fieldset className="wa-field" disabled={busy}>
        <legend>{t(`${x}.language`)}</legend>
        <div className="wa-segmented" role="radiogroup" aria-label={t(`${x}.language`)}>
          {WHATSAPP_PREFERENCE_LANGUAGES.map((value) => (
            <label key={value} className={`wa-segmented__option${language === value ? " wa-segmented__option--on" : ""}`}>
              <input
                type="radio"
                name={`${id}-language`}
                value={value}
                checked={language === value}
                onChange={() => { setLanguage(value); setNotice(false); }}
              />
              <span lang={value}>{t(`${x}.languages.${value}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="wa-field">
        <label htmlFor={`${id}-account`}>{t(`${x}.account`)}</label>
        <select
          id={`${id}-account`}
          value={accountId}
          onChange={(event) => { setAccountId(event.target.value); setNotice(false); }}
          disabled={busy || accountsLoading}
          aria-describedby={`${id}-account-hint`}
        >
          <option value="">{accountsLoading ? t(`${x}.loadingAccounts`) : t(`${x}.noDefault`)}</option>
          {showStale && <option value={savedAccount}>{t(`${x}.unavailableAccount`)}</option>}
          {accountsResult.items.map((account) => (
            <option key={account.id} value={String(account.id)}>
              {account.name} · {account.currency_code}
            </option>
          ))}
        </select>
        <p className="wa-hint" id={`${id}-account-hint`}>
          {accountsResult.failed && !accountsLoading ? t(`${x}.accountsFailed`) : t(`${x}.accountHint`)}
        </p>
      </div>

      <div className="wa-actions">
        <button
          type="submit"
          className="wa-button wa-button--primary"
          disabled={busy || !dirty || !languageValid}
        >
          {busy ? t(`${x}.saving`) : t(`${x}.save`)}
        </button>
      </div>

      <p className="wa-feedback" role="status">{notice ? t(`${x}.saved`) : ""}</p>
      {error && <p className="wa-error" role="alert">{error}</p>}
    </form>
  );
}
