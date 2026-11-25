import { accountsApi } from "../../features/Dashboards/User/api/accountsApi.js";
import { createIdempotencyKey } from "../../features/Dashboards/User/api/apiClient.js";
import { aiCopilotApi } from "../../features/Dashboards/User/api/aiCopilotApi.js";
import { aiExpenseCapturesApi } from "../../features/Dashboards/User/api/aiExpenseCapturesApi.js";
import { aiVoiceExpenseCapturesApi } from "../../features/Dashboards/User/api/aiVoiceExpenseCapturesApi.js";
import { authApi } from "../../features/Dashboards/User/api/authApi.js";
import { budgetsApi } from "../../features/Dashboards/User/api/budgetsApi.js";
import { categoriesApi } from "../../features/Dashboards/User/api/categoriesApi.js";
import { debtsApi } from "../../features/Dashboards/User/api/debtsApi.js";
import { notificationsApi } from "../../features/Dashboards/User/api/notificationsApi.js";
import { plannedSavingsApi } from "../../features/Dashboards/User/api/plannedSavingsApi.js";
import { recurringTransactionsApi } from "../../features/Dashboards/User/api/recurringTransactionsApi.js";
import { reportExportsApi } from "../../features/Dashboards/User/api/reportExportsApi.js";
import { savingsGoalsApi } from "../../features/Dashboards/User/api/savingsGoalsApi.js";
import { transactionsApi } from "../../features/Dashboards/User/api/transactionsApi.js";
import { transfersApi } from "../../features/Dashboards/User/api/transfersApi.js";
import { whatsappApi } from "../../features/Dashboards/User/api/whatsappApi.js";
import { MOBILE_WRITES, assertWriteOpen } from "./writeGate.js";

/*
 * Every request Mobile has code for that is not a read, and the only file that
 * makes them. ALL are CLOSED by data/writeGate.js: each call checks the gate
 * first and throws WriteClosedError without sending anything.
 *
 * Each call goes through the app's own wrapper (the same one the full version
 * uses), so the token is read the moment the call is made, and the wrapper adds
 * the Idempotency-Key header where the backend requires one. The caller asserts
 * the identity guard in the same turn, immediately before.
 *
 * Categories: the payloads are built by models/categoryForm.js and carry nothing
 * else (no amount, account, transaction, parent, status or icon). The endpoints
 * take no Idempotency-Key; the database's unique rule refuses a copy with 422.
 */
export const sendCategoryCreate = (payload) => {
  assertWriteOpen("category.create");
  return categoriesApi.create(payload);
};

export const sendCategoryUpdate = (categoryId, payload) => {
  assertWriteOpen("category.update");
  return categoriesApi.update(categoryId, payload);
};

/*
 * Notifications (notifications/useNotificationWrite.js): marking one read, or all of them. Neither takes a
 * body or an Idempotency-Key: the backend's own rule makes a copy harmless (data/writeGate.js
 * "same-result"). The id is checked to be a positive whole number before anything is sent.
 */
export const sendNotificationRead = (notificationId) => {
  assertWriteOpen("notifications.markRead");
  if (!/^[1-9]\d{0,14}$/.test(String(notificationId ?? ""))) throw Object.assign(new Error("Not a notification id."), { code: "INVALID_ID" });
  return notificationsApi.markRead(String(notificationId));
};

export const sendNotificationsReadAll = () => {
  assertWriteOpen("notifications.markAllRead");
  return notificationsApi.markAllRead();
};

/*
 * The savings reminder preference (settings/usePreferenceWrite.js), as the explicit value wanted: never "the other
 * one", so a request delivered twice leaves the same setting. Anything that is not true or false is not sent.
 */
export const sendNotificationPreferences = (values) => {
  assertWriteOpen("notifications.preferences");
  const wanted = values?.savings_installment_reminders;
  if (typeof wanted !== "boolean") throw Object.assign(new Error("A preference must be true or false."), { code: "INVALID_VALUE" });
  return notificationsApi.updatePreferences({ savings_installment_reminders: wanted });
};

/*
 * The forms (forms/workflows.js), with their input built by forms/writePayloads.js.
 * `key` is the submission's Idempotency-Key (forms/useWorkflowSubmit.js); it is
 * passed only where the backend takes one (MOBILE_WRITES[operation].key).
 *
 * The three reviews of something SmartSpend read (a receipt, a voice note, a
 * WhatsApp message) are two requests, like in the full version: the reviewed
 * values are saved with the review_version that was read, and the saved review
 * is confirmed with the version that save returned. If the save is refused,
 * nothing is confirmed; if the confirmation's outcome is unknown, the caller
 * re-reads the review rather than sending it again.
 */
const SENDERS = {
  "transaction.expense": ({ input }, key) => transactionsApi.createExpense(input, key),
  "transaction.income": ({ input }, key) => transactionsApi.createIncome(input, key),
  "transaction.correct": ({ ids, input }, key) => transactionsApi.correct(ids.transactionId, input, key),
  "transaction.reverse": ({ ids, input }) => transactionsApi.reverse(ids.transactionId, input.reason),
  "transfer.create": ({ input }, key) => transfersApi.create(input, key),
  "transfer.reverse": ({ ids, input }) => transfersApi.reverse(ids.transferId, input.reason),
  "goal.contribution": ({ ids, input }, key) => savingsGoalsApi.contribute(ids.goalId, input, key),
  "goal.withdrawal": ({ ids, input }, key) => savingsGoalsApi.withdraw(ids.goalId, input, key),
  "debt.payment": ({ ids, input }, key) => debtsApi.recordPayment(ids.debtId, input, key),
  "debt.paymentReverse": ({ ids, input }) => debtsApi.reversePayment(ids.paymentId, input.reason),
  // Names the occurrence the review showed (occurrence_id); the wrapper refuses to send without one.
  "recurring.confirmNext": ({ ids, input }) => recurringTransactionsApi.confirmNext(ids.ruleId, input.occurrence_id),
  "receipt.confirm": (write, key) => saveThenConfirm(write, key, (id, body) => aiExpenseCapturesApi.update(id, body), (id, version, k) => aiExpenseCapturesApi.confirm(id, { review_version: version }, { idempotencyKey: k })),
  "voice.confirm": (write, key) => saveThenConfirm(write, key, (id, body) => aiVoiceExpenseCapturesApi.update(id, body), (id, version, k) => aiVoiceExpenseCapturesApi.confirm(id, { review_version: version }, { idempotencyKey: k })),
  // Stores the file and queues it for AI reading; creates no transaction. input: { file, workspaceId, signal }.
  "receipt.upload": ({ input }, key) => aiExpenseCapturesApi.create(input.file, { workspaceId: input.workspaceId, idempotencyKey: key, signal: input.signal }),
  "voice.upload": ({ input }, key) => aiVoiceExpenseCapturesApi.create(input.file, { workspaceId: input.workspaceId, idempotencyKey: key, signal: input.signal }),
  "whatsapp.confirm": async ({ ids, input, reviewVersion }, key) => {
    const saved = await whatsappApi.updateDraft(ids.draftId, input, reviewVersion);
    return whatsappApi.confirmDraft(ids.draftId, { reviewVersion: savedVersion(saved, "draft"), idempotencyKey: key });
  },

  "category.archive": ({ ids }) => categoriesApi.archive(ids.categoryId),
  // The assistant (every one closed; the message carries the submission's key as its client_request_id).
  "ai.conversationCreate": ({ input }) => aiCopilotApi.createConversation(input.locale),
  "ai.message": ({ ids, input }, key) => aiCopilotApi.sendMessage(ids.conversationId, input.content, key),
  "ai.conversationDelete": ({ ids }) => aiCopilotApi.deleteConversation(ids.conversationId),
  "ai.messageFeedback": ({ ids, input }) => aiCopilotApi.messageFeedback(ids.messageId, input),
  "ai.insightFeedback": ({ ids, input }) => aiCopilotApi.insightFeedback(ids.insightId, input),
  "ai.insightsRefresh": () => aiCopilotApi.refreshInsights(),
  "ai.insightDismiss": ({ ids }) => aiCopilotApi.dismissInsight(ids.insightId),
  "ai.settings": ({ input }) => aiCopilotApi.updateSettings(input),
  "ai.dataDelete": () => aiCopilotApi.deleteData(),
  "account.create": ({ input }) => accountsApi.create(input),
  "account.update": ({ ids, input }) => accountsApi.update(ids.accountId, input),
  "account.archive": ({ ids }) => accountsApi.archive(ids.accountId),
  "budget.create": ({ input }) => budgetsApi.create(input),
  "budget.update": ({ ids, input }) => budgetsApi.update(ids.budgetId, input),
  "goal.create": ({ input }, key) => savingsGoalsApi.create(input, key),
  "goal.update": ({ ids, input }) => savingsGoalsApi.update(ids.goalId, input),
  "goal.plannedContribution": ({ ids, input }) => plannedSavingsApi.create(ids.goalId, input),
  "recurring.create": ({ input }, key) => recurringTransactionsApi.create(input, key),
  "recurring.update": ({ ids, input }) => recurringTransactionsApi.update(ids.ruleId, input),
  "recurring.skipNext": ({ ids, input }) => recurringTransactionsApi.skipNext(ids.ruleId, input.occurrence_id, input.reason),
  "debt.create": ({ input }, key) => debtsApi.create(input, key),
  "debt.update": ({ ids, input }) => debtsApi.update(ids.debtId, input),
  "profile.update": ({ input }) => authApi.updateProfile(input),
  "profile.password": ({ input }) => authApi.changePassword(input),
  "export.create": ({ input }) => reportExportsApi.create(input),
};

/*
 * The review_version a save answered with (data.capture for both captures,
 * data.draft for WhatsApp: AiExpenseCaptureController, AiVoiceExpenseCaptureController
 * captureResponse, WhatsAppExpenseDraftController draftResponse). Without one,
 * the confirmation is not sent.
 */
function savedVersion(response, field) {
  const version = response?.data?.[field]?.review_version;
  if (!Number.isSafeInteger(version)) {
    const error = new Error("The saved review did not say which version to confirm.");
    error.code = "MALFORMED_RESPONSE";
    throw error;
  }
  return version;
}

async function saveThenConfirm({ ids, input, reviewVersion }, key, save, confirm) {
  const saved = await save(ids.captureId, { review_version: reviewVersion, ...input });
  return confirm(ids.captureId, savedVersion(saved, "capture"), key);
}

export const SENDABLE_OPERATIONS = Object.freeze(Object.keys(SENDERS));

/** A fresh Idempotency-Key for one submission intent ("mobile-transaction-expense-<uuid>"; the backend allows [A-Za-z0-9._:-], 8–255). */
export const newWriteKey = (operation) => createIdempotencyKey(`mobile-${operation.replace(/[^A-Za-z0-9]+/g, "-")}`);

/**
 * Sends one form's write: { operation, ids, input, reviewVersion? } from
 * forms/writePayloads.js. Closed operations throw WriteClosedError before any
 * request exists. `key` is required for, and only given to, the writes that take one.
 */
export function sendWorkflowWrite(write, key) {
  assertWriteOpen(write.operation);
  const send = SENDERS[write.operation];
  if (!send) throw new Error(`Mobile has no send path for ${write.operation}.`);
  const needsKey = MOBILE_WRITES[write.operation].key === "client";
  if (needsKey && !key) throw new Error(`${MOBILE_WRITES[write.operation].endpoint} needs an Idempotency-Key.`);
  return send(write, needsKey ? key : undefined);
}
