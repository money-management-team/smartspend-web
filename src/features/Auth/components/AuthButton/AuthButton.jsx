import { Link } from "react-router-dom";

import "./AuthButton.css";

/*
 * Primary auth call-to-action.
 * Renders a router <Link> when `to` is given, otherwise a <button>
 * (type "submit" by default). While `loading`, it is disabled, shows a
 * spinner, and swaps its text for `loadingLabel` when provided.
 */
export default function AuthButton({
  to,
  loading = false,
  loadingLabel,
  disabled,
  type = "submit",
  className = "",
  children,
  ...rest
}) {
  const classes = `auth-button ${className}`.trim();

  const content = (
    <>
      {loading && <span className="auth-button__spinner" aria-hidden="true" />}

      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </>
  );

  if (to) {
    return (
      <Link className={classes} to={to} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
}
