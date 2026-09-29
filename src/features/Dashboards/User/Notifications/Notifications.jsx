import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { useUnreadNotifications } from "../../../../contexts/notifications/useUnreadNotifications";
import FinancialAlerts from "../Dashboard/components/FinancialAlerts/FinancialAlerts";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import NotificationInbox from "./components/NotificationInbox/NotificationInbox";
import NotificationsHeader from "./components/NotificationsHeader/NotificationsHeader";
import { formatUnreadBadge, NOTIFICATION_TABS } from "./notificationHelpers";

import "./Notifications.css";

/*
 * Two separate features on one page, each with its own API and data model:
 * - "Notifications" (default): the user's persistent inbox (GET
 *   /notifications) with read state, mark-as-read and mark-all-as-read.
 * - "Financial alerts" (`?tab=alerts`): alerts calculated from the current
 *   budgets on each request (GET /financial-alerts); nothing is stored and
 *   there is no read state.
 */
export default function Notifications() {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const { workspace } = useAuthContext();
  const { count: unreadCount } = useUnreadNotifications();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = NOTIFICATION_TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "inbox";

  // Each tab keeps only its own URL state.
  const selectTab = (nextTab) => {
    if (nextTab === tab) return;
    setSearchParams(nextTab === "inbox" ? new URLSearchParams() : new URLSearchParams({ tab: nextTab }));
  };

  return (
    <div className="notifications-page">
      <NotificationsHeader />

      <div className="notifications-page__tabs" role="tablist" aria-label={t("dashboard.notifications.tabs.label")}>
        {NOTIFICATION_TABS.map((item) => (
          <button
            type="button"
            role="tab"
            key={item}
            id={`notifications-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={tab === item ? `notifications-panel-${item}` : undefined}
            className={`notifications-page__tab${tab === item ? " notifications-page__tab--active" : ""}`}
            onClick={() => selectTab(item)}
          >
            <span>{t(`dashboard.notifications.tabs.${item}`)}</span>
            {item === "inbox" && unreadCount > 0 && (
              <span className="notifications-page__tab-count">
                <bdi>{formatUnreadBadge(unreadCount, locale)}</bdi>
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`notifications-panel-${tab}`}
        aria-labelledby={`notifications-tab-${tab}`}
        className="notifications-page__panel"
      >
        {tab === "inbox" ? (
          <NotificationInbox searchParams={searchParams} onSearchParamsChange={setSearchParams} />
        ) : (
          <FinancialAlerts workspaceId={workspace?.id} variant="full" />
        )}
      </div>
    </div>
  );
}
