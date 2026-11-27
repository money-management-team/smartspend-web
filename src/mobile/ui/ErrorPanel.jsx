import { useTranslation } from "react-i18next";

import { errorKind, isRetryable } from "../data/errorKind.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { useOnline } from "./useOnline.js";

/*
 * A failed read, said in plain words with the way forward. Read-only: the one
 * action is trying the same GET again. `compact` is the inline form for a
 * section of a screen that failed while the rest is fine. `hideExistence` is
 * for the page of a single record (an account, a transaction).
 */
export default function ErrorPanel({ error, onRetry, retrying = false, compact = false, titleId, hideExistence = false }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const online = useOnline();
  // For one record's page: "you may not see this" and "this does not exist" are one answer, so the screen never confirms that a restricted record exists.
  const raw = errorKind(error, online);
  const kind = hideExistence && raw === "forbidden" ? "notFound" : raw;
  const Tag = compact ? "div" : "section";

  return (
    <Tag className={`sm-error${compact ? " sm-error-compact" : " sm-card"}`} role="alert" data-sm-error={kind} aria-labelledby={compact ? undefined : titleId}>
      <p className="sm-text">{t(`errors.${kind}`)}</p>
      {onRetry && isRetryable(kind) && (
        <button type="button" className="sm-button sm-button-quiet" onClick={onRetry} disabled={retrying} aria-busy={retrying}>
          {t(retrying ? "errors.retrying" : "errors.retry")}
        </button>
      )}
    </Tag>
  );
}
