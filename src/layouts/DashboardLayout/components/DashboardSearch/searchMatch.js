/*
 * Matching for the dashboard search. Pure functions only (no React, no
 * routing), so the ranking is easy to test and a data search can reuse them.
 *
 * Text is normalised before comparing: case-folded, Arabic diacritics and
 * tatweel removed, alef/yeh/teh-marbuta variants unified, so "اضافة" finds
 * "إضافة" and "Budgets" finds "budgets".
 */

const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const tokenize = (value) => normalizeSearchText(value).split(" ").filter(Boolean);

/*
 * An entry is { id, labels: string[], keywords: string[] }: `labels` are the
 * page's names (every language), `keywords` are extra words that should find
 * it. Returns a score (higher is better) or 0 when the entry doesn't match.
 * Every typed word must match somewhere in the entry.
 */
export function scoreEntry(entry, query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;

  const labels = entry.labels.map(normalizeSearchText);
  const keywordWords = entry.keywords.flatMap(tokenize);
  const labelWords = labels.flatMap((label) => label.split(" "));

  let total = 0;

  for (const token of tokens) {
    let best = 0;

    if (labels.some((label) => label === token)) best = 100;
    else if (labels.some((label) => label.startsWith(token))) best = 80;
    else if (labelWords.some((word) => word.startsWith(token))) best = 70;
    else if (labels.some((label) => label.includes(token))) best = 50;
    else if (keywordWords.some((word) => word.startsWith(token))) best = 40;
    else if (keywordWords.some((word) => word.includes(token))) best = 20;

    if (best === 0) return 0;
    total += best;
  }

  return total / tokens.length;
}

// Matching entries, best first; ties keep their original (menu) order.
export function searchEntries(entries, query, limit = 8) {
  return entries
    .map((entry, index) => ({ entry, index, score: scoreEntry(entry, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((result) => result.entry);
}
