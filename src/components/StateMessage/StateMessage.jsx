import { useTranslation } from "react-i18next";

import "./StateMessage.css";

/*
 * The shared error / empty block for lists, tables and panels, so a failed
 * load and a valid empty result never look alike.
 *
 *   <StateMessage tone="error" message={getApiErrorMessage(error, t)} onRetry={reload} />
 *   <StateMessage message={t("...empty")} action={{ label: t("...add"), onClick: openForm }} />
 *
 * - `tone="error"`: announced as an alert; `onRetry` adds a "Try again" button.
 *   Pass an already translated, user-safe message (getApiErrorMessage and the
 *   feature error helpers do this), never a raw backend or JavaScript error.
 * - default (empty): a calm, neutral block with an optional call to action.
 * Loading uses the shared <Loading />; it is not part of this component.
 */
export default function StateMessage({
  tone = "empty",
  title,
  message,
  onRetry,
  action,
  className = "",
}) {
  const { t } = useTranslation();
  const isError = tone === "error";

  return (
    <div
      className={`state-message state-message--${tone}${
        className ? ` ${className}` : ""
      }`}
      role={isError ? "alert" : undefined}
    >
      {title && <strong>{title}</strong>}
      {message && <p dir="auto">{message}</p>}

      {(onRetry || action) && (
        <div className="state-message__actions">
          {onRetry && (
            <button type="button" onClick={onRetry}>
              {t("common.retry")}
            </button>
          )}
          {action && (
            <button type="button" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
