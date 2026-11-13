import { Link } from "react-router-dom";

/*
 * Newer / "Page x of y" / Older under a paged read-only card. Both ends are replace-links: Back leaves the page in one
 * step, and nothing here is a control that changes anything. `hrefFor(page)` gives the address of a page.
 */
export default function PageLinks({ label, name, current, lastPage, hrefFor, state, newer, older, pageText }) {
  if (lastPage <= 1) return null;

  return (
    <nav className="sm-paged-nav" aria-label={label}>
      {current > 1 ? <Link className="sm-card-link" to={hrefFor(current - 1)} replace state={state} data-sm-page-link={`${name}:${current - 1}`}>{newer}</Link> : <span />}
      <span className="sm-text sm-muted sm-fine">{pageText}</span>
      {current < lastPage ? <Link className="sm-card-link" to={hrefFor(current + 1)} replace state={state} data-sm-page-link={`${name}:${current + 1}`}>{older}</Link> : <span />}
    </nav>
  );
}
