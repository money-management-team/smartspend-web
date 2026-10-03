# Planned savings contributions — develop backend

The goal detail page loads `GET /savings-goals/{id}/planned-contributions` and shows the server's own `planned`, `fulfilled`, and `cancelled` states. The response has `data.planned_contributions` as an array and `data.pagination` as a separate object. The list can be filtered by status and paged.

Creating a plan sends `from_account_id`, a four-decimal `amount` string, `planned_date` and optional `notes` to `POST /savings-goals/{id}/planned-contributions`. Editing uses `PATCH /.../{planId}`. Cancel uses `DELETE /.../{planId}` and keeps the row in history. These operations change planning data only; they require no financial idempotency key.

Fulfil uses the existing contribution form and `POST /savings-goals/{id}/contributions` with `planned_contribution_id`, the matching source account and a financial `Idempotency-Key`. The planned amount can be changed at confirmation. The backend posts the transfer, goal movement and plan fulfilment atomically. If the source account is no longer eligible, the form disables confirmation; the user can edit the plan to another eligible account. A future plan can be funded early because the backend does not require the scheduled day for fulfilment.

The frontend does not reserve money or calculate the forecast. Only the backend includes eligible pending plans in the forecast. After fulfilment, both the goal's progress and the planned list refresh.

The accounts API validates `workspace_id`. The shared accounts client translates older frontend `id_workspace` callers to that field, so account choices remain scoped to the goal's workspace. Financial alerts still use their own `id_workspace` contract.

## Verification before deployment

1. Apply the new `create_planned_savings_contributions_table` migration to Laravel Cloud and confirm that develop has been deployed there before releasing the new frontend.
2. Create, edit, cancel, and fulfil a plan in staging with a real account; confirm balances change only after fulfilment, the plan becomes `fulfilled`, and the activity shows one posted movement. Retry the financial request with the same key and confirm no duplicate transfer.
3. Check forecast changes when a pending plan is created/cancelled/fulfilled and no change from cancelled or fulfilled plans.
4. Check an archived source account and a paused goal, plus 403/404/409/422 responses. The frontend build and lint checks alone do not prove these live behaviours.
