// Read-only account history uses the existing /transactions paginator.
// Amounts and directions come exclusively from this account's ledger lines.
export const MOVEMENT_TYPES = [
  "income",
  "expense",
  "transfer",
  "fee",
  "refund",
  "adjustment",
  "reversal",
  "debt_received",
  "debt_given",
  "debt_payment",
  "debt_collection",
];
export const DEFAULT_MOVEMENT_FILTERS = Object.freeze({
  type: "",
  status: "",
  date_from: "",
  date_to: "",
  sort: "occurred_at:desc",
  per_page: 20,
});
const SORTS = ["occurred_at:desc", "occurred_at:asc", "created_at:desc"];
const SCALE = 10000n;

function invalid(code = "MALFORMED_RESPONSE") {
  const error = new Error("Account movement data could not be validated.");
  error.code = code;
  return error;
}

function idKey(value) {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 1))
    return null;
  const text = String(value ?? "");
  return /^[1-9]\d{0,18}$/.test(text) ? text : null;
}

export function movementUnits(value) {
  if (typeof value !== "string") throw invalid();
  const match = value.match(/^(-?)(\d{1,40})(?:\.(\d{1,4}))?$/);
  if (!match) throw invalid();
  const units =
    BigInt(match[2]) * SCALE + BigInt((match[3] ?? "").padEnd(4, "0"));
  return match[1] ? -units : units;
}

export function movementDecimal(units) {
  const absolute = units < 0n ? -units : units;
  return `${units < 0n ? "-" : ""}${absolute / SCALE}.${String(absolute % SCALE).padStart(4, "0")}`;
}

// Intl formats only the integer BigInt; the exact fraction replaces its zeros.
// No financial value passes through Number(), including values above 2^53.
export function formatMovementMoney(value, currency, locale, showPlus = false) {
  const units = movementUnits(value);
  const absolute = units < 0n ? -units : units;
  const integer = absolute / SCALE;
  const fraction = String(absolute % SCALE)
    .padStart(4, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  const digits = new Intl.NumberFormat(locale, { useGrouping: false });
  const localizedFraction = [...fraction]
    .map((digit) => digits.format(BigInt(digit)))
    .join("");
  // Negative zero preserves the minus sign for amounts between -1 and 0.
  const signedInteger = units < 0n ? (integer === 0n ? -0 : -integer) : integer;
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).formatToParts(signedInteger);
  const formatted = parts
    .map((part) => (part.type === "fraction" ? localizedFraction : part.value))
    .join("");
  return showPlus && units > 0n ? `+${formatted}` : formatted;
}

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function buildAccountMovementQuery(
  accountId,
  filters = DEFAULT_MOVEMENT_FILTERS,
  page = 1,
) {
  if (!idKey(accountId) || !Number.isSafeInteger(page) || page < 1)
    throw invalid("ACCOUNT_HISTORY_FILTER_INVALID");
  if (!MOVEMENT_TYPES.includes(filters.type) && filters.type !== "")
    throw invalid("ACCOUNT_HISTORY_FILTER_INVALID");
  if (
    !["", "posted", "reversed"].includes(filters.status) ||
    !SORTS.includes(filters.sort) ||
    ![20, 50, 100].includes(filters.per_page)
  )
    throw invalid("ACCOUNT_HISTORY_FILTER_INVALID");
  if (
    (filters.date_from && !calendarDate(filters.date_from)) ||
    (filters.date_to && !calendarDate(filters.date_to)) ||
    (filters.date_from &&
      filters.date_to &&
      filters.date_from > filters.date_to)
  ) {
    throw invalid("ACCOUNT_HISTORY_DATE_INVALID");
  }
  const [sort_by, sort_dir] = filters.sort.split(":");
  return {
    account_id: idKey(accountId),
    page,
    per_page: filters.per_page,
    sort_by,
    sort_dir,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
  };
}

export function hasMovementFilters(filters) {
  return Boolean(
    filters.type || filters.status || filters.date_from || filters.date_to,
  );
}

export function parseAccountMovement(transaction, account) {
  if (
    !idKey(transaction?.id) ||
    !idKey(account?.id) ||
    !idKey(account?.workspace_id) ||
    idKey(transaction.workspace_id) !== idKey(account.workspace_id) ||
    typeof transaction.type !== "string" ||
    typeof transaction.status !== "string" ||
    !/^[A-Z]{3}$/.test(account.currency_code ?? "") ||
    !Array.isArray(transaction.ledger_entries) ||
    transaction.ledger_entries.some(
      (entry) => !entry || typeof entry !== "object",
    )
  )
    throw invalid();
  const entries = transaction.ledger_entries.filter(
    (entry) => idKey(entry.account_id) === idKey(account.id),
  );
  if (!entries.length) throw invalid();
  let incoming = 0n,
    outgoing = 0n;
  const seen = new Set();
  for (const entry of entries) {
    if (
      !idKey(entry.id) ||
      seen.has(idKey(entry.id)) ||
      idKey(entry.workspace_id) !== idKey(account.workspace_id) ||
      idKey(entry.transaction_id) !== idKey(transaction.id) ||
      entry.currency_code !== account.currency_code ||
      typeof entry.entry_role !== "string"
    )
      throw invalid();
    seen.add(idKey(entry.id));
    const amount = movementUnits(entry.signed_amount);
    if (amount > 0n) incoming += amount;
    if (amount < 0n) outgoing -= amount;
  }
  const net = incoming - outgoing;
  const counterparts = new Map();
  for (const entry of transaction.ledger_entries) {
    const other = entry.account;
    if (
      other &&
      idKey(other.id) &&
      idKey(other.id) === idKey(entry.account_id) &&
      idKey(other.id) !== idKey(account.id) &&
      idKey(entry.workspace_id) === idKey(account.workspace_id)
    ) {
      counterparts.set(idKey(other.id), other);
    }
  }
  return {
    transaction,
    entries,
    counterparts: [...counterparts.values()],
    incoming,
    outgoing,
    net,
    amount: movementDecimal(net),
    direction: net > 0n ? "in" : net < 0n ? "out" : "neutral",
    isReversal:
      transaction.type === "reversal" || transaction.reversal_of_id != null,
  };
}

export function parseAccountMovementPage(response, account, query) {
  const page = response?.data?.transactions;
  const integer = (value, min) => Number.isSafeInteger(value) && value >= min;
  if (
    response?.status !== true ||
    !page ||
    !Array.isArray(page.data) ||
    !integer(page.total, 0) ||
    !integer(page.current_page, 1) ||
    !integer(page.last_page, 1) ||
    !integer(page.per_page, 1) ||
    page.per_page > 100 ||
    page.data.length > page.per_page ||
    page.current_page !== query.page ||
    page.per_page !== query.per_page ||
    page.last_page !== Math.max(1, Math.ceil(page.total / page.per_page))
  )
    throw invalid();
  const rows = page.data.map((transaction) =>
    parseAccountMovement(transaction, account),
  );
  const ids = rows.map((row) => idKey(row.transaction.id));
  if (new Set(ids).size !== ids.length) throw invalid();
  const from = rows.length ? (page.current_page - 1) * page.per_page + 1 : null;
  const to = rows.length ? from + rows.length - 1 : null;
  if (
    (to != null && to > page.total) ||
    (page.from ?? null) !== from ||
    (page.to ?? null) !== to
  )
    throw invalid();
  const incoming = rows.reduce((sum, row) => sum + row.incoming, 0n);
  const outgoing = rows.reduce((sum, row) => sum + row.outgoing, 0n);
  return {
    rows,
    total: page.total,
    page: page.current_page,
    lastPage: page.last_page,
    from,
    to,
    incoming: movementDecimal(incoming),
    outgoing: movementDecimal(outgoing),
    net: movementDecimal(incoming - outgoing),
  };
}

export function movementTypeLabel(row) {
  if (row.isReversal) return "reversal";
  if (row.transaction.type === "transfer")
    return row.direction === "in"
      ? "transfer_in"
      : row.direction === "out"
        ? "transfer_out"
        : "transfer";
  return row.transaction.type;
}

// Related links use validated identifiers; descriptions/metadata stay text.
export function movementRelatedIds(transaction) {
  return {
    transfer: idKey(transaction.transfer_id),
    original: idKey(transaction.reversal_of_id),
    debt: idKey(transaction.metadata?.debt_id),
  };
}
