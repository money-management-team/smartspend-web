import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchAccountStatement,
  statementCsv,
} from "../src/features/Dashboards/User/AccountDetails/accountStatement.js";

const account = {
  id: 10,
  workspace_id: 3,
  currency_code: "ILS",
  name: "Wallet",
  status: "active",
};
const dates = { from: "2026-10-01", to: "2026-10-31" };
const transaction = (id, signed = "-1.0000", extra = {}) => ({
  id,
  workspace_id: 3,
  type: "expense",
  status: "posted",
  occurred_at: "2026-10-02T12:00:00.000000Z",
  description: "Lunch",
  amount: "100.0000",
  currency_code: "ILS",
  ledger_entries: [
    {
      id: id * 10,
      transaction_id: id,
      workspace_id: 3,
      account_id: 10,
      signed_amount: signed,
      currency_code: "ILS",
      entry_role: "expense",
      sequence: 1,
    },
  ],
  ...extra,
});
const paginator = (all, query) => {
  const data = all.slice(
      (query.page - 1) * query.per_page,
      query.page * query.per_page,
    ),
    from = data.length ? (query.page - 1) * query.per_page + 1 : null;
  return {
    status: true,
    data: {
      transactions: {
        data,
        current_page: query.page,
        last_page: Math.max(1, Math.ceil(all.length / query.per_page)),
        per_page: query.per_page,
        total: all.length,
        from,
        to: data.length ? from + data.length - 1 : null,
      },
    },
  };
};
test("statement reads every page twice with only fixed account period and existing GET filters", async () => {
  const all = Array.from({ length: 201 }, (_, index) => transaction(index + 1)),
    queries = [],
    progress = [];
  const result = await fetchAccountStatement(account, dates, {
    list: async (query) => {
      queries.push(query);
      return paginator(all, query);
    },
    onProgress: (value) => progress.push(value),
  });
  assert.equal(result.rows.length, 201);
  assert.deepEqual(
    queries.map((query) => query.page),
    [1, 2, 3, 1, 2, 3],
  );
  assert.ok(
    queries.every(
      (query) =>
        query.account_id === "10" &&
        query.sort_dir === "asc" &&
        query.date_from === dates.from &&
        query.date_to === dates.to &&
        !query.workspace_id,
    ),
  );
  assert.deepEqual(progress.at(-1), { done: 402, total: 402 });
  assert.equal(result.totals.net, "-201.0000");
});
test("own signed ledger effects include fees and never use the transaction headline amount", async () => {
  const tx = transaction(1, "-20.5001", { type: "transfer" });
  tx.ledger_entries.push(
    {
      ...tx.ledger_entries[0],
      id: 11,
      signed_amount: "-0.3000",
      entry_role: "fee",
    },
    {
      ...tx.ledger_entries[0],
      id: 12,
      account_id: 11,
      signed_amount: "20.5001",
      entry_role: "transfer_in",
    },
  );
  const result = await fetchAccountStatement(account, dates, {
    list: async (query) => paginator([tx], query),
  });
  assert.equal(result.rows[0].amount, "-20.8001");
  assert.equal(result.totals.outgoing, "20.8001");
});
test("large four-decimal statement totals remain exact without floating point conversion", async () => {
  const all = [
    transaction(1, "9007199254740993.0001"),
    transaction(2, "-0.0001"),
  ];
  const result = await fetchAccountStatement(account, dates, {
    list: async (query) => paginator(all, query),
  });
  assert.equal(result.totals.net, "9007199254740993.0000");
});
test("reversed originals and their reversal both remain in the statement", async () => {
  const all = [
    transaction(1, "-25.0000", { status: "reversed" }),
    transaction(2, "25.0000", { type: "reversal", reversal_of_id: 1 }),
  ];
  const result = await fetchAccountStatement(
    { ...account, status: "archived" },
    dates,
    { list: async (query) => paginator(all, query) },
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.totals.net, "0.0000");
});
test("an empty statement verifies honestly and cannot invent an opening or closing balance", async () => {
  const result = await fetchAccountStatement(account, dates, {
    list: async (query) => paginator([], query),
  });
  assert.deepEqual(result.rows, []);
  assert.equal(result.totals.net, "0.0000");
  assert.equal(result.opening_balance, undefined);
});
test("invalid calendar dates are rejected before the first HTTP read", async () => {
  let calls = 0;
  for (const value of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-02", to: "2026-10-01" },
  ])
    await assert.rejects(
      fetchAccountStatement(account, value, {
        list: async () => {
          calls++;
        },
      }),
      { code: "STATEMENT_DATES_INVALID" },
    );
  assert.equal(calls, 0);
});
test("over-limit statements stop before a partial export or a second page", async () => {
  let calls = 0;
  await assert.rejects(
    fetchAccountStatement(account, dates, {
      list: async (query) => {
        calls++;
        const response = paginator(
          Array.from({ length: 100 }, (_, i) => transaction(i + 1)),
          query,
        );
        response.data.transactions.total = 5001;
        response.data.transactions.last_page = 51;
        return response;
      },
    }),
    { code: "STATEMENT_LIMIT" },
  );
  assert.equal(calls, 1);
});
test("a failed middle page cannot be returned as a complete statement", async () => {
  const all = Array.from({ length: 101 }, (_, i) => transaction(i + 1));
  await assert.rejects(
    fetchAccountStatement(account, dates, {
      list: async (query) => {
        if (query.page === 2) throw new Error("offline");
        return paginator(all, query);
      },
    }),
    /offline/,
  );
});
test("cancellation fences even an HTTP adapter that returns late success", async () => {
  const controller = new AbortController();
  await assert.rejects(
    fetchAccountStatement(account, dates, {
      signal: controller.signal,
      list: async (query) => {
        controller.abort();
        return paginator([transaction(1)], query);
      },
    }),
    { name: "AbortError" },
  );
});
test("changed totals and same-count edits during verification are rejected", async () => {
  for (const mutate of [
    (row) => ({ ...row, description: "Changed" }),
    (row) => ({ ...row, status: "reversed" }),
    (row) => ({
      ...row,
      ledger_entries: [{ ...row.ledger_entries[0], signed_amount: "-2.0000" }],
    }),
  ]) {
    let calls = 0;
    await assert.rejects(
      fetchAccountStatement(account, dates, {
        list: async (query) =>
          paginator(
            [++calls === 1 ? transaction(1) : mutate(transaction(1))],
            query,
          ),
      }),
      { code: "STATEMENT_CHANGED" },
    );
  }
});
test("cross-page duplicate transactions cannot inflate statement totals", async () => {
  const all = Array.from({ length: 101 }, (_, i) => transaction(i + 1));
  all[100] = transaction(1);
  await assert.rejects(
    fetchAccountStatement(account, dates, {
      list: async (query) => paginator(all, query),
    }),
    { code: "STATEMENT_CHANGED" },
  );
});
test("foreign-account currency or workspace records cannot enter a statement", async () => {
  for (const extra of [
    { workspace_id: 4 },
    {
      ledger_entries: [{ ...transaction(1).ledger_entries[0], account_id: 11 }],
    },
    {
      ledger_entries: [
        { ...transaction(1).ledger_entries[0], currency_code: "USD" },
      ],
    },
  ])
    await assert.rejects(
      fetchAccountStatement(account, dates, {
        list: async (query) =>
          paginator([transaction(1, "-1.0000", extra)], query),
      }),
      { code: "MALFORMED_RESPONSE" },
    );
});
test("CSV uses UTF-8 BOM exact signed decimals quoted fields and neutralized external formulas", async () => {
  const result = await fetchAccountStatement(account, dates, {
    list: async (query) =>
      paginator(
        [
          transaction(1, "-0.0001", {
            description: '=HYPERLINK("secret")\nقهوة',
            category: { name: "@formula" },
          }),
        ],
        query,
      ),
  });
  const csv = statementCsv(result, { id: "ID", net: "Impact" });
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('"\'=HYPERLINK(""secret"")\nقهوة"'));
  assert.ok(csv.includes('"\'@formula"'));
  assert.ok(csv.includes('"-0.0001"'));
});

test("PDF money retains four decimals and signs even beyond floating point precision", async () => {
  const { formatStatementPdfMoney } =
    await import("../src/features/Dashboards/User/AccountDetails/statement/statementPdfModel.js");
  assert.equal(
    formatStatementPdfMoney("9007199254740993.0001", "ILS", true),
    "+9,007,199,254,740,993.0001 ILS",
  );
  assert.equal(formatStatementPdfMoney("-0.0001", "USD", true), "-0.0001 USD");
  assert.equal(formatStatementPdfMoney("0.0000", "USD", true), "0.00 USD");
});
test("PDF timestamps normalize timezone offsets to UTC without altering ledger impact", async () => {
  const { buildStatementPdfModel } =
    await import("../src/features/Dashboards/User/AccountDetails/statement/statementPdfModel.js");
  const result = await fetchAccountStatement(account, dates, {
    list: async (query) =>
      paginator(
        [
          transaction(1, "-0.0001", {
            occurred_at: "2026-10-02T15:00:00+03:00",
          }),
        ],
        query,
      ),
  });
  const model = buildStatementPdfModel({
    statement: result,
    language: "ar",
    t: (key) => key,
    typeLabel: () => "Expense",
    generatedAt: new Date("2026-10-03T12:00:00Z"),
  });
  assert.equal(model.rows[0].date, "2026-10-02 12:00:00 UTC");
  assert.equal(model.rows[0].net, "-0.0001 ILS");
  assert.equal(model.generatedDate, "2026-10-03 12:00:00 UTC");
  assert.equal(model.rtl, true);
});
