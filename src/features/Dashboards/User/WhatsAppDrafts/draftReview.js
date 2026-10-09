import {
  classifyWhatsAppError,
  normalizeWhatsAppAmount,
} from "../FinancialOperations/whatsappContract.js";
import { getApiErrorMessage } from "../api/apiClient.js";
import { formatDraftTime } from "./draftHelpers.js";

/*
 * Pure logic of the WhatsApp draft review screen: the edit form, its diff
 * against the saved draft, client-side checks, the state reducer, and the
 * translated text for failed save / confirm / discard calls.
 *
 * Money never goes through Number: amounts are compared and normalized as
 * decimal strings (normalizeWhatsAppAmount).
 */

export const EDITABLE_FIELDS = [
  "account_id", "category_id", "amount", "description", "transaction_date", "transaction_time",
];

/** "25.2500" -> "25.25", "25.0000" -> "25". String operations only. */
export function trimDecimal(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return value ?? "";
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

/** The editable fields of a saved draft, as the strings the inputs hold. */
export function draftToForm(draft) {
  const values = draft.review_values;
  return {
    account_id: values.account_id == null ? "" : String(values.account_id),
    category_id: values.category_id == null ? "" : String(values.category_id),
    amount: trimDecimal(values.amount ?? ""),
    description: values.description ?? "",
    transaction_date: values.transaction_date ?? "",
    transaction_time: formatDraftTime(values.transaction_time) ?? "",
  };
}

function normalizedAmount(value) {
  const text = String(value ?? "").trim();
  if (text === "") return "";
  try {
    return normalizeWhatsAppAmount(text);
  } catch {
    return `invalid:${text}`; // still compares as "different" from any valid value
  }
}

const normalizers = {
  amount: normalizedAmount,
  description: (value) => String(value ?? "").trim(),
  transaction_date: (value) => String(value ?? "").trim(),
  transaction_time: (value) => String(value ?? "").trim(),
  account_id: (value) => String(value ?? ""),
  category_id: (value) => String(value ?? ""),
};

/** The fields whose current value differs from the saved one. */
export const changedFields = (saved, form) =>
  EDITABLE_FIELDS.filter((field) => normalizers[field](saved[field]) !== normalizers[field](form[field]));

/**
 * The values to PATCH: only changed fields, null for an emptied optional one.
 * `transaction_date` is never emptied (validateForm refuses it first).
 */
export function formToChanges(saved, form) {
  const changes = {};
  for (const field of changedFields(saved, form)) {
    const value = String(form[field] ?? "").trim();
    changes[field] = value === "" ? null : value;
  }
  return changes;
}

const CALENDAR = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(value) {
  const match = CALENDAR.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** Friendly client-side checks. The backend stays the judge. Keys are error codes. */
export function validateForm(form) {
  const errors = {};
  const amount = String(form.amount ?? "").trim();

  if (amount !== "") {
    try {
      normalizeWhatsAppAmount(amount);
    } catch {
      errors.amount = "amount_invalid";
    }
  }

  const date = String(form.transaction_date ?? "").trim();
  if (date === "") errors.transaction_date = "date_required";
  else if (!isCalendarDate(date)) errors.transaction_date = "date_invalid";

  const time = String(form.transaction_time ?? "").trim();
  if (time !== "" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.transaction_time = "time_invalid";

  if ([...String(form.description ?? "")].length > 500) errors.description = "description_long";

  return errors;
}

/* ------------------------------------------------------------ server errors */

const SERVER_FIELDS = {
  account_id: "account_id", category_id: "category_id", amount: "amount", description: "description",
  transaction_date: "transaction_date", transaction_time: "transaction_time", currency_code: "account_id",
};

/** Backend 422 field errors, mapped onto form fields: { field: "server" }. */
export function serverFieldErrors(error) {
  const result = {};
  for (const key of Object.keys(error?.errors ?? {})) {
    if (SERVER_FIELDS[key]) result[SERVER_FIELDS[key]] = "server";
  }
  return result;
}

/**
 * User-facing text for a failed review call. `context`: save | confirm |
 * discard | read. Backend English is never shown for cases we can explain.
 */
export function getReviewErrorMessage(error, t, context) {
  const key = "dashboard.whatsappDrafts.review.errors";
  const kind = classifyWhatsAppError(error);

  // The adapter refuses a second confirmation of the same draft while one is running.
  if (error?.code === "WHATSAPP_CONFIRM_IN_FLIGHT") return t(`${key}.inFlight`);

  switch (kind) {
    case "forbidden": return t(`${key}.forbidden`);
    case "not_found": return t(`${key}.notFound`);
    case "unauthenticated": return t(`${key}.unauthenticated`);
    case "conflict": return t(`${key}.conflict.${context === "confirm" ? "confirm" : context}`, { defaultValue: t(`${key}.conflict.generic`) });
    case "validation": {
      const fields = Object.keys(error?.errors ?? {});
      const message = String(error?.message ?? "");
      if (/insufficient/i.test(message)) return t(`${key}.insufficient`);
      if (fields.includes("status")) return t(`${key}.notReviewable`);
      if (fields.includes("transaction_date") && context === "confirm") return t(`${key}.dateMissing`);
      if (fields.includes("transaction_time")) return t(`${key}.timeInvalid`);
      if (fields.includes("account_id") || fields.includes("currency_code")) return t(`${key}.account`);
      if (fields.includes("category_id")) return t(`${key}.category`);
      if (fields.includes("amount") || fields.includes("draft")) return t(`${key}.amount`);
      return t(`${key}.validation`);
    }
    case "timeout":
    case "network":
    case "server":
    case "malformed":
      return context === "confirm" ? t(`${key}.uncertainConfirm`) : getApiErrorMessage(error, t);
    default:
      return getApiErrorMessage(error, t);
  }
}

/* -------------------------------------------------------------------- state */

export const initialReviewState = Object.freeze({
  load: "loading", // loading | ready | error
  loadError: null,
  draft: null,
  saved: null,
  form: null,
  fieldErrors: {},
  save: { phase: "idle", error: null }, // idle | saving | error
  conflict: null, // { mine, acknowledged }
  confirm: { phase: "idle", error: null, note: null }, // idle | confirming | uncertain | checking | rejected | done
  discard: { phase: "idle", error: null }, // idle | discarding | uncertain | checking | rejected | done
  transaction: null,
});

const idle = { phase: "idle", error: null };

export function reviewReducer(state, action) {
  switch (action.type) {
    case "load-failed":
      return { ...state, load: "error", loadError: action.error };
    case "loaded": {
      const form = draftToForm(action.draft);
      return { ...initialReviewState, load: "ready", draft: action.draft, saved: form, form };
    }
    case "refreshed": {
      // A newer read of the same draft. Never replace a newer version with an older one.
      if (state.draft && action.draft.review_version < state.draft.review_version) return state;
      const saved = draftToForm(action.draft);
      const dirty = state.form && changedFields(state.saved, state.form).length > 0;
      return { ...state, draft: action.draft, saved, form: dirty ? state.form : saved };
    }
    case "field":
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
        save: state.save.phase === "error" ? idle : state.save,
      };
    case "reset-form":
      return { ...state, form: state.saved, fieldErrors: {}, save: idle };
    case "field-errors":
      return { ...state, fieldErrors: action.errors, save: { phase: "error", error: action.error ?? null } };
    case "save-start":
      return { ...state, save: { phase: "saving", error: null }, fieldErrors: {} };
    case "saved": {
      if (state.draft && action.draft.review_version < state.draft.review_version) {
        return { ...state, save: idle }; // an older answer never overwrites newer data
      }
      const saved = draftToForm(action.draft);
      return { ...state, draft: action.draft, saved, form: saved, fieldErrors: {}, save: idle, conflict: null };
    }
    case "save-failed":
      return { ...state, save: { phase: "error", error: action.error }, fieldErrors: action.fieldErrors ?? {} };
    case "conflict": {
      // The server changed under the user: show the latest, keep their edits aside.
      const saved = draftToForm(action.draft);
      return {
        ...state, draft: action.draft, saved, form: saved, fieldErrors: {}, save: idle,
        conflict: { mine: action.mine, acknowledged: false },
        confirm: state.confirm.phase === "done" ? state.confirm : { ...idle, note: null },
      };
    }
    case "conflict-reapply": {
      const form = { ...state.saved };
      for (const [field, value] of Object.entries(state.conflict?.mine ?? {})) form[field] = value ?? "";
      return { ...state, form, conflict: null };
    }
    case "conflict-dismiss":
      return { ...state, conflict: null };
    case "confirm-start":
      return { ...state, confirm: { phase: "confirming", error: null, note: null } };
    case "confirm-checking":
      return { ...state, confirm: { ...state.confirm, phase: "checking" } };
    case "confirm-uncertain":
      return { ...state, confirm: { phase: "uncertain", uncertain: true, error: action.error ?? null, note: action.note ?? null } };
    case "confirm-rejected":
      return { ...state, confirm: { phase: "rejected", error: action.error, note: null } };
    case "confirm-done": {
      const saved = draftToForm(action.draft);
      return {
        ...state, draft: action.draft, saved, form: saved, fieldErrors: {}, conflict: null,
        transaction: action.transaction ?? state.transaction, confirm: { phase: "done", error: null, note: action.note ?? null },
      };
    }
    case "confirm-clear":
      return { ...state, confirm: { phase: "idle", error: null, note: null } };
    case "discard-start":
      return { ...state, discard: { phase: "discarding", error: null } };
    case "discard-checking":
      return { ...state, discard: { ...state.discard, phase: "checking" } };
    case "discard-uncertain":
      return { ...state, discard: { phase: "uncertain", error: action.error ?? null } };
    case "discard-rejected":
      return { ...state, discard: { phase: "rejected", error: action.error } };
    case "discard-done": {
      const saved = draftToForm(action.draft);
      return { ...state, draft: action.draft, saved, form: saved, conflict: null, discard: { phase: "done", error: null } };
    }
    case "discard-clear":
      return { ...state, discard: idle };
    default:
      return state;
  }
}

/** Whether the saved draft, as the backend reports it, can be confirmed right now. */
export function canConfirmDraft(state) {
  const draft = state.draft;
  return Boolean(
    draft
    && draft.status === "ready_for_review"
    && draft.can_confirm === true
    && draft.confirmation?.ready === true
    && changedFields(state.saved, state.form).length === 0
    && !state.conflict
    && state.save.phase !== "saving"
    && ["idle", "rejected"].includes(state.confirm.phase),
  );
}
