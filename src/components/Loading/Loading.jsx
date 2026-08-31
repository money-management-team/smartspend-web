import "./Loading.css";

/**
 * Reusable loading indicator.
 *
 * @param {object} props
 * @param {string} [props.message] Text displayed below the indicator.
 * @param {"small"|"medium"|"large"} [props.size] Indicator size.
 * @param {"inline"|"section"|"page"} [props.variant] Container layout.
 * @param {string} [props.className] Additional class name for the container.
 */
export default function Loading({
  message = "جارٍ التحميل...",
  size = "medium",
  variant = "section",
  className = "",
}) {
  const classes = [
    "loading",
    `loading--${variant}`,
    `loading--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loading__indicator" aria-hidden="true">
        <span className="loading__orbit loading__orbit--outer" />
        <span className="loading__orbit loading__orbit--inner" />
        <span className="loading__core" />
      </span>

      {message && <span className="loading__message">{message}</span>}
    </div>
  );
}
