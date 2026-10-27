import { isRecord } from "./values.js";

/*
 * What the Planning models (budgets, goals, recurring rules) share: reading a
 * Laravel paginator without trusting it, and reading a percentage the backend
 * calculated.
 *
 * Nothing here calculates. A budget's spent and remaining, a goal's saved and
 * remaining, a percentage, a day count: each is the backend's own value or it
 * is unavailable. Mobile never derives "how much is left", "is it achieved" or
 * "when is it due" from other fields, because those answers have rules (what
 * counts as spent, which transfers count towards a goal, which date a rule
 * falls on) that live on the backend.
 */

const invalid = () => Object.assign(new Error("Planning data could not be validated."), { code: "MALFORMED_RESPONSE" });

/**
 * One page of a list endpoint, refused whole when it does not hold together:
 * paginator numbers that disagree with each other or with the request, a row
 * that is not an object with an id, an id twice on the page.
 *
 * @param {object} response the whole envelope (`status`, `data`, ...)
 * @param {{ page: number, perPage: number }} expected
 * @param {string} key where the paginator sits under `data` (`budgets`, `savings_goals`, ...)
 * @param {(raw: unknown) => object | null} normalize reads one row, or null when it is unusable
 */
export function buildPlanningPage(response, expected, key, normalize) {
  const page = response?.data?.[key];
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

  const rows = page.data.map(normalize);
  if (rows.some((row) => row === null)) throw invalid();
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw invalid();

  const from = rows.length ? (page.current_page - 1) * page.per_page + 1 : null;
  const to = rows.length ? from + rows.length - 1 : null;
  if ((to != null && to > page.total) || (page.from ?? null) !== from || (page.to ?? null) !== to) throw invalid();

  return { rows, total: page.total, page: page.current_page, lastPage: page.last_page };
}

/** Pages in order as one list; a row that shows up on two pages (the list shifted while paging) appears once, in its first place. */
export function mergePlanningPages(pages) {
  const seen = new Set();
  const items = [];

  for (const page of pages) {
    for (const row of page.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(row);
    }
  }

  return items;
}

const PERCENT = /^(-?)(\d{1,6})(?:\.(\d{1,4}))?$/;

/**
 * A percentage the backend sent as a decimal string ("40.0000"), as the text to
 * show and the width of its bar, or null when it is anything else.
 *
 * Both are made from the digits of the string, so nothing is converted to a
 * number and nothing is rounded: the text keeps one decimal at most and drops
 * the rest (99.96 reads "99.9", never "100"), and the bar is clamped to the
 * track (a negative value is an empty bar, a hundred or more is a full one).
 */
export function parsePercent(value) {
  if (typeof value !== "string") return null;

  const match = PERCENT.exec(value);
  if (!match) return null;

  const integer = match[2].replace(/^0+(?=\d)/, "");
  const fraction = match[3] ?? "";
  const zero = integer === "0" && /^0*$/.test(fraction);
  const negative = match[1] === "-" && !zero;
  const tenth = fraction.slice(0, 1);

  return {
    text: `${negative ? "−" : ""}${integer}${tenth && tenth !== "0" ? `.${tenth}` : ""}`,
    bar: negative ? "0%" : integer.length >= 3 ? "100%" : `${integer}${fraction ? `.${fraction.slice(0, 2)}` : ""}%`,
    // 100 and over (three integer digits): the bar is full and the text carries the number.
    full: !negative && integer.length >= 3,
  };
}

/** A backend state word: the word when it is one of the known ones, and always the word as sent so an unknown one can be shown as itself. */
export function readState(value, known) {
  const word = typeof value === "string" && value ? value.slice(0, 40) : null;
  return { word, known: word !== null && known.includes(word) };
}
