import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_MOVEMENT_FILTERS,
  MOVEMENT_TYPES,
  buildAccountMovementQuery,
  formatMovementMoney,
  movementDecimal,
  movementRelatedIds,
  movementTypeLabel,
  movementUnits,
  parseAccountMovement,
  parseAccountMovementPage,
} from "../src/features/Dashboards/User/AccountDetails/accountMovementHelpers.js";
import { ACCOUNT_MOVEMENT_MESSAGES } from "../src/features/Dashboards/User/AccountDetails/accountMovementMessages.js";

const account = {
  id: 10,
  workspace_id: 3,
  currency_code: "ILS",
  status: "active",
};
const entry = (extra = {}) => ({
  id: 1,
  transaction_id: 91,
  workspace_id: 3,
  account_id: 10,
  signed_amount: "-25.5000",
  currency_code: "ILS",
  entry_role: "expense",
  sequence: 1,
  ...extra,
});
const transaction = (extra = {}) => ({
  id: 91,
  workspace_id: 3,
  type: "expense",
  status: "posted",
  source: "voice",
  amount: "25.5000",
  ledger_entries: [entry()],
  ...extra,
});
const query = (page = 1) =>
  buildAccountMovementQuery(account.id, DEFAULT_MOVEMENT_FILTERS, page);
const response = (rows = [transaction()], overrides = {}) => ({
  status: true,
  data: {
    transactions: {
      data: rows,
      total: rows.length,
      current_page: 1,
      last_page: 1,
      per_page: 20,
      from: rows.length ? 1 : null,
      to: rows.length || null,
      ...overrides,
    },
  },
});
const invalid = (fn) =>
  assert.throws(fn, (error) => error.code === "MALFORMED_RESPONSE");

test("history requests lock the selected account and use only existing backend filters", () => {
  const filters = {
    ...DEFAULT_MOVEMENT_FILTERS,
    type: "debt_payment",
    status: "posted",
    date_from: "2026-09-01",
    date_to: "2026-10-02",
    sort: "occurred_at:asc",
    per_page: 50,
    account_id: 99,
    workspace_id: 7,
  };
  assert.deepEqual(buildAccountMovementQuery(10, filters, 2), {
    account_id: "10",
    page: 2,
    per_page: 50,
    sort_by: "occurred_at",
    sort_dir: "asc",
    type: "debt_payment",
    status: "posted",
    date_from: "2026-09-01",
    date_to: "2026-10-02",
  });
  assert.deepEqual(query(), {
    account_id: "10",
    page: 1,
    per_page: 20,
    sort_by: "occurred_at",
    sort_dir: "desc",
  });
});

test("all eleven backend financial types remain selectable including debts refunds adjustments and reversals", () => {
  assert.equal(MOVEMENT_TYPES.length, 11);
  for (const type of MOVEMENT_TYPES)
    assert.equal(
      buildAccountMovementQuery(10, { ...DEFAULT_MOVEMENT_FILTERS, type }).type,
      type,
    );
});

test("invalid dates ranges identifiers and pagination cannot produce a request", () => {
  for (const date of ["2026-02-30", "2026-13-01", "yesterday"]) {
    assert.throws(() =>
      buildAccountMovementQuery(10, {
        ...DEFAULT_MOVEMENT_FILTERS,
        date_from: date,
      }),
    );
  }
  assert.throws(() =>
    buildAccountMovementQuery(10, {
      ...DEFAULT_MOVEMENT_FILTERS,
      date_from: "2026-10-02",
      date_to: "2026-09-01",
    }),
  );
  for (const id of [
    0,
    -1,
    "../10",
    "10?account_id=99",
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() => buildAccountMovementQuery(id));
  for (const page of [0, -1, 1.5, "2"])
    assert.throws(() =>
      buildAccountMovementQuery(10, DEFAULT_MOVEMENT_FILTERS, page),
    );
  assert.equal(
    buildAccountMovementQuery(10, {
      ...DEFAULT_MOVEMENT_FILTERS,
      date_from: "2024-02-29",
    }).date_from,
    "2024-02-29",
  );
});

test("transfer direction and effect come only from this account's ledger entries", () => {
  const transfer = transaction({
    type: "transfer",
    amount: "100.0000",
    transfer_id: 5,
    ledger_entries: [
      entry({ entry_role: "transfer_out", signed_amount: "-100.0000" }),
      entry({
        id: 2,
        sequence: 2,
        account_id: 20,
        signed_amount: "100.0000",
        entry_role: "transfer_in",
        account: { id: 20, name: "Savings" },
      }),
    ],
  });
  const from = parseAccountMovement(transfer, account);
  const to = parseAccountMovement(transfer, { ...account, id: 20 });
  assert.equal(from.amount, "-100.0000");
  assert.equal(movementTypeLabel(from), "transfer_out");
  assert.equal(to.amount, "100.0000");
  assert.equal(movementTypeLabel(to), "transfer_in");
  assert.deepEqual(from.counterparts, [{ id: 20, name: "Savings" }]);
});

test("multiple account entries and fees are included exactly once in the movement breakdown", () => {
  const row = parseAccountMovement(
    transaction({
      type: "transfer",
      amount: "100.0000",
      ledger_entries: [
        entry({ signed_amount: "-100.0000", entry_role: "transfer_out" }),
        entry({
          id: 2,
          signed_amount: "-2.1234",
          entry_role: "fee",
          sequence: 2,
        }),
        entry({
          id: 3,
          account_id: 20,
          signed_amount: "100.0000",
          entry_role: "transfer_in",
          sequence: 3,
        }),
      ],
    }),
    account,
  );
  assert.equal(row.amount, "-102.1234");
  assert.equal(row.entries.length, 2);
  assert.equal(row.outgoing, 1021234n);
  assert.equal(row.incoming, 0n);
});

test("reversed originals and their reversal remain separate visible history with cancelling net effect", () => {
  const original = transaction({ status: "reversed" });
  const reversal = transaction({
    id: 92,
    type: "reversal",
    reversal_of_id: 91,
    ledger_entries: [
      entry({
        id: 2,
        transaction_id: 92,
        signed_amount: "25.5000",
        entry_role: "reversal",
      }),
    ],
  });
  const page = parseAccountMovementPage(
    response([original, reversal]),
    account,
    query(),
  );
  assert.equal(page.total, 2);
  assert.equal(page.rows.length, 2);
  assert.equal(page.net, "0.0000");
  assert.equal(page.incoming, "25.5000");
  assert.equal(page.outgoing, "25.5000");
  assert.equal(movementTypeLabel(page.rows[1]), "reversal");
});

test("debt movements keep their financial type and actual direction", () => {
  for (const type of [
    "debt_received",
    "debt_given",
    "debt_payment",
    "debt_collection",
  ]) {
    const row = parseAccountMovement(transaction({ type }), account);
    assert.equal(movementTypeLabel(row), type);
    assert.equal(row.direction, "out");
  }
});

test("large four decimal amounts and decimal arithmetic remain exact without binary floats", () => {
  const huge = "999999999999999.9999";
  assert.equal(movementDecimal(movementUnits(huge)), huge);
  assert.equal(
    formatMovementMoney(huge, "USD", "en-US"),
    "$999,999,999,999,999.9999",
  );
  const rows = [
    transaction({ ledger_entries: [entry({ signed_amount: huge })] }),
    transaction({
      id: 92,
      ledger_entries: [
        entry({ id: 2, transaction_id: 92, signed_amount: "0.0001" }),
      ],
    }),
  ];
  assert.equal(
    parseAccountMovementPage(response(rows), account, query()).net,
    "1000000000000000.0000",
  );
});

test("negative subunit amounts and positive signs survive formatting", () => {
  assert.equal(
    formatMovementMoney("-0.0001", "USD", "en-US", true),
    "-$0.0001",
  );
  assert.equal(formatMovementMoney("0.5000", "USD", "en-US", true), "+$0.50");
  assert.equal(formatMovementMoney("0.0000", "USD", "en-US", true), "$0.00");
  assert.match(formatMovementMoney("1.1234", "ILS", "ar-PS"), /١٫١٢٣٤/);
});

test("numeric nonfinite and overprecise ledger amounts cannot be silently rounded or zeroed", () => {
  for (const value of [25.5, NaN, Infinity, null, "NaN", "1e3", "25.12345", ""])
    invalid(() => movementUnits(value));
});

test("another account workspace currency or transaction cannot leak into this history", () => {
  for (const row of [
    transaction({ workspace_id: 8 }),
    transaction({ ledger_entries: [entry({ account_id: 20 })] }),
    transaction({ ledger_entries: [entry({ workspace_id: 8 })] }),
    transaction({ ledger_entries: [entry({ currency_code: "USD" })] }),
    transaction({ ledger_entries: [entry({ transaction_id: 92 })] }),
  ])
    invalid(() => parseAccountMovement(row, account));
});

test("duplicate entries or duplicate transactions are rejected before inflating totals", () => {
  invalid(() =>
    parseAccountMovement(
      transaction({ ledger_entries: [entry(), entry()] }),
      account,
    ),
  );
  invalid(() =>
    parseAccountMovementPage(
      response([transaction(), transaction()]),
      account,
      query(),
    ),
  );
});

test("empty history and pages past the last page remain honest empty results", () => {
  const empty = parseAccountMovementPage(response([]), account, query());
  assert.equal(empty.total, 0);
  assert.equal(empty.net, "0.0000");
  assert.equal(empty.from, null);
  const past = parseAccountMovementPage(
    response([], { total: 21, current_page: 3, last_page: 2 }),
    account,
    query(3),
  );
  assert.equal(past.total, 21);
  assert.equal(past.rows.length, 0);
  assert.equal(past.page, 3);
});

test("a page summary never pretends to sum movements on unrequested pages", () => {
  const page = parseAccountMovementPage(
    response([transaction()], { total: 201, last_page: 11 }),
    account,
    query(),
  );
  assert.equal(page.total, 201);
  assert.equal(page.outgoing, "25.5000");
  assert.equal(page.rows.length, 1);
});

test("malformed or mismatched paginator metadata is rejected", () => {
  for (const override of [
    { total: "1" },
    { total: 0 },
    { current_page: 2 },
    { per_page: 50 },
    { last_page: 2 },
    { from: 2 },
    { to: 2 },
  ])
    invalid(() =>
      parseAccountMovementPage(
        response([transaction()], override),
        account,
        query(),
      ),
    );
  invalid(() =>
    parseAccountMovementPage({ status: true, data: {} }, account, query()),
  );
});

test("archived accounts retain exactly the same read-only history", () => {
  assert.equal(
    parseAccountMovementPage(
      response(),
      { ...account, status: "archived" },
      query(),
    ).rows[0].amount,
    "-25.5000",
  );
});

test("related operation links reject unsafe metadata identifiers", () => {
  assert.deepEqual(
    movementRelatedIds({
      transfer_id: 2,
      reversal_of_id: 3,
      metadata: { debt_id: 4 },
    }),
    { transfer: "2", original: "3", debt: "4" },
  );
  assert.deepEqual(
    movementRelatedIds({
      transfer_id: "../x",
      reversal_of_id: 0,
      metadata: { debt_id: "4?x=1" },
    }),
    { transfer: null, original: null, debt: null },
  );
});

test("Arabic and English translations cover every backend type source and ledger role", () => {
  for (const language of ["ar", "en"]) {
    const messages = ACCOUNT_MOVEMENT_MESSAGES[language];
    for (const type of MOVEMENT_TYPES) assert.ok(messages.types[type]);
    for (const source of [
      "manual",
      "natural_language",
      "voice",
      "receipt_ocr",
      "statement_import",
      "recurring_rule",
      "business_request",
      "system",
    ])
      assert.ok(messages.sources[source]);
    for (const role of [
      "income",
      "expense",
      "transfer_in",
      "transfer_out",
      "fee",
      "refund",
      "adjustment",
      "reversal",
      "debt_in",
      "debt_out",
    ])
      assert.ok(messages.roles[role]);
  }
  assert.deepEqual(
    Object.keys(ACCOUNT_MOVEMENT_MESSAGES.ar).sort(),
    Object.keys(ACCOUNT_MOVEMENT_MESSAGES.en).sort(),
  );
});
