import { useTranslation } from "react-i18next";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import "./ReportPagination.css";

/*
 * `data.pagination` of a list report (current_page, per_page, total,
 * last_page, from, to, has_more_pages). Rendered only when the backend sent a
 * real pagination object; Overview's `pagination: []` never reaches here.
 */
export default function ReportPagination({ pagination, onPageChange }) {
  const { t } = useTranslation();

  if (!pagination || pagination.total <= 0) return null;

  return (
    <footer className="report-pagination">
      <span>
        {t("dashboard.transactions.pagination.summary", {
          from: pagination.from,
          to: pagination.to,
          total: pagination.total,
        })}
      </span>

      {pagination.lastPage > 1 && (
        <div className="report-pagination__pages">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            aria-label={t("dashboard.transactions.pagination.previous")}
          >
            <LuChevronLeft aria-hidden="true" />
          </button>
          <span aria-live="polite">
            {t("dashboard.transactions.pagination.page", {
              page: pagination.page,
              lastPage: pagination.lastPage,
            })}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasMore}
            aria-label={t("dashboard.transactions.pagination.next")}
          >
            <LuChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </footer>
  );
}
