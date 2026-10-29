import { useEffect, useMemo, useSyncExternalStore } from "react";

import { useAuthContext } from "../../contexts/auth/useAuthContext";

/*
 * Mobile's own choices on this device, one record per signed-in person and
 * workspace: how Home is arranged, saved Activity and report filters, and
 * quick-entry templates. Only choices the person made are kept, never anything
 * the backend sent: a saved filter is its address parameters, a template is
 * what was typed into it. No token, no response, no draft.
 *
 * The key names both ids, so another person, or another workspace, never sees
 * these choices; the identity boundary remounts everything when the identity
 * changes, which opens that identity's record. Storage that can't be read or
 * written (private mode, a full disk, blocked site data) leaves the choices
 * working for this visit only, and `persisted` says so.
 */

export const HOME_BLOCKS = Object.freeze(["balances", "summary", "accounts", "recent", "attention"]);
const MAX_VIEWS = 20;
const MAX_TEMPLATES = 20;
const ID = /^[1-9]\d{0,14}$/;
const LOCAL_ID = /^[a-z0-9]{8,40}$/;
const ACTIVITY_KEYS = ["type", "status", "account_id", "category_id", "date_from", "date_to", "sort"];
const REPORT_KEYS = ["from", "to"];

export const preferenceKey = (userId, workspaceId) => (ID.test(String(userId ?? "")) && ID.test(String(workspaceId ?? "")) ? `smartspend:mobile:prefs:v1:u:${userId}:w:${workspaceId}` : null);

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const cleanParams = (input, keys) =>
  Object.fromEntries(keys.flatMap((key) => {
    const value = input?.[key];
    return typeof value === "string" && value && value.length <= 40 && /^[A-Za-z0-9_:.-]+$/.test(value) ? [[key, value]] : [];
  }));

function normalizeTemplate(input) {
  if (!input || !LOCAL_ID.test(input.id ?? "") || !["expense", "income"].includes(input.type)) return null;
  const name = text(input.name, 80);
  const amount = text(input.amount, 20);
  if (!name || (amount && !/^\d{1,14}(\.\d{1,4})?$/.test(amount))) return null;
  return {
    id: input.id,
    name,
    type: input.type,
    account_id: ID.test(String(input.account_id ?? "")) ? String(input.account_id) : "",
    category_id: ID.test(String(input.category_id ?? "")) ? String(input.category_id) : "",
    amount,
    description: text(input.description, 255),
  };
}

function normalizeView(input, keys, extra) {
  if (!input || !LOCAL_ID.test(input.id ?? "")) return null;
  const name = text(input.name, 60);
  if (!name) return null;
  return { id: input.id, name, params: cleanParams(input.params, keys), ...extra(input) };
}

export function normalizePreferences(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) && input.version === 1 ? input : {};
  const unique = (list, test) => [...new Set(Array.isArray(list) ? list : [])].filter(test);
  const order = unique(source.homeOrder, (id) => HOME_BLOCKS.includes(id));
  const dedupe = (items) => items.filter((item, index) => item && items.findIndex((other) => other?.id === item.id) === index);

  return {
    version: 1,
    homeOrder: [...order, ...HOME_BLOCKS.filter((id) => !order.includes(id))],
    homeHidden: unique(source.homeHidden, (id) => HOME_BLOCKS.includes(id)),
    activityViews: dedupe((Array.isArray(source.activityViews) ? source.activityViews : []).map((view) => normalizeView(view, ACTIVITY_KEYS, () => ({})))).slice(0, MAX_VIEWS),
    reportViews: dedupe((Array.isArray(source.reportViews) ? source.reportViews : []).map((view) => normalizeView(view, REPORT_KEYS, (raw) => ({ type: typeof raw.type === "string" && /^[a-z-]{3,20}$/.test(raw.type) ? raw.type : "overview" })))).slice(0, MAX_VIEWS),
    templates: dedupe((Array.isArray(source.templates) ? source.templates : []).map(normalizeTemplate)).slice(0, MAX_TEMPLATES),
  };
}

export function newLocalId() {
  try {
    return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 24);
  }
}

function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/* One store per key, shared by every screen of the identity, so a change on one shows on the others at once. */
const stores = new Map();

export function createPreferenceStore(key, storage = deviceStorage(), eventTarget = typeof window === "undefined" ? null : window) {
  const listeners = new Set();
  const read = () => {
    try {
      const raw = key && storage ? storage.getItem(key) : null;
      return { ...normalizePreferences(raw ? JSON.parse(raw) : null), persisted: Boolean(key && storage) };
    } catch {
      return { ...normalizePreferences(null), persisted: false };
    }
  };
  let state = Object.freeze(read());
  const emit = () => listeners.forEach((listener) => listener());

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    change: (updater) => {
      const base = state.persisted ? read() : state;
      const next = normalizePreferences({ ...base, ...updater(base), version: 1 });
      let persisted = false;
      try {
        if (key && storage) {
          storage.setItem(key, JSON.stringify(next));
          persisted = true;
        }
      } catch {
        /* Kept for this visit only. */
      }
      state = Object.freeze({ ...next, persisted });
      emit();
    },
    connect: () => {
      if (!eventTarget) return () => {};
      const receive = (event) => {
        if (event.key === key || event.key === null) {
          state = Object.freeze(read());
          emit();
        }
      };
      eventTarget.addEventListener("storage", receive);
      return () => eventTarget.removeEventListener("storage", receive);
    },
  };
}

function storeFor(key) {
  const name = key ?? "anonymous";
  if (!stores.has(name)) stores.set(name, createPreferenceStore(key));
  return stores.get(name);
}

/** Tests only: forget the shared stores (each test starts with fresh storage). */
export const resetPreferenceStoresForTests = () => stores.clear();

/** The signed-in identity's Mobile preferences, and `change(current => partial)` to update them. */
export function useDevicePreferences() {
  const { user, workspace } = useAuthContext();
  const store = useMemo(() => storeFor(preferenceKey(user?.id, workspace?.id)), [user?.id, workspace?.id]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => store.connect(), [store]);
  return { ...state, change: store.change };
}
