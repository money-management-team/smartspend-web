import { useId } from "react";
import { Link } from "react-router-dom";

import Chevron from "./Chevron.jsx";

/*
 * A row that opens a page: an icon, a title and a one-line hint, and a chevron. Shared by More and by Profile and
 * settings, so every list of destinations in the app has the same row.
 */
export function GroupLink({ to, title, hint, icon: Icon, ...rest }) {
  return (
    <Link className="sm-link-row sm-more-link" to={to} {...rest}>
      {Icon && <span className="sm-tile-icon sm-row-icon" aria-hidden="true"><Icon /></span>}
      <span className="sm-row-main">
        <span className="sm-row-title">{title}</span>
        {hint && <span className="sm-row-meta">{hint}</span>}
      </span>
      <Chevron />
    </Link>
  );
}

/*
 * A group: its label sits above one card, so several cards each with an inner title become labels over lists. Its
 * children are rows (GroupLink) or `.sm-setting` blocks, separated by hairlines. An optional icon sits before the
 * label, decoration only (the label's text is the group's name).
 */
export default function LabelledGroup({ title, icon: Icon, children, ...rest }) {
  const id = useId();
  return (
    <section className="sm-more-group" aria-labelledby={id} {...rest}>
      <h2 id={id} className="sm-group-label">{Icon && <span className="sm-group-icon" aria-hidden="true"><Icon /></span>}{title}</h2>
      <div className="sm-card sm-group-card">{children}</div>
    </section>
  );
}
