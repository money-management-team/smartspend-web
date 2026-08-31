# SmartSpend API → React Pages

| React page | Connected endpoints |
|---|---|
| Login | `POST /login` |
| Register | `POST /register` |
| Dashboard | `GET /dashboard`, `GET /user` |
| Accounts | `GET /accounts`, `POST /accounts`, `PUT /accounts/{id}`, `POST /accounts/{id}/archive` |
| Financial Operations | `GET /accounts`, `GET /categories`, `GET /transactions`, `POST /transactions/income`, `POST /transactions/expense`, `POST /transfers`, `POST /transactions/{id}/reverse` |
| Budgets | `GET /budgets`, `POST /budgets`, `PUT /budgets/{id}`, `DELETE /budgets/{id}`, `GET /categories?type=expense` |
| Savings Goals | `GET /savings-goals`, `POST /savings-goals`, `PUT /savings-goals/{id}`, `DELETE /savings-goals/{id}`, `POST /savings-goals/{id}/contributions`, `GET /accounts` |
| Notifications | `GET /financial-alerts` |
| Reports | `GET /dashboard?date_from=...&date_to=...` |
| Settings / Profile | `GET /user`, `PUT /profile` |
| Logout | `POST /logout` |

## Intentionally left without invented API calls

The supplied backend reference does not document endpoints for:

- Recurring Operations
- Import / Smart Capture
- AI Assistant / AI Insights
- Upcoming Bills
- Forgot password / reset password / verification screens

Those screens were not connected to made-up endpoints.
