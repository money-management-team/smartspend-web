import { useTranslation } from "react-i18next";
import { LuArrowRight, LuInfo, LuPencil, LuRefreshCw, LuShieldCheck, LuTriangleAlert } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatAllocation, getFrequencyLabel, getSmartPlanErrorMessage } from "../../../SavingsGoals/smartPlanHelpers";
import { percentToBps } from "../../../SmartPlanWizard/smartPlanWizardHelpers";
import { getNextDueDate } from "../../planRevisionHelpers";

// The review card styles (assurance, approval, failure) are shared with the wizard.
import "../../../SmartPlanWizard/components/ReviewStep/ReviewStep.css";
import "./RevisionReview.css";

/*
 * The last stage of a revision: the plan as it is now beside what it will
 * be, what the change does, and an explicit approval. Every figure is the
 * backend's — the current plan from GET …/plan, the proposal from the
 * chosen plan-options option — so nothing is recomputed. Approving moves no
 * money.
 *
 * `failure` is the last PATCH error ({ error, kind, step }); `conflict` is
 * set when the plan changed under the user and this is a fresh review.
 */
export default function RevisionReview({
  change,
  plan,
  health,
  option,
  funding,
  accountsById,
  remaining,
  reversibleCount,
  accepted,
  onAcceptedChange,
  onEdit,
  failure,
  conflict,
  disabled,
  money,
  day,
  locale,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.planManagement.review";
  const intensity = (value) => translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", value);
  const rhythm = (source) => {
    const label = getFrequencyLabel(source);
    return label ? t(label.key, { count: label.count }) : "—";
  };
  const mode = (value) => t(`dashboard.savingsGoals.smartPlan.funding.modes.${value}`, { defaultValue: value });
  const count = (value) => <bdi>{new Intl.NumberFormat(locale).format(Number(value) || 0)}</bdi>;

  const currentSources = [...(plan.funding_sources ?? [])]
    .sort((left, right) => Number(left.priority) - Number(right.priority))
    .map((source) => ({
      key: source.account_id,
      name: source.account_name ?? `#${source.account_id}`,
      share: plan.funding_mode === "allocated" ? formatAllocation(source.allocation_bps, locale) : null,
    }));
  const nextSources = (funding.mode === "at_confirmation" ? [] : funding.sources).map((source) => ({
    key: source.account_id,
    name: accountsById.get(String(source.account_id))?.name ?? `#${source.account_id}`,
    share: funding.mode === "allocated" ? formatAllocation(percentToBps(source.percent), locale) : null,
  }));
  const sourceList = (sources, fundingMode) =>
    fundingMode === "at_confirmation" || sources.length === 0 ? (
      <span className="revision-review__muted">{t(`${prefix}.chosenAtConfirmation`)}</span>
    ) : (
      <ol className="revision-review__sources">
        {sources.map((source) => (
          <li key={source.key}>
            <span dir="auto">{source.name}</span>
            {source.share && <bdi dir="ltr">{source.share}</bdi>}
          </li>
        ))}
      </ol>
    );

  const sameText = (left, right) => String(left ?? "") === String(right ?? "");
  const rows =
    change === "schedule"
      ? [
          ["intensity", intensity(plan.intensity), intensity(option.intensity), sameText(plan.intensity, option.intensity)],
          [
            "rhythm",
            rhythm(plan),
            rhythm(option),
            sameText(plan.frequency, option.frequency) && sameText(plan.interval, option.interval),
          ],
          [
            "perInstallment",
            money(plan.installment_amount),
            money(option.installment_amount),
            sameText(plan.installment_amount, option.installment_amount),
          ],
          [
            "installments",
            t(`${prefix}.openCount`, { count: Number(health.outstanding_count) || 0 }),
            count(option.installment_count),
            false,
          ],
          ["nextDue", day(getNextDueDate(plan)), day(option.first_due_date), sameText(getNextDueDate(plan), option.first_due_date)],
          [
            "completion",
            day(plan.expected_completion_date),
            day(option.expected_completion_date),
            sameText(plan.expected_completion_date, option.expected_completion_date),
          ],
          ["fundingMode", mode(plan.funding_mode), mode(funding.mode), sameText(plan.funding_mode, funding.mode)],
          ["accounts", sourceList(currentSources, plan.funding_mode), sourceList(nextSources, funding.mode), false],
        ]
      : [
          ["fundingMode", mode(plan.funding_mode), mode(funding.mode), sameText(plan.funding_mode, funding.mode)],
          ["accounts", sourceList(currentSources, plan.funding_mode), sourceList(nextSources, funding.mode), false],
          ["perInstallment", money(plan.installment_amount), money(plan.installment_amount), true],
          ["nextDue", day(getNextDueDate(plan)), day(getNextDueDate(plan)), true],
        ];

  const effects =
    change === "schedule"
      ? [
          t(`${prefix}.effects.schedule.replaced`),
          t(`${prefix}.effects.schedule.cancelled`, { count: Number(health.outstanding_count) || 0 }),
          t(`${prefix}.effects.schedule.kept`),
          remaining != null ? (
            <>
              {t(`${prefix}.effects.schedule.covers`)} {money(remaining)}
            </>
          ) : null,
          t(`${prefix}.effects.schedule.history`),
        ]
      : [
          t(`${prefix}.effects.funding.same`),
          t(`${prefix}.effects.funding.open`),
          t(`${prefix}.effects.funding.kept`),
          t(`${prefix}.effects.funding.history`),
        ];

  return (
    <div className="revision-review">
      {conflict && (
        <div className="review-step__failure review-step__failure--warning" role="alert">
          <LuRefreshCw aria-hidden="true" />
          <div>
            <p>{t(`${prefix}.conflict`)}</p>
          </div>
        </div>
      )}

      {failure && (
        <div
          className={`review-step__failure review-step__failure--${failure.kind === "unknown" ? "warning" : "danger"}`}
          role="alert"
        >
          <LuTriangleAlert aria-hidden="true" />
          <div>
            <p dir="auto">
              {failure.kind === "unknown"
                ? t(`${prefix}.unknownOutcome`)
                : getSmartPlanErrorMessage(failure.error, t, i18n, "revise")}
            </p>
            {failure.step && (
              <button type="button" onClick={() => onEdit(failure.step)}>
                {t(`${prefix}.fix.${failure.step}`)}
              </button>
            )}
          </div>
        </div>
      )}

      <section className="revision-review__compare" aria-labelledby="revision-review-title">
        <header>
          <h2 id="revision-review-title">{t(`${prefix}.title.${change}`)}</h2>
          <button
            type="button"
            className="review-step__edit"
            onClick={() => onEdit(change === "schedule" ? "plan" : "funding")}
            aria-label={t(`${prefix}.edit.${change}`)}
          >
            <LuPencil aria-hidden="true" />
            <span>{t("dashboard.savingsGoals.smartPlanWizard.review.editLabel")}</span>
          </button>
        </header>

        <table className="revision-review__table">
          <caption className="revision-review__sr-only">{t(`${prefix}.caption`)}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="revision-review__sr-only">{t(`${prefix}.columns.item`)}</span>
              </th>
              <th scope="col">{t(`${prefix}.columns.now`)}</th>
              <th scope="col" className="revision-review__arrow-col" aria-hidden="true" />
              <th scope="col">{t(`${prefix}.columns.after`)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, now, after, same]) => (
              <tr key={key} className={same ? "revision-review__row--same" : "revision-review__row--changed"}>
                <th scope="row">{t(`${prefix}.rows.${key}`)}</th>
                <td data-label={t(`${prefix}.columns.now`)}>{now}</td>
                <td className="revision-review__arrow-col" aria-hidden="true">
                  <LuArrowRight />
                </td>
                <td data-label={t(`${prefix}.columns.after`)}>
                  {after}
                  {same && <small className="revision-review__same">{t(`${prefix}.unchanged`)}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="revision-review__effects" aria-labelledby="revision-review-effects-title">
        <h2 id="revision-review-effects-title">{t(`${prefix}.effectsTitle`)}</h2>
        <ul>
          {effects.filter(Boolean).map((effect, index) => (
            <li key={index}>{effect}</li>
          ))}
        </ul>
      </section>

      {change === "schedule" && reversibleCount > 0 && (
        <div className="revision-review__note" role="note">
          <LuInfo aria-hidden="true" />
          <p>{t(`${prefix}.splitReversal`, { count: reversibleCount })}</p>
        </div>
      )}

      <div className="review-step__assurance" role="note">
        <LuShieldCheck aria-hidden="true" />
        <div>
          <strong>{t(`${prefix}.noMoneyTitle`)}</strong>
          <p>{t(`${prefix}.noMoneyBody.${change}`)}</p>
        </div>
      </div>

      <label className="review-step__accept">
        <input type="checkbox" checked={accepted} disabled={disabled} onChange={(event) => onAcceptedChange(event.target.checked)} />
        <span>{t(`${prefix}.accept.${change}`)}</span>
      </label>
    </div>
  );
}
