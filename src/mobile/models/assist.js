import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { dateOnlyOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * The assistant, captures, WhatsApp and notification preferences as Mobile
 * shows them. Pure. Every value is the backend's; a value that is missing or
 * not what the contract says is left out (null), never replaced with a guess.
 * Amounts stay the backend's strings.
 */

const invalid = () => Object.assign(new Error("The answer could not be validated."), { code: "MALFORMED_RESPONSE" });
const word = (value) => (typeof value === "string" && /^[a-z][a-z0-9_]{0,40}$/.test(value) ? value : null);
const moment = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value : null);
const money = (value) => (parseDecimal(value) ? String(value) : null);
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

/** A Laravel paginator at data[key]: rows through `normalize` (a row it refuses makes the page unusable). */
export function buildPage(data, key, normalize) {
  const page = isRecord(data) ? data[key] : null;
  if (!isRecord(page) || !Array.isArray(page.data)) throw invalid();
  const items = page.data.map(normalize);
  if (items.some((item) => item === null)) throw invalid();
  if (new Set(items.map((item) => item.id)).size !== items.length) throw invalid();
  const current = Number.isSafeInteger(page.current_page) && page.current_page > 0 ? page.current_page : 1;
  const last = Number.isSafeInteger(page.last_page) && page.last_page >= current ? page.last_page : current;
  return { items, page: current, lastPage: last, total: count(page.total) };
}

/* ---------- Assistant ---------- */

export function buildAiSettings(data) {
  const settings = isRecord(data) ? data.settings : null;
  if (!isRecord(settings)) throw invalid();
  const flag = (value) => (typeof value === "boolean" ? value : null);
  return {
    consent: flag(settings.consent?.active),
    insights: flag(settings.insights_enabled),
    forecast: flag(settings.forecast_enabled),
    retentionDays: count(settings.retention_days),
    language: word(settings.preferred_language),
  };
}

const SOURCE = /^[a-z_]{1,40}$/;
const sourcesOf = (value) =>
  (Array.isArray(value) ? value : [])
    .filter(isRecord)
    .map((source) => ({ type: SOURCE.test(source.type ?? "") ? source.type : null, id: idText(source.id), label: textOrNull(source.label, 120) }))
    .filter((source) => source.type || source.label)
    .slice(0, 8);

export const normalizeConversation = (raw) => {
  const id = isRecord(raw) ? idText(raw.id) : null;
  return id ? { id, title: textOrNull(raw.title, 120), updatedAt: moment(raw.updated_at ?? raw.created_at) } : null;
};

export const normalizeMessage = (raw) => {
  const id = isRecord(raw) ? idText(raw.id) : null;
  if (!id || !["user", "assistant"].includes(raw.role)) return null;
  return { id, role: raw.role, content: textOrNull(raw.content, 8000) ?? "", sources: sourcesOf(raw.sources), createdAt: moment(raw.created_at) };
};

export const normalizeInsight = (raw) => {
  const id = isRecord(raw) ? idText(raw.id) : null;
  if (!id) return null;
  return {
    id,
    type: word(raw.type),
    status: word(raw.status),
    title: textOrNull(raw.title, 200),
    summary: textOrNull(raw.summary, 1000),
    explanation: textOrNull(raw.explanation, 2000),
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    sources: sourcesOf(raw.sources),
    generatedAt: moment(raw.generated_at ?? raw.created_at),
  };
};

const FORECAST_FIGURES = ["current_balance", "expected_inflow", "expected_outflow", "projected_balance", "minimum_projected_balance"];

export function buildForecast(data) {
  const forecast = isRecord(data) ? data.forecast : null;
  if (!isRecord(forecast)) throw invalid();
  const currencies = (Array.isArray(forecast.currencies) ? forecast.currencies : []).filter(isRecord).flatMap((row) => {
    if (!isCurrencyCode(row.currency_code)) return [];
    const timeline = (Array.isArray(row.timeline) ? row.timeline : []).filter(isRecord).flatMap((day) => {
      const date = dateOnlyOrNull(day.date);
      return date ? [{ date, inflow: money(day.expected_inflow), outflow: money(day.expected_outflow), closing: money(day.closing_balance) }] : [];
    });
    return [{ currency: row.currency_code, figures: Object.fromEntries(FORECAST_FIGURES.map((key) => [key, money(row[key])])), timeline, pressureDays: Array.isArray(row.pressure_days) ? row.pressure_days.map(dateOnlyOrNull).filter(Boolean) : [] }];
  });
  return {
    status: word(forecast.status),
    start: dateOnlyOrNull(forecast.period?.start),
    end: dateOnlyOrNull(forecast.period?.end),
    explanation: textOrNull(forecast.explanation, 2000),
    assumptions: (Array.isArray(forecast.assumptions) ? forecast.assumptions : []).map((item) => textOrNull(typeof item === "string" ? item : item?.text, 300)).filter(Boolean).slice(0, 10),
    currencies,
  };
}

/** The voice and receipt quotas: both, or neither (an unknown quota is never shown as a fresh one). */
export function buildQuotas(data) {
  const one = (value) => {
    if (!isRecord(value) || !moment(value.reset_at)) return null;
    const { limit, used, remaining } = value;
    return Number.isSafeInteger(limit) && limit > 0 && Number.isSafeInteger(used) && used >= 0 && used <= limit && remaining === limit - used ? { limit, used, remaining, resetAt: value.reset_at } : null;
  };
  const voice = one(data?.quotas?.voice);
  const receipt = one(data?.quotas?.receipt);
  return voice && receipt ? { voice, receipt } : null;
}

/* ---------- Captures ---------- */

export const CAPTURE_STATUSES = Object.freeze(["uploaded", "queued", "processing", "ready_for_review", "failed", "confirmed", "discarded"]);
const REVIEW_FIELDS = ["account_id", "category_id", "merchant_name", "amount", "currency_code", "transaction_date", "transaction_time", "reference_number", "tax_amount", "fee_amount", "description"];

export function normalizeCapture(raw, source) {
  const id = isRecord(raw) ? idText(raw.id) : null;
  if (!id || !CAPTURE_STATUSES.includes(raw.status)) return null;
  if (source === "voice" && raw.source_type !== "voice") return null;
  const values = isRecord(raw.review_values) ? raw.review_values : {};
  const review = Object.fromEntries(REVIEW_FIELDS.map((field) => [field, values[field] ?? null]));
  return {
    id,
    source,
    status: raw.status,
    reviewVersion: Number.isSafeInteger(raw.review_version) ? raw.review_version : null,
    review: {
      ...review,
      amount: money(review.amount),
      tax_amount: money(review.tax_amount),
      fee_amount: money(review.fee_amount),
      currency_code: isCurrencyCode(review.currency_code) ? review.currency_code : null,
      account_id: idText(review.account_id) ?? "",
      category_id: idText(review.category_id) ?? "",
      transaction_date: dateOnlyOrNull(review.transaction_date) ?? "",
      merchant_name: textOrNull(review.merchant_name, 191) ?? "",
      description: textOrNull(review.description, 500) ?? "",
      reference_number: textOrNull(review.reference_number, 120) ?? "",
    },
    transcript: source === "voice" ? textOrNull(raw.transcript, 4000) : null,
    warnings: (Array.isArray(raw.warnings) ? raw.warnings : []).map((item) => textOrNull(typeof item === "string" ? item : item?.message, 300)).filter(Boolean).slice(0, 10),
    failure: textOrNull(raw.failure_reason ?? raw.error_message, 300),
    transactionId: idText(raw.transaction_id ?? raw.transaction?.id),
    createdAt: moment(raw.created_at),
  };
}

export function buildCaptureDetail(data, requestedId, source) {
  const capture = normalizeCapture(isRecord(data) ? data.capture : null, source);
  return capture && capture.id === String(requestedId) ? capture : null;
}

/* ---------- WhatsApp ---------- */

export const WHATSAPP_STATES = Object.freeze(["disabled", "not_linked", "linked"]);
export const DRAFT_STATUSES = Object.freeze(["collecting", "ready_for_review", "confirmed", "discarded", "expired"]);

export function buildWhatsApp(data) {
  if (!isRecord(data) || typeof data.enabled !== "boolean" || !WHATSAPP_STATES.includes(data.state) || !isRecord(data.capabilities)) throw invalid();
  const integration = isRecord(data.integration) ? data.integration : null;
  return {
    enabled: data.enabled,
    state: data.state,
    canLink: data.capabilities.can_link === true,
    canManage: data.capabilities.can_manage_link === true,
    canReview: data.capabilities.can_review_drafts === true,
    phoneLastDigits: typeof integration?.phone_last_digits === "string" && /^\d{2,4}$/.test(integration.phone_last_digits) ? integration.phone_last_digits : null,
    linkedAt: moment(integration?.linked_at),
    language: word(integration?.language ?? integration?.preferred_language),
  };
}

export function normalizeDraft(raw) {
  const id = isRecord(raw) ? idText(raw.id) : null;
  if (!id || !DRAFT_STATUSES.includes(raw.status) || !Number.isSafeInteger(raw.review_version) || !isRecord(raw.review_values)) return null;
  const values = raw.review_values;
  const issues = Array.isArray(raw.confirmation?.issues) ? raw.confirmation.issues.filter(isRecord).map((issue) => word(issue.code)).filter(Boolean) : [];
  return {
    id,
    status: raw.status,
    reviewVersion: raw.review_version,
    review: {
      account_id: idText(values.account_id) ?? "",
      category_id: idText(values.category_id) ?? "",
      amount: money(values.amount),
      description: textOrNull(values.description, 500) ?? "",
      transaction_date: dateOnlyOrNull(values.transaction_date) ?? "",
      transaction_time: typeof values.transaction_time === "string" && /^\d{2}:\d{2}/.test(values.transaction_time) ? values.transaction_time.slice(0, 5) : "",
    },
    currency: isCurrencyCode(raw.account?.currency_code) ? raw.account.currency_code : isCurrencyCode(values.currency_code) ? values.currency_code : null,
    accountName: textOrNull(raw.account?.name, 80),
    ready: raw.confirmation?.ready === true,
    issues,
    canEdit: raw.can_edit === true,
    expiresAt: moment(raw.expires_at),
    createdAt: moment(raw.created_at),
    message: textOrNull(raw.source_text ?? raw.message_text, 1000),
  };
}

export function buildDraftDetail(data, requestedId) {
  const draft = normalizeDraft(isRecord(data) ? data.draft : null);
  return draft && draft.id === String(requestedId) ? draft : null;
}

/* ---------- Notification preferences ---------- */

export function buildNotificationPreferences(data) {
  if (!isRecord(data) || !isRecord(data.preferences)) throw invalid();
  return {
    reminders: typeof data.preferences.savings_installment_reminders === "boolean" ? data.preferences.savings_installment_reminders : null,
    available: typeof data.savings_installment_reminders_available === "boolean" ? data.savings_installment_reminders_available : null,
    channels: (Array.isArray(data.channels) ? data.channels : []).map(word).filter(Boolean),
  };
}
