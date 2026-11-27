import { tx } from "./mobileApi.mjs";

/*
 * A fictional transaction history for browser checks: three named days, then
 * every kind of record the screens have to draw (income, expense, transfer,
 * reversed, reversal, replacement, pending, draft, failed, an unknown status,
 * long Arabic text, a very large amount, other currencies), and plain expenses
 * on earlier days to reach 60 rows (three pages).
 */
const iso = (day, hour = 10) => `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000000Z`;
const line = (id, accountId, amount, role, name = "Everyday wallet", currency = "ILS") => ({ id: id * 10 + accountId, workspace_id: 1, transaction_id: id, account_id: accountId, currency_code: currency, signed_amount: amount, entry_role: role, account: { id: accountId, name } });

export function activityFixture() {
  const rows = [
    tx(1, { description: "Groceries", amount: "45.2500", occurred_at: iso(26, 12) }),
    tx(2, { type: "income", description: "Salary", amount: "3000.0000", occurred_at: iso(26, 9), category: { id: 5, name: "Salary" }, category_id: 5, ledger_entries: [line(2, 1, "3000.0000", "income")] }),
    tx(3, { type: "transfer", description: "Move to savings", amount: "400.0000", occurred_at: iso(25, 15), transfer_id: 9, category: null, category_id: null, ledger_entries: [line(3, 1, "-400.0000", "source"), line(3, 2, "400.0000", "destination", "Savings jar")] }),
    tx(4, { description: "Duplicate lunch", status: "reversed", amount: "30.0000", occurred_at: iso(25, 12), reversed_at: "2026-10-25T14:00:00.000000Z", reversal_reason: "Entered twice", ledger_entries: [line(4, 1, "-30.0000", "expense")] }),
    tx(5, { type: "reversal", description: null, category: null, category_id: null, amount: "30.0000", reversal_of_id: 4, occurred_at: iso(25, 11), ledger_entries: [line(5, 1, "30.0000", "reversal")] }),
    tx(6, { description: "Corrected groceries", amount: "50.0000", related_transaction_id: 1, occurred_at: iso(24, 18), ledger_entries: [line(6, 1, "-50.0000", "expense")] }),
    tx(7, { description: "Awaiting review", status: "pending_review", amount: "12.0000", occurred_at: iso(24, 12) }),
    tx(8, { description: "Half done", status: "draft", amount: "1.0000", occurred_at: iso(24, 11) }),
    tx(9, { description: "Did not go through", status: "failed", amount: "2.0000", occurred_at: iso(23, 12) }),
    tx(10, { description: "Odd status record", status: "settling", amount: "3.0000", occurred_at: iso(23, 11) }),
    tx(11, { description: "فاتورة الكهرباء الشهرية لمنزل العائلة في الطابق الثالث مع رسوم الصيانة السنوية والتأمين", amount: "212.7500", occurred_at: iso(22, 12), category: { id: 6, name: "فواتير" }, category_id: 6 }),
    tx(12, { type: "income", description: "Consulting retainer for the whole quarter", amount: "123456789012.3456", occurred_at: iso(22, 9), category: { id: 5, name: "Salary" }, category_id: 5, ledger_entries: [line(12, 1, "123456789012.3456", "income")] }),
    tx(13, { description: "Hotel", currency_code: "EUR", amount: "180.5000", occurred_at: iso(21, 12), ledger_entries: [line(13, 4, "-180.5000", "expense", "Euro card", "EUR")] }),
    tx(14, { description: "Books", currency_code: "USD", amount: "24.9900", occurred_at: iso(21, 10), ledger_entries: [line(14, 3, "-24.9900", "expense", "Dollar savings", "USD")] }),
    tx(15, { description: "No date given", occurred_at: null }),
  ];

  for (let id = 16; id <= 60; id += 1) rows.push(tx(id, { description: `Filler ${id}`, amount: "1.0000", occurred_at: iso(20 - (id % 18), 10) }));
  return rows;
}
