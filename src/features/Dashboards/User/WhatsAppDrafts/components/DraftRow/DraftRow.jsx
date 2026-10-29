import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { LuChevronRight } from "react-icons/lu";

import { getWhatsAppDraftPath } from "../../../../../../routes/Path.js";
import {
  draftTitle, formatDraftAmount, formatDraftDate, formatDraftTime,
} from "../../draftHelpers.js";
import { DraftReadiness, DraftStatusBadge } from "../DraftStatus/DraftStatus.jsx";

const x = "dashboard.whatsappDrafts";

/*
 * One draft in the inbox. Shows only what the list returns, and an unset
 * value is stated as unset: a missing amount is "Amount not set", never 0.
 * An unconfirmed draft is not presented as a posted transaction.
 */
export default function DraftRow({ draft, locale, listSearch = "" }) {
  const { t } = useTranslation();
  const values = draft.review_values;
  const amount = formatDraftAmount(values.amount, values.currency_code, locale);
  const date = formatDraftDate(values.transaction_date, locale);
  const time = formatDraftTime(values.transaction_time);
  const title = draftTitle(draft) ?? t(`${x}.row.untitled`, { id: draft.id });

  return (
    <article className={`wad-row wad-row--${draft.status}`}>
      <span className="wad-row__icon" aria-hidden="true"><FaWhatsapp /></span>

      <div className="wad-row__main">
        <h2 className="wad-row__title" dir="auto">
          <Link
            to={getWhatsAppDraftPath(draft.id)}
            state={{ listSearch }}
            className="wad-row__link"
          >
            {title}
          </Link>
        </h2>

        <p className="wad-row__meta">
          <span>{date ? <bdi>{date}</bdi> : t(`${x}.row.noDate`)}</span>
          {time && <span><bdi dir="ltr">{time}</bdi></span>}
          <span dir="auto">{draft.account?.name ?? t(`${x}.row.noAccount`)}</span>
          <span dir="auto">{draft.category?.name ?? t(`${x}.row.noCategory`)}</span>
        </p>

        <div className="wad-row__badges">
          <DraftStatusBadge status={draft.status} />
          <DraftReadiness draft={draft} />
        </div>
      </div>

      <div className="wad-row__side">
        {amount ? (
          <strong className="wad-amount"><bdi dir="ltr">{amount}</bdi></strong>
        ) : (
          <span className="wad-amount wad-amount--unset">{t(`${x}.row.noAmount`)}</span>
        )}
        <span className="wad-row__open" aria-hidden="true"><LuChevronRight /></span>
      </div>
    </article>
  );
}
