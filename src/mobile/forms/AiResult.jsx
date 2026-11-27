import { Link, useLocation } from "react-router-dom";

import { MOBILE_AI, aiConversationPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";

/*
 * A confirmed assistant write, as the server answered it (models/aiWrites.js): a new conversation (opened next), the settings as
 * saved, a deleted conversation, or the AI data deleted (with the counts the server reports). The write's cached reads were dropped
 * when the answer arrived (forms/useWorkflowSubmit.js), so the assistant page reads again. Nothing here is about money.
 */
export default function AiResult({ kind, result, outcomeRef, t }) {
  // A question typed on the assistant's page travels with the router state, so the new conversation opens with it ready to send.
  const draft = useLocation().state?.draft;
  const row = (name, label, value) => (value !== null && value !== undefined ? <div className="sm-stat" data-sm-result={name}><dt>{label}</dt><dd>{value}</dd></div> : null);

  return (
    <div className="sm-card sm-transfer-result" role="status" tabIndex={-1} ref={outcomeRef} data-sm-outcome="confirmed" data-sm-ai-result={kind} data-sm-conversation-id={kind === "created" ? result.id : undefined}>
      <h2 className="sm-card-title">{t(`forms.aiResult.${kind}Title`)}</h2>
      <p className="sm-text sm-muted">{t(`forms.aiResult.${kind}Body`)}</p>
      {kind === "settings" && (
        <dl className="sm-stats sm-stats-stacked">
          {row("enabled", t("forms.fields.ai_enabled"), t(result.enabled ? "forms.aiResult.on" : "forms.aiResult.off"))}
          {row("insights", t("forms.fields.insights_enabled"), t(result.insights ? "forms.aiResult.on" : "forms.aiResult.off"))}
          {row("forecast", t("forms.fields.forecast_enabled"), t(result.forecast ? "forms.aiResult.on" : "forms.aiResult.off"))}
          {row("language", t("forms.fields.preferred_language"), result.language ? t(`forms.options.aiLocale.${result.language}`) : null)}
          {row("retention", t("forms.fields.retention_days"), t("forms.aiResult.days", { count: result.retentionDays }))}
        </dl>
      )}
      {kind === "data" && result && (
        <dl className="sm-stats sm-stats-stacked">
          {row("conversations", t("forms.aiResult.conversations"), result.conversations)}
          {row("insights", t("forms.aiResult.insights"), result.insights)}
          {row("feedback", t("forms.aiResult.feedback"), result.feedback)}
          {row("usage", t("forms.aiResult.usage"), result.usage)}
        </dl>
      )}
      {kind === "created" && (
        <Link className="sm-button" to={aiConversationPath(result.id)} state={typeof draft === "string" && draft ? { from: MOBILE_AI, draft } : { from: MOBILE_AI }} data-sm-action="open-conversation">{t("forms.aiResult.openConversation")}</Link>
      )}
      <Link className="sm-link-row" to={MOBILE_AI} data-sm-action="after-write">
        <span>{t("forms.aiResult.back")}</span>
        <Chevron />
      </Link>
    </div>
  );
}
