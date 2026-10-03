import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { LuSearch, LuX } from "react-icons/lu";

import { buildPageIndex, searchEntries } from "./searchIndex";

import "./DashboardSearch.css";

/*
 * Header search over the dashboard's pages (combobox + listbox). Arrow keys
 * move the highlight, Enter opens it, Escape closes the list and then clears
 * the field. Below 480px the field is collapsed behind an icon button and
 * opens as a bar over the header.
 */
export default function DashboardSearch() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const toggleRef = useRef(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [compactOpen, setCompactOpen] = useState(false);

  // Page names follow the language, so the index is rebuilt when it changes.
  const language = i18n.resolvedLanguage || i18n.language;
  const entries = useMemo(
    () => buildPageIndex(i18n),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n, language],
  );
  const results = useMemo(() => searchEntries(entries, query), [entries, query]);
  const hasQuery = query.trim().length > 0;
  const showList = open && hasQuery;
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  // Moving to another page ends the search (state adjusted during render).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setQuery("");
    setOpen(false);
    setActive(0);
    setCompactOpen(false);
  }

  useEffect(() => {
    if (!showList && !compactOpen) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setCompactOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showList, compactOpen]);

  useEffect(() => {
    if (compactOpen) inputRef.current?.focus();
  }, [compactOpen]);

  const closeCompact = () => {
    setCompactOpen(false);
    toggleRef.current?.focus();
  };

  const choose = (entry) => {
    if (!entry) return;
    setQuery("");
    setOpen(false);
    setActive(0);
    setCompactOpen(false);
    navigate(entry.path);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hasQuery || results.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (showList && results.length > 0) choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      if (showList) {
        event.preventDefault();
        setOpen(false);
      } else if (hasQuery) {
        event.preventDefault();
        setQuery("");
      } else if (compactOpen) {
        event.preventDefault();
        closeCompact();
      }
    }
  };

  const activeId =
    showList && results.length > 0 ? `${baseId}-${activeIndex}` : undefined;

  return (
    <div
      className={`dashboard-search${compactOpen ? " dashboard-search--compact-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        ref={toggleRef}
        className="dashboard-search__toggle"
        onClick={() => setCompactOpen(true)}
        aria-label={t("dashboard.header.search.open")}
        title={t("dashboard.header.search.open")}
      >
        <LuSearch aria-hidden="true" />
      </button>

      <div className="dashboard-search__field" role="search">
        <LuSearch aria-hidden="true" />

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={query}
          placeholder={t("dashboard.header.searchPlaceholder")}
          aria-label={t("dashboard.header.search.label")}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeId}
          autoComplete="off"
          enterKeyHint="go"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />

        {compactOpen && (
          <button
            type="button"
            className="dashboard-search__close"
            onClick={closeCompact}
            aria-label={t("dashboard.header.search.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        )}

        {showList && (
          <div className="dashboard-search__panel">
            <ul
              id={listId}
              role="listbox"
              aria-label={t("dashboard.header.search.results")}
            >
              {results.map((entry, index) => (
                <li
                  key={entry.id}
                  id={`${baseId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`dashboard-search__option${
                    index === activeIndex
                      ? " dashboard-search__option--active"
                      : ""
                  }`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(entry)}
                  onPointerMove={() => setActive(index)}
                >
                  <span className="dashboard-search__label">{entry.label}</span>
                  {entry.context && (
                    <span className="dashboard-search__context">
                      {entry.context}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {results.length === 0 && (
              <p className="dashboard-search__empty" role="status">
                {t("dashboard.header.search.noResults", {
                  query: query.trim(),
                })}
              </p>
            )}
          </div>
        )}

        <span className="dashboard-search__sr" role="status" aria-live="polite">
          {showList && results.length > 0
            ? t("dashboard.header.search.count", { total: results.length })
            : ""}
        </span>
      </div>
    </div>
  );
}
