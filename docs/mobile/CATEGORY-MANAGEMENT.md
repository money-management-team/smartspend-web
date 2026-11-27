# Mobile — category management (Phase 2E)

**Categories → a new category / a category's page → Edit or Archive → review → confirm → the server's result.** The operations `category.create`, `category.update` and `category.archive` are **closed**: `APPROVED` in `src/mobile/data/writeGate.js` is empty. This builds on [S04B4-category-management.md](S04B4-category-management.md) (the list, the page, create and rename) and [S04B4.1-mutation-safety-hardening.md](S04B4.1-mutation-safety-hardening.md).

## What the backend supports (read from the source, never from production)

Refs: `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72` (`git show`). `CategoryController`, `Store/UpdateCategoryRequest`, `Create/Update/ArchiveCategoryAction` and `CategoryResource` are **identical** on both. Routes: `GET /categories`, `GET /categories/{id}`, `POST /categories`, `PUT|PATCH /categories/{id}`, `POST /categories/{id}/archive`, `DELETE /categories/{id}` (an alias of archive).

**Not supported, so not built:**
- **Restore.** There is no endpoint or action. An archived category stays archived.
- **An archived list or an active/archived filter.** `GET /categories` returns active categories only (`is_active = true`); it has no status parameter. An archived category is readable only by id (`GET /categories/{id}`), which its own page does.
- **Parents or subcategories on a write.** `CreateCategoryAction` sets `parent_id = null`; no request has a parent field. The list still groups under a parent when the data clearly says so (S04B3).
- **Search.** The list has no search parameter.

### Create: `POST /categories`
- **Body:** `workspace_id` (exists), `name` (required, max 255), `type` (`income` | `expense`), optional `color` (`#RRGGBB`, max 20), optional `icon` (max 50).
- **Authorization:** the workspace must be one the user manages, else 403.
- **Duplicates:** refused with a **422 on `name`** when the workspace already has a category with the same type and the same `name_key` (lower-cased, spaces collapsed). The unique index `(workspace_id, type, name_key)` has **no `is_active` condition, so an archived category keeps its name**, and with no restore that name is gone for that type. The same name under the other type is allowed. A racing copy is caught by the index and answered with the same 422.
- **Answer:** 201 `{ data: { category } }`. The category is custom (`is_system` false), active, `sort_order` 0.
- **No replay.** A copy is refused, never answered with the first category. **`unique-index` is not idempotency:** after a lost answer the 422 can come for a category that exists. Classification unchanged: `unique-index`.

### Update: `PATCH /categories/{id}`
- Partial: `name`, `type`, `color`, `icon` (colour and icon nullable).
- **Refused (422):** a system category, a category with no workspace, an archived category, a duplicate name and type (the category itself is excluded), and a **type change once any transaction uses the category**. 403 for another workspace's category; 404 when it isn't visible.
- Mobile **never sends the type**: even where the backend would allow it (no transaction yet), changing it changes what the category means, and the full version asks for an explicit confirmation of it.
- **Classification:** unchanged at `unique-index`. The source shows a copy sets the same values and succeeds (`same-result` would describe it); it was left at the more cautious value, as the task requires, with the evidence in `writeGate.js`.

### Archive: `POST /categories/{id}/archive`
- Under a row lock. **Refused (422):** a system category, one with no workspace, an already archived one. 403 for another workspace's.
- It sets `is_active = false` **and nothing else**: no transaction, budget, import mapping or report reference changes, and the category stays readable. A copy after success is a 422 "already archived" (**`once-only`**, a new registration).
- **History:** transactions keep their `category_id` and show it. New transactions, budgets and imports require an **active** category (the posting actions, `StoreBudgetRequest` and the import mapping check `is_active`), so an archived category can't be chosen again. A budget that already uses it is not touched by the archive.
- **Balances and ledger:** none are touched (categories never hold money).

## What Mobile does

Already in place (S04B4, audited, behaviour kept): the list (active, with the backend's type filter, your own first and the system ones after), the category page (read-only facts), a new category (name and type) and a rename, with their own mutation hook: one request per submission, nothing resent, proof required for "created", certain refusals only where the contract says so, the lists read again after a write that may have happened or a duplicate refusal.

Added in this phase:
- **Colour and icon** on create and edit (optional), from the same presets the full version offers. An edit sends only what changed (a cleared colour or icon as `null`). A created or edited category is "confirmed" only when the answer carries the sent colour and icon.
- **A review step** for create and edit: what would be sent, and for an edit what each detail was ("Was: …"). Only the review's Confirm sends.
- **Archive** (`category-archive`, through the shared forms engine): the review shows the category and what archiving means (history stays, no new use, the name stays taken, no restore); the confirmed result shows the server's category as archived. Only your own, active category is offered it.
- **Expense and income** are kept apart in the list: a heading per type when a section holds both.
- The Archive link on a category's page, only for a category you can change.
- New registration `category.archive` (`once-only`), with its evidence. `category.create` and `category.update` are unchanged.

## Unknown outcomes

- **Create:** after a lost answer the form says it is unknown and sends nothing more. A retry after a reload is refused as a duplicate; the list is read again then, so the first copy shows.
- **Update:** nothing resent; the page can be re-read.
- **Archive:** after a lost answer a reload reads the category as archived, so the form is not offered again; a copy would be refused with a 422, never repeated.

## Tests

`tests/mobileCategoryManagement.test.mjs` (28 tests) against a fake backend that follows the rules above: the registration (no restore operation), the closed gate (zero requests), who is offered what, expense/income separation and the backend's type filter, create with colour and icon (review, payload, proof), duplicates (case, spacing, archived, other type), double tap, lost answer then retry, invalid payloads, edit (prefill, locked type, "Was", only the changed fields, cleared values, a refused duplicate, the type refused once transactions exist, system/archived/other-workspace categories), archive (review text, payload with no body and no key, result, the list no longer showing it, refusals, double tap, lost answer, unverifiable answers), Arabic, and the builders and proofs. The existing category suites were updated for the review step (submit opens it, Confirm sends).

## Before opening

1. **Create** has no replay on any ref: opening it is an explicit risk decision (a lost answer is recoverable by reading the list, not provable), or it waits for a keyed create on the backend.
2. **Update and archive** are safe by construction; they need a staging run (a rename, a colour change, an archive; a duplicate; a system category; the type refused once used).
3. The 408 evidence, a recorded per-write approval, then a separate commit adding the operations to `APPROVED`.
