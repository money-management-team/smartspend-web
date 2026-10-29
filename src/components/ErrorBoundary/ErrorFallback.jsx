import { useTranslation } from "react-i18next";
import { LuRefreshCw, LuTriangleAlert } from "react-icons/lu";

import { PATH } from "../../routes/Path";

import "./ErrorFallback.css";

/*
 * What users see after an unexpected error. No stack trace or message from
 * the error itself is ever rendered. The dashboard link is a plain anchor (a
 * full page load), because the router state may be the thing that broke.
 */
export default function ErrorFallback({ variant = "app", onRetry }) {
  const { t } = useTranslation();

  return (
    <div className={`error-fallback error-fallback--${variant}`} role="alert">
      <div className="error-fallback__card">
        <span className="error-fallback__icon" aria-hidden="true">
          <LuTriangleAlert />
        </span>

        <h1>{t("common.errorBoundary.title")}</h1>
        <p>{t("common.errorBoundary.message")}</p>

        <div className="error-fallback__actions">
          <button
            type="button"
            className="error-fallback__button error-fallback__button--primary"
            onClick={() => window.location.reload()}
          >
            <LuRefreshCw aria-hidden="true" />
            {t("common.errorBoundary.reload")}
          </button>

          {variant === "page" && onRetry && (
            <button
              type="button"
              className="error-fallback__button"
              onClick={onRetry}
            >
              {t("common.retry")}
            </button>
          )}

          <a className="error-fallback__button" href={PATH.USER.DASHBOARD}>
            {t("common.errorBoundary.dashboard")}
          </a>
        </div>
      </div>
    </div>
  );
}
