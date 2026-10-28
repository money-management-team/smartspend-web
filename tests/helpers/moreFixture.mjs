import { envelope, failure } from "./mobileApi.mjs";
import { paginator } from "./planningFixture.mjs";

/*
 * Fictional debts, payments, transfers, notifications and calendar events, and a
 * fake backend that filters and pages them like the documented endpoints.
 */

export const debt = (id, over = {}) => ({
  id,
  workspace_id: 1,
  direction: "payable",
  counterparty_name: `Person ${id}`,
  original_amount: "1500.0000",
  paid_amount: "500.0000",
  remaining_amount: "1000.0000",
  currency_code: "ILS",
  issued_at: "2026-08-01",
  due_date: "2026-12-01",
  status: "partially_paid",
  is_overdue: false,
  effective_status: "partially_paid",
  days_until_due: 34,
  opening_transaction_id: null,
  has_movement: false,
  payments_count: 1,
  notes: null,
  settled_at: null,
  archived_at: null,
  ...over,
});

export const payment = (id, debtId, over = {}) => ({
  id,
  debt_id: debtId,
  amount: "500.0000",
  currency_code: "ILS",
  paid_at: "2026-09-15",
  status: "posted",
  is_reversed: false,
  transaction_id: 30 + id,
  account: { id: 1, name: "Cash", type: "cash", currency_code: "ILS" },
  ...over,
});

export const transfer = (id, over = {}) => ({
  id,
  from_account_id: 2,
  to_account_id: 1,
  amount: "400.0000",
  fee_amount: "0.0000",
  currency_code: "ILS",
  status: "posted",
  occurred_at: "2026-10-10T12:00:00Z",
  posted_at: "2026-10-10T12:00:01Z",
  from_account: { id: 2, name: "Bank" },
  to_account: { id: 1, name: "Cash" },
  fee_category: null,
  ...over,
});

export const notification = (id, over = {}) => ({
  id,
  type: "recurring_posted",
  severity: "info",
  title: `Notice ${id}`,
  body: "An expense was posted.",
  subject_type: "recurring_transaction",
  subject_id: 3,
  amount: "500.0000",
  currency_code: "ILS",
  is_read: false,
  read_at: null,
  created_at: "2026-10-15T09:00:00Z",
  ...over,
});

export const event = (id, date, over = {}) => ({ id: `debt_due:${id}`, type: "debt_due", title: `Due ${id}`, date, status: "active", amount: "100.0000", currency_code: "ILS", severity: "warning", subject_type: "debt", subject_id: id, ...over });

// The notifications endpoint documents its paginator without from/to.
const withoutRange = ({ from, to, ...rest }) => (void from, void to, rest);

export function moreBackend({ debts = [], payments = {}, transfers = [], notifications = [], events = null } = {}) {
  return (call) => {
    const q = call.query;
    const page = { page: Number(q.page ?? 1), perPage: Number(q.per_page ?? 20) };

    if (call.path === "/debts") {
      const rows = debts.filter((row) => (!q.direction || row.direction === q.direction) && (!q.status || row.effective_status === q.status || row.status === q.status));
      return { body: envelope({ debts: paginator(rows, page) }) };
    }
    const debtPayments = /^\/debts\/(\d+)\/payments$/.exec(call.path);
    if (debtPayments) return { body: envelope({ payments: paginator(payments[debtPayments[1]] ?? [], page) }) };
    const oneDebt = /^\/debts\/(\d+)$/.exec(call.path);
    if (oneDebt) {
      const found = debts.find((row) => String(row.id) === oneDebt[1]);
      return found ? { body: envelope({ debt: found }) } : failure(404, "Not found");
    }

    if (call.path === "/transfers") return { body: envelope({ transfers: paginator(transfers.filter((row) => !q.status || row.status === q.status), page) }) };
    const oneTransfer = /^\/transfers\/(\d+)$/.exec(call.path);
    if (oneTransfer) {
      const found = transfers.find((row) => String(row.id) === oneTransfer[1]);
      return found ? { body: envelope({ transfer: found }) } : failure(404, "Not found");
    }

    if (call.path === "/notifications") {
      const rows = notifications.filter((row) => !q.status || (q.status === "read") === row.is_read);
      return { body: envelope({ notifications: withoutRange(paginator(rows, page)), unread_count: notifications.filter((row) => !row.is_read).length }) };
    }

    if (call.path === "/calendar") {
      const month = String(q.month).padStart(2, "0");
      const days = new Date(Date.UTC(Number(q.year), Number(q.month), 0)).getUTCDate();
      const list = (events ?? []).filter((item) => item.date.startsWith(`${q.year}-${month}-`));
      return { body: envelope({ period: { from: `${q.year}-${month}-01`, to: `${q.year}-${month}-${days}`, view: "month" }, events: list, summary: { total: list.length, by_type: {}, by_status: {}, by_severity: {} } }) };
    }

    return failure(404, "Not found");
  };
}
