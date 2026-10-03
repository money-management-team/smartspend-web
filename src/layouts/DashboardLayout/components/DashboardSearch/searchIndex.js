import { getNavigation } from "../../navigation";

/*
 * Page search index. It is built from the sidebar's navigation model, so a
 * page added to the menu is searchable with no second list to keep in sync.
 * Every entry also carries its Arabic and English names, so "budgets" finds
 * the page from the Arabic UI and the reverse.
 *
 * To search data later, add another source that returns entries of the same
 * shape ({ id, path, label, context, haystack, labelText }) and concatenate
 * it with the page entries before calling `searchEntries`.
 */

const LANGUAGES = ["ar", "en"];
const MAX_RESULTS = 8;

/* Case, Arabic diacritics / tatweel and the common letter variants are folded
   so "اعدادات" matches "الإعدادات". */
export function normalizeSearchText(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenNavigation(sections) {
  const pages = [];

  sections.forEach((section) => {
    section.entries.forEach((entry) => {
      if (entry.type === "group") {
        entry.children.forEach((child) =>
          pages.push({
            path: child.path,
            label: child.label,
            context: entry.label,
          }),
        );
      } else {
        pages.push({ path: entry.path, label: entry.label, context: "" });
      }
    });
  });

  return pages;
}

/* `i18n.getFixedT(language)` translates in a fixed language without
   switching the app's. */
export function buildPageIndex(i18n) {
  const current = flattenNavigation(getNavigation(i18n.getFixedT(null), null));
  const names = LANGUAGES.map((language) =>
    flattenNavigation(getNavigation(i18n.getFixedT(language), null)),
  );

  return current.map((page, index) => ({
    id: page.path,
    path: page.path,
    label: page.label,
    context: page.context,
    haystack: normalizeSearchText(
      [
        page.label,
        page.context,
        ...names.flatMap((pages) => [pages[index].label, pages[index].context]),
      ].join(" "),
    ),
    labelText: normalizeSearchText(page.label),
  }));
}

/* Every word of the query must appear. A label that starts with the query
   ranks first, then one with a word that does. An empty query returns
   nothing. */
export function searchEntries(entries, query) {
  const text = normalizeSearchText(query);
  if (!text) return [];

  const words = text.split(" ");

  return entries
    .filter((entry) => words.every((word) => entry.haystack.includes(word)))
    .map((entry) => {
      let rank = 2;
      if (entry.labelText.startsWith(text)) rank = 0;
      else if (entry.labelText.split(" ").some((w) => w.startsWith(words[0])))
        rank = 1;
      return { entry, rank };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_RESULTS)
    .map(({ entry }) => entry);
}
