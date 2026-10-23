import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { LuArrowLeft, LuArrowRight, LuSparkles } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import UnsavedChangesGuard from "../../../../components/UnsavedChanges/UnsavedChangesGuard";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH, getGoalPlanRevisionPath, getSavingsGoalDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { accountsApi } from "../api/accountsApi";
import { savingsGoalsApi } from "../api/savingsGoalsApi";
import { savingsPlansApi } from "../api/savingsPlansApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import PrivateMoney from "../Experience/PrivateMoney";
import { createIdempotentAttempt, translateEnum } from "../FinancialOperations/transactionHelpers";
import { getEligibleAccounts, getGoalErrorMessage, getGoalStatus } from "../SavingsGoals/savingsGoalHelpers";
import { getSmartPlanErrorMessage, isDateOnly, readPlanResponse, todayIn } from "../SavingsGoals/smartPlanHelpers";
import { SMART_SAVINGS_ENABLED } from "../SavingsGoals/smartSavings";
import FundingStep from "../SmartPlanWizard/components/FundingStep/FundingStep";
import GoalStep from "../SmartPlanWizard/components/GoalStep/GoalStep";
import PlanStep from "../SmartPlanWizard/components/PlanStep/PlanStep";
import WizardStepper from "../SmartPlanWizard/components/WizardStepper/WizardStepper";
import {
  emptyGoalForm,
  getPreviewInput,
  getPreviewKey,
  isSelectableOption,
  readPlanOptions,
  validateFunding,
  validateGoalStep,
} from "../SmartPlanWizard/smartPlanWizardHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";
import { formatDate, formatMoney } from "../utils/formatters";
import RevisionReview from "./components/RevisionReview/RevisionReview";
import {
  REVISION_CHANGES,
  REVISION_STEPS,
  buildFundingRevision,
  buildScheduleRevision,
  countReversibleSplitPayments,
  getPlanFunding,
  getPlanRhythm,
  getRevisionErrorStep,
  isSameFunding,
} from "./planRevisionHelpers";

import "../SmartPlanWizard/SmartPlanWizard.css";
import "./SmartPlanRevision.css";

// 409s meaning "this isn't the plan you reviewed": reload it and review again.
const PLAN_CHANGED = ["savings_plan_version_conflict", "savings_plan_accounts_changed"];

/*
 * Revising a goal's active smart plan (PATCH /savings-goals/{id}/plan), owner
 * only and gated by VITE_SMART_SAVINGS_ENABLED (the route only exists when it
 * is on; this redirects otherwise).
 *
 * - change=schedule: Schedule → Plan → Funding → Review. The options come
 *   from GET …/plan-options (the backend regenerates them from the ledger
 *   with the current plan in place). Approving supersedes the plan with
 *   the chosen option: open installments are cancelled, confirmed ones keep
 *   their money in the goal, and the replacement covers what's left.
 * - change=funding: Funding → Review. Same plan, schedule and amounts.
 *
 * Every request names the `plan_version` the user reviewed. If the plan
 * changed meanwhile (409 savings_plan_version_conflict) the current plan is
 * loaded and the user reviews and approves again; a changed option (409
 * savings_plan_option_stale) returns to fresh options. Nothing is resent
 * automatically. One Idempotency-Key per payload: an identical retry after
 * an unknown outcome replays instead of revising twice. No money moves.
 */
export default function SmartPlanRevisionPage({ smartSavingsEnabled = SMART_SAVINGS_ENABLED }) {
  const { savingsGoalId, change } = useParams();

  if (!smartSavingsEnabled) return <Navigate to={PATH.USER.SAVINGS_GOALS} replace />;
  if (!REVISION_CHANGES.includes(change)) return <Navigate to={getSavingsGoalDetailsPath(savingsGoalId)} replace />;

  // A new change type is a new revision: nothing carries over.
  return <SmartPlanRevision key={change} savingsGoalId={savingsGoalId} change={change} />;
}

function SmartPlanRevision({ savingsGoalId, change }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const today = todayIn(user?.timezone ?? workspace?.timezone);
  const prefix = "dashboard.savingsGoals.planManagement";
  const steps = REVISION_STEPS[change];
  const detailsPath = getSavingsGoalDetailsPath(savingsGoalId);

  const [step, setStep] = useState(0);
  const [formDraft, setFormDraft] = useState(null);
  const [showScheduleErrors, setShowScheduleErrors] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [preview, setPreview] = useState({ key: null, data: null, error: null });
  const [selection, setSelection] = useState({ key: null, intensity: null });
  const [showPlanError, setShowPlanError] = useState(false);
  const [fundingDraft, setFundingDraft] = useState(null);
  const [showFundingError, setShowFundingError] = useState(false);
  const [approval, setApproval] = useState({ key: null, accepted: false });
  const [stale, setStale] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [failure, setFailure] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [attempt] = useState(() => createIdempotentAttempt("savings-plan-revision"));
  const pendingRef = useRef(false);

  /* ---------- Goal + active plan ---------- */

  const [reload, setReload] = useState(0);
  const loadKey = `${savingsGoalId}:${reload}`;
  const [loaded, setLoaded] = useState({ key: null, goal: null, data: null, error: null, noPlan: false });

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    Promise.all([
      savingsGoalsApi.get(savingsGoalId, { signal }),
      savingsPlansApi.getActive(savingsGoalId, { signal }).then(
        (response) => ({ data: readPlanResponse(response?.data, savingsGoalId) }),
        (error) => {
          if (error?.code === "NOT_FOUND") return { noPlan: true };
          throw error;
        },
      ),
    ])
      .then(([goalResponse, planResult]) => {
        const goal = goalResponse?.data?.savings_goal;
        const valid = goal && String(goal.id) === String(savingsGoalId) && (planResult.noPlan || planResult.data);

        setLoaded(
          valid
            ? { key: loadKey, goal, data: planResult.data ?? null, error: null, noPlan: Boolean(planResult.noPlan) }
            : { key: loadKey, goal: null, data: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }), noPlan: false },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        setLoaded({ key: loadKey, goal: null, data: null, error, noPlan: false });
      });

    return () => controller.abort();
  }, [loadKey, savingsGoalId]);

  const isLoaded = loaded.key === loadKey;
  // The last plan stays on screen while it reloads, but nothing can be sent.
  const goal = loaded.goal;
  const plan = loaded.data?.plan ?? null;
  const health = loaded.data?.health ?? {};
  const currency = goal?.currency_code;

  /* ---------- Accounts ---------- */

  const [accountsReload, setAccountsReload] = useState(0);
  const accountsKey = goal?.workspace_id ? `${goal.workspace_id}:${accountsReload}` : null;
  const [accountsState, setAccountsState] = useState({ key: null, list: [], error: null });

  useEffect(() => {
    if (!accountsKey) return undefined;

    const controller = new AbortController();
    const id = accountsKey.split(":")[0];

    accountsApi
      .list({ id_workspace: id }, { signal: controller.signal })
      .then((response) => {
        const list = response?.data?.accounts;
        setAccountsState(
          Array.isArray(list)
            ? { key: accountsKey, list, error: null }
            : { key: accountsKey, list: [], error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setAccountsState({ key: accountsKey, list: [], error });
      });

    return () => controller.abort();
  }, [accountsKey]);

  const accountsLoaded = accountsKey != null && accountsState.key === accountsKey;
  const eligibleAccounts = accountsLoaded
    ? getEligibleAccounts(accountsState.list, { currency, goalAccountId: goal?.account?.id })
    : [];
  const accountsById = new Map(eligibleAccounts.map((account) => [String(account.id), account]));

  // The drafts start from the plan as it is; the user's edits replace them.
  const form = formDraft ?? { ...emptyGoalForm(), rhythm: getPlanRhythm(plan) ?? "monthly" };
  const funding = fundingDraft ?? getPlanFunding(plan);
  // Accounts that are no longer eligible drop out (once the list is known).
  const effectiveFunding = accountsLoaded
    ? { mode: funding.mode, sources: funding.sources.filter((source) => accountsById.has(String(source.account_id))) }
    : funding;

  /* ---------- Options (schedule change) ---------- */

  const scheduleErrors = validateGoalStep(form, { existing: true, today });
  const scheduleValid = Object.keys(scheduleErrors).length === 0 && goal != null;
  const previewKey =
    change === "schedule" && scheduleValid ? getPreviewKey(getPreviewInput(form, { goal, workspaceId: goal.workspace_id }), previewNonce) : null;
  const wantsPreview = previewKey != null && steps[step] !== "schedule";

  useEffect(() => {
    if (!wantsPreview) return undefined;

    const controller = new AbortController();
    const { goalId, query } = JSON.parse(previewKey);

    savingsPlansApi
      .getOptions(goalId, query, { signal: controller.signal })
      .then((response) => {
        const data = readPlanOptions(response?.data?.plan_options);
        setPreview(
          data
            ? { key: previewKey, data, error: null }
            : { key: previewKey, data: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setPreview({ key: previewKey, data: null, error });
      });

    return () => controller.abort();
  }, [previewKey, wantsPreview]);

  const previewCurrent = previewKey != null && preview.key === previewKey;
  const previewView = {
    loading: wantsPreview && !previewCurrent,
    data: previewCurrent ? preview.data : null,
    error: previewCurrent ? preview.error : null,
  };
  const selectedOption =
    previewView.data && selection.key === previewKey
      ? previewView.data.options.find((option) => option.intensity === selection.intensity && isSelectableOption(option))
      : null;

  /* ---------- Approval ---------- */

  const fundingError = validateFunding(effectiveFunding);
  const fundingUnchanged = change === "funding" && plan != null && isSameFunding(plan, effectiveFunding);
  const ready = plan != null && (change === "funding" || selectedOption != null) && !fundingError && !fundingUnchanged;
  // The approval covers exactly what is shown, against this plan version.
  const reviewSignature = ready
    ? JSON.stringify([
        change,
        plan.plan_version,
        previewKey,
        selectedOption?.options_fingerprint ?? null,
        selectedOption?.assessment_fingerprint ?? null,
        effectiveFunding,
      ])
    : null;
  const accepted = approval.accepted && approval.key === reviewSignature;

  /* ---------- Render helpers ---------- */

  const money = (value) =>
    value == null || value === "" ? (
      "—"
    ) : (
      <bdi dir="ltr">
        <PrivateMoney>{formatMoney(value, currency, locale)}</PrivateMoney>
      </bdi>
    );
  const day = (value) => (isDateOnly(value) ? <bdi>{formatDate(value, locale)}</bdi> : "—");

  const isDirty = !isRunning && (step > 0 || formDraft != null || fundingDraft != null);
  const goToStep = (name) => {
    const index = steps.indexOf(name);
    if (index >= 0) setStep(index);
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else navigate(detailsPath);
  };

  const handleContinue = () => {
    const name = steps[step];

    if (name === "schedule") {
      setShowScheduleErrors(true);
      if (scheduleValid) setStep(step + 1);
      return;
    }

    if (name === "plan") {
      setShowPlanError(true);
      if (selectedOption) setStep(step + 1);
      return;
    }

    if (name === "funding") {
      setShowFundingError(true);
      if (!fundingError && !fundingUnchanged && (accountsLoaded || effectiveFunding.mode === "at_confirmation")) {
        setStep(step + 1);
      }
    }
  };

  const handleSubmit = async () => {
    if (pendingRef.current || !accepted || !ready || !isLoaded) return;

    const body =
      change === "schedule"
        ? buildScheduleRevision(plan, form, selectedOption, effectiveFunding)
        : buildFundingRevision(plan, effectiveFunding);
    const idempotencyKey = attempt.keyFor({ goalId: savingsGoalId, body });

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);
    setConflict(false);

    try {
      await savingsPlansApi.revise(savingsGoalId, body, idempotencyKey);
      attempt.settle();
      navigate(detailsPath, { state: { smartPlanRevised: change } });
    } catch (error) {
      // 401: apiClient's session-expired flow takes over.
      if (error?.code === "UNAUTHENTICATED") return;

      const unknown = UNKNOWN_OUTCOME_CODES.includes(error?.code);
      // An unknown outcome keeps the key: retrying the same request replays
      // it. Anything else was rejected, so the next attempt is a new one.
      if (!unknown) attempt.reset();

      if (error?.serverCode === "savings_plan_option_stale") {
        // The option changed on the backend: fresh options, a new choice
        // and a new approval. The regenerated option isn't taken for them.
        setStale(error.payload?.verdict ?? "unavailable");
        setApproval({ key: null, accepted: false });
        setShowPlanError(false);
        setPreviewNonce((nonce) => nonce + 1);
        goToStep("plan");
        return;
      }

      if (PLAN_CHANGED.includes(error?.serverCode) || error?.serverCode === "savings_plan_not_active" || error?.code === "NOT_FOUND") {
        // Not the plan the user reviewed (or no plan at all): load the
        // current one. The approval no longer matches its version.
        setApproval({ key: null, accepted: false });
        setConflict(PLAN_CHANGED.includes(error?.serverCode));
        setReload((count) => count + 1);
        if (change === "schedule") {
          setPreviewNonce((nonce) => nonce + 1);
          if (PLAN_CHANGED.includes(error?.serverCode)) goToStep("plan");
        }
        return;
      }

      setFailure({
        error,
        kind: unknown ? "unknown" : "final",
        step: error?.code === "VALIDATION_ERROR" ? getRevisionErrorStep(error.errors, change) : null,
      });
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
    }
  };

  /* ---------- Page states ---------- */

  const backLink = (
    <p className="smart-wizard__back-row">
      <Link className="smart-wizard__back" to={detailsPath}>
        <LuArrowLeft aria-hidden="true" />
        <span>{t("dashboard.savingsGoals.smartPlanWizard.backToGoal")}</span>
      </Link>
    </p>
  );

  const pageState = (title, body, action, role = "status") => (
    <div className="smart-wizard smart-revision">
      {backLink}
      <div className="smart-wizard__state" role={role}>
        <h1>{title}</h1>
        <p>{body}</p>
        {action}
      </div>
    </div>
  );

  if (!goal && !loaded.error) {
    return (
      <div className="smart-wizard smart-revision">
        {backLink}
        <Loading variant="page" size="large" message={t(`${prefix}.loading`)} />
      </div>
    );
  }

  if (isLoaded && loaded.error) {
    const notFound = loaded.error.code === "NOT_FOUND";
    return pageState(
      t(notFound ? "dashboard.savingsGoals.details.notFoundTitle" : `${prefix}.errorTitle`),
      notFound ? getGoalErrorMessage(loaded.error, t) : getSmartPlanErrorMessage(loaded.error, t, i18n, "load"),
      notFound ? null : (
        <button type="button" onClick={() => setReload((count) => count + 1)}>
          {t("common.retry")}
        </button>
      ),
      "alert",
    );
  }

  if (isLoaded && loaded.noPlan) {
    return pageState(
      t(`${prefix}.noPlan.title`),
      t(`${prefix}.noPlan.body`),
      <Link className="smart-wizard__state-link" to={detailsPath}>
        {t("dashboard.savingsGoals.smartPlanWizard.backToGoal")}
      </Link>,
    );
  }

  if (!plan) {
    return (
      <div className="smart-wizard smart-revision">
        {backLink}
        <Loading variant="page" size="large" message={t(`${prefix}.loading`)} />
      </div>
    );
  }

  // The backend keeps a paused goal's schedule as it is; funding may change.
  if (change === "schedule" && getGoalStatus(goal) === "paused") {
    return pageState(
      t(`${prefix}.paused.title`),
      t(`${prefix}.paused.body`),
      <Link className="smart-wizard__state-link" to={getGoalPlanRevisionPath(goal.id, "funding")}>
        {t(`${prefix}.paused.funding`)}
      </Link>,
    );
  }

  /* ---------- Steps ---------- */

  const stepName = steps[step];
  const intensity = translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", plan.intensity);

  return (
    <div className="smart-wizard smart-revision">
      {backLink}

      <header className="smart-wizard__head">
        <p className="smart-wizard__eyebrow">
          <LuSparkles aria-hidden="true" />
          <span>{t(`${prefix}.eyebrow`, { intensity })}</span>
        </p>
        <h1 dir="auto">{t(`${prefix}.title.${change}`, { name: goal.name ?? "" })}</h1>
        <p>{t(`${prefix}.subtitle.${change}`)}</p>
      </header>

      <WizardStepper steps={steps} current={step} onSelect={(index) => index < step && setStep(index)} />

      <section className="smart-wizard__panel" aria-labelledby="smart-revision-step-title">
        <h2 id="smart-revision-step-title" className="smart-wizard__step-title">
          {t(`dashboard.savingsGoals.smartPlanWizard.steps.${stepName}`)}
        </h2>

        {stepName === "schedule" && (
          <GoalStep
            goal={goal}
            form={form}
            errors={showScheduleErrors ? scheduleErrors : {}}
            onChange={(field, value) => {
              setFormDraft({ ...form, [field]: value });
              setStale(null);
              setConflict(false);
            }}
            onChooseFree={() => {}}
            money={money}
            day={day}
          />
        )}

        {stepName === "plan" && (
          <>
            {conflict && (
              <p className="smart-revision__banner" role="alert">
                {t(`${prefix}.review.conflict`)}
              </p>
            )}
            <PlanStep
              preview={previewView}
              selected={selectedOption?.intensity ?? null}
              onSelect={(value) => {
                setSelection({ key: previewKey, intensity: value });
                setStale(null);
              }}
              onRetry={() => setPreviewNonce((nonce) => nonce + 1)}
              onEditGoal={() => goToStep("schedule")}
              stale={stale}
              money={money}
              day={day}
              locale={locale}
            />
            {showPlanError && !selectedOption && previewView.data?.options?.length > 0 && (
              <p className="smart-wizard__error" role="alert">
                {t("dashboard.savingsGoals.smartPlanWizard.validation.choosePlan")}
              </p>
            )}
          </>
        )}

        {stepName === "funding" && (
          <>
            {conflict && change === "funding" && (
              <p className="smart-revision__banner" role="alert">
                {t(`${prefix}.review.conflict`)}
              </p>
            )}
            <FundingStep
              funding={effectiveFunding}
              accounts={{
                loading: !accountsLoaded,
                error: accountsLoaded ? accountsState.error : null,
                list: eligibleAccounts,
              }}
              currency={currency}
              error={showFundingError ? fundingError : null}
              onChange={(next) => {
                setFundingDraft(next);
                setConflict(false);
              }}
              onRetry={() => setAccountsReload((key) => key + 1)}
            />
            {showFundingError && !fundingError && fundingUnchanged && (
              <p className="smart-wizard__error" role="alert">
                {t(`${prefix}.validation.fundingUnchanged`)}
              </p>
            )}
          </>
        )}

        {stepName === "review" && ready && (
          <RevisionReview
            change={change}
            plan={plan}
            health={health}
            option={selectedOption}
            funding={effectiveFunding}
            accountsById={accountsById}
            remaining={previewView.data?.goal?.remaining_amount ?? null}
            reversibleCount={countReversibleSplitPayments(plan)}
            accepted={accepted}
            onAcceptedChange={(value) => setApproval({ key: reviewSignature, accepted: value })}
            onEdit={goToStep}
            failure={failure}
            conflict={conflict}
            disabled={isRunning || !isLoaded}
            money={money}
            day={day}
            locale={locale}
          />
        )}

        {stepName === "review" && !ready && (
          <div className="smart-wizard__state" role="status">
            <p>{t(`${prefix}.review.notReady`)}</p>
            <button type="button" onClick={() => goToStep(change === "schedule" ? "plan" : "funding")}>
              {t(`${prefix}.review.edit.${change}`)}
            </button>
          </div>
        )}
      </section>

      <footer className="smart-wizard__nav">
        <button type="button" className="smart-wizard__button" onClick={goBack} disabled={isRunning}>
          <LuArrowLeft aria-hidden="true" />
          <span>{t(step === 0 ? "common.cancel" : "dashboard.savingsGoals.smartPlanWizard.back")}</span>
        </button>

        {stepName === "review" ? (
          <button
            type="button"
            className="smart-wizard__button smart-wizard__button--primary"
            onClick={handleSubmit}
            disabled={!accepted || isRunning || !ready || !isLoaded}
            aria-busy={isRunning || undefined}
          >
            <span>
              {t(
                isRunning
                  ? `${prefix}.submitting`
                  : failure?.kind === "unknown"
                    ? `${prefix}.retrySubmit`
                    : `${prefix}.submit.${change}`,
              )}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="smart-wizard__button smart-wizard__button--primary"
            onClick={handleContinue}
            disabled={stepName === "plan" && (previewView.loading || !previewView.data?.options?.some(isSelectableOption))}
          >
            <span>{t("dashboard.savingsGoals.smartPlanWizard.continue")}</span>
            <LuArrowRight aria-hidden="true" />
          </button>
        )}
      </footer>

      <UnsavedChangesGuard when={isDirty} />
    </div>
  );
}
