import { aiCopilotApi } from "../../features/Dashboards/User/api/aiCopilotApi.js";
import { aiExpenseCapturesApi } from "../../features/Dashboards/User/api/aiExpenseCapturesApi.js";
import { aiInputQuotasApi } from "../../features/Dashboards/User/api/aiInputQuotasApi.js";
import { aiVoiceExpenseCapturesApi } from "../../features/Dashboards/User/api/aiVoiceExpenseCapturesApi.js";
import { notificationsApi } from "../../features/Dashboards/User/api/notificationsApi.js";
import { whatsappApi } from "../../features/Dashboards/User/api/whatsappApi.js";

/*
 * The second read facade: the assistant, voice and receipt captures, WhatsApp
 * and the notification preferences. Every function here is a GET through the
 * app's own wrapper (token, language, envelope and errors handled there), with
 * only documented parameters. Nothing here sends a message, uploads a file,
 * confirms a capture or a draft, links or unlinks WhatsApp, or saves a setting:
 * the wrappers' write methods are not named in this file
 * (tests/mobileReadOnly.test.mjs lists exactly the methods used).
 *
 * The forecast wrapper takes no signal, so an abandoned forecast read is not
 * cancelled; its answer is simply not shown (the store ignores it).
 */

export const ASSIST_PER_PAGE = 20;
export const MESSAGES_PER_PAGE = 50;

export const readAiSettings = (signal) => aiCopilotApi.settings({ signal });
export const readConversations = (page, signal) => aiCopilotApi.conversations({ page, per_page: ASSIST_PER_PAGE }, { signal });
export const readConversation = (conversationId, page, signal) => aiCopilotApi.conversation(conversationId, { page, per_page: MESSAGES_PER_PAGE }, { signal });
export const readInsights = (page, signal) => aiCopilotApi.insights({ page, per_page: ASSIST_PER_PAGE }, { signal });
export const readForecast = () => aiCopilotApi.forecast();
export const readInputQuotas = (signal) => aiInputQuotasApi.get({ signal });

export const readVoiceCaptures = (page, signal) => aiVoiceExpenseCapturesApi.list({ page, per_page: ASSIST_PER_PAGE, sort_dir: "desc" }, { signal });
export const readVoiceCapture = (captureId, signal) => aiVoiceExpenseCapturesApi.get(captureId, { signal });
export const readReceiptCaptures = (page, signal) => aiExpenseCapturesApi.list({ page, per_page: ASSIST_PER_PAGE, sort_dir: "desc" }, { signal });
export const readReceiptCapture = (captureId, signal) => aiExpenseCapturesApi.get(captureId, { signal });

export const readWhatsApp = (signal) => whatsappApi.getIntegration({ signal });
export const readWhatsAppDrafts = (status, page, signal) => whatsappApi.listDrafts({ status: status || undefined, page, per_page: ASSIST_PER_PAGE }, { signal });
export const readWhatsAppDraft = (draftId, signal) => whatsappApi.getDraft(draftId, { signal });

export const readNotificationPreferences = (signal) => notificationsApi.getPreferences({ signal });
