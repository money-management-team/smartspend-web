import { envelope, mockFetch } from "./mockFetch.mjs";

/*
 * A stateful stand-in for the WhatsApp draft endpoints, written from the
 * backend source (smartspend-backend @ b7ca549): review_version checks,
 * PATCH validation, readiness issues, atomic confirmation with idempotent
 * replay, discard. It sits behind the REAL adapter and HTTP client through
 * mockFetch, so a test sees the exact method, path, headers and body the app
 * sends. `transactions` is the ledger: a double posting shows up there.
 */

export const SERVER_ACCOUNTS = [
  { id: 1, workspace_id: 1, name: "Cash wallet", currency_code: "ILS", status: "active", savings_goal: null },
  { id: 2, workspace_id: 1, name: "Bank", currency_code: "USD", status: "active", savings_goal: null },
  { id: 3, workspace_id: 1, name: "Old account", currency_code: "ILS", status: "archived", savings_goal: null },
  { id: 4, workspace_id: 9, name: "Other workspace", currency_code: "ILS", status: "active", savings_goal: null },
];
export const SERVER_CATEGORIES = [
  { id: 2, name: "Food", type: "expense", is_active: true, workspace_id: null },
  { id: 3, name: "Rent", type: "expense", is_active: true, workspace_id: 1 },
  { id: 5, name: "Salary", type: "income", is_active: true, workspace_id: null },
];

const minor = (value) => {
  const [integer, fraction = ""] = String(value).split(".");
  return BigInt(integer + fraction.padEnd(4, "0").slice(0, 4));
};

export function createDraftServer(initial = {}) {
  const server = {
    calls: [],
    transactions: [],
    failures: [],
    gates: new Map(),
    balance: "1000.0000",
    accounts: SERVER_ACCOUNTS.map((a) => ({ ...a })),
    draft: {
      id: 7, workspace_id: 1, status: "ready_for_review", review_version: 1,
      can_edit: true, can_confirm: true, can_discard: true, confirmed_transaction_id: null,
      values: {
        account_id: 1, category_id: 2, amount: "25.2500", currency_code: "ILS", description: "Lunch",
        transaction_date: "2026-10-06", transaction_time: "12:30:00", workspace_timezone: "Asia/Gaza",
      },
      ...initial,
    },
  };

  const accountOf = (id) => server.accounts.find((a) => a.id === id);

  function issues() {
    const v = server.draft.values;
    const list = [];
    if (v.account_id == null) list.push({ field: "account_id", code: "account_required", message: "x" });
    if (v.category_id == null) list.push({ field: "category_id", code: "category_required", message: "x" });
    if (v.amount == null) list.push({ field: "amount", code: "amount_required", message: "x" });
    const account = accountOf(v.account_id);
    if (v.account_id != null && (!account || account.status !== "active")) {
      list.push({ field: "account_id", code: "account_not_usable", message: "x" });
    }
    if (v.transaction_date == null) list.push({ field: "transaction_date", code: "date_required", message: "x" });
    return list;
  }

  function resource() {
    const d = server.draft;
    const reviewable = d.status === "ready_for_review";
    const found = issues();
    const account = accountOf(d.values.account_id);
    return {
      id: d.id, workspace_id: d.workspace_id, source: "whatsapp", status: d.status, review_version: d.review_version,
      can_edit: reviewable && d.can_edit, can_confirm: reviewable && d.can_confirm, can_discard: reviewable && d.can_discard,
      review_values: { ...d.values },
      confirmation: { ready: reviewable && d.can_confirm && found.length === 0, issues: reviewable ? found : [] },
      ...(d.confirmed_transaction_id != null ? { confirmed_transaction_id: d.confirmed_transaction_id } : {}),
      timestamps: { created_at: "2026-10-06T09:00:00Z", ready_for_review_at: "2026-10-06T09:01:00Z", expires_at: "2026-10-20T09:00:00Z" },
      account: account ? { id: account.id, name: account.name, currency_code: account.currency_code, current_balance: server.balance } : null,
      category: d.values.category_id != null ? { id: d.values.category_id, name: "Food" } : null,
    };
  }

  const fail = (status, message, errors) => ({ status, body: { status: false, message, ...(errors ? { errors } : {}) } });
  const ok = (data, status = 200) => ({ status, body: envelope(data) });

  function patch(body) {
    const d = server.draft;
    if (d.status !== "ready_for_review") return fail(422, "Only an unexpired draft ready for review may be changed.", { status: ["x"] });
    if (body.review_version !== d.review_version) return fail(409, "This draft has changed. Refresh it before saving again.");
    const fields = Object.keys(body).filter((k) => k !== "review_version");
    if (!fields.length) return fail(422, "At least one editable review field is required.", { draft: ["x"] });

    const next = { ...d.values };
    for (const field of fields) {
      const value = body[field];
      if (field === "transaction_date" && value === null) return fail(422, "The transaction date cannot be removed.", { transaction_date: ["x"] });
      if (field === "amount" && value !== null && !(typeof value === "string" && /^\d+(\.\d{1,4})?$/.test(value) && /[1-9]/.test(value))) {
        return fail(422, "The amount must be a positive decimal.", { amount: ["x"] });
      }
      if (field === "account_id" && value !== null) {
        const account = accountOf(value);
        if (!account || account.workspace_id !== d.workspace_id) return fail(422, "no", { account_id: ["x"] });
        if (account.status !== "active") return fail(422, "The selected account is archived.", { account_id: ["x"] });
        next.currency_code = account.currency_code;
      }
      if (field === "account_id" && value === null) next.currency_code = null;
      if (field === "category_id" && value !== null) {
        const category = SERVER_CATEGORIES.find((c) => c.id === value);
        if (!category || category.type !== "expense") return fail(422, "The selected category must be an active expense category.", { category_id: ["x"] });
      }
      if (field === "transaction_time" && value !== null) {
        if (server.rejectTime === value) return fail(422, "time", { transaction_time: ["x"] });
        next[field] = value.length === 5 ? `${value}:00` : value;
        continue;
      }
      next[field] = value;
    }
    d.values = next;
    d.review_version += 1;
    return ok({ draft: resource() });
  }

  function confirm(body, key) {
    const d = server.draft;
    if (d.status === "confirmed") {
      const tx = server.transactions.find((t) => t.id === d.confirmed_transaction_id);
      if (tx && tx.key === key) return ok({ draft: resource(), transaction: tx.resource }, 201);
      return fail(409, "This draft was already confirmed with a different idempotency key.");
    }
    if (d.status !== "ready_for_review") return fail(422, "Only an unexpired draft ready for review can be confirmed.", { status: ["x"] });
    if (body.review_version !== d.review_version) return fail(409, "This draft has changed. Refresh it before confirming.");
    const found = issues();
    if (found.length) return fail(422, found[0].message, { [found[0].field]: ["x"] });
    if (server.rejectCategory) return fail(422, "The selected category must be an active expense category.", { category_id: ["x"] });
    if (minor(d.values.amount) > minor(server.balance)) return fail(422, "Insufficient balance.", { amount: ["x"] });

    const id = 50 + server.transactions.length;
    const resourceTx = { id, type: "expense", status: "posted", amount: d.values.amount, currency_code: d.values.currency_code, source: "whatsapp" };
    server.transactions.push({ id, key, draftId: d.id, resource: resourceTx });
    d.status = "confirmed";
    d.confirmed_transaction_id = id;
    return ok({ draft: resource(), transaction: resourceTx }, 201);
  }

  function discard() {
    const d = server.draft;
    if (d.status !== "ready_for_review") return fail(422, "Only an unexpired draft ready for review may be changed.", { status: ["x"] });
    d.status = "discarded";
    return ok({ draft: resource() });
  }

  async function handle(url, init = {}) {
    const method = init.method ?? "GET";
    const path = new URL(url, "http://x").pathname.replace(/^\/api/, "");
    const key = init.headers?.["Idempotency-Key"];
    const body = init.body ? JSON.parse(init.body) : undefined;
    const draftPath = `/integrations/whatsapp/expense-drafts/${server.draft.id}`;
    let op = null;
    if (method === "GET" && path === draftPath) op = "get";
    else if (method === "PATCH" && path === draftPath) op = "patch";
    else if (method === "POST" && path === `${draftPath}/confirm`) op = "confirm";
    else if (method === "DELETE" && path === draftPath) op = "delete";
    else if (method === "GET" && path === "/integrations/whatsapp/expense-drafts/summary") op = "summary";
    else if (method === "GET" && path === "/integrations/whatsapp/expense-drafts") op = "list";
    else if (path.startsWith("/integrations/whatsapp/expense-drafts/")) op = "other-draft";

    server.calls.push({ op, method, path, key, body, headers: init.headers ?? {} });

    if (server.gates.has(op)) await server.gates.get(op).promise;

    const index = server.failures.findIndex((f) => f.op === op);
    const failure = index >= 0 ? server.failures.splice(index, 1)[0] : null;

    const run = () => {
      switch (op) {
        case "get": return ok({ draft: resource() });
        case "patch": return patch(body);
        case "confirm": return confirm(body, key);
        case "delete": return discard();
        case "summary": return ok({ pending_review_count: server.draft.status === "ready_for_review" ? 1 : 0 });
        case "list": {
          const items = server.draft.status === "ready_for_review" ? [resource()] : [];
          return ok({ drafts: { current_page: 1, per_page: 20, last_page: 1, total: items.length, from: items.length ? 1 : null, to: items.length || null, data: items } });
        }
        case "other-draft": return fail(404, "Not found");
        default: return ok({ enabled: true, state: "linked", capabilities: { can_link: false, can_manage_link: true, can_review_drafts: true }, integration: null });
      }
    };

    if (failure) {
      if (failure.apply) run(); // the server did the work, the answer is lost
      if (failure.kind === "network") throw new TypeError("network down");
      return fail(failure.status ?? 500, "Server error");
    }

    return run();
  }

  server.handle = handle;
  server.install = () => mockFetch((url, init) => handle(url, init));
  /** The next call of `op` fails: { kind: "network" } or { kind: "http", status }, `apply` = server did the work. */
  server.failNext = (op, spec = { kind: "network" }) => server.failures.push({ op, ...spec });
  server.hold = (op) => {
    let release;
    const promise = new Promise((resolve) => { release = resolve; });
    server.gates.set(op, { promise });
    return () => { server.gates.delete(op); release(); };
  };
  server.count = (op) => server.calls.filter((c) => c.op === op).length;
  server.of = (op) => server.calls.filter((c) => c.op === op);
  server.resource = resource;
  return server;
}
