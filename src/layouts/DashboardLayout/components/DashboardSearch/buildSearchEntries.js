import { PATH } from "../../../../routes/Path";
import { getNavigation } from "../../dashboardNavigation";

/*
 * The searchable pages, taken from the sidebar's own navigation model so the
 * search can only ever offer pages that exist in the user's menu (a page added
 * to or hidden from the menu is added to or hidden from the search with it).
 * Each page is indexed under its name in every supported language plus the
 * extra words in `dashboard.search.keywords.<id>`, so Arabic and English both
 * work whichever language the interface is in.
 *
 * To search data later (accounts, transactions, ...), add a second source that
 * returns entries of the same shape and merge it in DashboardSearch.
 */

const KEYWORD_IDS = {
  [PATH.USER.DASHBOARD]: "dashboard",
  [PATH.USER.ACCOUNTS]: "accounts",
  [PATH.USER.ATTENTION]: "attention",
  [PATH.USER.FINANCIAL_OPERATIONS]: "financialOperations",
  [PATH.USER.QUICK_TEMPLATES]: "templates",
  [PATH.USER.TRANSFERS]: "transfers",
  [PATH.USER.RECURRING]: "recurring",
  [PATH.USER.AI_EXPENSE_CAPTURES]: "aiCaptures",
  [PATH.USER.IMPORTS]: "imports",
  [PATH.USER.CALENDAR]: "calendar",
  [PATH.USER.CATEGORIES]: "categories",
  [PATH.USER.BUDGETS]: "budgets",
  [PATH.USER.SAVINGS_GOALS]: "savingsGoals",
  [PATH.USER.DEBTS]: "debts",
  [PATH.USER.REPORTS]: "reports",
  [PATH.USER.REPORT_EXPORTS]: "exports",
  [PATH.USER.MONTHLY_REVIEW]: "monthly",
  [PATH.USER.GETTING_STARTED]: "guide",
  [PATH.USER.AI_ASSISTANT]: "aiAssistant",
  [PATH.USER.NOTIFICATIONS]: "notifications",
  [PATH.USER.SETTING]: "settings",
};

const SEARCH_LANGUAGES = ["en", "ar"];

function flattenLinks(navigation) {
  return navigation.flatMap((section) =>
    section.entries.flatMap((entry) =>
      entry.type === "group"
        ? entry.children.map((child) => ({
            ...child,
            icon: entry.icon,
            group: entry.label,
          }))
        : [entry],
    ),
  );
}

export function buildSearchEntries(i18n, t) {
  const translators = SEARCH_LANGUAGES.map((language) =>
    i18n.getFixedT(language),
  );
  const perLanguage = translators.map((fixedT) =>
    flattenLinks(getNavigation(fixedT, null)),
  );

  return flattenLinks(getNavigation(t, null)).map((link, index) => {
    const keywordId = KEYWORD_IDS[link.path];

    return {
      id: link.path,
      path: link.path,
      label: link.label,
      group: link.group ?? null,
      icon: link.icon ?? null,
      labels: [
        link.label,
        ...perLanguage.map((links) => links[index].label),
        ...perLanguage.map((links) => links[index].group ?? ""),
      ].filter(Boolean),
      keywords: keywordId
        ? translators.map((fixedT) =>
            fixedT(`dashboard.search.keywords.${keywordId}`, {
              defaultValue: "",
            }),
          )
        : [],
    };
  });
}
