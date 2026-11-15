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
 *     "duplicates"       nothing stops a copy: it creates a second record
 *     "unverified"       not established from the source
 */
const write = (endpoint, moves, key, serverDedup) => Object.freeze({ endpoint, moves, key, serverDedup });

export const MOBILE_WRITES = Object.freeze({
  "category.create": write("POST /categories", false, "none", "unique-index"),
  "category.update": write("PATCH /categories/{id}", false, "none", "unique-index"),

  "transaction.expense": write("POST /transactions/expense", true, "client", "key-fix-pending"),
  "transaction.income": write("POST /transactions/income", true, "client", "key-fix-pending"),
  "transaction.correct": write("PATCH /transactions/{id}", true, "client", "key-fix-pending"),
  "transaction.reverse": write("POST /transactions/{id}/reverse", true, "none", "once-only"),
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

  // Unique (workspace_id, name) on accounts: a copy is refused with 422 on `name` (StoreAccountRequest);
  // a racing copy is stopped by the index (500 on develop @ fd87531, 422 on 6b696d72 @ 296602e0). No key.
  "account.create": write("POST /accounts", false, "none", "unique-index"),
  "account.update": write("PATCH /accounts/{id}", false, "none", "same-result"),
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
