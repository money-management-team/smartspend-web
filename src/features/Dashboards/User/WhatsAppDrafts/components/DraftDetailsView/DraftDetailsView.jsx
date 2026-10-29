import { useTranslation } from "react-i18next";
import {
  formatDraftAmount, formatDraftDate, formatDraftInstant, formatDraftTime, isReviewable,
} from "../../draftHelpers.js";
import { DraftIssues, DraftReadiness, DraftStatusBadge } from "../DraftStatus/DraftStatus.jsx";

const x = "dashboard.whatsappDrafts.details";

function Field({ label, children, wide = false }) {
  return (
    <div className={wide ? "wad-field wad-field--wide" : "wad-field"}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const unset = (t) => <span className="wad-unset">{t(`${x}.notSet`)}</span>;

/* The saved financial values of a draft, read-only. */
export function FinancialCard({ draft, locale }) {
  const { t } = useTranslation();
  const values = draft.review_values;
  const timeZone = values.workspace_timezone;
  const amount = formatDraftAmount(values.amount, values.currency_code, locale);
  const date = formatDraftDate(values.transaction_date, locale);
  const time = formatDraftTime(values.transaction_time);

  return (
    <section className="wad-card" aria-labelledby="wad-fin-title">
      <header className="wad-card__head">
        <h2 id="wad-fin-title">{t(`${x}.financial`)}</h2>
        <DraftStatusBadge status={draft.status} />
      </header>

      <p className="wad-amount wad-amount--hero">
        {amount ? <bdi dir="ltr">{amount}</bdi> : <span className="wad-unset">{t("dashboard.whatsappDrafts.row.noAmount")}</span>}
      </p>

      <dl className="wad-fields">
        <Field label={t(`${x}.currency`)}>
          {values.currency_code ? <bdi dir="ltr">{values.currency_code}</bdi> : unset(t)}
        </Field>
        <Field label={t(`${x}.account`)}>{draft.account?.name ? <span dir="auto">{draft.account.name}</span> : unset(t)}</Field>
        <Field label={t(`${x}.category`)}>{draft.category?.name ? <span dir="auto">{draft.category.name}</span> : unset(t)}</Field>
        <Field label={t(`${x}.date`)}>{date ? <bdi>{date}</bdi> : unset(t)}</Field>
        <Field label={t(`${x}.time`)}>{time ? <bdi dir="ltr">{time}</bdi> : unset(t)}</Field>
        <Field label={t(`${x}.timezone`)}>{timeZone ? <bdi dir="ltr">{timeZone}</bdi> : unset(t)}</Field>
        <Field label={t(`${x}.description`)} wide>
          {values.description ? <span dir="auto" className="wad-text">{values.description}</span> : unset(t)}
        </Field>
      </dl>

      {isReviewable(draft) && <p className="wad-note">{t(`${x}.draftNote`)}</p>}

    </section>
  );
}

/* What the backend currently says about confirming the SAVED draft. */
export function ReadinessCard({ draft }) {
  const { t } = useTranslation();
  if (!isReviewable(draft)) return null;

  return (
    <section className="wad-card" aria-labelledby="wad-ready-title">
      <header className="wad-card__head">
        <h2 id="wad-ready-title">{t(`${x}.readiness`)}</h2>
        <DraftReadiness draft={draft} />
      </header>
      {draft.confirmation.issues.length > 0 ? (
        <>
          <p>{t(`${x}.incompleteIntro`)}</p>
          <DraftIssues issues={draft.confirmation.issues} />
        </>
      ) : (
        <p>{draft.confirmation.ready ? t(`${x}.completeIntro`) : t(`${x}.noIssues`)}</p>
      )}
      <p className="wad-note">{t(`${x}.recheck`)}</p>
    </section>
  );
}

export function AboutCard({ draft, locale }) {
  const { t } = useTranslation();
  const timeZone = draft.review_values.workspace_timezone;
  const stamps = draft.timestamps ?? {};
  const instant = (iso) => formatDraftInstant(iso, locale, timeZone);

  // Moments are shown only when the backend sent them.
  const events = [
    ["created_at", stamps.created_at],
    ["ready_for_review_at", stamps.ready_for_review_at],
    ["expires_at", draft.status === "ready_for_review" ? stamps.expires_at : null],
    ["confirmed_at", stamps.confirmed_at],
    ["discarded_at", stamps.discarded_at],
    ["expired_at", stamps.expired_at],
  ].filter(([, iso]) => instant(iso));

  return (
    <section className="wad-card" aria-labelledby="wad-meta-title">
      <header className="wad-card__head"><h2 id="wad-meta-title">{t(`${x}.about`)}</h2></header>
      <dl className="wad-fields">
        <Field label={t(`${x}.reference`)}><bdi dir="ltr">#{draft.id}</bdi></Field>
        <Field label={t(`${x}.source`)}>WhatsApp</Field>
        {events.map(([key, iso]) => (
          <Field key={key} label={t(`${x}.events.${key}`)}><bdi>{instant(iso)}</bdi></Field>
        ))}
      </dl>
    </section>
  );
}

/*
 * Read-only composition (financial values, readiness, metadata). The review
 * screen uses the three cards separately so it can swap the financial card
 * for the edit form when the backend allows editing.
 */
export default function DraftDetailsView({ draft, locale }) {
  return (
    <div className="wad-details">
      <FinancialCard draft={draft} locale={locale} />
      <ReadinessCard draft={draft} />
      <AboutCard draft={draft} locale={locale} />
    </div>
  );
}
