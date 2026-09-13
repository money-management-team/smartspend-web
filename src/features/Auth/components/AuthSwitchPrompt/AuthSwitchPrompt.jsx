import { Link } from "react-router-dom";

import "./AuthSwitchPrompt.css";

/* "Don't have an account? Create account" style footer line. */
export default function AuthSwitchPrompt({ prefix, linkLabel, to }) {
  return (
    <p className="auth-switch-prompt">
      {prefix} <Link to={to}>{linkLabel}</Link>
    </p>
  );
}
