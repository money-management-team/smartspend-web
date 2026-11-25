/*
 * Every write Mobile has code for, and whether it may be sent. All are closed.
 * APPROVED stays empty in the production-bound source until a separate,
 * per-write staging-enablement approval.
 *
 * A write is opened only by changing APPROVED below, in a reviewed commit that
 * cites the server-side evidence for it (docs/mobile/SECURITY-AND-FINANCIAL-GATES.md).
 * There is no environment variable, storage key, URL parameter or console switch
 * that opens one: a build cannot be configured into sending them by accident.
 *
 * Why closed: the browser itself can send a write twice. In a local test (Chrome
 * 156, HTTP/1.1) a POST or PATCH answered with 408, or whose reused connection
 * dropped after the server had read the body, reached the server two or three
 * times while the page called fetch once, and in one case the page saw a single
 * 201 for a write the server had processed twice. Nothing in the page can
 * prevent that; only the server can (an idempotency key it honours, or a
 * uniqueness rule it enforces). Until that is verified on the backend for a
 * write, Mobile does not send it.
 *
 * Every form's write is registered here (forms/workflows.js `operation`), with
 * its send path in data/writeApi.js; registering one does not open it.
 *
 *   moves        whether it moves money
 *   key          "client": an Idempotency-Key per logical submission;
 *                "derived": the backend derives it (the occurrence); "none"
 *   serverDedup  what the backend source shows about a duplicate of this request
 *                (develop @ fd87531, fix/financial-idempotency-p0 @ c18d4ea, and its local,
 *                unpushed tip 6b696d72 where cited; docs/mobile/BACKEND-VERIFICATION-RESULTS.md):
 *     "unique-index"     a database unique rule refuses the copy, so no second record is
 *                        created. This is NOT idempotency: the copy is refused, not replayed,
 *                        so after a lost answer the refusal can come for a write that happened.
 *                        The category form drops its cached reads after such a 422, so the
 *                        list shows the category if the first copy made it
 *                        (categories/useCategoryMutation.js). forms/useWorkflowSubmit.js does
 *                        not: it reports a 422 as refused and keeps its cached reads. On
 *                        develop @ fd87531 a copy that races the first one can be answered 500.
 *     "key-atomic"       the key is completed in the same transaction as the money
 *     "key-fix-pending"  atomic only on the unmerged, undeployed fix branch
 *     "once-only"        row lock + "already done" check (a copy gets 409/422)
 *     "same-result"      a copy writes the same values again
 *     "next-open"        the request names no occurrence: the backend acts on the rule's next
 *                        open occurrence when the request arrives, and posting or skipping one
 *                        immediately creates the next. A copy therefore acts on the FOLLOWING
 *                        occurrence (RecurringTransactionController confirmNext/skipNext and
 *                        nextOpenOccurrence, PostOccurrenceAction has no due-date check,
 *                        RecurringScheduleService::advance -> materialise; develop @ fd87531 and
 *                        fix/financial-idempotency-p0 @ 6b696d72). NEVER_APPROVABLE: such a write
 *                        stays closed even if it is listed in APPROVED, until the backend takes
 *                        the occurrence in the request and the classification is changed.
 *                        Mobile already sends occurrence_id (forms/writePayloads.js). The backend
 *                        change that requires it exists only as UNCOMMITTED work in the
 *                        fix/financial-idempotency-p0 worktree (on top of 6b696d72): nothing
 *                        deployed takes it yet, so the classification stays "next-open".
 *     "duplicates"       nothing stops a copy: it creates a second record
 *     "unverified"       not established from the source
 */
const write = (endpoint, moves, key, serverDedup) => Object.freeze({ endpoint, moves, key, serverDedup });

export const MOBILE_WRITES = Object.freeze({
  // Categories (docs/mobile/CATEGORY-MANAGEMENT.md; CategoryController and the three actions are identical on develop @ fd87531 and
  // 6b696d72). The backend has exactly create, update (PUT/PATCH) and archive (POST /archive, DELETE is its alias): NO restore, no
  // archived listing (GET /categories returns active only), no parent on a write.
  // Create: a copy is refused with 422 on `name` (same name and type, case and spacing ignored, in the workspace: the (workspace_id,
  // type, name_key) unique index also counts ARCHIVED rows), never answered with the first category: no replay.
  "category.create": write("POST /categories", false, "none", "unique-index"),
  // Unchanged here. Evidence: UpdateCategoryAction excludes the category itself from its duplicate check, so a copy sets the same
  // values and succeeds ("same-result" would describe it); it is kept at the more cautious classification until a reviewed change.
  "category.update": write("PATCH /categories/{id}", false, "none", "unique-index"),
  // ArchiveCategoryAction: under a row lock; refused for a system category (422), one without a workspace (422), another workspace's
  // (403) and an already archived one (422). It sets is_active false and nothing else: transactions, budgets and every reference keep
  // pointing at it, and GET /categories/{id} still reads it. A copy after success is a 422 "already archived".
  "category.archive": write("POST /categories/{id}/archive", false, "none", "once-only"),

  // PostExpenseAction / PostIncomeAction (docs/mobile/TRANSACTION-CREATE.md). The key is required (StoreExpenseRequest /
  // StoreIncomeRequest, [A-Za-z0-9._:-]{8,255}), reserved per {workspace, user, "post_expense"|"post_income", key} with a
  // hash of the request: same key + same request replays the first transaction, same key + different request is a 409,
  // a key still processing is a 409. On develop @ fd87531 the posting and IdempotencyService::complete are TWO
  // transactions (run() without `atomic`), so a failure between them leaves the money posted and the key "processing",
  // and a key older than 24 h is recycled even for these operations. Both are fixed only on 6b696d72 (`atomic: true`,
  // FINANCIAL_OPERATIONS), which is unmerged and undeployed: hence "key-fix-pending", and these stay closed.
  "transaction.expense": write("POST /transactions/expense", true, "client", "key-fix-pending"),
  "transaction.income": write("POST /transactions/income", true, "client", "key-fix-pending"),
  // UpdateTransactionAction (docs/mobile/TRANSACTION-CHANGE.md): a correction is NOT an edit. It reverses the original and posts a
  // replacement (a new id, related_transaction_id = the original), both in ONE DB::transaction under row locks on the two accounts,
  // so the money is atomic on develop @ fd87531 and 6b696d72. What differs is the key: on develop run() completes it in a second
  // transaction (non-atomic: money corrected and the key still "processing"), recycles it after 24 h, and hashes the request
  // WITHOUT occurred_at, description and reference_number (the same key with another date replays the first correction instead
  // of being refused); on 6b696d72 it is atomic, never recycled and hashes everything. Develop also drops a statement upload's
  // provenance from the replacement. Hence "key-fix-pending", and Mobile does not correct imported transactions.
  "transaction.correct": write("PATCH /transactions/{id}", true, "client", "key-fix-pending"),
  // ReverseTransactionAction, identical on both refs: no key. The whole reversal runs in one DB::transaction with the accounts
  // locked first; the original is re-read under lock and refused when it is already reversed (409), a reversal, not posted, or a
  // debt's money (409 debt_transaction_requires_domain_reversal); it also refuses a reversal that would overdraw an account that
  // forbids a negative balance (422). A copy therefore reverses nothing twice (409), though after a lost answer that 409 cannot
  // tell "my request did it" from "already reversed": Mobile reports an unknown outcome and sends nothing more.
  "transaction.reverse": write("POST /transactions/{id}/reverse", true, "none", "once-only"),
  // TransferMoneyAction (identical on develop @ fd87531 and 6b696d72): the key is required (StoreTransferRequest,
  // [A-Za-z0-9._:-]{8,255}) and reserved per {workspace, user, "internal_transfer", key} with a hash of the request;
  // the debit, credit, optional fee and IdempotencyService::complete run in ONE DB::transaction under row locks on
  // both accounts (ascending id), so the key completes with the money or not at all. Same key + same request replays
  // the first transfer; same key + different request, or a key still processing, is a 409. Caveat on develop only:
  // a key older than 24 h is recycled even for a financial operation (fixed on 6b696d72 by FINANCIAL_OPERATIONS);
  // data/pendingWriteStorage.js keeps a key for 24 h from before it is sent, so Mobile never reuses one past that.
  "transfer.create": write("POST /transfers", true, "client", "key-atomic"),
  "transfer.reverse": write("POST /transfers/{id}/reverse", true, "none", "once-only"),
  "goal.contribution": write("POST /savings-goals/{id}/contributions", true, "client", "key-atomic"),
  "goal.withdrawal": write("POST /savings-goals/{id}/withdrawals", true, "client", "key-atomic"),
  "debt.payment": write("POST /debts/{id}/payments", true, "client", "key-fix-pending"),
  "debt.paymentReverse": write("POST /debt-payments/{id}/reverse", true, "none", "once-only"),
  // The derived key is the occurrence's, and the occurrence is chosen when the request arrives:
  // a copy is a different occurrence with a different key, and posts the next period's money.
  "recurring.confirmNext": write("POST /recurring-transactions/{id}/confirm-next", true, "derived", "next-open"),
  "receipt.confirm": write("POST /ai/expense-captures/{id}/confirm", true, "client", "key-atomic"),
  "voice.confirm": write("POST /ai/voice-expense-captures/{id}/confirm", true, "client", "key-atomic"),
  // Neither upload moves money or creates a transaction: it only stores the file and queues AI
  // reading. The key header is optional for the receipt and required for voice
  // (StoreAiExpenseCaptureRequest / StoreAiVoiceExpenseCaptureRequest on
  // fix/financial-idempotency-p0 @ 6b696d72); Mobile always sends one. Both are
  // reserved/completed through the same IdempotencyService as a money write, keyed to
  // {workspace_id, file_hash} (AiCaptureUploadService / AiVoiceCaptureAdmissionService), so a
  // retry with the same key and the same file replays the first capture and a different file
  // under a reused key is refused with a 409 rather than silently accepted.
  "receipt.upload": write("POST /ai/expense-captures", false, "client", "key-atomic"),
  "voice.upload": write("POST /ai/voice-expense-captures", false, "client", "key-atomic"),
  "whatsapp.confirm": write("POST /integrations/whatsapp/expense-drafts/{id}/confirm", true, "client", "key-atomic"),

  // The AI assistant (docs/mobile/AI-ASSISTANT.md). Identical on develop @ fd87531 and 6b696d72: routes, controllers, requests and
  // services (AiChatService, AiConversationService, AiFeedbackService, AiSettingsService, AiDataDeletionService, GenerateAiInsightsJob).
  // None moves money (the assistant is read-only over SmartSpend's facts), but a message and an insight refresh spend provider
  // quota, so each is still closed and none is ever resent by itself.
  //
  // A new conversation has no key and no dedup: a copy is another, empty conversation (harmless, visible in the list).
  "ai.conversationCreate": write("POST /ai/conversations", false, "none", "duplicates"),
  // SendAiMessageRequest requires `client_request_id` (<=100, [A-Za-z0-9._:-]). AiChatService stores the user/assistant pair BEFORE the
  // provider call (unique client_request_id per conversation) and a copy returns that stored pair (200, replayed) without calling the
  // provider again, including a copy that races the first (the unique violation is turned into the stored pair). Two caveats Mobile
  // handles: the replay does NOT compare the content (the same id with other text returns the first pair), so the id is bound to the
  // text; and a provider failure is stored too (the assistant message is `failed`), so a deliberate retry after a FAILED answer needs a
  // new id, while a retry after an UNKNOWN outcome keeps the same one. throttle:ai-generate (per minute and per day) runs before the controller.
  "ai.message": write("POST /ai/conversations/{id}/messages", false, "client", "same-result"),
  // ManageAiConversationRequest authorises the owner; the messages and the conversation are removed in one transaction. A copy is a 404.
  "ai.conversationDelete": write("DELETE /ai/conversations/{id}", false, "none", "once-only"),
  // AiFeedbackService upserts one feedback row per (user, message) and per (user, insight) under a row lock: a copy sets the same values.
  // (A "normal_activity" reason on an unusual-spending insight also dismisses it.)
  "ai.messageFeedback": write("POST /ai/messages/{id}/feedback", false, "none", "same-result"),
  "ai.insightFeedback": write("POST /ai/insights/{id}/feedback", false, "none", "same-result"),
  // 202: queues GenerateAiInsightsJob, which is ShouldBeUnique per {user}:{workspace}, so a copy while one is pending queues nothing; the
  // insights appear later, so Mobile never says they were refreshed. throttle:ai-generate applies. 422 when insights are switched off.
  "ai.insightsRefresh": write("POST /ai/insights/refresh", false, "none", "same-result"),
  // Sets status dismissed (and dismissed_at): a copy leaves the same state.
  "ai.insightDismiss": write("POST /ai/insights/{id}/dismiss", false, "none", "same-result"),
  // UpdateAiSettingsRequest: partial; sets the sent values under a row lock. ai_enabled=true is the consent decision (it creates or renews
  // consent), so Mobile only ever sends it as false. retention_days is 7..365 by default. throttle:ai-privacy applies.
  "ai.settings": write("PUT /ai/settings", false, "none", "same-result"),
  // DeleteAiDataRequest needs confirmation "DELETE_AI_DATA". Force-deletes the user's AI conversations, insights, feedback and usage logs in
  // one transaction and switches the assistant off until consent is given again. A copy deletes nothing more. Destructive, so Mobile asks
  // for an explicit acknowledgement. Nothing about money is touched.
  "ai.dataDelete": write("DELETE /ai/data", false, "none", "same-result"),

  // Accounts (docs/mobile/ACCOUNT-MANAGEMENT.md). The backend has exactly three account writes: create, update (PATCH/PUT) and
  // archive (POST /archive, and DELETE as an alias); there is NO restore and NO "make default" endpoint, so Mobile has no such
  // operation (is_default is read-only; archiving clears it).
  // Create has NO replay: a copy is refused (422 on `name`), never answered with the first account, so after a lost answer the
  // refusal can come for an account that exists. It stays "unique-index", is never retried, and Mobile reads its lists again after
  // that 422. Unique (workspace_id, name) on accounts: a copy is refused with 422 on `name` (StoreAccountRequest);
  // a racing copy is stopped by the index (500 on develop @ fd87531, 422 on 6b696d72 @ 296602e0). No key.
  "account.create": write("POST /accounts", false, "none", "unique-index"),
  // UpdateAccountAction (identical on both refs): partial, sets the sent values, so a copy leaves the same state. Refused for an
  // archived account (422), for a goal's account's type/currency/opening balance/negative setting (422), and once the account has
  // ledger entries for its opening balance and currency (422). The name is unique per workspace (422).
  "account.update": write("PATCH /accounts/{id}", false, "none", "same-result"),
  // ArchiveAccountAction (identical on both refs): under a row lock, refused when already archived (422), when it is a savings
  // goal's account (422, archive the goal) and when an active savings plan is funded from it (409 account_funds_active_savings_plan:
  // certain, nothing changed). It changes only status, archived_at and is_default; the ledger and history are untouched. A balance
  // does not block it. A copy after success is a 422 "already archived".
  "account.archive": write("POST /accounts/{id}/archive", false, "none", "once-only"),
  // Unique active_uniqueness_key (workspace, owner, scope, period, currency while active): a copy is
  // refused with 422 (StoreBudgetRequest); a racing copy is stopped by the index (500 on develop
  // @ fd87531, 409 DuplicateBudgetException on 6b696d72 @ 296602e0). No key.
  "budget.create": write("POST /budgets", false, "none", "unique-index"),
  "budget.update": write("PATCH /budgets/{id}", false, "none", "same-result"),
  // Key required since fix/financial-idempotency-p0 @ 6b696d72 (12644a03); a copy returns the first goal.
  "goal.create": write("POST /savings-goals", false, "client", "key-fix-pending"),
  "goal.update": write("PATCH /savings-goals/{id}", false, "none", "same-result"),
  "goal.plannedContribution": write("POST /savings-goals/{id}/planned-contributions", false, "none", "duplicates"),
  // Key required since fix/financial-idempotency-p0 @ 6b696d72 (0d798c57); a copy returns the first rule.
  "recurring.create": write("POST /recurring-transactions", false, "client", "key-fix-pending"),
  "recurring.update": write("PATCH /recurring-transactions/{id}", false, "none", "same-result"),
  // No key and no occurrence in the request: a copy skips the following occurrence too.
  "recurring.skipNext": write("POST /recurring-transactions/{id}/skip-next", false, "none", "next-open"),
  // Key required since fix/financial-idempotency-p0 @ 6b696d72 (a04c8684); a copy returns the first debt.
  "debt.create": write("POST /debts", false, "client", "key-fix-pending"),
  "debt.update": write("PATCH /debts/{id}", false, "none", "same-result"),
  "profile.update": write("PUT /profile", false, "none", "same-result"),
  // A copy after success fails on the current password, so the answer can say "refused" for a change that happened.
  "profile.password": write("PATCH /profile/password", false, "none", "unverified"),
  "export.create": write("POST /report-exports", false, "none", "duplicates"),

  // Notifications are the signed-in user's own (scoped by user_id, not by workspace) and move no money.
  // NotificationService::markRead sets read_at only while it is null and otherwise returns the row as it is,
  // so a copy changes nothing and answers with the same row; markAllRead updates only the caller's unread
  // rows, so a copy marks 0. Another person's notification is a 404, never a 403
  // (NotificationController::authorizeOwnership); a 403 comes only from the inactive-account middleware.
  // Both answer with the server's own unread_count. Identical on develop @ fd87531 and
  // fix/financial-idempotency-p0 @ 6b696d72 (docs/mobile/NOTIFICATION-WRITES.md).
  "notifications.markRead": write("PATCH /notifications/{id}/read", false, "none", "same-result"),
  "notifications.markAllRead": write("POST /notifications/read-all", false, "none", "same-result"),
  // The one notification preference (savings_installment_reminders), sent as the explicit wanted value, never a toggle.
  // NotificationPreferenceService::update locks the user's row (a unique user_id, inserted with insertOrIgnore on the
  // first change) and sets that value, so a copy leaves the same state; switching on when already on keeps the resume
  // point (test_switching_on_when_already_on_does_not_reset_the_resume_point). The owner is the token's (user_id in the
  // body is removed). Identical on develop @ fd87531 and fix/financial-idempotency-p0 @ 6b696d72.
  "notifications.preferences": write("PATCH /notifications/preferences", false, "none", "same-result"),
});

const APPROVED = Object.freeze([]);

/*
 * Test-only override. `import.meta.env.MODE` is a literal in every Vite build ("production",
 * "preview", "staging"...), so outside the test runner (tests/helpers/loader.mjs sets "test")
 * TESTING is the constant false: the override is never read, setWriteApprovalsForTests() throws
 * if something calls it, and the bundler drops both. tests/mobileBundle.test.mjs checks the built
 * output for this.
 */
const TESTING = import.meta.env.MODE === "test";
let testOverride = null;

/*
 * Classifications no approval can open: a write with one of these stays closed even if it is
 * listed in APPROVED (or in the test switch). Opening one needs the backend fixed first and
 * its classification changed above, in a reviewed commit.
 */
export const NEVER_APPROVABLE = Object.freeze(["next-open"]);

const approvable = (operation) => !NEVER_APPROVABLE.includes(MOBILE_WRITES[operation].serverDedup);

/** Whether this write may be sent. Unknown names and never-approvable writes are closed. */
export const isWriteOpen = (operation) => Object.hasOwn(MOBILE_WRITES, operation) && approvable(operation) && (TESTING && testOverride ? testOverride : APPROVED).includes(operation);

/** Thrown by the write facade instead of sending: nothing left the browser. */
export class WriteClosedError extends Error {
  constructor(operation) {
    super(`Mobile does not send ${operation}.`);
    this.name = "WriteClosedError";
    this.code = "WRITE_CLOSED";
    this.operation = operation;
  }
}

export function assertWriteOpen(operation) {
  if (!isWriteOpen(operation)) throw new WriteClosedError(operation);
}

/** Tests only: open these writes (an array of names), or `null` to go back to APPROVED. */
export function setWriteApprovalsForTests(operations) {
  if (!TESTING) throw new Error("SMARTSPEND_TEST_ONLY_WRITE_GATE: write approvals can only be overridden by the test runner.");
  testOverride = operations === null ? null : Object.freeze([...operations]);
}
