import "./Shared.css";

export default function SectionCard({
  className = "",
  title,
  subtitle,
  action,
  children,
}) {
  return (
    <section className={`dashboard-section-card ${className}`.trim()}>
      {(title || subtitle || action) && (
        <header className="dashboard-section-card__header">
          <div className="dashboard-section-card__heading">
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>

          {action && (
            <div className="dashboard-section-card__action">{action}</div>
          )}
        </header>
      )}

      {children}
    </section>
  );
}
