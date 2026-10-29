import { PATH, getAccountDetailsPath, getAiExpenseCapturePath, getSettingsTabPath, getWhatsAppDraftPath, getNewOperationPath, getNewSavingsGoalPath, getNewTransferPath, getBudgetDetailsPath, getDebtDetailsPath, getRecurringDetailsPath, getSavingsGoalDetailsPath, getTransactionDetailsPath, getTransferDetailsPath } from "../../routes/Path.js";
import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { idText, isRecord, textOrNull } from "../models/values.js";
import { amountError, compareAmounts, dateError, integerError, normalizeAmount, textError } from "./validation.js";

/*
 * Every Mobile form for a change the full version can make, described as data.
 *
 * A form here can be filled in, checked and reviewed, and that is where it ends:
 * NONE of them is sent. No file in Mobile has code that sends any of these
 * requests (tests/mobileReadOnly.test.mjs and tests/mobileForms.test.mjs check
 * the source), and the review step shows why and links to the full version. Each
 * entry names the request the full version makes (`endpoint`) and the write's
 * name (`operation`); none of these names is in data/writeGate.js, so the gate
 * answers "closed" for every one of them. Opening one would need a reviewed send
 * path of its own, the server-side evidence in
 * docs/mobile/SECURITY-AND-FINANCIAL-GATES.md, and a change to the gate.
 *
 * Fields are only the documented ones (docs/<feature>/api.md); a field the full
 * version shows as fixed after creation (an account's currency, a budget's
 * category, a debt's direction, a rule's structure) is shown, not edited.
 *
 * Field kinds: account, category, amount, currency, date, text, textarea, choice,
 * integer, check. `when(values, ctx)` hides a field; `required` may be a function.
 */

// The currencies the full version offers (Accounts/accountHelpers.js ACCOUNT_CURRENCIES; tests/mobileForms.test.mjs keeps them equal).
export const FORM_CURRENCIES = Object.freeze(["ILS", "USD", "EUR", "JOD", "SAR", "AED"]);
export const ACCOUNT_TYPES = Object.freeze(["cash", "bank", "wallet", "savings", "custom"]);
export const REASON = Object.freeze({ min: 3, max: 500 });
export const PASSWORD_MIN = 8;
// The report names and the formats the export queue builds (docs/report-exports/overview.md). PDF is built in the browser by the full version, not queued.
export const EXPORT_REPORTS = Object.freeze(["overview", "income-expense", "cash-flow", "accounts", "categories", "transfers", "budgets", "savings-goals", "debts", "recurring"]);
export const EXPORT_FORMATS = Object.freeze(["csv", "xlsx"]);

const text = (value) => (typeof value === "string" ? value : "");
const digits = (value) => {
  const parsed = parseDecimal(value);
  if (!parsed) return "";
  const shown = String(value).replace(/^[-+]/, "");
  return shown.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
};
const day = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "");

/* ---------- The records some forms start from (each refuses an answer about another id) ---------- */

const pickTransaction = (data, id) => {
  const raw = isRecord(data) ? data.transaction : null;
  if (!isRecord(raw) || idText(raw.id) !== String(id)) return null;
  const own = (Array.isArray(raw.ledger_entries) ? raw.ledger_entries : []).find((entry) => isRecord(entry) && entry.entry_role === raw.type);
  return {
    id: String(id),
    type: text(raw.type),
    status: text(raw.status),
    isReversal: raw.reversal_of_id != null || raw.type === "reversal",
    isTransfer: raw.transfer_id != null || raw.type === "transfer" || raw.type === "fee",
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    amount: digits(raw.amount),
    accountId: idText(own?.account?.id ?? own?.account_id ?? raw.account_id) ?? "",
    categoryId: idText(raw.category?.id ?? raw.category_id) ?? "",
    description: text(raw.description),
    referenceNumber: text(raw.reference_number),
    occurredAt: day(raw.occurred_at),
  };
};

const pickTransfer = (data, id) => {
  const raw = isRecord(data) ? data.transfer : null;
  if (!isRecord(raw) || idText(raw.id) !== String(id)) return null;
  return {
    id: String(id),
    status: text(raw.status),
    amount: digits(raw.amount),
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    fromName: textOrNull(raw.from_account?.name, 80),
    toName: textOrNull(raw.to_account?.name, 80),
    occurredAt: day(raw.occurred_at),
  };
};

const pickAccount = (data, id) => {
  const raw = isRecord(data) ? data.account : null;
  if (!isRecord(raw) || idText(raw.id) !== String(id)) return null;
  return {
    id: String(id),
    name: text(raw.name),
    type: text(raw.type),
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    openingBalance: parseDecimal(raw.opening_balance) ? String(raw.opening_balance).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : "",
    allowNegative: raw.allow_negative_balance === true,
    status: text(raw.status),
    isGoal: Boolean(raw.savings_goal) || raw.type === "savings_goal",
  };
};

const pickBudget = (data, id) => {
  const raw = isRecord(data) ? data.budget : null;
  if (!isRecord(raw) || idText(raw.id) !== String(id)) return null;
  return {
    id: String(id),
    name: text(raw.name),
    amountLimit: digits(raw.amount_limit),
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    periodStart: day(raw.period_start),
    periodEnd: day(raw.period_end),
    notes: text(raw.notes),
    categoryName: textOrNull(raw.category?.name, 80),
    status: text(raw.status),
  };
};

const pickGoal = (data, id) => {
  const raw = isRecord(data) ? data.savings_goal : null;
  if (!isRecord(raw) || idText(raw.id) !== String(id)) return null;
  return {
    id: String(id),
    name: text(raw.name),
    targetAmount: digits(raw.target_amount),
    savedAmount: parseDecimal(raw.saved_amount) ? raw.saved_amount : null,
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    targetDate: day(raw.target_date),
    notes: text(raw.notes),
    status: text(raw.status),
    accountId: idText(raw.account?.id ?? raw.account_id) ?? "",
  };
};

const pickRule = (data, id) => {
  const raw = isRecord(data) ? data.recurring_transaction : null;
  if (!isRecord(raw) || idText(raw.id) !== String(id)) return null;
  return {
    id: String(id),
    name: text(raw.name),
    type: text(raw.type),
    amount: digits(raw.amount),
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    accountName: textOrNull(raw.account?.name, 80),
    interval: Number.isSafeInteger(raw.interval) ? String(raw.interval) : "",
    frequency: text(raw.frequency),
    endDate: day(raw.end_date),
    maxOccurrences: Number.isSafeInteger(raw.max_occurrences) ? String(raw.max_occurrences) : "",
    processingMode: text(raw.processing_mode),
    description: text(raw.description),
    notes: text(raw.notes),
    status: text(raw.status),
    nextDue: day(raw.schedule?.next_occurrence?.due_date ?? raw.next_due_date),
  };
};

const pickDebt = (data, id) => {
  const raw = isRecord(data) ? data.debt : null;
  if (!isRecord(raw) || idText(raw.id) !== String(id)) return null;
  return {
    id: String(id),
    direction: text(raw.direction),
    counterparty: text(raw.counterparty_name),
    originalAmount: digits(raw.original_amount),
    remaining: parseDecimal(raw.remaining_amount) ? String(raw.remaining_amount) : null,
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    issuedAt: day(raw.issued_at),
    dueDate: day(raw.due_date),
    notes: text(raw.notes),
    status: text(raw.effective_status || raw.status),
    paymentsCount: Number.isSafeInteger(raw.payments_count) ? raw.payments_count : null,
  };
};

// One payment of a debt, from the debt's latest payments (there is no GET for a single payment).
const pickPayment = (data, paymentId) => {
  const rows = isRecord(data) && isRecord(data.payments) && Array.isArray(data.payments.data) ? data.payments.data : null;
  const raw = rows?.find((row) => isRecord(row) && idText(row.id) === String(paymentId));
  if (!raw) return null;
  return {
    id: String(paymentId),
    amount: digits(raw.amount),
    currency: isCurrencyCode(raw.currency_code) ? raw.currency_code : null,
    paidAt: day(raw.paid_at),
    reversed: raw.is_reversed === true || raw.status === "reversed",
    accountName: textOrNull(raw.account?.name, 80),
  };
};

export const RECORD_PICKERS = Object.freeze({ transaction: pickTransaction, transfer: pickTransfer, account: pickAccount, budget: pickBudget, goal: pickGoal, rule: pickRule, debt: pickDebt, payment: pickPayment });

/* ---------- Shared pieces ---------- */

const accountOf = (ctx, id) => ctx.accounts?.find((account) => account.id === String(id)) ?? null;
const currencyOfAccount = (field) => (values, ctx) => accountOf(ctx, values[field])?.currency ?? null;

const reasonField = { name: "reason", kind: "textarea", required: true, min: REASON.min, max: REASON.max, hint: "reasonHint" };
const descriptionField = { name: "description", kind: "text", max: 255 };
const referenceField = { name: "reference_number", kind: "text", max: 100 };

// Accounts money can be moved with: active, not a savings goal's own account.
export const spendable = (account) => account && !account.archived && !account.isGoal;

const sameCurrencyAs = (currency) => (account) => spendable(account) && (!currency || account.currency === currency);

/* ---------- The forms ---------- */

const entry = (type) => ({
  id: type,
  group: "money",
  operation: `transaction.${type}`,
  endpoint: `POST /transactions/${type}`,
  fullPath: () => getNewOperationPath(type),
  needs: { accounts: true, categories: true },
  fields: [
    { name: "account_id", kind: "account", required: true, accounts: spendable },
    { name: "category_id", kind: "category", required: type === "expense", categoryType: () => type },
    { name: "amount", kind: "amount", required: true, currency: currencyOfAccount("account_id") },
    { name: "occurred_at", kind: "date", required: true },
    descriptionField,
    referenceField,
  ],
  initial: (ctx) => ({ account_id: "", category_id: "", amount: "", occurred_at: ctx.today, description: "", reference_number: "" }),
});

export const WORKFLOWS = Object.freeze({
  expense: entry("expense"),
  income: entry("income"),

  transfer: {
    id: "transfer",
    group: "money",
    operation: "transfer.create",
    endpoint: "POST /transfers",
    fullPath: () => getNewTransferPath(),
    needs: { accounts: true, categories: true },
    fields: [
      { name: "from_account_id", kind: "account", required: true, accounts: spendable },
      { name: "to_account_id", kind: "account", required: true, accounts: (account, values, ctx) => sameCurrencyAs(accountOf(ctx, values.from_account_id)?.currency)(account) && account.id !== String(values.from_account_id) },
      { name: "amount", kind: "amount", required: true, currency: currencyOfAccount("from_account_id") },
      { name: "fee_amount", kind: "amount", required: false, zero: true, currency: currencyOfAccount("from_account_id"), hint: "feeHint" },
      { name: "fee_category_id", kind: "category", categoryType: () => "expense", required: (values) => hasFee(values), when: (values) => hasFee(values) },
      { name: "fee_description", kind: "text", max: 500, when: (values) => hasFee(values) },
      { name: "occurred_at", kind: "date", required: true },
      { name: "description", kind: "text", max: 500 },
      referenceField,
    ],
    initial: (ctx) => ({ from_account_id: "", to_account_id: "", amount: "", fee_amount: "", fee_category_id: "", fee_description: "", occurred_at: ctx.today, description: "", reference_number: "" }),
    check: (values, ctx) => {
      const from = accountOf(ctx, values.from_account_id);
      const to = accountOf(ctx, values.to_account_id);
      if (from && to && from.id === to.id) return { to_account_id: "sameAccount" };
      if (from && to && from.currency !== to.currency) return { to_account_id: "currencyMismatch" };
      return {};
    },
  },

  account: {
    id: "account",
    group: "accounts",
    operation: "account.create",
    labels: { type: "accountType" },
    endpoint: "POST /accounts",
    fullPath: () => PATH.USER.ACCOUNTS,
    needs: {},
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "type", kind: "choice", required: true, options: ACCOUNT_TYPES, optionKey: "accountType" },
      { name: "currency_code", kind: "currency", required: true },
      { name: "opening_balance", kind: "amount", required: true, zero: true, currency: (values) => values.currency_code || null, hint: "openingHint" },
      { name: "allow_negative_balance", kind: "check" },
    ],
    initial: () => ({ name: "", type: "", currency_code: "", opening_balance: "0", allow_negative_balance: false }),
  },

  budget: {
    id: "budget",
    group: "planning",
    operation: "budget.create",
    endpoint: "POST /budgets",
    fullPath: () => PATH.USER.BUDGETS,
    needs: { categories: true },
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "scope", kind: "choice", required: true, options: ["general", "category"], optionKey: "budgetScope", hint: "scopeHint" },
      { name: "category_id", kind: "category", categoryType: () => "expense", required: (values) => values.scope === "category", when: (values) => values.scope === "category" },
      { name: "currency_code", kind: "currency", required: true },
      { name: "amount_limit", kind: "amount", required: true, currency: (values) => values.currency_code || null },
      { name: "period_start", kind: "date", required: true },
      { name: "period_end", kind: "date", required: true },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: () => ({ name: "", scope: "general", category_id: "", currency_code: "", amount_limit: "", period_start: "", period_end: "", notes: "" }),
    check: (values) => (values.period_start && values.period_end && values.period_end < values.period_start ? { period_end: "endBeforeStart" } : {}),
  },

  goal: {
    id: "goal",
    group: "planning",
    operation: "goal.create",
    endpoint: "POST /savings-goals",
    fullPath: () => getNewSavingsGoalPath(),
    needs: {},
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "currency_code", kind: "currency", required: true },
      { name: "target_amount", kind: "amount", required: true, currency: (values) => values.currency_code || null },
      { name: "target_date", kind: "date" },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: () => ({ name: "", currency_code: "", target_amount: "", target_date: "", notes: "" }),
    check: (values, ctx) => (values.target_date && values.target_date < ctx.today ? { target_date: "pastDate" } : {}),
  },

  recurring: {
    id: "recurring",
    group: "planning",
    operation: "recurring.create",
    labels: { type: "entryType" },
    endpoint: "POST /recurring-transactions",
    fullPath: () => PATH.USER.RECURRING,
    needs: { accounts: true, categories: true },
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "type", kind: "choice", required: true, options: ["expense", "income"], optionKey: "entryType" },
      { name: "account_id", kind: "account", required: true, accounts: spendable },
      { name: "category_id", kind: "category", required: (values) => values.type === "expense", categoryType: (values) => values.type || null, when: (values) => Boolean(values.type) },
      { name: "amount", kind: "amount", required: true, currency: currencyOfAccount("account_id") },
      { name: "frequency", kind: "choice", required: true, options: ["weekly", "monthly", "yearly"], optionKey: "frequency" },
      { name: "interval", kind: "integer", required: true, min: 1, max: 60, hint: "intervalHint" },
      { name: "start_date", kind: "date", required: true },
      { name: "end_date", kind: "date" },
      { name: "max_occurrences", kind: "integer", min: 1, max: 1000 },
      { name: "processing_mode", kind: "choice", required: true, options: ["manual", "automatic"], optionKey: "processingMode", hint: "modeHint" },
      descriptionField,
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: (ctx) => ({ name: "", type: "", account_id: "", category_id: "", amount: "", frequency: "monthly", interval: "1", start_date: ctx.today, end_date: "", max_occurrences: "", processing_mode: "manual", description: "", notes: "" }),
    check: (values) => (values.start_date && values.end_date && values.end_date < values.start_date ? { end_date: "endBeforeStart" } : {}),
  },

  debt: {
    id: "debt",
    group: "planning",
    operation: "debt.create",
    labels: { account_id: "debtAccount" },
    endpoint: "POST /debts",
    fullPath: () => PATH.USER.DEBTS,
    needs: { accounts: true },
    fields: [
      { name: "direction", kind: "choice", required: true, options: ["payable", "receivable"], optionKey: "debtDirection" },
      { name: "counterparty_name", kind: "text", required: true, max: 150 },
      { name: "currency_code", kind: "currency", required: true },
      { name: "original_amount", kind: "amount", required: true, currency: (values) => values.currency_code || null },
      { name: "issued_at", kind: "date" },
      { name: "due_date", kind: "date" },
      { name: "account_id", kind: "account", accounts: (account, values) => sameCurrencyAs(values.currency_code)(account), hint: "debtAccountHint" },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: (ctx) => ({ direction: "", counterparty_name: "", currency_code: "", original_amount: "", issued_at: ctx.today, due_date: "", account_id: "", notes: "" }),
    check: (values) => (values.issued_at && values.due_date && values.due_date < values.issued_at ? { due_date: "dueBeforeIssue" } : {}),
  },

  /* ----- Changes to one record ----- */

  "transaction-correct": {
    id: "transaction-correct",
    group: "money",
    operation: "transaction.correct",
    endpoint: "PATCH /transactions/{id}",
    record: "transaction",
    fullPath: (ctx) => getTransactionDetailsPath(ctx.record.id),
    eligible: (record) => (record.status !== "posted" || record.isReversal || record.isTransfer || !["income", "expense"].includes(record.type) ? "notCorrectable" : null),
    needs: { accounts: true, categories: true },
    editsRecord: true,
    fields: [
      { name: "account_id", kind: "account", required: true, accounts: (account, values, ctx) => sameCurrencyAs(ctx.record.currency)(account) },
      { name: "category_id", kind: "category", required: (values, ctx) => ctx.record.type === "expense", categoryType: (values, ctx) => ctx.record.type },
      { name: "amount", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency },
      { name: "occurred_at", kind: "date", required: true },
      descriptionField,
      referenceField,
      { ...reasonField, alwaysSent: true },
    ],
    initial: (ctx) => ({ account_id: ctx.record.accountId, category_id: ctx.record.categoryId, amount: ctx.record.amount, occurred_at: ctx.record.occurredAt, description: ctx.record.description, reference_number: ctx.record.referenceNumber, reason: "" }),
    effectKey: "correctEffect",
  },

  "transaction-reverse": {
    id: "transaction-reverse",
    group: "money",
    operation: "transaction.reverse",
    endpoint: "POST /transactions/{id}/reverse",
    record: "transaction",
    fullPath: (ctx) => getTransactionDetailsPath(ctx.record.id),
    eligible: (record) => (record.status !== "posted" || record.isReversal || record.isTransfer ? "notReversible" : null),
    needs: {},
    fields: [reasonField],
    initial: () => ({ reason: "" }),
    summary: (ctx) => ({ amount: ctx.record.amount, currency: ctx.record.currency, date: ctx.record.occurredAt }),
    effectKey: "reverseEffect",
  },

  "transfer-reverse": {
    id: "transfer-reverse",
    group: "money",
    operation: "transfer.reverse",
    endpoint: "POST /transfers/{id}/reverse",
    record: "transfer",
    fullPath: (ctx) => getTransferDetailsPath(ctx.record.id),
    eligible: (record) => (record.status !== "posted" ? "notReversible" : null),
    needs: {},
    fields: [reasonField],
    initial: () => ({ reason: "" }),
    summary: (ctx) => ({ amount: ctx.record.amount, currency: ctx.record.currency, date: ctx.record.occurredAt, from: ctx.record.fromName, to: ctx.record.toName }),
    effectKey: "transferReverseEffect",
  },

  "account-edit": {
    id: "account-edit",
    group: "accounts",
    operation: "account.update",
    labels: { type: "accountType" },
    endpoint: "PATCH /accounts/{id}",
    record: "account",
    fullPath: (ctx) => getAccountDetailsPath(ctx.record.id),
    eligible: (record) => (record.status === "archived" ? "archived" : record.isGoal ? "goalAccount" : null),
    needs: {},
    editsRecord: true,
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "type", kind: "choice", required: true, options: ACCOUNT_TYPES, optionKey: "accountType" },
      { name: "currency_code", kind: "locked", value: (ctx) => ctx.record.currency, hint: "currencyLocked" },
      { name: "opening_balance", kind: "amount", required: true, zero: true, currency: (values, ctx) => ctx.record.currency, hint: "openingLockedHint" },
      { name: "allow_negative_balance", kind: "check" },
    ],
    initial: (ctx) => ({ name: ctx.record.name, type: ACCOUNT_TYPES.includes(ctx.record.type) ? ctx.record.type : "", opening_balance: ctx.record.openingBalance, allow_negative_balance: ctx.record.allowNegative }),
  },

  "account-archive": {
    id: "account-archive",
    group: "accounts",
    operation: "account.archive",
    endpoint: "POST /accounts/{id}/archive",
    record: "account",
    fullPath: (ctx) => getAccountDetailsPath(ctx.record.id),
    eligible: (record) => (record.status === "archived" ? "archived" : record.isGoal ? "goalAccount" : null),
    needs: {},
    fields: [],
    initial: () => ({}),
    summary: (ctx) => ({ name: ctx.record.name }),
    effectKey: "archiveEffect",
  },

  "budget-edit": {
    id: "budget-edit",
    group: "planning",
    operation: "budget.update",
    endpoint: "PATCH /budgets/{id}",
    record: "budget",
    fullPath: (ctx) => getBudgetDetailsPath(ctx.record.id),
    eligible: (record) => (record.status === "archived" ? "archived" : null),
    needs: {},
    editsRecord: true,
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "scope", kind: "locked", value: (ctx) => ctx.record.categoryName ?? null, hint: "scopeLocked" },
      { name: "amount_limit", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency },
      { name: "period_start", kind: "date", required: true },
      { name: "period_end", kind: "date", required: true },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: (ctx) => ({ name: ctx.record.name, amount_limit: ctx.record.amountLimit, period_start: ctx.record.periodStart, period_end: ctx.record.periodEnd, notes: ctx.record.notes }),
    check: (values) => (values.period_start && values.period_end && values.period_end < values.period_start ? { period_end: "endBeforeStart" } : {}),
  },

  "goal-edit": {
    id: "goal-edit",
    group: "planning",
    operation: "goal.update",
    endpoint: "PATCH /savings-goals/{id}",
    record: "goal",
    fullPath: (ctx) => getSavingsGoalDetailsPath(ctx.record.id),
    eligible: (record) => (record.status === "archived" ? "archived" : null),
    needs: {},
    editsRecord: true,
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "currency_code", kind: "locked", value: (ctx) => ctx.record.currency, hint: "currencyLocked" },
      { name: "target_amount", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency },
      { name: "target_date", kind: "date" },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: (ctx) => ({ name: ctx.record.name, target_amount: ctx.record.targetAmount, target_date: ctx.record.targetDate, notes: ctx.record.notes }),
  },

  "goal-contribute": goalMovement("contribution"),
  "goal-withdraw": goalMovement("withdrawal"),

  "goal-plan": {
    id: "goal-plan",
    group: "planning",
    operation: "goal.plannedContribution",
    endpoint: "POST /savings-goals/{id}/planned-contributions",
    record: "goal",
    fullPath: (ctx) => getSavingsGoalDetailsPath(ctx.record.id),
    eligible: (record) => (record.status !== "active" ? "goalNotActive" : null),
    needs: { accounts: true },
    fields: [
      { name: "from_account_id", kind: "account", required: true, accounts: (account, values, ctx) => sameCurrencyAs(ctx.record.currency)(account) && account.id !== ctx.record.accountId },
      { name: "amount", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency },
      { name: "planned_date", kind: "date", required: true },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: () => ({ from_account_id: "", amount: "", planned_date: "", notes: "" }),
    check: (values, ctx) => (values.planned_date && values.planned_date < ctx.today ? { planned_date: "pastDate" } : {}),
    effectKey: "planEffect",
  },

  "recurring-edit": {
    id: "recurring-edit",
    group: "planning",
    operation: "recurring.update",
    endpoint: "PATCH /recurring-transactions/{id}",
    record: "rule",
    fullPath: (ctx) => getRecurringDetailsPath(ctx.record.id),
    eligible: (record) => (["archived", "completed"].includes(record.status) ? "ruleClosed" : null),
    needs: {},
    editsRecord: true,
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "amount", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency },
      { name: "interval", kind: "integer", required: true, min: 1, max: 60, hint: "intervalHint" },
      { name: "end_date", kind: "date" },
      { name: "max_occurrences", kind: "integer", min: 1, max: 1000 },
      { name: "processing_mode", kind: "choice", required: true, options: ["manual", "automatic"], optionKey: "processingMode", hint: "modeHint" },
      descriptionField,
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: (ctx) => ({ name: ctx.record.name, amount: ctx.record.amount, interval: ctx.record.interval, end_date: ctx.record.endDate, max_occurrences: ctx.record.maxOccurrences, processing_mode: ctx.record.processingMode, description: ctx.record.description, notes: ctx.record.notes }),
  },

  "recurring-confirm": {
    id: "recurring-confirm",
    group: "planning",
    operation: "recurring.confirmNext",
    endpoint: "POST /recurring-transactions/{id}/confirm-next",
    record: "rule",
    fullPath: (ctx) => getRecurringDetailsPath(ctx.record.id),
    eligible: (record) => (record.status !== "active" ? "ruleNotActive" : null),
    needs: {},
    fields: [],
    initial: () => ({}),
    summary: (ctx) => ({ name: ctx.record.name, amount: ctx.record.amount, currency: ctx.record.currency, date: ctx.record.nextDue, account: ctx.record.accountName }),
    effectKey: "confirmEffect",
  },

  "recurring-skip": {
    id: "recurring-skip",
    group: "planning",
    operation: "recurring.skipNext",
    endpoint: "POST /recurring-transactions/{id}/skip-next",
    record: "rule",
    fullPath: (ctx) => getRecurringDetailsPath(ctx.record.id),
    eligible: (record) => (record.status !== "active" ? "ruleNotActive" : null),
    needs: {},
    fields: [{ name: "reason", kind: "textarea", max: 500 }],
    initial: () => ({ reason: "" }),
    summary: (ctx) => ({ name: ctx.record.name, date: ctx.record.nextDue }),
    effectKey: "skipEffect",
  },

  "debt-edit": {
    id: "debt-edit",
    group: "planning",
    operation: "debt.update",
    endpoint: "PATCH /debts/{id}",
    record: "debt",
    fullPath: (ctx) => getDebtDetailsPath(ctx.record.id),
    eligible: (record) => (["archived", "paid"].includes(record.status) ? "debtClosed" : null),
    needs: {},
    editsRecord: true,
    fields: [
      { name: "direction", kind: "locked", value: (ctx) => ctx.record.direction, optionKey: "debtDirection", hint: "directionLocked" },
      { name: "counterparty_name", kind: "text", required: true, max: 150 },
      { name: "original_amount", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency, hint: "originalLockedHint", locked: (ctx) => ctx.record.paymentsCount !== 0 },
      { name: "issued_at", kind: "date" },
      { name: "due_date", kind: "date" },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: (ctx) => ({ counterparty_name: ctx.record.counterparty, original_amount: ctx.record.originalAmount, issued_at: ctx.record.issuedAt, due_date: ctx.record.dueDate, notes: ctx.record.notes }),
    check: (values) => (values.issued_at && values.due_date && values.due_date < values.issued_at ? { due_date: "dueBeforeIssue" } : {}),
  },

  "debt-payment": {
    id: "debt-payment",
    group: "planning",
    operation: "debt.payment",
    labels: { account_id: "paymentAccount" },
    endpoint: "POST /debts/{id}/payments",
    record: "debt",
    fullPath: (ctx) => getDebtDetailsPath(ctx.record.id),
    eligible: (record) => (["archived", "paid"].includes(record.status) ? "debtClosed" : null),
    needs: { accounts: true },
    fields: [
      { name: "account_id", kind: "account", required: true, accounts: (account, values, ctx) => sameCurrencyAs(ctx.record.currency)(account) },
      { name: "amount", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency, fill: (ctx) => (ctx.record.remaining ? digits(ctx.record.remaining) : null) },
      { name: "paid_at", kind: "date", max: "today" },
      { name: "notes", kind: "textarea", max: 1000 },
    ],
    initial: (ctx) => ({ account_id: "", amount: "", paid_at: ctx.today, notes: "" }),
    check: (values, ctx) => {
      if (ctx.record.remaining && !amountError(values.amount) && compareAmounts(values.amount, ctx.record.remaining) > 0) return { amount: "aboveRemaining" };
      if (values.paid_at && values.paid_at > ctx.today) return { paid_at: "futureDate" };
      return {};
    },
    effectKey: (ctx) => (ctx.record.direction === "receivable" ? "collectionEffect" : "paymentEffect"),
  },

  "debt-payment-reverse": {
    id: "debt-payment-reverse",
    group: "planning",
    operation: "debt.paymentReverse",
    endpoint: "POST /debt-payments/{id}/reverse",
    record: "payment",
    fullPath: (ctx) => getDebtDetailsPath(ctx.debtId),
    eligible: (record) => (record.reversed ? "alreadyReversed" : null),
    needs: {},
    fields: [reasonField],
    initial: () => ({ reason: "" }),
    summary: (ctx) => ({ amount: ctx.record.amount, currency: ctx.record.currency, date: ctx.record.paidAt, account: ctx.record.accountName }),
    effectKey: "paymentReverseEffect",
  },

  /* ----- Reviews of what SmartSpend read for you, and your own details ----- */

  "receipt-review": captureReview("receipt"),
  "voice-review": captureReview("voice"),

  "whatsapp-draft": {
    id: "whatsapp-draft",
    group: "assist",
    operation: "whatsapp.confirm",
    endpoint: "POST /integrations/whatsapp/expense-drafts/{id}/confirm",
    record: "whatsappDraft",
    fullPath: (ctx) => getWhatsAppDraftPath(ctx.record.id),
    eligible: (record) => (record.status === "expired" ? "draftExpired" : ["confirmed", "discarded"].includes(record.status) ? "draftClosed" : null),
    needs: { accounts: true, categories: true },
    fields: [
      { name: "account_id", kind: "account", required: true, accounts: spendable },
      { name: "category_id", kind: "category", required: true, categoryType: () => "expense" },
      { name: "amount", kind: "amount", required: true, currency: (values, ctx) => accountOf(ctx, values.account_id)?.currency ?? ctx.record.currency },
      { name: "transaction_date", kind: "date", required: true },
      { name: "description", kind: "text", max: 500 },
    ],
    initial: (ctx) => ({ account_id: ctx.record.review.account_id, category_id: ctx.record.review.category_id, amount: ctx.record.review.amount ? digits(ctx.record.review.amount) : "", transaction_date: ctx.record.review.transaction_date, description: ctx.record.review.description }),
    effectKey: "draftEffect",
  },

  "profile-edit": {
    id: "profile-edit",
    group: "settings",
    operation: "profile.update",
    endpoint: "PUT /profile",
    record: "user",
    fullPath: () => getSettingsTabPath("profile"),
    needs: {},
    editsRecord: true,
    fields: [
      { name: "name", kind: "text", required: true, max: 255 },
      { name: "email", kind: "email", required: true, max: 255, hint: "emailHint" },
      { name: "phone", kind: "text", max: 30 },
    ],
    initial: (ctx) => ({ name: ctx.record.name, email: ctx.record.email, phone: ctx.record.phone }),
  },

  "password-change": {
    id: "password-change",
    group: "settings",
    operation: "profile.password",
    endpoint: "PATCH /profile/password",
    record: "user",
    fullPath: () => getSettingsTabPath("security"),
    needs: {},
    fields: [
      { name: "current_password", kind: "password", required: true, autoComplete: "current-password" },
      { name: "password", kind: "password", required: true, autoComplete: "new-password", hint: "passwordHint" },
      { name: "password_confirmation", kind: "password", required: true, autoComplete: "new-password" },
    ],
    initial: () => ({ current_password: "", password: "", password_confirmation: "" }),
    // The full version's rules (Settings/ChangePassword): 8 characters, a letter and a digit, not the current one.
    check: (values) => {
      const next = values.password ?? "";
      if (!next) return {};
      if ([...next].length < PASSWORD_MIN) return { password: "passwordShort" };
      if (!/\p{L}/u.test(next) || !/\p{N}/u.test(next)) return { password: "passwordMix" };
      if (values.current_password && next === values.current_password) return { password: "passwordSame" };
      if (values.password_confirmation && values.password_confirmation !== next) return { password_confirmation: "passwordMismatch" };
      return {};
    },
  },

  export: {
    id: "export",
    group: "reports",
    operation: "export.create",
    endpoint: "POST /report-exports",
    fullPath: () => PATH.USER.REPORT_EXPORTS,
    needs: {},
    fields: [
      { name: "report", kind: "choice", required: true, options: EXPORT_REPORTS, optionKey: "reportType" },
      { name: "format", kind: "choice", required: true, options: EXPORT_FORMATS, optionKey: "exportFormat", hint: "formatHint" },
      { name: "from", kind: "date", required: true },
      { name: "to", kind: "date", required: true },
      { name: "currency", kind: "currency" },
    ],
    initial: (ctx) => ({ report: "", format: "csv", from: `${ctx.today.slice(0, 8)}01`, to: ctx.today, currency: "" }),
    check: (values) => (values.from && values.to && values.to < values.from ? { to: "endBeforeStart" } : {}),
    effectKey: "exportEffect",
  },
});

function captureReview(source) {
  return {
    id: `${source}-review`,
    group: "assist",
    operation: `${source}.confirm`,
    endpoint: source === "voice" ? "POST /ai/voice-expense-captures/{id}/confirm" : "POST /ai/expense-captures/{id}/confirm",
    record: `${source}Capture`,
    fullPath: (ctx) => (source === "voice" ? PATH.USER.FINANCIAL_OPERATIONS : getAiExpenseCapturePath(ctx.record.id)),
    eligible: (record) => (["uploaded", "queued", "processing"].includes(record.status) ? "captureProcessing" : record.status === "failed" ? "captureFailed" : ["confirmed", "discarded"].includes(record.status) ? "captureClosed" : null),
    needs: { accounts: true, categories: true },
    fields: [
      { name: "account_id", kind: "account", required: true, accounts: spendable },
      { name: "category_id", kind: "category", required: true, categoryType: () => "expense" },
      { name: "merchant_name", kind: "text", max: 191 },
      { name: "amount", kind: "amount", required: true, currency: (values, ctx) => accountOf(ctx, values.account_id)?.currency ?? ctx.record.review.currency_code },
      { name: "transaction_date", kind: "date", required: true },
      { name: "description", kind: "text", max: 500 },
      { name: "reference_number", kind: "text", max: 120 },
    ],
    initial: (ctx) => ({ ...Object.fromEntries(["account_id", "category_id", "merchant_name", "transaction_date", "description", "reference_number"].map((name) => [name, ctx.record.review[name] ?? ""])), amount: ctx.record.review.amount ? digits(ctx.record.review.amount) : "" }),
    // What SmartSpend read is in one currency; an account in another one would change its meaning.
    check: (values, ctx) => {
      const chosen = accountOf(ctx, values.account_id);
      return ctx.record.review.currency_code && chosen && chosen.currency !== ctx.record.review.currency_code ? { account_id: "captureCurrency" } : {};
    },
    effectKey: "captureEffect",
  };
}

function hasFee(values) {
  const fee = normalizeAmount(values.fee_amount);
  return Boolean(fee) && /[1-9]/.test(fee);
}

function goalMovement(type) {
  const accountField = type === "contribution" ? "from_account_id" : "to_account_id";
  return {
    id: type === "contribution" ? "goal-contribute" : "goal-withdraw",
    group: "planning",
    operation: `goal.${type}`,
    endpoint: `POST /savings-goals/{id}/${type}s`,
    record: "goal",
    fullPath: (ctx) => getSavingsGoalDetailsPath(ctx.record.id),
    eligible: (record) => (record.status === "archived" ? "archived" : type === "contribution" && record.status !== "active" ? "goalNotActive" : null),
    needs: { accounts: true },
    fields: [
      { name: accountField, kind: "account", required: true, accounts: (account, values, ctx) => sameCurrencyAs(ctx.record.currency)(account) && account.id !== ctx.record.accountId },
      { name: "amount", kind: "amount", required: true, currency: (values, ctx) => ctx.record.currency },
      { name: "occurred_at", kind: "date", required: true },
      { name: "description", kind: "text", max: 255 },
    ],
    initial: (ctx) => ({ [accountField]: "", amount: "", occurred_at: ctx.today, description: "" }),
    check: (values, ctx) => (type === "withdrawal" && ctx.record.savedAmount && !amountError(values.amount) && compareAmounts(values.amount, ctx.record.savedAmount) > 0 ? { amount: "aboveSaved" } : {}),
    effectKey: type === "contribution" ? "contributeEffect" : "withdrawEffect",
  };
}

/* ---------- What a filled-in form means ---------- */

const resolve = (value, values, ctx) => (typeof value === "function" ? value(values, ctx) : value);

/** The fields shown for these values (hidden ones are neither checked nor reviewed). */
export const visibleFields = (workflow, values, ctx) => workflow.fields.filter((field) => !field.when || field.when(values, ctx));

export const isLocked = (field, ctx) => field.kind === "locked" || (typeof field.locked === "function" && field.locked(ctx));

/** Field name -> error code, for every visible field that is not right. */
export function validateWorkflow(workflow, values, ctx) {
  const errors = {};
  for (const field of visibleFields(workflow, values, ctx)) {
    if (isLocked(field, ctx)) continue;
    const required = Boolean(resolve(field.required, values, ctx));
    const value = values[field.name];
    let error = null;

    if (field.kind === "amount") error = amountError(value, { required, zero: field.zero });
    else if (field.kind === "text" || field.kind === "textarea") error = textError(value, { required, min: field.min ?? 0, max: field.max ?? 255 });
    else if (field.kind === "email") error = textError(value, { required, max: field.max ?? 255 }) ?? (value?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? "email" : null);
    else if (field.kind === "password") error = value ? null : required ? "required" : null;
    else if (field.kind === "date") error = dateError(value, { required });
    else if (field.kind === "integer") error = integerError(value, { required, min: field.min, max: field.max });
    else if (field.kind === "choice") error = value ? (field.options.includes(value) ? null : "choice") : required ? "required" : null;
    else if (field.kind === "currency") error = value ? (FORM_CURRENCIES.includes(value) ? null : "choice") : required ? "required" : null;
    else if (field.kind === "account") {
      const account = value ? accountOf(ctx, value) : null;
      error = value ? (account && (!field.accounts || field.accounts(account, values, ctx)) ? null : "choice") : required ? "required" : null;
    } else if (field.kind === "category") {
      const type = resolve(field.categoryType, values, ctx);
      const category = value ? ctx.categories?.find((item) => item.id === String(value)) : null;
      error = value ? (category && (!type || category.type === type) ? null : "choice") : required ? "required" : null;
    }

    if (error) errors[field.name] = error;
  }

  const cross = workflow.check ? workflow.check(values, ctx) : {};
  for (const [name, code] of Object.entries(cross)) if (!errors[name]) errors[name] = code;

  if (workflow.editsRecord && Object.keys(errors).length === 0 && changedFields(workflow, values, ctx).length === 0) errors._form = "noChange";
  return errors;
}

const comparable = (field, value) => {
  if (field.kind === "check") return value === true;
  if (field.kind === "amount") return normalizeAmount(value).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return typeof value === "string" ? value.trim() : value ?? "";
};

/** For a change to a record: the editable fields whose value differs from the record's (the reason is not a change). */
export function changedFields(workflow, values, ctx) {
  if (!workflow.editsRecord) return [];
  const before = workflow.initial(ctx);
  return visibleFields(workflow, values, ctx).filter((field) => !isLocked(field, ctx) && !field.alwaysSent && Object.hasOwn(before, field.name) && comparable(field, values[field.name]) !== comparable(field, before[field.name]));
}

/** Whether anything was typed or changed: what the leave guard protects. */
export function isDirty(workflow, values, ctx) {
  const before = workflow.initial(ctx);
  return Object.keys(values).some((name) => {
    const field = workflow.fields.find((item) => item.name === name) ?? { kind: "text" };
    return comparable(field, values[name]) !== comparable(field, before[name]);
  });
}

export const currencyFor = (field, values, ctx) => resolve(field.currency, values, ctx) ?? null;

export const accountChoices = (field, values, ctx) => (ctx.accounts ?? []).filter((account) => (field.accounts ? field.accounts(account, values, ctx) : spendable(account)));

export const categoryChoices = (field, values, ctx) => {
  const type = resolve(field.categoryType, values, ctx);
  return (ctx.categories ?? []).filter((category) => category.active !== false && (!type || category.type === type));
};

export const isRequired = (field, values, ctx) => Boolean(resolve(field.required, values, ctx));

export const effectKeyOf = (workflow, ctx) => (typeof workflow.effectKey === "function" ? workflow.effectKey(ctx) : workflow.effectKey ?? null);

/** The new-entry forms, in the order the Add sheet lists them. */
export const NEW_ENTRY_ORDER = Object.freeze(["expense", "income", "transfer", "account", "budget", "goal", "recurring", "debt"]);

/** Every form at /m/add/{id}: the Add sheet's, and the export form (opened from Exports). */
export const NEW_FORM_IDS = Object.freeze([...NEW_ENTRY_ORDER, "export"]);

/** Every write these forms stand for. None is sent; none is in the write gate (tests/mobileForms.test.mjs). */
export const DRAFT_ONLY_OPERATIONS = Object.freeze(Object.values(WORKFLOWS).map((workflow) => workflow.operation));
