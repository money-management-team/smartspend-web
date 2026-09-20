# Statement imports — idempotency

Confirm and reverse are the only import calls that move money, and both send an `Idempotency-Key`. Everything else (upload, mapping, validate, preview, row update, row ignore, cancel, list, get) sends none, because repeating it cannot post a transaction twice.

## Where the key comes from

Both use `createIdempotentAttempt(prefix)` from `FinancialOperations/transactionHelpers.js`, the same helper the transfer and transaction screens use. No new idempotency infrastructure was added.

```js
const attemptRef = useRef(null);
attemptRef.current ??= createIdempotentAttempt("import-confirm");

const idempotencyKey = attemptRef.current.keyFor({ import: importRecord.id });
// … call …
attemptRef.current.settle(error);   // or settle(null) on success
```

The attempt object lives in a ref for the whole life of the component, so it survives re-renders.

## What `keyFor` guarantees

`keyFor(payload)` fingerprints the payload. The same fingerprint returns the **same** key; a different one mints a new key. So:

- **Confirm** is keyed by `{ import: id }`. Every retry of the same import — after a timeout, a network blip, or a double click — reuses one key, and the backend can only post the import once.
- **Reverse** is keyed by `{ import: id, reason }`. Retrying the same reversal reuses the key; editing the reason is genuinely a new reversal intent and gets a new one.

## What `settle` guarantees

`settle(error)` clears the key only when the outcome is definitive — success, or a `VALIDATION_ERROR` / `FORBIDDEN` / `NOT_FOUND` / `UNAUTHENTICATED` / `REQUEST_FAILED` rejection. An **unknown** outcome (timeout, network failure, 5xx, 429) keeps the key, so the retry that follows cannot move the money a second time.

A fresh key is never minted "blindly after uncertainty" — that is exactly the case the helper is built to prevent.

## Double-submit protection

Each component also guards with a `pendingRef` checked at the top of the handler and a `disabled` / `aria-busy` button while the request is in flight. The ref guard, not just the disabled attribute, is what makes a fast double click a no-op.

## 409 is not a retry

A `409` means the backend already did it: *"This import has already been confirmed."* or *"…already been reversed."*

On a 409 the frontend:

1. **never** sends the operation again;
2. **never** mints a fresh idempotency key;
3. re-reads the import through `GET /imports/{id}` and shows its real state, so the user sees what actually happened rather than an error they might try to "fix" by clicking again.

`isImportLifecycleConflict(error)` marks this case, and `getImportErrorMessage(error, t, "confirm" | "reverse")` gives it its own wording.
