import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuArrowRight, LuReceiptText } from "react-icons/lu";

import { getAiExpenseCapturePath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDateTime } from "../../../utils/formatters";
import { getReviewVersion } from "../../captureHelpers";
import CaptureStatusBadge from "../CaptureStatusBadge/CaptureStatusBadge";

import "./CaptureRow.css";

/*
 * One capture in the list.
 *
 * Only what the list endpoint actually returns is shown. Its contract
 * guarantees `id`, `status` and `review_version`; merchant, amount, category,
 * account, the receipt image and any confidence score belong to the details
 * endpoint and are NOT invented here from it.
 *
 * `created_at` is rendered only when the response carries it, so the row is
 * useful where the backend sends it and correct where it doesn't.
 *
 * The only action is opening the capture. It carries the list's query string
 * in router state, so Back from the details page returns to the same filters
 * and page. Confirm, retry and discard are not row actions: they belong to
 * the review screen, where the user can see what they are acting on.
 */
export default function CaptureRow({ capture, listSearch = "" }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const reviewVersion = getReviewVersion(capture);

  return (
    <article className="capture-row">
      <span className="capture-row__icon" aria-hidden="true">
        <LuReceiptText />
      </span>

      <div className="capture-row__identity">
        <h2>{t("dashboard.aiCaptures.row.title", { id: capture.id })}</h2>
        <CaptureStatusBadge status={capture.status} />
      </div>

      <dl className="capture-row__meta">
        {capture.created_at && (
          <div>
            <dt>{t("dashboard.aiCaptures.row.createdAt")}</dt>
            <dd>
              <bdi dir="ltr">{formatDateTime(capture.created_at, locale)}</bdi>
            </dd>
          </div>
        )}

        {reviewVersion != null && (
          <div>
            <dt>{t("dashboard.aiCaptures.row.reviewVersion")}</dt>
            <dd>
              <bdi dir="ltr">{reviewVersion}</bdi>
            </dd>
          </div>
        )}
      </dl>

      <Link
        className="capture-row__action"
        to={getAiExpenseCapturePath(capture.id)}
        state={{ from: listSearch }}
        aria-label={t("dashboard.aiCaptures.row.viewNamed", { id: capture.id })}
      >
        {t("dashboard.aiCaptures.row.view")}
        <LuArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}
