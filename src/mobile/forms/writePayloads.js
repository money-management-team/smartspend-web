import { normalizeAmount } from "./validation.js";
import { changedFields, visibleFields } from "./workflows.js";

/*
 * What each Mobile form would send, built from a form that already passed
 * validateWorkflow. Pure: no request, no storage, no clock (ctx.today is given).
 *
 * The field names and shapes are the backend's (develop @ fd87531 and
 * fix/financial-idempotency-p0 @ c18d4ea, which changed no request or route),
 * checked against each FormRequest's rules, and follow what the full version
 * sends for the same write:
 *
 *   - ids are numbers; amounts are plain decimals with 4 places;
 *   - occurred_at is "YYYY-MM-DD 12:00:00", like the full version (toOccurredAt);
 *   - an optional field left empty is left out of a create;
 *   - a change to a record sends only what changed (a cleared optional text
 *     is sent as null), plus the reason where one is required;
 *   - a field the form shows but the backend does not take (a budget's scope)
 *     is never sent.
 *
 * The result names the write (`operation`), the record ids the request needs,
 * and its `input`. data/writeApi.js turns that into the shared wrapper's call,
 * and only after the write gate says the operation is open.
 */

/** A valid form amount as the backend's MoneyAmount takes it: no sign, no leading zeros, 4 decimals. */
export function wireAmount(value) {
  const amount = normalizeAmount(value);
  if (!/^\d+(\.\d{1,4})?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(4, "0")}`;
}

const id = (value) => (value === "" || value == null ? undefined : Number(value));
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const day = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
const occurredAt = (value) => (day(value) ? `${value} 12:00:00` : undefined);
const integer = (value) => (typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined);
const compact = (input) => Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

/* How a value of each field kind is sent. `clear` is what an emptied optional field becomes in a change. */
function wireValue(field, value, { clear } = {}) {
  let wired;
  if (field.kind === "amount") wired = wireAmount(value) ?? undefined;
  else if (field.kind === "account" || field.kind === "category") wired = id(value);
  else if (field.kind === "integer") wired = integer(value);
  else if (field.kind === "check") wired = value === true;
  else if (field.kind === "date") wired = day(value);
  else wired = text(value);
  return wired === undefined && clear ? null : wired;
}

/* A create: every visible field that has a value, under its own name. */
function createInput(workflow, values, ctx, { skip = [], dates = {} } = {}) {
  const input = {};
  for (const field of visibleFields(workflow, values, ctx)) {
    if (field.kind === "locked" || skip.includes(field.name)) continue;
    input[field.name] = dates[field.name] ? dates[field.name](values[field.name]) : wireValue(field, values[field.name]);
  }
  return compact(input);
}

/* A change to a record: only the changed fields (an emptied optional one becomes null). */
function changeInput(workflow, values, ctx, { dates = {} } = {}) {
  const input = {};
  for (const field of changedFields(workflow, values, ctx)) {
    input[field.name] = dates[field.name] ? dates[field.name](values[field.name]) ?? null : wireValue(field, values[field.name], { clear: true });
  }
  return input;
}

const withWorkspace = (input, ctx) => ({ workspace_id: Number(ctx.workspaceId), ...input });
const reasonOf = (values) => text(values.reason);

/* workflow id -> (values, ctx) => { ids, input } */
const BUILDERS = {
  expense: (wf, values, ctx) => ({ input: createInput(wf, values, ctx, { dates: { occurred_at: occurredAt } }) }),
  income: (wf, values, ctx) => ({ input: createInput(wf, values, ctx, { dates: { occurred_at: occurredAt } }) }),
  transfer: (wf, values, ctx) => ({ input: createInput(wf, values, ctx, { dates: { occurred_at: occurredAt } }) }),
  account: (wf, values, ctx) => ({ input: withWorkspace(createInput(wf, values, ctx), ctx) }),
  // `scope` only decides whether a category is asked for; the backend has no such field.
  budget: (wf, values, ctx) => ({ input: withWorkspace(createInput(wf, values, ctx, { skip: ["scope"] }), ctx) }),
  goal: (wf, values, ctx) => ({ input: withWorkspace(createInput(wf, values, ctx), ctx) }),
  // The rule's workspace is its account's (StoreRecurringTransactionRequest takes no workspace_id).
  recurring: (wf, values, ctx) => ({ input: createInput(wf, values, ctx) }),
  debt: (wf, values, ctx) => ({ input: withWorkspace(createInput(wf, values, ctx), ctx) }),

  "transaction-correct": (wf, values, ctx) => ({
    ids: { transactionId: ctx.record.id },
    input: { reason: reasonOf(values), ...changeInput(wf, values, ctx, { dates: { occurred_at: occurredAt } }) },
  }),
  "transaction-reverse": (wf, values, ctx) => ({ ids: { transactionId: ctx.record.id }, input: { reason: reasonOf(values) } }),
  "transfer-reverse": (wf, values, ctx) => ({ ids: { transferId: ctx.record.id }, input: { reason: reasonOf(values) } }),

  "account-edit": (wf, values, ctx) => ({ ids: { accountId: ctx.record.id }, input: changeInput(wf, values, ctx) }),
  "account-archive": (wf, values, ctx) => ({ ids: { accountId: ctx.record.id }, input: {} }),
  "budget-edit": (wf, values, ctx) => ({ ids: { budgetId: ctx.record.id }, input: changeInput(wf, values, ctx) }),
  "goal-edit": (wf, values, ctx) => ({ ids: { goalId: ctx.record.id }, input: changeInput(wf, values, ctx) }),
  "goal-contribute": (wf, values, ctx) => ({ ids: { goalId: ctx.record.id }, input: createInput(wf, values, ctx, { dates: { occurred_at: occurredAt } }) }),
  "goal-withdraw": (wf, values, ctx) => ({ ids: { goalId: ctx.record.id }, input: createInput(wf, values, ctx, { dates: { occurred_at: occurredAt } }) }),
  "goal-plan": (wf, values, ctx) => ({ ids: { goalId: ctx.record.id }, input: createInput(wf, values, ctx) }),

  "recurring-edit": (wf, values, ctx) => ({ ids: { ruleId: ctx.record.id }, input: changeInput(wf, values, ctx) }),
  "recurring-confirm": (wf, values, ctx) => ({ ids: { ruleId: ctx.record.id }, input: {} }),
  "recurring-skip": (wf, values, ctx) => ({ ids: { ruleId: ctx.record.id }, input: compact({ reason: reasonOf(values) }) }),

  "debt-edit": (wf, values, ctx) => ({ ids: { debtId: ctx.record.id }, input: changeInput(wf, values, ctx) }),
  // Like the full version (buildPaymentPayload): today's date is the backend's default, so it is left out.
  "debt-payment": (wf, values, ctx) => ({
    ids: { debtId: ctx.record.id },
    input: createInput(wf, values, ctx, { dates: { paid_at: (value) => (day(value) && value !== ctx.today ? value : undefined) } }),
  }),
  "debt-payment-reverse": (wf, values, ctx) => ({ ids: { paymentId: ctx.record.id }, input: { reason: reasonOf(values) } }),

  // Two requests: the edited values are saved with the review_version that was read, then the
  // saved review is confirmed with the version that save returned (data/writeApi.js).
  "receipt-review": (wf, values, ctx) => ({ ids: { captureId: ctx.record.id }, reviewVersion: ctx.record.reviewVersion, input: captureInput(wf, values, ctx) }),
  "voice-review": (wf, values, ctx) => ({ ids: { captureId: ctx.record.id }, reviewVersion: ctx.record.reviewVersion, input: captureInput(wf, values, ctx) }),
  "whatsapp-draft": (wf, values, ctx) => ({ ids: { draftId: ctx.record.id }, reviewVersion: ctx.record.reviewVersion, input: createInput(wf, values, ctx) }),

  "profile-edit": (wf, values, ctx) => ({ input: changeInput(wf, values, ctx) }),
  "password-change": (wf, values) => ({ input: { currentPassword: values.current_password, password: values.password, passwordConfirmation: values.password_confirmation } }),
  export: (wf, values) => ({ input: { report: values.report, format: values.format, filters: compact({ from: day(values.from), to: day(values.to), currency: text(values.currency) }) } }),
};

/* Every reviewed capture field, an emptied optional one as null (the review replaces what was read). */
function captureInput(workflow, values, ctx) {
  const input = {};
  for (const field of visibleFields(workflow, values, ctx)) input[field.name] = wireValue(field, values[field.name], { clear: true });
  return input;
}

export const PAYLOAD_WORKFLOWS = Object.freeze(Object.keys(BUILDERS));

/**
 * The write a valid form stands for: { operation, ids, input, reviewVersion? }.
 * Throws for a workflow that has no builder, so a new form can't be sent by accident.
 */
export function buildWrite(workflow, values, ctx) {
  const build = BUILDERS[workflow.id];
  if (!build) throw new Error(`No request is defined for the "${workflow.id}" form.`);
  const { ids = {}, input, reviewVersion } = build(workflow, values, ctx);
  return { operation: workflow.operation, ids, input, ...(reviewVersion !== undefined ? { reviewVersion } : {}) };
}
