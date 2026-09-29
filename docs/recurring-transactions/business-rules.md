# Recurring Transactions — Business Rules

## A rule is not a transaction

| Action | Moves money? |
| --- | --- |
| Create, edit, pause, resume, archive | No |
| Skip next | No — the occurrence is closed as `skipped` |
| Confirm next | **Yes** — the oldest open occurrence is posted as a real transaction |
| Backend scheduler (automatic rules) | **Yes**, on the due date — never simulated by the frontend |

The UI never adjusts a balance after any of these; the pages that show balances read them from the backend when they load.

## Action matrix (`getRuleActions`)

| Status | Edit | Pause | Resume | Confirm / Skip next | Archive |
| --- | --- | --- | --- | --- | --- |
| `active` | ✓ | ✓ | — | ✓ while an occurrence is open* | ✓ |
| `paused` | ✓ | — | ✓ | — | ✓ |
| `completed` | — | — | — | — | ✓ |
| `archived` | — | — | — | — | — |
| unknown | — | — | — | — | — |

\* "Open" comes from `schedule.open_occurrences_count` (or `schedule.next_occurrence`). When a response has no schedule at all (list rows), the buttons are offered and the backend decides — a 422 "nothing open" is shown as such.

The backend is the final authority: every action still handles its rejection (422 / 409), and the page is refreshed afterwards.

## Editable vs structural fields

| Editable (PATCH) | Fixed after creation |
| --- | --- |
| name, amount, interval, end date, max occurrences, processing mode, description, notes, metadata | type, account, category, currency, frequency, start date, anchor day, status, next due date, last processed at |

- The edit form shows the fixed fields read-only with: *"These fields define the rule and can't be changed. To change them, create a new rule and archive this one."* Nothing fakes a structural edit.
- **A new amount applies to open, unposted occurrences only.** Posted transactions keep their amount (stated in the form).

## Pause and resume

- **Pause** (`POST …/pause`, no body): temporary. No occurrences are posted and automatic processing stops. It is not an archive.
- **Resume** (`POST …/resume`, no body): the backend recalculates `next_due_date`. **Periods missed while paused are not posted retroactively**; the UI never creates or posts them.
- A rule that can't be paused/resumed answers 422, shown in the dialog.

## Archive (`DELETE`)

- Archiving is **not deletion** — the UI never says "delete permanently".
- Future occurrences stop; open ones are cancelled by the backend; posted transactions and the whole occurrence history are kept.
- The page stays on the archived rule, now read-only, and the history (including `cancelled` occurrences) remains visible.
- Archiving an archived rule returns 409 ("already archived").

## Occurrence history

Every status stays listed: `posted` (with a link to its transaction), `skipped` (with the reason), `failed` (with `failure_reason` and `attempts`), `cancelled`, `scheduled`, `due`. `is_overdue` is the backend's flag, shown as a badge; it is never computed from dates.

## Form validation (client side, before sending)

| Field | Rule |
| --- | --- |
| Type | income or expense (create) |
| Account | required (create); active, not a savings-goal container |
| Category | **required for both types** (create); the list is refetched for the selected type and the choice is cleared when the type changes |
| Name | required, ≤ 150 |
| Amount | positive, ≤ 4 decimals (shared `getAmountError`) |
| Frequency | weekly / monthly / yearly (create) |
| Interval | integer 1–60 |
| Start date | required (create; defaults to today) |
| End date | optional, ≥ start date |
| Max occurrences | optional, integer 1–1000 |
| Processing mode | manual / automatic |
| Skip reason | optional, ≤ 500 |

Backend field errors (`account_id`, `category_id`, `name`, `type`, `amount`, `currency_code`, `frequency`, `interval`, `start_date`, `end_date`, `max_occurrences`, `processing_mode`, `description`, `notes`, `reason`) are shown under the matching input; errors for fields without an input are listed in the error block.

## Processing modes (as explained in the form)

- **Manual:** nothing is posted until the user confirms an occurrence; they can also skip one.
- **Automatic:** the server posts each occurrence on its due date. If posting fails (for example, insufficient balance), the occurrence is marked failed and can be confirmed again later.
