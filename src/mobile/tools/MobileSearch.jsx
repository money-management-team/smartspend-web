import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { newEntryPath } from "../forms/actionRoutes.js";
import { NEW_ENTRY_ORDER } from "../forms/workflows.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_ACCOUNTS, MOBILE_ACTIVITY, MOBILE_AI, MOBILE_BUDGETS, MOBILE_CALENDAR, MOBILE_CAPTURES, MOBILE_CATEGORIES, MOBILE_DEBTS, MOBILE_EXPORTS, MOBILE_GOALS, MOBILE_IMPORTS, MOBILE_MORE, MOBILE_NOTIFICATIONS, MOBILE_PLANNING, MOBILE_PREFIX, MOBILE_PROFILE, MOBILE_RECURRING, MOBILE_REPORTS, MOBILE_REVIEW, MOBILE_TEMPLATES, MOBILE_TRANSFERS, MOBILE_WHATSAPP } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";

// Every Mobile page that can be opened directly, with the title key it is known by.
const PAGES = [
  [MOBILE_PREFIX, "titles.home"], [MOBILE_ACTIVITY, "titles.activity"], [MOBILE_PLANNING, "titles.planning"], [MOBILE_MORE, "titles.more"],
  [MOBILE_ACCOUNTS, "titles.accounts"], [MOBILE_TRANSFERS, "titles.transfers"], [MOBILE_BUDGETS, "titles.budgets"], [MOBILE_GOALS, "titles.goals"],
  [MOBILE_RECURRING, "titles.recurring"], [MOBILE_CATEGORIES, "titles.categories"], [MOBILE_DEBTS, "titles.debts"], [MOBILE_CALENDAR, "titles.calendar"],
  [MOBILE_REPORTS, "titles.reports"], [MOBILE_EXPORTS, "titles.exports"], [MOBILE_IMPORTS, "titles.imports"], [MOBILE_NOTIFICATIONS, "titles.notifications"],
  [MOBILE_AI, "titles.assistant"], [MOBILE_CAPTURES, "titles.captures"], [MOBILE_WHATSAPP, "titles.whatsapp"], [MOBILE_PROFILE, "titles.profile"],
  [MOBILE_REVIEW, "titles.review"], [MOBILE_TEMPLATES, "titles.templates"],
];

/* Lower case, no Arabic diacritics, one spelling of alef, yaa and taa marbuta, so a search matches however the word was typed. */
const foldText = (value) =>
  String(value ?? "")
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{Mn}|ـ/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();

/*
 * Search finds Mobile pages and forms, not records: the API has no documented
 * search over transactions or other data, so none is pretended. Each entry is
 * matched in both languages whatever the interface language (every word typed
 * must match), as the full version's page search does. Activity's filters are
 * the way to look for transactions.
 */
export default function MobileSearch() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [query, setQuery] = useState("");
  const index = useMemo(() => {
    const en = i18n.getFixedT("en", MOBILE_NAMESPACE);
    const ar = i18n.getFixedT("ar", MOBILE_NAMESPACE);
    const pages = PAGES.map(([to, key]) => ({ to, key, kind: "page", words: foldText(`${en(key)} ${ar(key)}`) }));
    const forms = NEW_ENTRY_ORDER.map((id) => ({ to: newEntryPath(id), key: `forms.flows.${id}.title`, kind: "form", words: foldText(`${en(`forms.flows.${id}.title`)} ${ar(`forms.flows.${id}.title`)} ${en(`forms.flows.${id}.link`)} ${ar(`forms.flows.${id}.link`)}`) }));
    return [...pages, ...forms];
  }, [i18n]);
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  const results = terms.length ? index.filter((entry) => terms.every((term) => entry.words.includes(term))) : [];

  return (
    <section className="sm-page" data-sm-screen="search">
      <div className="sm-card">
        <label className="sm-label" htmlFor={`${ids}-q`}>{t("search.label")}</label>
        <input id={`${ids}-q`} className="sm-input" type="search" dir="auto" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} aria-describedby={`${ids}-hint`} />
        <p id={`${ids}-hint`} className="sm-text sm-muted sm-fine">{t("search.hint")}</p>
      </div>
      <p className="sm-sr" role="status" aria-live="polite">{terms.length ? t("search.count", { count: results.length }) : ""}</p>
      {terms.length > 0 && (
        results.length === 0 ? (
          <div className="sm-card" data-sm-empty="search">
            <p className="sm-text">{t("search.none", { query: query.trim() })}</p>
            <Link className="sm-link-row" to={MOBILE_ACTIVITY}><span>{t("search.activity")}</span><Chevron /></Link>
          </div>
        ) : (
          <ul className="sm-card sm-list" aria-label={t("search.results")}>
            {results.map((entry) => (
              <li key={entry.to}>
                <Link className="sm-link-row" to={entry.to} data-sm-result={entry.to}>
                  <span className="sm-row-main">
                    <span className="sm-row-title">{t(entry.key)}</span>
                    <span className="sm-row-meta">{t(`search.kind.${entry.kind}`)}</span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
