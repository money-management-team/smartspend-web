import { useId } from "react";

import "./ReportSection.css";

// Card shell shared by every report block: a heading, an optional hint and
// optional actions, then the content.
export default function ReportSection({ title, hint, actions, wide = false, children }) {
  const titleId = useId();

  return (
    <section className={`report-section ${wide ? "report-section--wide" : ""}`} aria-labelledby={titleId}>
      <header className="report-section__header">
        <div className="report-section__copy">
          <h2 id={titleId}>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
