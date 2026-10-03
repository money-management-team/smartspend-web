import {
  buildAccountMovementQuery,
  parseAccountMovementPage,
  movementDecimal,
} from "./accountMovementHelpers.js";
import { dataError, isCalendarDate } from "../Experience/experienceData.js";

export const MAX_STATEMENT_ROWS = 5000;
const checkAbort = (signal) => {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
};
const fingerprint = (row) =>
  JSON.stringify([
    row.transaction.id,
    row.transaction.type,
    row.transaction.status,
    row.transaction.occurred_at,
    row.transaction.description,
    row.transaction.reference_number,
    row.transaction.category?.name,
    row.entries.map((entry) => [
      entry.id,
      entry.signed_amount,
      entry.currency_code,
      entry.entry_role,
      entry.sequence,
    ]),
  ]);

/** Every page is required. A verification pass rejects changes, duplicates and partial results. */
export async function fetchAccountStatement(
  account,
  dates,
  { list, signal, onProgress = () => {} } = {},
) {
  if (
    !isCalendarDate(dates.from) ||
    !isCalendarDate(dates.to) ||
    dates.to < dates.from
  )
    throw dataError("STATEMENT_DATES_INVALID");
  const query = buildAccountMovementQuery(account.id, {
    type: "",
    status: "",
    date_from: dates.from,
    date_to: dates.to,
    per_page: 100,
    sort: "occurred_at:asc",
  });
  const rows = [],
    seen = new Set();
  let expectedTotal = null,
    lastPage = 1;
  for (let pass = 0; pass < 2; pass++) {
    let count = 0;
    for (let page = 1; page <= lastPage; page++) {
      checkAbort(signal);
      const parsed = parseAccountMovementPage(
        await list({ ...query, page }, { signal }),
        account,
        { ...query, page },
      );
      checkAbort(signal);
      if (expectedTotal === null) {
        expectedTotal = parsed.total;
        lastPage = parsed.lastPage;
      }
      if (expectedTotal > MAX_STATEMENT_ROWS)
        throw dataError("STATEMENT_LIMIT");
      if (parsed.total !== expectedTotal || parsed.lastPage !== lastPage)
        throw dataError("STATEMENT_CHANGED");
      const required = Math.min(
        100,
        Math.max(0, expectedTotal - (page - 1) * 100),
      );
      if (parsed.rows.length !== required) throw dataError("STATEMENT_CHANGED");
      for (const row of parsed.rows) {
        const id = String(row.transaction.id);
        if (pass === 0) {
          if (seen.has(id)) throw dataError("STATEMENT_CHANGED");
          seen.add(id);
          rows.push(row);
        } else if (fingerprint(rows[count]) !== fingerprint(row))
          throw dataError("STATEMENT_CHANGED");
        count++;
      }
      onProgress({
        done: pass * expectedTotal + count,
        total: expectedTotal * 2,
      });
    }
    if (count !== expectedTotal) throw dataError("STATEMENT_CHANGED");
  }
  const incoming = rows.reduce((sum, row) => sum + row.incoming, 0n),
    outgoing = rows.reduce((sum, row) => sum + row.outgoing, 0n);
  return {
    account: { ...account },
    dates: { ...dates },
    rows,
    totals: {
      incoming: movementDecimal(incoming),
      outgoing: movementDecimal(outgoing),
      net: movementDecimal(incoming - outgoing),
    },
  };
}

const csvCell = (value, numeric = false) => {
  let text = String(value ?? "");
  // External labels/descriptions may be interpreted as formulas by spreadsheet programs.
  if (
    !numeric &&
    (text.startsWith("\t") ||
      text.startsWith("\r") ||
      text.startsWith("\n") ||
      /^[=+\-@]/.test(text.trimStart()))
  )
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function statementCsv(
  statement,
  labels,
  typeLabel = (row) => row.transaction.type,
) {
  const keys = [
    "id",
    "date",
    "type",
    "description",
    "category",
    "status",
    "incoming",
    "outgoing",
    "net",
    "currency",
  ];
  const lines = [keys.map((key) => csvCell(labels[key])).join(",")];
  for (const row of statement.rows) {
    const tx = row.transaction;
    const cells = [
      tx.id,
      tx.occurred_at,
      typeLabel(row),
      tx.description,
      tx.category?.name,
      tx.status,
      movementDecimal(row.incoming),
      movementDecimal(row.outgoing),
      row.amount,
      statement.account.currency_code,
    ];
    lines.push(
      cells
        .map((value, index) => csvCell(value, [0, 6, 7, 8].includes(index)))
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
