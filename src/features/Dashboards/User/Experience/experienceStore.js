// Device preferences only. This module never performs an API request.
export const DASHBOARD_BLOCKS = [
  "currency",
  "summary",
  "accounts",
  "stats",
  "cashFlow",
  "categories",
  "budgets",
  "goals",
  "recurring",
  "recent",
  "alerts",
];
const FILTER_KEYS = {
  transactions: [
    "type",
    "account_id",
    "category_id",
    "status",
    "currency_code",
    "date_from",
    "date_to",
    "sort",
    "per_page",
  ],
  reports: ["report", "from", "to", "currency", "group_by", "per_page"],
  account: ["type", "status", "date_from", "date_to", "sort", "per_page"],
  category: [
    "account_id",
    "status",
    "date_from",
    "date_to",
    "sort_dir",
    "per_page",
  ],
};
export const positiveId = (value) =>
  /^[1-9]\d{0,14}$/.test(String(value ?? "")) &&
  Number.isSafeInteger(Number(value))
    ? String(value)
    : null;
const localId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
const text = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export function preferenceKey(userId, workspaceId) {
  const user = positiveId(userId),
    workspace = positiveId(workspaceId);
  return user && workspace
    ? `smartspend:experience:v1:u:${user}:w:${workspace}`
    : null;
}
export function sanitizeFilters(scope, input) {
  const keys = FILTER_KEYS[scope.split(":")[0]] ?? [];
  const source =
    input instanceof URLSearchParams ? Object.fromEntries(input) : input;
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = source?.[key];
      return typeof value === "string" &&
        value.length <= 80 &&
        ![...value].some((character) => character.charCodeAt(0) < 32) &&
        value !== ""
        ? [[key, value]]
        : [];
    }),
  );
}
export function normalizeTemplate(input) {
  if (
    !input ||
    !localId(input.id) ||
    !["expense", "income"].includes(input.type) ||
    !positiveId(input.account_id) ||
    !positiveId(input.workspace_id)
  )
    return null;
  const name = text(input.name, 80),
    amount = text(input.amount, 32);
  if (
    !name ||
    (amount &&
      (!/^\d{1,14}(\.\d{1,4})?$/.test(amount) || !/[1-9]/.test(amount)))
  )
    return null;
  if (input.category_id && !positiveId(input.category_id)) return null;
  if (!/^[A-Z]{3}$/.test(input.currency_code ?? "")) return null;
  return {
    id: input.id,
    name,
    type: input.type,
    account_id: positiveId(input.account_id),
    workspace_id: positiveId(input.workspace_id),
    category_id: positiveId(input.category_id) ?? "",
    currency_code: input.currency_code,
    amount,
    description: text(input.description, 255),
  };
}
export function templateIsEligible(
  template,
  accounts,
  categories,
  workspaceId,
) {
  const value = normalizeTemplate(template);
  if (!value || value.workspace_id !== positiveId(workspaceId)) return false;
  const account = accounts.find(
    (row) =>
      String(row.id) === value.account_id &&
      String(row.workspace_id) === value.workspace_id,
  );
  if (
    !account ||
    account.status !== "active" ||
    account.type === "savings_goal" ||
    account.savings_goal ||
    account.archived_at ||
    account.currency_code !== value.currency_code
  )
    return false;
  return (
    !value.category_id ||
    categories.some(
      (row) =>
        String(row.id) === value.category_id &&
        row.type === value.type &&
        row.is_active !== false &&
        row.is_active !== 0 &&
        row.status !== "archived" &&
        (row.workspace_id == null ||
          String(row.workspace_id) === value.workspace_id),
    )
  );
}
export function newLocalId() {
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}
export function manualTemplateForm(template, today) {
  const value = normalizeTemplate(template);
  if (!value) throw new Error("Invalid manual template.");
  return {
    amount: value.amount,
    category_id: value.category_id,
    note: value.description,
    reference_number: "",
    date: today,
  };
}
export function normalizePreferences(input = {}) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (input.version !== undefined && input.version !== 1)
  )
    input = {};
  const unique = (values) => [...new Set(Array.isArray(values) ? values : [])];
  const order = unique(input.dashboardOrder).filter((id) =>
    DASHBOARD_BLOCKS.includes(id),
  );
  const templateIds = new Set(),
    viewIds = new Set();
  return {
    version: 1,
    hiddenMoney: input.hiddenMoney === true,
    guideDismissed: input.guideDismissed === true,
    dashboardOrder: [
      ...order,
      ...DASHBOARD_BLOCKS.filter((id) => !order.includes(id)),
    ],
    hiddenDashboard: unique(input.hiddenDashboard).filter((id) =>
      DASHBOARD_BLOCKS.includes(id),
    ),
    templates: (Array.isArray(input.templates) ? input.templates : [])
      .flatMap((item) => {
        const value = normalizeTemplate(item);
        if (!value || templateIds.has(value.id)) return [];
        templateIds.add(value.id);
        return [value];
      })
      .slice(0, 20),
    savedViews: (Array.isArray(input.savedViews) ? input.savedViews : [])
      .flatMap((item) => {
        if (
          !localId(item?.id) ||
          viewIds.has(item.id) ||
          !/^(transactions|reports|account:[1-9]\d{0,14}|category:[1-9]\d{0,14})$/.test(
            item.scope ?? "",
          ) ||
          !text(item.name, 80)
        )
          return [];
        viewIds.add(item.id);
        return [
          {
            id: item.id,
            name: text(item.name, 80),
            scope: item.scope,
            filters: sanitizeFilters(item.scope, item.filters),
          },
        ];
      })
      .slice(0, 30),
  };
}
export function createExperienceStore({
  userId,
  workspaceId,
  storage,
  eventTarget,
} = {}) {
  const key = preferenceKey(userId, workspaceId),
    listeners = new Set();
  let state;
  const read = () => {
    try {
      const raw = key && storage?.getItem(key);
      return {
        ...normalizePreferences(raw ? JSON.parse(raw) : {}),
        persisted: Boolean(key && storage),
      };
    } catch {
      return { ...normalizePreferences(), persisted: false };
    }
  };
  state = Object.freeze(read());
  const emit = () => listeners.forEach((fn) => fn());
  return {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    update: (updater) => {
      // Read the latest device state before merging, including another tab's write.
      const current = state.persisted ? read() : state;
      const next = normalizePreferences(
        typeof updater === "function"
          ? updater(current)
          : { ...current, ...updater },
      );
      let persisted = false;
      try {
        if (key && storage) {
          storage.setItem(key, JSON.stringify(next));
          persisted = true;
        }
      } catch {
        /* Keep the current session usable. */
      }
      state = Object.freeze({ ...next, persisted });
      emit();
    },
    connect: () => {
      const receive = (event) => {
        if (event.key === key || event.key === null) {
          state = Object.freeze(read());
          emit();
        }
      };
      eventTarget?.addEventListener("storage", receive);
      return () => eventTarget?.removeEventListener("storage", receive);
    },
  };
}
