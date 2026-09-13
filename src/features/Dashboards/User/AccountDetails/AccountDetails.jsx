import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LuArchive, LuArrowLeft, LuPencil } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH } from "../../../../routes/Path";
import { accountsApi } from "../api/accountsApi";
import { ApiError } from "../api/apiClient";
import AccountForm from "../Accounts/components/AccountForm/AccountForm";
import ArchiveAccountDialog from "../Accounts/components/ArchiveAccountDialog/ArchiveAccountDialog";
import {
  getAccountColor,
  getAccountErrorMessage,
  renderAccountIcon,
  getDisplayLocale,
  isNegativeMoney,
} from "../Accounts/accountHelpers";
import { formatDate, formatMoney } from "../utils/formatters";

import "./AccountDetails.css";

export default function AccountDetails() {
  const { accountId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request, the page is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${accountId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, account: null, error: null });
  const [isEditing, setIsEditing] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const saveRequestRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    accountsApi
      .get(accountId, { signal: controller.signal })
      .then((response) => {
        const account = response.data?.account;

        setResult(
          account
            ? { key: requestKey, account, error: null }
            : {
                key: requestKey,
                account: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, account: null, error });
      });

    return () => controller.abort();
  }, [accountId, requestKey]);

  const isLoading = result.key !== requestKey;
  const { account, error } = isLoading ? { account: null, error: null } : result;

  // Once the account is gone for this user (404), show the not-available state.
  const markUnavailable = (requestError) => {
    if (requestError?.code === "NOT_FOUND") {
      setIsEditing(false);
      setIsArchiveOpen(false);
      setResult({ key: requestKey, account: null, error: requestError });
    }
  };

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const saveRequest = (async () => {
      let response;

      try {
        response = await accountsApi.update(account.id, values);
      } catch (requestError) {
        markUnavailable(requestError);
        throw requestError;
      }

      const updatedAccount = response.data?.account;

      if (updatedAccount) {
        setResult((current) => ({ ...current, account: updatedAccount }));
      } else {
        setReloadKey((key) => key + 1);
      }
      setIsEditing(false);
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      saveRequestRef.current = null;
    }
  };

  const handleArchive = async () => {
    try {
      await accountsApi.archive(account.id);
    } catch (requestError) {
      markUnavailable(requestError);
      throw requestError;
    }

    // It is no longer an active account: back to the list, which refetches.
    navigate(PATH.USER.ACCOUNTS, {
      state: { archivedAccountName: account.name },
    });
  };

  const backLink = (
    <Link className="account-details__back" to={PATH.USER.ACCOUNTS}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.accounts.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="account-details">
        {backLink}
        <Loading message={false} />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.code === "NOT_FOUND";

    return (
      <div className="account-details">
        {backLink}

        <div className="account-details__state" role="alert">
          <h1>
            {t(
              isNotFound
                ? "dashboard.accounts.details.notFoundTitle"
                : "dashboard.accounts.details.errorTitle",
            )}
          </h1>
          <p>{getAccountErrorMessage(error, t)}</p>

          {!isNotFound && (
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const color = getAccountColor(account);
  const isActive = account.status === "active";
  const money = (value) => formatMoney(value, account.currency_code, locale);
  const date = (value) => formatDate(value, locale, timeZone);

  const rows = [
    ["type", t(`dashboard.accounts.types.${account.type}`, { defaultValue: account.type })],
    ["currency", <bdi key="currency">{account.currency_code}</bdi>],
    ["currentBalance", <bdi key="current" dir="ltr">{money(account.current_balance)}</bdi>],
    ["openingBalance", <bdi key="opening" dir="ltr">{money(account.opening_balance)}</bdi>],
    [
      "negativeBalance",
      t(
        account.allow_negative_balance
          ? "dashboard.accounts.details.allowed"
          : "dashboard.accounts.details.notAllowed",
      ),
    ],
    account.low_balance_threshold != null && [
      "lowBalanceThreshold",
      <bdi key="threshold" dir="ltr">{money(account.low_balance_threshold)}</bdi>,
    ],
    account.last_four_digits && [
      "lastFour",
      <bdi key="last-four" dir="ltr">•••• {account.last_four_digits}</bdi>,
    ],
    color && [
      "color",
      <span className="account-details__swatch" key="color">
        <span style={{ background: color }} aria-hidden="true" />
        <bdi>{color}</bdi>
      </span>,
    ],
    [
      "status",
      t(`dashboard.accounts.status.${account.status}`, {
        defaultValue: account.status,
      }),
    ],
    account.created_at && ["createdAt", date(account.created_at)],
    account.updated_at && ["updatedAt", date(account.updated_at)],
    account.archived_at && ["archivedAt", date(account.archived_at)],
  ].filter(Boolean);

  return (
    <div className="account-details">
      {backLink}

      <header
        className={`account-details__header${color ? " account-details__header--colored" : ""}`}
        style={color ? { "--account-color": color } : undefined}
      >
        <span className="account-details__icon" aria-hidden="true">
          {renderAccountIcon(account)}
        </span>

        <div className="account-details__identity">
          <h1>{account.name}</h1>

          <div className="account-details__chips">
            <span className="account-details__chip">
              {t(`dashboard.accounts.types.${account.type}`, {
                defaultValue: account.type,
              })}
            </span>
            <span
              className={`account-details__chip account-details__chip--${isActive ? "active" : "archived"}`}
            >
              {t(`dashboard.accounts.status.${account.status}`, {
                defaultValue: account.status,
              })}
            </span>
            {account.is_default && (
              <span className="account-details__chip">
                {t("dashboard.accounts.details.default")}
              </span>
            )}
            {account.is_hidden && (
              <span className="account-details__chip">
                {t("dashboard.accounts.details.hidden")}
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div className="account-details__actions">
            <button
              type="button"
              className="account-details__action"
              onClick={() => setIsEditing(true)}
            >
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.accounts.edit")}</span>
            </button>
            <button
              type="button"
              className="account-details__action account-details__action--archive"
              onClick={() => setIsArchiveOpen(true)}
            >
              <LuArchive aria-hidden="true" />
              <span>{t("dashboard.accounts.archive")}</span>
            </button>
          </div>
        )}
      </header>

      {!isActive && (
        <p className="account-details__note" role="note">
          {t("dashboard.accounts.details.archivedNote")}
        </p>
      )}

      <section className="account-details__balance">
        <span>{t("dashboard.accounts.details.currentBalance")}</span>
        <strong
          className={
            isNegativeMoney(account.current_balance)
              ? "account-details__amount account-details__amount--negative"
              : "account-details__amount"
          }
          dir="ltr"
        >
          {money(account.current_balance)}
        </strong>
        <small>
          {t("dashboard.accounts.details.openingBalance")}:{" "}
          <bdi dir="ltr">{money(account.opening_balance)}</bdi>
        </small>
      </section>

      <section className="account-details__panel" aria-labelledby="account-details-title">
        <h2 id="account-details-title">{t("dashboard.accounts.details.title")}</h2>

        <dl className="account-details__list">
          {rows.map(([key, value]) => (
            <div className="account-details__row" key={key}>
              <dt>{t(`dashboard.accounts.details.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isEditing && (
        <AccountForm
          account={account}
          onSave={handleSave}
          onClose={() => setIsEditing(false)}
        />
      )}

      {isArchiveOpen && (
        <ArchiveAccountDialog
          account={account}
          onConfirm={handleArchive}
          onClose={() => setIsArchiveOpen(false)}
        />
      )}
    </div>
  );
}
