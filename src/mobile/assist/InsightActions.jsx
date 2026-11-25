import { useTranslation } from "react-i18next";

import WriteOutcome from "../forms/WriteOutcome.jsx";
import { useWorkflowSubmit } from "../forms/useWorkflowSubmit.js";
import { isWriteOpen } from "../data/writeGate.js";
import { useResourceStore } from "../identity/storeContext.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildInsightDismissed } from "../models/aiWrites.js";
import { MOBILE_AI } from "../navigation.js";

const isInsightKey = (key) => key.startsWith("ai:insights:");

/*
 * Dismissing one insight (POST /ai/insights/{id}/dismiss: it sets the insight's status to dismissed, so a copy leaves the same state).
 * Offered only while the write is open. The list is read again after the answer (the dismissed one is no longer "active").
 */
export function DismissInsight({ id }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const sent = useWorkflowSubmit();
  if (!isWriteOpen("ai.insightDismiss")) return null;

  const done = sent.phase === "confirmed" && buildInsightDismissed(sent.data, id);
  if (sent.phase === "confirmed") return <p className="sm-text sm-muted sm-fine" role="status" data-sm-note="insight-dismissed" data-sm-proven={done ? "true" : "false"}>{t("assist.dismissed")}</p>;

  return (
    <>
      <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => sent.submit({ operation: "ai.insightDismiss", ids: { insightId: id }, input: {} })} disabled={sent.sending || sent.phase === "unknown"} aria-busy={sent.sending ? "true" : undefined} data-sm-action="dismiss-insight">
        {t(sent.sending ? "assist.dismissing" : "assist.dismiss")}
      </button>
      {["rejected", "unknown", "changed"].includes(sent.phase) && <WriteOutcome outcome={sent} operation="ai.insightDismiss" outcomeRef={null} backTo={MOBILE_AI} t={t} />}
    </>
  );
}

/*
 * Asking for new insights (POST /ai/insights/refresh). The backend answers 202 and queues a job (unique per person while one is
 * pending): nothing is refreshed yet, so the confirmation says exactly that and offers to look again. Limited per minute and per day.
 */
export function RefreshInsights() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const sent = useWorkflowSubmit();
  const store = useResourceStore();
  if (!isWriteOpen("ai.insightsRefresh")) return null;

  return (
    <div className="sm-ai-refresh" data-sm-section="insight-refresh" data-sm-phase={sent.phase}>
      {sent.phase !== "confirmed" && (
        <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => sent.submit({ operation: "ai.insightsRefresh", ids: {}, input: {} })} disabled={sent.sending || sent.phase === "unknown"} aria-busy={sent.sending ? "true" : undefined} data-sm-action="refresh-insights">
          {t(sent.sending ? "assist.refreshing" : "assist.refreshInsights")}
        </button>
      )}
      {sent.phase === "confirmed" && (
        <>
          <p className="sm-text sm-muted" role="status" data-sm-note="refresh-queued">{t("assist.refreshQueued")}</p>
          <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => store.drop(isInsightKey)} data-sm-action="check-insights">{t("assist.checkInsights")}</button>
        </>
      )}
      {["rejected", "unknown", "changed"].includes(sent.phase) && <WriteOutcome outcome={sent} operation="ai.insightsRefresh" outcomeRef={null} backTo={MOBILE_AI} t={t} />}
    </div>
  );
}
