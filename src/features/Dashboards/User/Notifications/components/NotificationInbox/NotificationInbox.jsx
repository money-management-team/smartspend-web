import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LuCheckCheck, LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { useUnreadNotifications } from "../../../../../../contexts/notifications/useUnreadNotifications";
import { ApiError } from "../../../api/apiClient";
import { notificationsApi } from "../../../api/notificationsApi";
import {
  getNotificationErrorMessage,
  hasActiveNotificationFilters,
  isNotificationEntity,
  isNotificationRead,
  notificationFiltersToQuery,
  notificationFiltersToSearchParams,
  parseNotificationsPage,
  readNotificationFilters,
  replaceNotification,
  toUnreadCount,
} from "../../notificationHelpers";
import NotificationFilters from "../NotificationFilters/NotificationFilters";
import NotificationItem from "../NotificationItem/NotificationItem";

import "./NotificationInbox.css";

/*
 * The persistent notification inbox: GET /notifications, filtered by read
 * state and severity and paginated by the backend (filters and page live in
 * the URL).
 *
 * The unread count shown everywhere (badge, sidebar, this tab) is always the
 * backend's: each list, mark-read and mark-all-read response hands its
 * `unread_count` to the shared UnreadNotifications context; nothing is
 * decremented locally.
 */
export default function NotificationInbox({ searchParams, onSearchParamsChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { count: unreadCount, setCount: setUnreadCount } = useUnreadNotifications();

  const filters = readNotificationFilters(searchParams);
  const filterKey = notificationFiltersToSearchParams(filters).toString();

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request (filters, page or retry changed), it is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  // Ids with a mark-read request in flight: the ref blocks a second request,
  // the state disables the button.
  const pendingRef = useRef(new Set());
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const markingAllRef = useRef(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  // { tone: "success" | "error", text }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = notificationFiltersToQuery(readNotificationFilters(new URLSearchParams(filterKey)));

    notificationsApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const parsed = parseNotificationsPage(response);

        setResult(
          parsed
            ? { key: requestKey, page: parsed, error: null }
            : { key: requestKey, page: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );

        if (parsed) setUnreadCount(response.data.unread_count);
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey, setUnreadCount]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];
  const isFiltered = hasActiveNotificationFilters(filters);

  const reloadList = () => setReloadKey((key) => key + 1);

  const updateFilters = (changes) => {
    setNotice(null);
    onSearchParamsChange(notificationFiltersToSearchParams({ ...filters, ...changes, page: 1 }));
  };

  const clearFilters = () => updateFilters({ status: "", severity: "" });

  const goToPage = (page) => onSearchParamsChange(notificationFiltersToSearchParams({ ...filters, page }));

  const setPending = (id, isPending) => {
    const key = String(id);
    if (isPending) pendingRef.current.add(key);
    else pendingRef.current.delete(key);
    setPendingIds(new Set(pendingRef.current));
  };

  /* ---------- Mark one as read ---------- */

  // PATCH /notifications/{id}/read; the row and the badge take the backend's
  // copy. Resolves to true on success. Already-read rows send nothing.
  const markRead = async (notification) => {
    const id = String(notification.id);
    if (isNotificationRead(notification) || pendingRef.current.has(id)) return false;

    setPending(id, true);
    setNotice(null);

    try {
      const response = await notificationsApi.markRead(notification.id);
      const updated = response?.data?.notification;

      if (isNotificationEntity(updated)) {
        setResult((current) =>
          current.page
            ? { ...current, page: { ...current.page, items: replaceNotification(current.page.items, updated) } }
            : current,
        );
      } else {
        // The request succeeded but its row is missing: show the backend's list.
        reloadList();
      }

      setUnreadCount(response?.data?.unread_count);
      return true;
    } catch (markError) {
      // 401: apiClient already ended the session and the guards redirect.
      if (markError?.code !== "UNAUTHENTICATED") {
        setNotice({ tone: "error", text: getNotificationErrorMessage(markError, t, "markRead") });
      }
      throw markError;
    } finally {
      setPending(id, false);
    }
  };

  const handleMarkRead = (notification) => {
    markRead(notification).catch(() => {});
  };

  // Opening an unread notification marks it read first, then goes to its
  // subject. The read state is secondary: a failed mark-read (other than an
  // expired session) still opens the subject.
  const handleOpen = async (notification, path) => {
    if (pendingRef.current.has(String(notification.id))) return;

    try {
      await markRead(notification);
    } catch (markError) {
      if (markError?.code === "UNAUTHENTICATED") return;
    }

    if (path) navigate(path);
  };

  /* ---------- Mark all as read ---------- */

  // POST /notifications/read-all. `marked_count` may be 0 (nothing was
  // unread): still a success. The list is fetched again so every row shows
  // the backend's read state.
  const handleMarkAll = async () => {
    if (markingAllRef.current) return;

    markingAllRef.current = true;
    setIsMarkingAll(true);
    setNotice(null);

    try {
      const response = await notificationsApi.markAllRead();
      const markedCount = toUnreadCount(response?.data?.marked_count);

      setUnreadCount(response?.data?.unread_count);
      setNotice({
        tone: "success",
        text: markedCount
          ? t("dashboard.notifications.notices.markedAll", { count: markedCount })
          : t("dashboard.notifications.notices.allAlreadyRead"),
      });
      reloadList();
    } catch (markError) {
      if (markError?.code !== "UNAUTHENTICATED") {
        setNotice({ tone: "error", text: getNotificationErrorMessage(markError, t, "markAll") });
      }
    } finally {
      markingAllRef.current = false;
      setIsMarkingAll(false);
    }
  };

  /* ---------- Render ---------- */

  const emptyKey =
    filters.status === "unread"
      ? "emptyUnread"
      : filters.status === "read"
        ? "emptyRead"
        : isFiltered
          ? "emptyFiltered"
          : "empty";

  return (
    <section className="notification-inbox" aria-labelledby="notification-inbox-title">
      <header className="notification-inbox__toolbar">
        <div className="notification-inbox__heading">
          <h2 id="notification-inbox-title">{t("dashboard.notifications.inbox.title")}</h2>
          {unreadCount != null && (
            <p aria-live="polite">
              {unreadCount > 0
                ? t("dashboard.notifications.inbox.unreadCount", { count: unreadCount })
                : t("dashboard.notifications.inbox.allRead")}
            </p>
          )}
        </div>

        <button
          type="button"
          className="notification-inbox__mark-all"
          onClick={handleMarkAll}
          disabled={isMarkingAll || unreadCount === 0}
          aria-busy={isMarkingAll}
        >
          <LuCheckCheck aria-hidden="true" />
          <span>
            {isMarkingAll ? t("dashboard.notifications.inbox.markingAll") : t("dashboard.notifications.inbox.markAll")}
          </span>
        </button>
      </header>

      <NotificationFilters filters={filters} onChange={updateFilters} onClear={clearFilters} disabled={isLoading} />

      {notice && (
        <div
          className={`notification-inbox__notice notification-inbox__notice--${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <p>{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {isLoading && <Loading message={t("dashboard.notifications.states.loading")} />}

      {!isLoading && error && (
        <div className="notification-inbox__state notification-inbox__state--error" role="alert">
          <p>{getNotificationErrorMessage(error, t)}</p>
          <button type="button" onClick={reloadList}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="notification-inbox__state">
          {listPage && listPage.total > 0 && listPage.page > 1 ? (
            <>
              <p>{t("dashboard.notifications.states.emptyPage")}</p>
              <button type="button" onClick={() => goToPage(1)}>
                {t("dashboard.transactions.pagination.first")}
              </button>
            </>
          ) : (
            <>
              <p>{t(`dashboard.notifications.states.${emptyKey}`)}</p>
              {isFiltered && (
                <button type="button" onClick={clearFilters}>
                  {t("dashboard.notifications.filters.clear")}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <ul className="notification-inbox__list">
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              isPending={pendingIds.has(String(notification.id))}
              onOpen={handleOpen}
              onMarkRead={handleMarkRead}
            />
          ))}
        </ul>
      )}

      {!isLoading && !error && listPage && listPage.lastPage > 1 && (
        <footer className="notification-inbox__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", {
              from: listPage.from,
              to: listPage.to,
              total: listPage.total,
            })}
          </span>

          <div className="notification-inbox__pages">
            <button
              type="button"
              onClick={() => goToPage(listPage.page - 1)}
              disabled={listPage.page <= 1}
              aria-label={t("dashboard.transactions.pagination.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {t("dashboard.transactions.pagination.page", {
                page: listPage.page,
                lastPage: listPage.lastPage,
              })}
            </span>
            <button
              type="button"
              onClick={() => goToPage(listPage.page + 1)}
              disabled={listPage.page >= listPage.lastPage}
              aria-label={t("dashboard.transactions.pagination.next")}
            >
              <LuChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
