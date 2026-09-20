import { useId } from "react";

import "./ImportPanel.css";

// Card shell of one wizard step: title, hint, content.
export default function ImportPanel({ title, hint, children }) {
  const titleId = useId();

  return (
    <section className="import-panel" aria-labelledby={titleId}>
      <header className="import-panel__header">
        <h2 id={titleId}>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      <div className="import-panel__body">{children}</div>
    </section>
  );
}
