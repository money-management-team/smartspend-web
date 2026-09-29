import "./AuthHeading.css";

/*
 * Page title block for the form panel.
 * `icon` renders a decorative badge above the title;
 * `tone="success"` switches the badge to the success style.
 */
export default function AuthHeading({ title, subtitle, icon, tone = "primary" }) {
  return (
    <header className={`auth-heading auth-heading--${tone}`}>
      {icon && (
        <span className="auth-heading__icon" aria-hidden="true">
          {icon}
        </span>
      )}

      <h1 className="auth-heading__title">{title}</h1>

      {subtitle && <p className="auth-heading__subtitle">{subtitle}</p>}
    </header>
  );
}
