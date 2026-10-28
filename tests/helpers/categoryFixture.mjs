import { envelope, failure } from "./mobileApi.mjs";

/*
 * Fictional categories and a backend that answers like the category endpoints:
 * GET /categories (active only, optional `type`), GET /categories/{id}, and, when
 * a test allows them, POST /categories and PATCH /categories/{id}. Writes change
 * the in-memory list, so a read after a write sees the result.
 */

export const category = (id, over = {}) => ({
  id,
  workspace_id: 1,
  parent_id: null,
  name: `Category ${id}`,
  slug: `category-${id}`,
  type: "expense",
  icon: null,
  color: null,
  is_system: false,
  is_active: true,
  sort_order: 0,
  created_at: "2026-01-05T09:00:00Z",
  updated_at: "2026-02-05T09:00:00Z",
  ...over,
});

export const defaultCategories = () => [
  category(1, { name: "Groceries", icon: "shopping-cart", color: "#10B981" }),
  category(2, { name: "Salary", type: "income", icon: "briefcase" }),
  category(3, { name: "Fresh produce", parent_id: 1 }),
  category(10, { name: "Food", is_system: true, workspace_id: null, icon: "food" }),
  category(11, { name: "Transport", is_system: true, workspace_id: null }),
];

/**
 * @param {object[]} rows
 * @param {{ onCreate?: (body, call) => unknown, onUpdate?: (id, body, call) => unknown }} hooks
 * Without a hook, a create answers 201 with the new category and an update 200 with the renamed one.
 */
export function categoriesBackend(rows = defaultCategories(), { onCreate, onUpdate } = {}) {
  const state = { rows: rows.map((row) => ({ ...row })), nextId: 100 };

  const handler = (call) => {
    if (call.method === "GET" && call.path === "/categories") {
      const list = state.rows.filter((row) => row.is_active && (!call.query.type || row.type === call.query.type));
      return { body: envelope({ categories: list }) };
    }

    const one = /^\/categories\/(\d+)$/.exec(call.path);

    if (call.method === "GET" && one) {
      const found = state.rows.find((row) => String(row.id) === one[1]);
      return found ? { body: envelope({ category: found }) } : failure(404, "Not found");
    }

    if (call.method === "POST" && call.path === "/categories") {
      if (onCreate) return onCreate(call.body, call, state);
      const created = category(state.nextId++, { ...call.body, slug: String(call.body.name).toLowerCase() });
      state.rows.push(created);
      return { status: 201, body: envelope({ category: created }) };
    }

    if (call.method === "PATCH" && one) {
      if (onUpdate) return onUpdate(one[1], call.body, call, state);
      const found = state.rows.find((row) => String(row.id) === one[1]);
      if (!found) return failure(404, "Not found");
      if (found.is_system) return failure(403, "System categories are read-only.");
      Object.assign(found, call.body);
      return { body: envelope({ category: found }) };
    }

    return failure(404, "Not found");
  };

  return Object.assign(handler, { state });
}
