import ReportBadge from "../ReportBadge/ReportBadge";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportDistribution.css";

/*
 * Counts per status or direction (`status_distribution`,
 * `direction_distribution`, `budget_status_distribution`). The counts are the
 * backend's; the bar length only compares them within the same group.
 */
export default function ReportDistribution({ groups }) {
  return (
    <div className="report-distribution">
      {groups.map((group) => {
        const max = Math.max(1, ...group.entries.map((entry) => entry.count));

        return (
          <div className="report-distribution__group" key={group.currency || "all"}>
            {group.currency && (
              <h3>
                <bdi dir="ltr">{group.currency}</bdi>
              </h3>
            )}

            <ul>
              {group.entries.map((entry) => (
                <li key={entry.key} className="report-distribution__row">
                  <ReportBadge value={entry.key} />
                  <span className="report-distribution__track" aria-hidden="true">
                    <span style={{ inlineSize: `${(entry.count / max) * 100}%` }} />
                  </span>
                  <strong>
                    <ReportValue value={entry.count} type="count" />
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
