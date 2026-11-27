/*
 * A 409 from a transaction write is not always the same thing: a key still
 * processing, a key reused with different values, an already-reversed
 * record, and this specific, named case (smartspend-backend
 * PossibleDuplicateTransactionException, config/finance.php
 * manual_duplicate_guard — off by default) all answer 409. Only the backend's
 * own machine-readable `code` on the body tells them apart; the status alone
 * never does. Mobile keeps its own copy of this (like the rest of
 * data/writeGate.js's notes) rather than importing the full version's
 * transactionHelpers.js.
 */
export const isPossibleDuplicateError = (error) => error?.serverCode === "possible_duplicate";

/**
 * The transaction a possible-duplicate 409's body says this looks like
 * (smartspend-backend bootstrap/app.php: `data.matched_transaction`), or null
 * when the body isn't that documented shape — so a caller never shows a
 * confirmation step around data it can't actually read.
 */
export function possibleDuplicateMatch(error) {
  const matched = error?.payload?.data?.matched_transaction;
  // A genuine JSON integer (TransactionController), never converted: this
  // reads `id`, never an amount, so it stays out of forms/writePayloads.js's
  // Number()-for-ids-only exception too (tests/mobileReadOnly.test.mjs).
  return matched && typeof matched === "object" && Number.isFinite(matched.id)
    ? matched
    : null;
}
