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
 *                (develop @ fd87531, fix/financial-idempotency-p0 @ c18d4ea;
 *                docs/mobile/BACKEND-VERIFICATION-RESULTS.md):
 *     "unique-index"     a database unique rule refuses the copy (422)
 *     "key-atomic"       the key is completed in the same transaction as the money
 *     "key-fix-pending"  atomic only on the unmerged, undeployed fix branch
 *     "once-only"        row lock + "already done" check (a copy gets 409/422)
 *     "same-result"      a copy writes the same values again
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
  "recurring.confirmNext": write("POST /recurring-transactions/{id}/confirm-next", true, "derived", "key-atomic"),
  "receipt.confirm": write("POST /ai/expense-captures/{id}/confirm", true, "client", "key-atomic"),
  "voice.confirm": write("POST /ai/voice-expense-captures/{id}/confirm", true, "client", "key-atomic"),
  "whatsapp.confirm": write("POST /integrations/whatsapp/expense-drafts/{id}/confirm", true, "client", "key-atomic"),

  "account.create": write("POST /accounts", false, "none", "duplicates"),
  "account.update": write("PATCH /accounts/{id}", false, "none", "same-result"),
  "account.archive": write("POST /accounts/{id}/archive", false, "none", "once-only"),
  "budget.create": write("POST /budgets", false, "none", "duplicates"),
  "budget.update": write("PATCH /budgets/{id}", false, "none", "same-result"),
  "goal.create": write("POST /savings-goals", false, "none", "duplicates"),
  "goal.update": write("PATCH /savings-goals/{id}", false, "none", "same-result"),
  "goal.plannedContribution": write("POST /savings-goals/{id}/planned-contributions", false, "none", "duplicates"),
  "recurring.create": write("POST /recurring-transactions", false, "none", "duplicates"),
  "recurring.update": write("PATCH /recurring-transactions/{id}", false, "none", "same-result"),
  // No key and no occurrence in the request: whether a copy skips a second occurrence is not established.
  "recurring.skipNext": write("POST /recurring-transactions/{id}/skip-next", false, "none", "unverified"),
  "debt.create": write("POST /debts", false, "none", "duplicates"),
  "debt.update": write("PATCH /debts/{id}", false, "none", "same-result"),
  "profile.update": write("PUT /profile", false, "none", "same-result"),
  // A copy after success fails on the current password, so the answer can say "refused" for a change that happened.
  "profile.password": write("PATCH /profile/password", false, "none", "unverified"),
  "export.create": write("POST /report-exports", false, "none", "duplicates"),
});

const APPROVED = Object.freeze([]);

let testOverride = null;

/** Whether this write may be sent. Unknown names are closed. */
export const isWriteOpen = (operation) => Object.hasOwn(MOBILE_WRITES, operation) && (testOverride ?? APPROVED).includes(operation);

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
  testOverride = operations === null ? null : Object.freeze([...operations]);
}
