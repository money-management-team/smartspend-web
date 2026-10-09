import { useTranslation } from "react-i18next";
import {
  LuBan, LuCircleCheck, LuClock3, LuHourglass, LuInbox, LuTriangleAlert,
} from "react-icons/lu";

import { isKnownIssueCode, readinessOf } from "../../draftHelpers.js";

const x = "dashboard.whatsappDrafts";
const STATUS_ICONS = {
  collecting: LuHourglass,
  ready_for_review: LuInbox,
  confirmed: LuCircleCheck,
  discarded: LuBan,
  expired: LuClock3,
};

/* Text plus icon: the state never relies on colour alone. */
export function DraftStatusBadge({ status }) {
  const { t } = useTranslation();
  const Icon = STATUS_ICONS[status] ?? LuInbox;

  return (
    <span className={`wad-status wad-status--${status}`}>
      <Icon aria-hidden="true" />
      {t(`${x}.statuses.${status}`, { defaultValue: status })}
    </span>
  );
}

/*
 * How complete a draft being reviewed looks. It reflects the backend's
 * `confirmation` data at this moment; the balance and the user's permission
 * are checked again when a draft is confirmed, so this is never a promise.
 */
export function DraftReadiness({ draft }) {
  const { t } = useTranslation();
  const readiness = readinessOf(draft);
  if (readiness === "none") return null;

  const incomplete = readiness === "incomplete";
  const Icon = incomplete ? LuTriangleAlert : LuCircleCheck;

  return (
    <span className={`wad-chip wad-chip--${incomplete ? "warn" : "ok"}`}>
      <Icon aria-hidden="true" />
      {incomplete
        ? t(`${x}.readiness.incomplete`, { count: draft.confirmation.issues.length })
        : t(`${x}.readiness.complete`)}
    </span>
  );
}

/* Every issue the backend reports, including codes this app does not know. */
export function DraftIssues({ issues }) {
  const { t } = useTranslation();
  if (!issues.length) return null;

  return (
    <ul className="wad-issues">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${issue.field ?? ""}-${index}`}>
          <LuTriangleAlert aria-hidden="true" />
          <span>
            {isKnownIssueCode(issue.code)
              ? t(`${x}.issues.${issue.code}`)
              : t(`${x}.issues.unknown`)}
            {!isKnownIssueCode(issue.code) && (
              <small> <bdi dir="ltr">{issue.code}</bdi></small>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
