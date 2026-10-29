import { amountError, isCalendarDay, normalizeAmount } from "../forms/validation.js";

/*
 * Reading a statement file on this device, before anything is uploaded. Pure.
 *
 * The backend reads the file itself after upload and its validation is the one
 * that counts; this is a preview so the person can check the file and the
 * column mapping first. Only CSV can be read here (Excel needs the backend).
 * Nothing in this module sends or stores the file.
 */

// The mapping fields the full version offers (Imports/Imports.jsx FIELDS).
export const IMPORT_FIELDS = Object.freeze(["date", "description", "amount", "debit", "credit", "type", "currency", "category", "reference"]);
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
// A UTF-8 byte-order mark at the start of the file (spreadsheet programs add one).
const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`);

export function importFileKind(file) {
  const name = String(file?.name ?? "").toLowerCase();
  if (!file || file.size < 1) return "empty";
  if (file.size > IMPORT_MAX_BYTES) return "size";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx")) return "xlsx";
  return "type";
}

/** The delimiter that splits the first line into the most columns: comma, semicolon or tab. */
const delimiterOf = (line) => [",", ";", "\t"].map((char) => [char, line.split(char).length]).sort((a, b) => b[1] - a[1])[0][0];

/** CSV as rows of cells: quoted cells, doubled quotes, line breaks inside quotes, a leading byte-order mark. */
export function parseCsv(text) {
  const source = String(text ?? "").replace(BOM, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = delimiterOf(firstLine);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      if (rows.length > MAX_ROWS) break;
    } else cell += char;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  const [headers = [], ...body] = rows;
  return { headers: headers.map((header, index) => header.trim() || `#${index + 1}`), rows: body.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS, delimiter };
}

const HEADER_WORDS = {
  date: ["date", "تاريخ", "التاريخ"],
  description: ["description", "details", "memo", "الوصف", "البيان"],
  amount: ["amount", "المبلغ", "مبلغ"],
  debit: ["debit", "مدين", "سحب"],
  credit: ["credit", "دائن", "إيداع"],
  type: ["type", "النوع"],
  currency: ["currency", "العملة"],
  category: ["category", "التصنيف"],
  reference: ["reference", "ref", "المرجع"],
};

/** A first guess at the mapping from header names; the person can change every column. */
export function suggestMapping(headers) {
  const mapping = {};
  headers.forEach((header, index) => {
    const name = header.trim().toLowerCase();
    const field = IMPORT_FIELDS.find((key) => !(key in mapping) && HEADER_WORDS[key].includes(name));
    if (field) mapping[field] = String(index);
  });
  return mapping;
}

const readDay = (value) => {
  const text = String(value ?? "").trim();
  if (isCalendarDay(text.slice(0, 10))) return text.slice(0, 10);
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (!match) return null;
  const day = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return isCalendarDay(day) ? day : null;
};

const readAmount = (value) => {
  const text = normalizeAmount(String(value ?? "")).replace(/^-/, "");
  // 12.50 and 12.5 are the same amount (compared as text, never as a float).
  return text && !amountError(text) ? text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : null;
};

/*
 * Each row as this preview reads it, with what looks wrong: no date, no amount,
 * or the same date, amount and description as an earlier row of this file (a
 * possible duplicate). The backend's own checks, including duplicates of what
 * is already recorded, happen after upload and decide.
 */
export function previewRows(parsed, mapping) {
  const col = (row, field) => (mapping[field] === undefined || mapping[field] === "" ? undefined : row[parseInt(mapping[field], 10)]);
  const seen = new Set();

  return parsed.rows.map((row, index) => {
    const date = readDay(col(row, "date"));
    const amount = readAmount(col(row, "amount")) ?? readAmount(col(row, "debit")) ?? readAmount(col(row, "credit"));
    const description = String(col(row, "description") ?? "").trim().slice(0, 255);
    const problems = [];
    if (!date) problems.push("date");
    if (!amount) problems.push("amount");
    const signature = `${date}|${amount}|${description.toLowerCase()}`;
    if (date && amount && seen.has(signature)) problems.push("duplicate");
    seen.add(signature);
    return { line: index + 2, date, amount, description, problems };
  });
}
