import { flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * What counts as proof that an assistant write happened (AiConversationController, AiMessageController, AiFeedbackController,
 * AiSettingsController, AiDataController; identical on develop @ fd87531 and fix/financial-idempotency-p0 @ 6b696d72). Each builder
 * returns the server's own record, or null when the answer is not provably the thing that was asked for, in which case the screen
 * says only that SmartSpend confirmed it (it was a 2xx). Pure: no React, no requests.
 *
 *   POST /ai/conversations              201 data.conversation: id, title, status "active", locale, message_count?, last_message_at ...
 *   POST /ai/conversations/{id}/messages 201 (200 when replayed) data.user_message, data.assistant_message, data.replayed
 *   POST /ai/messages/{id}/feedback     200 data.feedback: rating, reason_code, comment (an upsert)
 *   PUT  /ai/settings                   200 data.settings: ai_enabled, insights_enabled, forecast_enabled, preferred_language, retention_days, consent
 *   DELETE /ai/data                     200 data.deleted: conversations_deleted, insights_deleted, feedback_deleted, usage_logs_deleted
 *   DELETE /ai/conversations/{id}       200 data null
 *   POST /ai/insights/refresh           202 data null (a job is queued: nothing is refreshed yet)
 *   POST /ai/insights/{id}/dismiss      200 data.insight (status "dismissed")
 */

const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

/** @param {{ locale: string }} input */
export function buildConversationCreated(data, input) {
  const raw = isRecord(data) ? data.conversation : null;
  const id = isRecord(raw) ? idText(raw.id) : null;
  if (!id || raw.status !== "active" || !isRecord(input) || raw.locale !== input.locale) return null;
  return { id, title: textOrNull(raw.title, 120), locale: raw.locale };
}

/** @param {Record<string, unknown>} input only the settings that were changed */
export function buildSettingsSaved(data, input) {
  const raw = isRecord(data) ? data.settings : null;
  if (!isRecord(raw) || !isRecord(input)) return null;

  const settings = {
    enabled: flagOrNull(raw.ai_enabled),
    insights: flagOrNull(raw.insights_enabled),
    forecast: flagOrNull(raw.forecast_enabled),
    language: raw.preferred_language === "ar" || raw.preferred_language === "en" ? raw.preferred_language : null,
    retentionDays: count(raw.retention_days),
  };
  if (settings.enabled === null || settings.insights === null || settings.forecast === null || settings.retentionDays === null) return null;
  if (Object.hasOwn(input, "ai_enabled") && settings.enabled !== input.ai_enabled) return null;
  if (Object.hasOwn(input, "insights_enabled") && settings.insights !== input.insights_enabled) return null;
  if (Object.hasOwn(input, "forecast_enabled") && settings.forecast !== input.forecast_enabled) return null;
  if (Object.hasOwn(input, "preferred_language") && settings.language !== input.preferred_language) return null;
  if (Object.hasOwn(input, "retention_days") && settings.retentionDays !== input.retention_days) return null;
  return settings;
}

/** The counts the server says it deleted; null unless every one is a whole number. */
export function buildDataDeleted(data) {
  const raw = isRecord(data) ? data.deleted : null;
  if (!isRecord(raw)) return null;
  const result = { conversations: count(raw.conversations_deleted), insights: count(raw.insights_deleted), feedback: count(raw.feedback_deleted), usage: count(raw.usage_logs_deleted) };
  return Object.values(result).every((value) => value !== null) ? result : null;
}

/**
 * The answer to a sent message: the stored user message (with the text that was sent) and the assistant's reply, which is either
 * answered, still being prepared, or failed (a failed attempt is stored and replayed, so it is shown as failed, never as an answer).
 *
 * @param {string} content the text that was sent
 * @param {string} conversationId
 */
export function buildMessagePair(data, content, conversationId) {
  const user = isRecord(data) ? data.user_message : null;
  const assistant = isRecord(data) ? data.assistant_message : null;
  if (!isRecord(user) || !isRecord(assistant)) return null;
  if (user.role !== "user" || assistant.role !== "assistant") return null;
  if (idText(user.conversation_id) !== String(conversationId) || idText(assistant.conversation_id) !== String(conversationId)) return null;
  if (typeof user.content !== "string" || user.content !== content) return null;
  if (idText(assistant.reply_to_message_id) !== idText(user.id) || !idText(user.id) || !idText(assistant.id)) return null;

  const status = typeof assistant.status === "string" ? assistant.status : "";
  return {
    userId: idText(user.id),
    assistantId: idText(assistant.id),
    replayed: data.replayed === true,
    state: status === "failed" ? "failed" : status === "pending" || status === "processing" ? "pending" : "ready",
    failure: status === "failed" && isRecord(assistant.failure) ? textOrNull(assistant.failure.message, 300) : null,
  };
}

/** The feedback row the server saved: the rating that was sent (and the reason, when one was). */
export function buildFeedbackSaved(data, input) {
  const raw = isRecord(data) ? data.feedback : null;
  if (!isRecord(raw) || !isRecord(input) || raw.rating !== input.rating) return null;
  if (input.reason_code !== undefined && raw.reason_code !== input.reason_code) return null;
  return { rating: raw.rating };
}

/** The insight, now dismissed (status "dismissed"), and the one that was asked for. */
export function buildInsightDismissed(data, insightId) {
  const raw = isRecord(data) ? data.insight : null;
  return isRecord(raw) && idText(raw.id) === String(insightId) && raw.status === "dismissed" ? { id: String(insightId) } : null;
}
