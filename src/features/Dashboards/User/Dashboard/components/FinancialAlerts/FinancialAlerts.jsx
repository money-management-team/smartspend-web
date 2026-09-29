import { createElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCircleAlert, LuInfo, LuRefreshCw, LuTriangleAlert } from "react-icons/lu";

import { getBudgetDetailsPath, getFinancialAlertsPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { ApiError, getApiErrorMessage } from "../../../api/apiClient";
import { financialAlertsApi } from "../../../api/financialAlertsApi";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatDateTime } from "../../../utils/formatters";
import SectionCard from "../shared/SectionCard";

import "./FinancialAlerts.css";

const SEVERITY_ICONS = {
  critical: LuCircleAlert,
  warning: LuTriangleAlert,
  info: LuInfo,
};
// Budget progress statuses counted by `summary.by_status`, in display order.
const SUMMARY_STATUSES = ["exceeded", "near_limit", "warning", "safe"];
const COMPACT_LIMIT = 3;

const getSeverity = (alert) =>
  Object.hasOwn(SEVERITY_ICONS, alert?.severity) ? alert.severity : "info";

const toCount = (value) => {
  const number = Number(value);
  return value != null && value !== "" && Number.isFinite(number) ? number : null;
};

/*
 * GET /financial-alerts: alerts the backend calculates from the current
 * budgets when asked. They are not stored notifications, so there is nothing
 * to mark as read or dismiss; the list is simply fetched again.
 *
 * `workspaceId` is sent as `id_workspace` (this endpoint's name for it).
 * "compact" (dashboard) shows the first alerts and links to the full list;
 * "full" (Notifications page, Financial alerts tab) shows every alert.
 */
export default function FinancialAlerts({ workspaceId, variant = "compact" }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const isCompact = variant === "compact";

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${workspaceId ?? ""}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    financialAlertsApi
      .list({ id_workspace: workspaceId ?? undefined }, { signal: controller.signal })
      .then((response) => {
        const data = response?.data;
        setResult(
          data && Array.isArray(data.alerts)
            ? { key: requestKey, data, error: null }
            : {
                key: requestKey,
                data: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, data: null, error });
      });

    return () => controller.abort();
  }, [workspaceId, requestKey]);

  const isLoading = result.key !== requestKey;
  const { data, error } = isLoading ? { data: null, error: null } : result;
  const alerts = data?.alerts ?? [];
  const visibleAlerts = isCompact ? alerts.slice(0, COMPACT_LIMIT) : alerts;
  const summary = data?.summary ?? null;
  const reload = () => setReloadKey((key) => key + 1);

  const summaryCounts = [
    ["active_budgets", toCount(summary?.active_budgets)],
    ...SUMMARY_STATUSES.map((status) => [status, toCount(summary?.by_status?.[status])]),
    ["ended", toCount(summary?.ended)],
    ["without_expenses", toCount(summary?.without_expenses)],
  ].filter(([, count]) => count != null);

  return (
    <SectionCard
      className={`financial-alerts financial-alerts--${isCompact ? "compact" : "full"}`}
      title={t("dashboard.financialAlerts.title")}
      subtitle={t("dashboard.financialAlerts.subtitle")}
      action={
        isCompact ? (
          <Link to={getFinancialAlertsPath()} className="dashboard-section-link">
            {t("dashboard.user.common.viewAll")}
          </Link>
        ) : (
          <button
            type="button"
            className="financial-alerts__refresh"
            onClick={reload}
            disabled={isLoading}
          >
            <LuRefreshCw aria-hidden="true" />
            <span>{t("dashboard.financialAlerts.refresh")}</span>
          </button>
        )
      }
    >
      <div className="financial-alerts__body" aria-busy={isLoading}>
        {isLoading && (
          <p className="financial-alerts__state" role="status">
            {t("dashboard.financialAlerts.states.loading")}
          </p>
        )}

        {!isLoading && error && (
          <div className="financial-alerts__state financial-alerts__state--error" role="alert">
            <p>{getApiErrorMessage(error, t)}</p>
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {summaryCounts.length > 0 && (
              <ul className="financial-alerts__summary" aria-label={t("dashboard.financialAlerts.summary.label")}>
                {summaryCounts.map(([key, count]) => (
                  <li key={key} className={`financial-alerts__count financial-alerts__count--${key}`}>
                    <strong>
                      <bdi>{count.toLocaleString(locale)}</bdi>
                    </strong>
                    <span>{t(`dashboard.financialAlerts.summary.${key}`)}</span>
                  </li>
                ))}
              </ul>
            )}

            {alerts.length === 0 ? (
              <p className="financial-alerts__state">{t("dashboard.financialAlerts.states.empty")}</p>
            ) : (
              <ul className="financial-alerts__list">
                {visibleAlerts.map((alert, index) => {
                  const severity = getSeverity(alert);

                  return (
                    <li
                      key={`${alert.type ?? "alert"}-${alert.budget_id ?? ""}-${index}`}
                      className={`financial-alert financial-alert--${severity}`}
                    >
                      <span className="financial-alert__icon" aria-hidden="true">
                        {createElement(SEVERITY_ICONS[severity])}
                      </span>

                      <div className="financial-alert__copy">
                        <div className="financial-alert__heading">
                          <span className={`financial-alert__badge financial-alert__badge--${severity}`}>
                            {translateEnum(t, i18n, "dashboard.financialAlerts.severities", alert.severity) ||
                              t("dashboard.financialAlerts.severities.info")}
                          </span>
                          {alert.type && (
                            <strong>{translateEnum(t, i18n, "dashboard.financialAlerts.types", alert.type)}</strong>
                          )}
                        </div>

                        {alert.message && <p dir="auto">{alert.message}</p>}

                        {alert.budget_id != null && (
                          <Link to={getBudgetDetailsPath(alert.budget_id)} className="financial-alert__link">
                            {t("dashboard.financialAlerts.viewBudget")}
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {isCompact && alerts.length > visibleAlerts.length && (
              <p className="financial-alerts__more">
                <Link to={getFinancialAlertsPath()}>
                  {t("dashboard.financialAlerts.more", { count: alerts.length - visibleAlerts.length })}
                </Link>
              </p>
            )}

            {data?.generated_at && (
              <p className="financial-alerts__generated">
                {t("dashboard.financialAlerts.generatedAt", {
                  date: formatDateTime(data.generated_at, locale),
                })}
              </p>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
