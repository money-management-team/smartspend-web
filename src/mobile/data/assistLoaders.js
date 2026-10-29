import { readAiSettings, readConversation, readConversations, readForecast, readInputQuotas, readInsights, readNotificationPreferences, readReceiptCapture, readReceiptCaptures, readVoiceCapture, readVoiceCaptures, readWhatsApp, readWhatsAppDraft, readWhatsAppDrafts } from "./readAssistApi.js";

/*
 * What each store entry of the assistant, capture, WhatsApp and preference
 * screens loads: the response's `data`, as the backend sent it (a list's
 * paginator is inside `data` for all of these). The models in
 * models/assist.js decide what of it can be shown.
 */
const dataOf = (read) => async (...args) => (await read(...args)).data;

export const loadAiSettings = dataOf(readAiSettings);
export const conversationsLoader = (page) => (signal) => dataOf(readConversations)(page, signal);
export const conversationLoader = (id, page) => (signal) => dataOf(readConversation)(id, page, signal);
export const insightsLoader = (page) => (signal) => dataOf(readInsights)(page, signal);
export const loadForecast = dataOf(readForecast);
export const loadInputQuotas = dataOf(readInputQuotas);
export const voiceCapturesLoader = (page) => (signal) => dataOf(readVoiceCaptures)(page, signal);
export const voiceCaptureLoader = (id) => (signal) => dataOf(readVoiceCapture)(id, signal);
export const receiptCapturesLoader = (page) => (signal) => dataOf(readReceiptCaptures)(page, signal);
export const receiptCaptureLoader = (id) => (signal) => dataOf(readReceiptCapture)(id, signal);
export const loadWhatsApp = dataOf(readWhatsApp);
export const whatsAppDraftsLoader = (status, page) => (signal) => dataOf(readWhatsAppDrafts)(status, page, signal);
export const whatsAppDraftLoader = (id) => (signal) => dataOf(readWhatsAppDraft)(id, signal);
export const loadNotificationPreferences = dataOf(readNotificationPreferences);

export const assistKeys = {
  aiSettings: "ai:settings",
  conversations: (page) => `ai:conversations:${page}`,
  conversation: (id, page) => `ai:conversation:${id}:${page}`,
  insights: (page) => `ai:insights:${page}`,
  forecast: "ai:forecast",
  quotas: "ai:quotas",
  voiceCaptures: (page) => `voice:${page}`,
  voiceCapture: (id) => `voiceCapture:${id}`,
  receiptCaptures: (page) => `receipts:${page}`,
  receiptCapture: (id) => `receiptCapture:${id}`,
  whatsapp: "whatsapp",
  whatsappDrafts: (status, page) => `whatsappDrafts:${status || "all"}:${page}`,
  whatsappDraft: (id) => `whatsappDraft:${id}`,
  notificationPreferences: "notificationPreferences",
};
