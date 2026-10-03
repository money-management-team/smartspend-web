import { Link } from "react-router-dom";

import { ArrowIcon } from "../AuthIcons";

import "./AuthBackLink.css";

/* Secondary "go back" action shown under the form. */
export default function AuthBackLink({ to, children }) {
  return (
    <Link className="auth-back-link" to={to}>
      <ArrowIcon />
      <span>{children}</span>
    </Link>
  );
}
