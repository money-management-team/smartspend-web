import { idText, isRecord, textOrNull } from "./values.js";

/*
 * One page of `GET /transactions?account_id=` as the movements of that
 * account. The same reading the full app's account history uses: a movement's
 * amount and direction come only from the ledger lines of THIS account (signed
 * amounts the backend wrote), as exact integers in units of 0.0001, never as
 * floating-point numbers. Nothing is added across movements or accounts, and no
 * balance is derived from them.
 *
 * A page that does not hold together (paginator numbers that disagree, a line
 * in another currency, a movement with no line for this account, a repeated
 * id) is refused whole, so Mobile shows an error and not a half-right list.
 */

const SCALE = 10000n;

const invalid = () => {
  const error = new Error("Account movement data could not be validated.");
  error.code = "MALFORMED_RESPONSE";
  return error;
};

function units(value) {
  if (typeof value !== "string") throw invalid();

  const match = value.match(/^(-?)(\d{1,40})(?:\.(\d{1,4}))?$/);
  if (!match) throw invalid();

  const total = BigInt(match[2]) * SCALE + BigInt((match[3] ?? "").padEnd(4, "0"));
  return match[1] ? -total : total;
}

function decimal(total) {
  const absolute = total < 0n ? -total : total;
  return `${total < 0n ? "-" : ""}${absolute / SCALE}.${String(absolute % SCALE).padStart(4, "0")}`;
}

function movement(transaction, account) {
  if (
    !isRecord(transaction) ||
    !idText(transaction.id) ||
    idText(transaction.workspace_id) !== account.workspaceId ||
    typeof transaction.type !== "string" ||
    typeof transaction.status !== "string" ||
    !Array.isArray(transaction.ledger_entries) ||
    !transaction.ledger_entries.every(isRecord)
  ) {
    throw invalid();
  }

  const own = transaction.ledger_entries.filter((entry) => idText(entry.account_id) === account.id);
  if (own.length === 0) throw invalid();

  let incoming = 0n;
  let outgoing = 0n;
  const seen = new Set();

  for (const entry of own) {
    if (
      !idText(entry.id) ||
      seen.has(idText(entry.id)) ||
      idText(entry.workspace_id) !== account.workspaceId ||
      idText(entry.transaction_id) !== idText(transaction.id) ||
      entry.currency_code !== account.currency
    ) {
      throw invalid();
    }

    seen.add(idText(entry.id));

    const amount = units(entry.signed_amount);
    if (amount > 0n) incoming += amount;
    if (amount < 0n) outgoing -= amount;
  }

  const net = incoming - outgoing;
  const counterpart = transaction.ledger_entries
    .map((entry) => entry.account)
    .find((other) => isRecord(other) && idText(other.id) && idText(other.id) !== account.id);

  return {
    id: idText(transaction.id),
    type: transaction.type,
    reversed: transaction.status === "reversed",
    isReversal: transaction.type === "reversal" || transaction.reversal_of_id != null,
    title: textOrNull(transaction.description) ?? textOrNull(transaction.category?.name),
    occurredAt: typeof transaction.occurred_at === "string" ? transaction.occurred_at : null,
    amount: decimal(net),
    direction: net > 0n ? "in" : net < 0n ? "out" : "neutral",
    counterpart: textOrNull(counterpart?.name, 80),
  };
}

/**
 * @param {object} response the API envelope
 * @param {{ id: string, workspaceId: string, currency: string }} account the account the page was requested for
 * @param {{ page: number, perPage: number }} expected
 */
export function buildMovementPage(response, account, expected) {
  const page = response?.data?.transactions;
  const integer = (value, min) => Number.isSafeInteger(value) && value >= min;

  if (
    response?.status !== true ||
    !isRecord(page) ||
    !Array.isArray(page.data) ||
    !integer(page.total, 0) ||
    !integer(page.current_page, 1) ||
    !integer(page.last_page, 1) ||
    !integer(page.per_page, 1) ||
    page.per_page > 100 ||
    page.data.length > page.per_page ||
    page.current_page !== expected.page ||
    page.per_page !== expected.perPage ||
    page.last_page !== Math.max(1, Math.ceil(page.total / page.per_page))
  ) {
    throw invalid();
  }

  const rows = page.data.map((transaction) => movement(transaction, account));
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw invalid();

  const from = rows.length ? (page.current_page - 1) * page.per_page + 1 : null;
  const to = rows.length ? from + rows.length - 1 : null;
  if ((to != null && to > page.total) || (page.from ?? null) !== from || (page.to ?? null) !== to) throw invalid();

  return { rows, total: page.total, page: page.current_page, lastPage: page.last_page };
}
