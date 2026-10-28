import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_CATEGORIES, categoryDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";

/*
 * What happened to a category write, once it has ended in one of two ways that
 * leave the form behind:
 *
 *   confirmed  the server's answer proves it: its own category (name and type) is
 *              shown, not what was typed;
 *   unknown    it could not be confirmed. The page says so, does NOT call it a
 *              failure, offers only reads to check (the list and, for a rename, the
 *              category), and has no way to send it again: a second create would
 *              be a second category.
 *
 * Focus moves to the heading, so the result is the first thing announced.
 */
export default function CategoryOutcome({ kind, mode, category, categoryId }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const headingRef = useRef(null);
  const key = `categories.outcome.${kind}.${mode}`;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (kind === "confirmed") {
    return (
      <section className="sm-card sm-cat-outcome" role="status" data-sm-outcome="confirmed" aria-labelledby="sm-cat-outcome">
        <h2 id="sm-cat-outcome" className="sm-card-title" ref={headingRef} tabIndex={-1}>{t(`${key}.title`)}</h2>
        <p className="sm-text">
          {t(`${key}.body`)} <bdi className="sm-user-text sm-strong">{category.name}</bdi>
        </p>
        <p className="sm-text sm-muted sm-fine">{t("categories.outcome.confirmed.note")}</p>
        <Link className="sm-button" to={categoryDetailPath(category.id)}>{t("categories.outcome.view")}</Link>
        <Link className="sm-link-row" to={MOBILE_CATEGORIES}>
          <span>{t("categories.outcome.backToList")}</span>
          <Chevron />
        </Link>
      </section>
    );
  }

  return (
    <section className="sm-card sm-cat-outcome" role="alert" data-sm-outcome="unknown" aria-labelledby="sm-cat-outcome">
      <h2 id="sm-cat-outcome" className="sm-card-title" ref={headingRef} tabIndex={-1}>{t(`${key}.title`)}</h2>
      <p className="sm-text">{t(`${key}.body`)}</p>
      <p className="sm-text">{t(`${key}.advice`)}</p>
      <p className="sm-text sm-muted sm-fine">{t("categories.outcome.unknown.noResend")}</p>
      {mode === "edit" && categoryId && (
        <Link className="sm-button" to={categoryDetailPath(categoryId)}>{t("categories.outcome.checkOne")}</Link>
      )}
      {mode === "edit" ? (
        <Link className="sm-link-row" to={MOBILE_CATEGORIES}>
          <span>{t("categories.outcome.checkList")}</span>
          <Chevron />
        </Link>
      ) : (
        <Link className="sm-button" to={MOBILE_CATEGORIES}>{t("categories.outcome.checkList")}</Link>
      )}
    </section>
  );
}
