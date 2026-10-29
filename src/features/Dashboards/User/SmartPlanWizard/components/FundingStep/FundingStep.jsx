import { createElement } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowDown,
  LuArrowUp,
  LuHandCoins,
  LuInfo,
  LuLandmark,
  LuListOrdered,
  LuPercent,
  LuTrash2,
  LuTriangleAlert,
} from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import PrivateMoney from "../../../Experience/PrivateMoney";
import { useExperience } from "../../../Experience/useExperience";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatMoney } from "../../../utils/formatters";
import { FUNDING_MODES, MAX_SOURCES, TOTAL_BPS, bpsToPercent, totalAllocationBps } from "../../smartPlanWizardHelpers";

import "./FundingStep.css";

const MODE_ICONS = {
  single: LuLandmark,
  priority: LuListOrdered,
  allocated: LuPercent,
  at_confirmation: LuHandCoins,
};

/*
 * Stage 3: where installments will come from. The modes and their shape
 * rules are the backend's (one account; two to five in priority order; two
 * to five with shares totalling 100 %; or chosen at each confirmation).
 * Choosing accounts here moves nothing: money only moves when the user
 * confirms an installment. Eligibility (active, same currency, not a goal's
 * account) is re-checked by the backend on acceptance and at every
 * confirmation.
 *
 * `funding` is { mode, sources: [{ account_id, percent }] } in priority
 * order; `accounts` is { loading, error, list } of eligible accounts.
 */
export default function FundingStep({ funding, accounts, currency, error, onChange, onRetry }) {
  const { t, i18n } = useTranslation();
  const experience = useExperience();
  const locale = getDisplayLocale(i18n.language);
  const prefix = "dashboard.savingsGoals.smartPlanWizard.funding";
  const { mode, sources } = funding;
  const list = accounts.list ?? [];
  const byId = new Map(list.map((account) => [String(account.id), account]));
  const chosen = new Set(sources.map((source) => String(source.account_id)));
  const available = list.filter((account) => !chosen.has(String(account.id)));
  const isMulti = mode === "priority" || mode === "allocated";

  const setMode = (next) =>
    onChange({
      mode: next,
      // Keep the accounts already chosen where the new mode can use them.
      sources: next === "at_confirmation" ? [] : next === "single" ? sources.slice(0, 1) : sources,
    });
  const setSources = (next) => onChange({ mode, sources: next });
  const move = (index, step) => {
    const next = [...sources];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setSources(next);
  };
  // The account's current balance from GET /accounts, as a guide for choosing; it is checked again at every confirmation.
  const hasBalance = (account) => typeof account?.current_balance === "string" && account.current_balance !== "";
  const accountLabel = (account) => (
    <>
      <span className="funding-step__account-name" dir="auto">
        {account?.name ?? "—"}
      </span>
      {hasBalance(account) ? (
        <span className="funding-step__account-balance">
          {t(`${prefix}.available`)}{" "}
          <bdi dir="ltr">
            <PrivateMoney>{formatMoney(account.current_balance, currency, locale)}</PrivateMoney>
          </bdi>
        </span>
      ) : (
        account?.type && (
          <span className="funding-step__account-type">{translateEnum(t, i18n, "dashboard.accounts.types", account.type)}</span>
        )
      )}
    </>
  );
  const optionLabel = (account) =>
    hasBalance(account)
      ? `${account.name} · ${experience?.preferences.hiddenMoney ? "••••" : formatMoney(account.current_balance, currency, locale)}`
      : account.name;

  const total = mode === "allocated" ? totalAllocationBps(sources) : null;

  return (
    <div className="funding-step">
      <fieldset className="funding-step__modes">
        <legend>{t(`${prefix}.modeTitle`)}</legend>
        {FUNDING_MODES.map((option) => (
          <label key={option} className={`funding-step__mode${mode === option ? " funding-step__mode--checked" : ""}`}>
            <input type="radio" name="smart-wizard-funding-mode" value={option} checked={mode === option} onChange={() => setMode(option)} />
            <span className="funding-step__mode-icon" aria-hidden="true">
              {createElement(MODE_ICONS[option])}
            </span>
            <span className="funding-step__mode-copy">
              <strong>{t(`dashboard.savingsGoals.smartPlan.funding.modes.${option}`)}</strong>
              <span>{t(`${prefix}.modes.${option}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "at_confirmation" ? (
        <div className="funding-step__callout" role="note">
          <LuInfo aria-hidden="true" />
          <p>{t(`${prefix}.atConfirmation`, { currency })}</p>
        </div>
      ) : accounts.loading ? (
        <p className="funding-step__state" role="status">
          {t(`${prefix}.loadingAccounts`)}
        </p>
      ) : accounts.error ? (
        <div className="funding-step__state" role="alert">
          <p>{t(`${prefix}.accountsError`)}</p>
          <button type="button" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="funding-step__callout funding-step__callout--warning" role="note">
          <LuTriangleAlert aria-hidden="true" />
          <p>{t(`${prefix}.noAccounts`, { currency })}</p>
        </div>
      ) : mode === "single" ? (
        <fieldset className="funding-step__accounts">
          <legend>{t(`${prefix}.chooseOne`)}</legend>
          {list.map((account) => {
            const checked = chosen.has(String(account.id));
            return (
              <label key={account.id} className={`funding-step__account${checked ? " funding-step__account--checked" : ""}`}>
                <input
                  type="radio"
                  name="smart-wizard-funding-account"
                  value={account.id}
                  checked={checked}
                  onChange={() => setSources([{ account_id: account.id, percent: "" }])}
                />
                {accountLabel(account)}
              </label>
            );
          })}
        </fieldset>
      ) : (
        <section className="funding-step__accounts" aria-labelledby="funding-step-list-title">
          <h3 id="funding-step-list-title">{t(`${prefix}.${mode}Title`)}</h3>
          <p className="funding-step__hint">{t(`${prefix}.${mode}Hint`, { max: MAX_SOURCES })}</p>

          {sources.length > 0 && (
            <ol className="funding-step__chosen">
              {sources.map((source, index) => {
                const account = byId.get(String(source.account_id));
                const label = account?.name ?? `#${source.account_id}`;

                return (
                  <li key={source.account_id} className="funding-step__row">
                    <span className="funding-step__order" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="funding-step__row-name">{accountLabel(account)}</span>

                    {mode === "allocated" && (
                      <label className="funding-step__percent">
                        <span className="funding-step__sr-only">{t(`${prefix}.shareOf`, { name: label })}</span>
                        <input
                          inputMode="decimal"
                          dir="ltr"
                          value={source.percent}
                          placeholder="0"
                          onChange={(event) =>
                            setSources(sources.map((item, i) => (i === index ? { ...item, percent: event.target.value } : item)))
                          }
                        />
                        <span aria-hidden="true">%</span>
                      </label>
                    )}

                    <span className="funding-step__row-actions">
                      {mode === "priority" && (
                        <>
                          <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t(`${prefix}.moveUp`, { name: label })}>
                            <LuArrowUp aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(index, 1)}
                            disabled={index === sources.length - 1}
                            aria-label={t(`${prefix}.moveDown`, { name: label })}
                          >
                            <LuArrowDown aria-hidden="true" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setSources(sources.filter((_, i) => i !== index))}
                        aria-label={t(`${prefix}.remove`, { name: label })}
                      >
                        <LuTrash2 aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {isMulti && sources.length < MAX_SOURCES && available.length > 0 && (
            <label className="funding-step__add">
              <span>{t(`${prefix}.addAccount`)}</span>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) setSources([...sources, { account_id: Number(event.target.value), percent: "" }]);
                }}
              >
                <option value="">{t(`${prefix}.addPlaceholder`)}</option>
                {available.map((account) => (
                  <option key={account.id} value={account.id}>
                    {optionLabel(account)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === "allocated" && sources.length > 0 && (
            <p className={`funding-step__total${total === TOTAL_BPS ? " funding-step__total--ok" : ""}`} aria-live="polite">
              {t(`${prefix}.total`)} <bdi dir="ltr">{total === null ? "—" : `${bpsToPercent(total)}%`}</bdi>
              <span> / 100%</span>
            </p>
          )}
        </section>
      )}

      {error && (
        <p className="funding-step__error" role="alert">
          {t(`dashboard.savingsGoals.smartPlanWizard.validation.${error}`, { max: MAX_SOURCES })}
        </p>
      )}

      {mode === "allocated" && (
        <div className="funding-step__callout funding-step__callout--warning" role="note">
          <LuInfo aria-hidden="true" />
          <p>{t(`${prefix}.allocatedNotice`)}</p>
        </div>
      )}

      <p className="funding-step__footnote">{t(`${prefix}.noMoney`)}</p>
    </div>
  );
}
