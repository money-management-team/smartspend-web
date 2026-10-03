import "./RecurringSection.css";

export default function RecurringSection({ title, subtitle, children }) {
  return (
    <section className="recurring-section">
      <header className="recurring-section__header">
        <h2>{title}</h2>

        {subtitle && <p>{subtitle}</p>}
      </header>

      <div className="recurring-section__list">{children}</div>
    </section>
  );
}
