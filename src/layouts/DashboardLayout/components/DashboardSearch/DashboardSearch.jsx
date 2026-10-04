import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LuArrowUpRight, LuSearch, LuX } from "react-icons/lu";

import { buildSearchEntries } from "./buildSearchEntries";
import { searchEntries } from "./searchMatch";

import "./DashboardSearch.css";

/*
 * Header search over the dashboard's pages (not data). Typing filters the
 * menu pages in either language; Enter / click navigates through the router.
 * Below 480px the field is collapsed behind a search button.
 */
export default function DashboardSearch() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef(null);
  const toggleRef = useRef(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCompactOpen, setIsCompactOpen] = useState(false);

  const entries = useMemo(
    () => buildSearchEntries(i18n, t),
    // `t` changes with the language, which is what the labels depend on.
    [i18n, t],
  );

  const hasQuery = query.trim().length > 0;
  const results = useMemo(
    () => (hasQuery ? searchEntries(entries, query) : []),
    [entries, hasQuery, query],
  );
  const showPopup = isOpen && hasQuery;
  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));
  const optionId = (index) => `${listId}-option-${index}`;

  const close = ({ restoreFocus = false } = {}) => {
    setIsOpen(false);
    setIsCompactOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  const reset = () => {
    setQuery("");
    setActiveIndex(0);
  };

  const go = (entry) => {
    if (!entry) return;
    navigate(entry.path);
    reset();
    close();
    inputRef.current?.blur();
  };

  const handleChange = (event) => {
    setQuery(event.target.value);
    setActiveIndex(0);
    setIsOpen(true);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hasQuery) return;
      event.preventDefault();
      setIsOpen(true);
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((safeIndex + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      if (showPopup && results.length > 0) {
        event.preventDefault();
        go(results[safeIndex]);
      }
    } else if (event.key === "Escape") {
      if (showPopup || isCompactOpen) {
        event.preventDefault();
        event.stopPropagation();
        close({ restoreFocus: isCompactOpen });
      } else if (hasQuery) {
        reset();
      }
    }
  };

  const handleBlur = (event) => {
    // Keep the popup while focus moves inside the search (e.g. the clear button).
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsOpen(false);
    setIsCompactOpen(false);
  };

  const openCompact = () => {
    setIsCompactOpen(true);
    // The field is shown by the class change; focus after it renders.
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div
      className={`dashboard-search${isCompactOpen ? " dashboard-search--open" : ""}`}
      role="search"
      onBlur={handleBlur}
    >
      <button
        type="button"
        ref={toggleRef}
        className="dashboard-search__toggle"
        onClick={openCompact}
        aria-label={t("dashboard.search.open")}
      >
        <LuSearch aria-hidden="true" />
      </button>

      <div className="dashboard-search__field">
        <LuSearch aria-hidden="true" />

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("dashboard.header.searchPlaceholder")}
          aria-label={t("dashboard.search.label")}
          role="combobox"
          aria-expanded={showPopup}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showPopup && results.length > 0 ? optionId(safeIndex) : undefined
          }
          autoComplete="off"
          enterKeyHint="go"
          spellCheck={false}
        />

        {hasQuery && (
          <button
            type="button"
            className="dashboard-search__clear"
            onClick={() => {
              reset();
              inputRef.current?.focus();
            }}
            aria-label={t("dashboard.search.clear")}
          >
            <LuX aria-hidden="true" />
          </button>
        )}
      </div>

      {showPopup && (
        <div className="dashboard-search__popup">
          {results.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={t("dashboard.search.results")}
            >
              {results.map((entry, index) => {
                const Icon = entry.icon ?? LuArrowUpRight;

                return (
                  <li
                    key={entry.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === safeIndex}
                    className={`dashboard-search__option${
                      index === safeIndex ? " is-active" : ""
                    }`}
                    // mousedown, so the click lands before the input blurs.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(entry)}
                    onMouseMove={() => setActiveIndex(index)}
                  >
                    <span className="dashboard-search__icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="dashboard-search__text">
                      <strong>{entry.label}</strong>
                      {entry.group && <small>{entry.group}</small>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p id={listId} className="dashboard-search__empty" role="status">
              {t("dashboard.search.empty", { query: query.trim() })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
