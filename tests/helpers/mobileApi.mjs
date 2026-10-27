/*
 * A fake backend for the Mobile screens. Fictional data only, no network.
 *
 * It replaces globalThis.fetch (the one thing apiClient's apiRequest calls) and
 * is strict: a request with any method but GET is recorded as a violation AND
 * throws on the spot, so a test that makes one fails where it happened. The
 * other ways a page could talk to a server (XMLHttpRequest, sendBeacon,
 * WebSocket, EventSource) are trapped the same way, so a screen cannot get
 * around the check by not using fetch.
 */

export const envelope = (data) => ({ status: true, message: "ok", data });
export const failure = (status, message = "failed", code) => ({ status, body: { status: false, message, ...(code ? { code } : {}), errors: {} } });

export function installFakeApi(handler) {
  const calls = [];
  const violations = [];
  const pending = [];
  const original = { fetch: globalThis.fetch, XMLHttpRequest: globalThis.XMLHttpRequest, WebSocket: globalThis.WebSocket, EventSource: globalThis.EventSource, sendBeacon: globalThis.navigator?.sendBeacon };

  globalThis.fetch = (url, init = {}) => {
    const method = String(init.method ?? "GET").toUpperCase();
    const parsed = new URL(String(url), "http://localhost");
    const call = {
      method,
      path: parsed.pathname.replace(/^\/api/, ""),
      query: Object.fromEntries(parsed.searchParams),
      headers: init.headers ?? {},
      auth: init.headers?.Authorization ?? null,
      hasBody: init.body !== undefined,
      signal: init.signal,
    };

    calls.push(call);

    if (method !== "GET" || call.hasBody) {
      violations.push(`${method} ${call.path}`);
      throw new Error(`FORBIDDEN: Mobile sent ${method} ${call.path}`);
    }

    return new Promise((resolve, reject) => {
      const respond = (outcome) => {
        if (call.signal?.aborted) {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          return;
        }

        if (outcome instanceof Error) {
          reject(outcome);
          return;
        }

        const status = outcome?.status ?? 200;
        const body = outcome && "body" in outcome ? outcome.body : outcome;
        resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: outcome?.headers ?? {} }));
      };

      let outcome;
      try {
        outcome = handler(call);
      } catch (error) {
        reject(error);
        return;
      }

      if (outcome && typeof outcome.then === "function") {
        const entry = { call, settle: respond };
        pending.push(entry);
        outcome.then((value) => respond(value), reject);
      } else {
        respond(outcome ?? { status: 404, body: { status: false, message: "not found", errors: {} } });
      }
    });
  };

  const trap = (name) =>
    class {
      constructor(...args) {
        violations.push(`${name}(${args.join(", ")})`);
        throw new Error(`FORBIDDEN: Mobile used ${name}`);
      }
    };

  globalThis.XMLHttpRequest = trap("XMLHttpRequest");
  globalThis.WebSocket = trap("WebSocket");
  globalThis.EventSource = trap("EventSource");
  Object.defineProperty(globalThis.navigator, "sendBeacon", {
    configurable: true,
    writable: true,
    value: (...args) => {
      violations.push(`sendBeacon(${args[0]})`);
      throw new Error("FORBIDDEN: Mobile used sendBeacon");
    },
  });

  return {
    calls,
    violations,
    /** Requests of the last `n` (or all) calls, as "GET /path". */
    summary: () => calls.map((call) => `${call.method} ${call.path}`),
    reset() {
      calls.length = 0;
      violations.length = 0;
    },
    /** For the tests that provoke a violation on purpose: returns them and clears the list. */
    takeViolations() {
      return violations.splice(0);
    },
    /** Puts the globals back, then fails if anything forbidden happened, even if a screen swallowed the error. */
    restore() {
      globalThis.fetch = original.fetch;
      globalThis.XMLHttpRequest = original.XMLHttpRequest;
      globalThis.WebSocket = original.WebSocket;
      globalThis.EventSource = original.EventSource;
      if (original.sendBeacon) globalThis.navigator.sendBeacon = original.sendBeacon;
      else delete globalThis.navigator.sendBeacon;

      if (violations.length) throw new Error(`Mobile made forbidden requests: ${violations.join(", ")}`);
    },
  };
}

/* ---------- Fictional data ---------- */

export const account = (over = {}) => ({
  id: 1,
  workspace_id: 1,
  name: "Everyday wallet",
  type: "cash",
  currency_code: "ILS",
  opening_balance: "100.0000",
  current_balance: "1234.5000",
  allow_negative_balance: false,
  savings_goal: null,
  color: null,
  icon: null,
  status: "active",
  created_at: "2026-01-05T09:00:00Z",
  updated_at: "2026-01-05T09:00:00Z",
  archived_at: null,
  ...over,
});

export const currencyRow = (code, over = {}) => ({
  currency_code: code,
  accounts_count: 1,
  current_balance: "1234.5000",
  income: "2000.0000",
  expense: "765.5000",
  net: "1234.5000",
  ...over,
});

export const dashboard = (over = {}) => ({
  period: { preset: "month", date_from: "2026-10-01", date_to: "2026-10-31", timezone: "UTC" },
  scope: { workspace_id: 1, workspace_ids: [1], is_multi_currency: false, primary_currency_code: "ILS" },
  totals: { currency_code: "ILS", accounts_count: 1, active_accounts_count: 1, current_balance: "1234.5000", income: "2000.0000", expense: "765.5000", net: "1234.5000" },
  summary_by_currency: [currencyRow("ILS")],
  accounts: [account()],
  recent_transactions: [
    { id: 11, type: "expense", status: "posted", description: "Groceries", amount: "45.2500", currency_code: "ILS", occurred_at: "2026-10-20T10:00:00Z", category: { name: "Food" } },
    { id: 12, type: "income", status: "posted", description: "Freelance payment", amount: "300.0000", currency_code: "ILS", occurred_at: "2026-10-18T08:30:00Z", category: null },
  ],
  ...over,
});

export const multiCurrencyDashboard = () =>
  dashboard({
    scope: { workspace_id: 1, workspace_ids: [1], is_multi_currency: true, primary_currency_code: "ILS" },
    totals: { currency_code: "ILS", accounts_count: 3, active_accounts_count: 3, current_balance: "1234.5000", income: "2000.0000", expense: "765.5000", net: "1234.5000" },
    summary_by_currency: [
      currencyRow("USD", { current_balance: "500.2500", income: "900.0000", expense: "399.7500", net: "500.2500" }),
      currencyRow("ILS"),
      currencyRow("EUR", { current_balance: "-20.5000", income: "0.0000", expense: "20.5000", net: "-20.5000" }),
    ],
    accounts: [
      account({ id: 3, name: "Dollar savings", type: "savings", currency_code: "USD", current_balance: "500.2500" }),
      account({ id: 1 }),
      account({ id: 4, name: "Euro card", type: "bank", currency_code: "EUR", current_balance: "-20.5000" }),
    ],
  });

export const movement = (id, accountId, signedAmount, over = {}) => ({
  id,
  workspace_id: 1,
  type: signedAmount.startsWith("-") ? "expense" : "income",
  status: "posted",
  description: signedAmount.startsWith("-") ? "Coffee" : "Salary",
  occurred_at: "2026-10-1" + (id % 9) + "T10:00:00Z",
  reversal_of_id: null,
  ledger_entries: [
    { id: id * 10, workspace_id: 1, transaction_id: id, account_id: accountId, currency_code: "ILS", signed_amount: signedAmount, entry_role: "main", account: { id: accountId, name: "Everyday wallet" } },
  ],
  ...over,
});

export const movementPage = (rows, { page = 1, perPage = 20, total = rows.length } = {}) => ({
  transactions: {
    data: rows,
    total,
    current_page: page,
    per_page: perPage,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    from: rows.length ? (page - 1) * perPage + 1 : null,
    to: rows.length ? (page - 1) * perPage + rows.length : null,
  },
});

/** The routes a healthy backend answers for the Mobile screens. */
export function healthyBackend({ dashboardData = dashboard(), alerts = { generated_at: "2026-10-26T00:00:00Z", alerts: [] }, accounts = [account()], detail, movements = movementPage([]) } = {}) {
  return (call) => {
    if (call.path === "/dashboard") return { body: envelope(dashboardData) };
    if (call.path === "/financial-alerts") return { body: envelope(alerts) };
    if (call.path === "/accounts") return { body: envelope({ accounts }) };
    if (/^\/accounts\/\d+$/.test(call.path)) {
      const found = detail ?? accounts.find((item) => `/accounts/${item.id}` === call.path);
      return found ? { body: envelope({ account: found }) } : failure(404, "Not found");
    }
    if (call.path === "/transactions") return { body: envelope(movements) };
    return failure(404, "Not found");
  };
}

/* ---------- Transactions (Activity) ---------- */

export const tx = (id, over = {}) => ({
  id,
  workspace_id: 1,
  type: "expense",
  status: "posted",
  amount: "45.2500",
  currency_code: "ILS",
  description: `Payment ${id}`,
  reference_number: null,
  occurred_at: "2026-10-20T10:00:00.000000Z",
  posted_at: "2026-10-20T10:00:05.000000Z",
  category: { id: 4, name: "Food" },
  category_id: 4,
  transfer_id: null,
  reversal_of_id: null,
  related_transaction_id: null,
  ledger_entries: [{ id: id * 10, workspace_id: 1, transaction_id: id, account_id: 1, currency_code: "ILS", signed_amount: "-45.2500", entry_role: "expense", account: { id: 1, name: "Everyday wallet" } }],
  creator: { id: 1, name: "Alex Example" },
  ...over,
});

/*
 * A backend that behaves like GET /transactions on a fixed set of transactions:
 * it filters (type, status, account_id, category_id, date_from, date_to), sorts
 * by occurred_at, and pages with a Laravel-shaped paginator. A test can wrap it
 * to delay or fail particular requests.
 */
export function transactionsBackend(all, { categories = [{ id: 4, name: "Food", type: "expense" }, { id: 5, name: "Salary", type: "income" }], accounts = [account()] } = {}) {
  return (call) => {
    if (call.path === "/transactions") {
      const q = call.query;
      let rows = all.filter((row) => (!q.type || row.type === q.type) && (!q.status || row.status === q.status) && (!q.category_id || String(row.category_id) === q.category_id) && (!q.account_id || row.ledger_entries.some((entry) => String(entry.account_id) === q.account_id)));
      const day = (row) => (row.occurred_at ?? "").slice(0, 10);
      if (q.date_from) rows = rows.filter((row) => day(row) >= q.date_from);
      if (q.date_to) rows = rows.filter((row) => day(row) <= q.date_to);
      rows = [...rows].sort((a, b) => (q.sort_dir === "asc" ? 1 : -1) * (a.occurred_at ?? "").localeCompare(b.occurred_at ?? ""));
      const perPage = Number(q.per_page ?? 20);
      const page = Number(q.page ?? 1);
      return { body: envelope(movementPage(rows.slice((page - 1) * perPage, page * perPage), { page, perPage, total: rows.length })) };
    }
    const one = /^\/transactions\/(\d+)$/.exec(call.path);
    if (one) {
      const found = all.find((row) => String(row.id) === one[1]);
      return found ? { body: envelope({ transaction: found }) } : failure(404, "Not found");
    }
    if (call.path === "/categories") return { body: envelope({ categories }) };
    if (call.path === "/accounts") return { body: envelope({ accounts }) };
    if (/^\/accounts\/\d+$/.test(call.path)) {
      const found = accounts.find((item) => `/accounts/${item.id}` === call.path);
      return found ? { body: envelope({ account: found }) } : failure(404, "Not found");
    }
    if (call.path === "/dashboard") return { body: envelope(dashboard()) };
    if (call.path === "/financial-alerts") return { body: envelope({ alerts: [] }) };
    return failure(404, "Not found");
  };
}
