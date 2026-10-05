import { LuCalendarRange } from "react-icons/lu";

import "./ReportsHeader.css";

/*
 * Page header for the selected report: the "Reports" eyebrow, the report's
 * name and description, the period being viewed and the page actions. It
 * replaces a separate title band plus a second "spotlight" card, so the
 * report name and period appear once.
 */
export default function ReportsHeader({ icon: Icon = null, title, description, period = null, actions = null }) {
  return (
    <header className="reports-header">
      <div className="reports-header__main">
        {Icon && (
          <span className="reports-header__icon" aria-hidden="true">
            <Icon />
          </span>
        )}

        <div className="reports-header__copy">
          <h1>{title}</h1>
          {description && <p className="reports-header__description">{description}</p>}
          {period && (
            <p className="reports-header__period">
              <LuCalendarRange aria-hidden="true" />
              <bdi>{period}</bdi>
            </p>
          )}
        </div>
      </div>

      {actions && <div className="reports-header__actions">{actions}</div>}
    </header>
  );
}
