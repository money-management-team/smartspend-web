/*
 * Every write Mobile has code for, and whether it may be sent. All are closed.
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
 * `serverDedup` is what is known about the server's protection: every value is
 * "unverified" because the backend repository has not been available.
 */
export const MOBILE_WRITES = Object.freeze({
  "category.create": Object.freeze({ endpoint: "POST /categories", serverDedup: "unverified" }),
  "category.update": Object.freeze({ endpoint: "PATCH /categories/{id}", serverDedup: "unverified" }),
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
