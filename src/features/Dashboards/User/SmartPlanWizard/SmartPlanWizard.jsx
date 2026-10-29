import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { LuArrowLeft, LuArrowRight, LuSparkles } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import UnsavedChangesGuard from "../../../../components/UnsavedChanges/UnsavedChangesGuard";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH, getNewSavingsGoalPath, getSavingsGoalDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { accountsApi } from "../api/accountsApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { savingsGoalsApi } from "../api/savingsGoalsApi";
import { savingsPlansApi } from "../api/savingsPlansApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import PrivateMoney from "../Experience/PrivateMoney";
import { createIdempotentAttempt } from "../FinancialOperations/transactionHelpers";
import { getEligibleAccounts, getGoalErrorMessage, getGoalProgress, getGoalStatus } from "../SavingsGoals/savingsGoalHelpers";
import { isDateOnly, isSmartSavingsDisabledError, todayIn } from "../SavingsGoals/smartPlanHelpers";
import { SMART_SAVINGS_ENABLED } from "../SavingsGoals/smartSavings";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";
import { formatDate, formatMoney } from "../utils/formatters";
import FundingStep from "./components/FundingStep/FundingStep";
import GoalStep from "./components/GoalStep/GoalStep";
import PlanStep from "./components/PlanStep/PlanStep";
import ReviewStep from "./components/ReviewStep/ReviewStep";
import WizardStepper from "./components/WizardStepper/WizardStepper";
import {
  STEPS,
  buildCreateWithGoalBody,
  buildPlanSelection,
  emptyGoalForm,
  getErrorStep,
  getPreviewInput,
  getPreviewKey,
  isSelectableOption,
  readPlanOptions,
  validateFunding,
  validateGoalStep,
} from "./smartPlanWizardHelpers";

import "./SmartPlanWizard.css";

const isZeroAmount = (value) => /^-?0*(\.0*)?$/.test(String(value ?? "").trim());

/*
 * Smart savings plan creation, in four stages: Goal → Plan → Funding →
 * Review. Gated by VITE_SMART_SAVINGS_ENABLED (the route only exists when it
 * is on; this redirects otherwise).
 *
 * - New goal (/dashboard/savings-goals/smart-plan): POST /savings-plans/
 *   preview, then POST /savings-goals/with-plan creates the goal, its
 *   savings account and the plan in one transaction. "Free savings" leaves
 *   for the existing create form, unchanged.
 * - Existing flexible goal (/dashboard/savings-goals/{id}/smart-plan):
 *   GET …/plan-options, then POST …/plan.
 *
 * The preview belongs to its inputs: changing the goal, amount, currency,
 * dates or rhythm fetches a new one and clears the chosen option. Creation
 * sends that option's two fingerprints; if the backend's regenerated option
 * no longer matches (409 savings_plan_option_stale) the user is taken back
 * to the refreshed options and must choose and approve again — nothing is
 * accepted on their behalf. One Idempotency-Key per payload: an identical
 * retry after an unknown outcome replays instead of creating twice.
 * Accepting a plan moves no money. If the backend's release gate is off
 * (409 smart_savings_disabled) nothing was created; the wizard says so and
 * offers no retry.
 */
export default function SmartPlanWizardPage({ smartSavingsEnabled = SMART_SAVINGS_ENABLED }) {
  if (!smartSavingsEnabled) return <Navigate to={PATH.USER.SAVINGS_GOALS} replace />;
  return <SmartPlanWizard />;
}

function SmartPlanWizard() {
  const { savingsGoalId } = useParams();
  const isExisting = savingsGoalId != null;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const today = todayIn(user?.timezone ?? workspace?.timezone);
  const prefix = "dashboard.savingsGoals.smartPlanWizard";

  const [form, setForm] = useState(emptyGoalForm);
  const [step, setStep] = useState(0);
  const [showGoalErrors, setShowGoalErrors] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [preview, setPreview] = useState({ key: null, data: null, error: null });
  const [selection, setSelection] = useState({ key: null, intensity: null });
  const [showPlanError, setShowPlanError] = useState(false);
  const [funding, setFunding] = useState({ mode: "single", sources: [] });
  const [showFundingError, setShowFundingError] = useState(false);
  const [approval, setApproval] = useState({ key: null, accepted: false });
  const [stale, setStale] = useState(null);
  const [failure, setFailure] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [attempt] = useState(() => createIdempotentAttempt("savings-plan"));
  const pendingRef = useRef(false);

  /* ---------- Existing goal ---------- */

  const [goalReload, setGoalReload] = useState(0);
  const goalKey = isExisting ? `${savingsGoalId}:${goalReload}` : null;
  const [goalState, setGoalState] = useState({ key: null, goal: null, hasPlan: false, error: null });

  useEffect(() => {
    if (!goalKey) return undefined;

    const controller = new AbortController();
    const signal = controller.signal;

    Promise.all([
      savingsGoalsApi.get(savingsGoalId, { signal }),
      // A goal with an active plan can't take another one.
      savingsPlansApi.getActive(savingsGoalId, { signal }).then(
        () => true,
        (error) => {
          if (error?.code === "NOT_FOUND") return false;
          throw error;
        },
      ),
    ])
      .then(([response, hasPlan]) => {
        const goal = response?.data?.savings_goal;
        setGoalState(
          goal && String(goal.id) === String(savingsGoalId)
            ? { key: goalKey, goal, hasPlan, error: null }
            : { key: goalKey, goal: null, hasPlan: false, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        setGoalState({ key: goalKey, goal: null, hasPlan: false, error });
      });

    return () => controller.abort();
  }, [goalKey, savingsGoalId]);

  const goalLoading = isExisting && goalState.key !== goalKey;
  const goal = isExisting && !goalLoading ? goalState.goal : null;

  /* ---------- Workspace (new goal) ---------- */

  const [workspaceReload, setWorkspaceReload] = useState(0);
  const [workspaceState, setWorkspaceState] = useState({ key: null, id: null, error: null });

  useEffect(() => {
    if (isExisting) return undefined;

    let active = true;
    resolveWorkspaceId()
      .then((id) => active && setWorkspaceState({ key: workspaceReload, id, error: null }))
      .catch((error) => active && setWorkspaceState({ key: workspaceReload, id: null, error }));

    return () => {
      active = false;
    };
  }, [isExisting, workspaceReload]);

  const workspaceId = isExisting ? goal?.workspace_id : workspaceState.key === workspaceReload ? workspaceState.id : null;
  const currency = isExisting ? goal?.currency_code : form.currency_code;

  /* ---------- Accounts ---------- */

  const [accountsReload, setAccountsReload] = useState(0);
  const accountsKey = workspaceId ? `${workspaceId}:${accountsReload}` : null;
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
  // Accounts that stopped being eligible (another currency, say) drop out.
  const effectiveFunding = {
    mode: funding.mode,
    sources: funding.sources.filter((source) => accountsById.has(String(source.account_id))),
  };

  /* ---------- Preview ---------- */

  const goalErrors = validateGoalStep(form, { existing: isExisting, today });
  const goalReady = isExisting ? goal != null : workspaceId != null;
  const goalValid = Object.keys(goalErrors).length === 0 && goalReady;
  const previewKey = goalValid ? getPreviewKey(getPreviewInput(form, { goal, workspaceId }), previewNonce) : null;
  const wantsPreview = step >= 1 && previewKey != null;

  useEffect(() => {
    if (!wantsPreview) return undefined;

    const controller = new AbortController();
    const { goalId, body, query } = JSON.parse(previewKey);
    const request = goalId
      ? savingsPlansApi.getOptions(goalId, query, { signal: controller.signal })
      : savingsPlansApi.previewProposal(body, { signal: controller.signal });

    request
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
  // The approval covers exactly what is shown: any change asks for it again.
  const reviewSignature = selectedOption
    ? JSON.stringify([previewKey, selectedOption.options_fingerprint, selectedOption.assessment_fingerprint, effectiveFunding, form.name, form.notes])
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

  const isDirty =
    !isRunning &&
    (step > 0 ||
      (!isExisting && (form.name.trim() !== "" || form.target_amount.trim() !== "" || form.notes.trim() !== "")));

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setStale(null);
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else navigate(isExisting ? getSavingsGoalDetailsPath(savingsGoalId) : PATH.USER.SAVINGS_GOALS);
  };

  const handleContinue = () => {
    if (step === 0) {
      setShowGoalErrors(true);
      if (goalValid) setStep(1);
      return;
    }

    if (step === 1) {
      setShowPlanError(true);
      if (selectedOption) setStep(2);
      return;
    }

    if (step === 2) {
      setShowFundingError(true);
      // At-confirmation needs no account now; the others need the list.
      if (!fundingError && (accountsLoaded || effectiveFunding.mode === "at_confirmation")) setStep(3);
    }
  };

  const handleCreate = async () => {
    if (pendingRef.current || !accepted || !selectedOption || fundingError || failure?.kind === "unavailable") return;

    const planSelection = buildPlanSelection(form, selectedOption, effectiveFunding);
    const body = isExisting ? planSelection : buildCreateWithGoalBody(form, workspaceId, planSelection);
    const idempotencyKey = attempt.keyFor({ goalId: savingsGoalId ?? null, body });

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);

    try {
      const response = isExisting
        ? await savingsPlansApi.createForGoal(savingsGoalId, body, idempotencyKey)
        : await savingsPlansApi.createWithGoal(body, idempotencyKey);
      attempt.settle();

      const createdId = response?.data?.savings_goal?.id ?? savingsGoalId;
      navigate(createdId != null ? getSavingsGoalDetailsPath(createdId) : PATH.USER.SAVINGS_GOALS, {
        state: { smartPlanCreated: true },
      });
    } catch (error) {
      // 401: apiClient's session-expired flow takes over.
      if (error?.code === "UNAUTHENTICATED") return;

      const unknown = UNKNOWN_OUTCOME_CODES.includes(error?.code);
      // An unknown outcome keeps the key: retrying the same request replays
      // it. Anything else was rejected, so the next attempt is a new one.
      if (!unknown) attempt.reset();

      if (error?.serverCode === "savings_plan_option_stale") {
        // The option changed on the backend. Show the regenerated options
        // and require a new choice and a new approval.
        setStale(error.payload?.verdict ?? "unavailable");
        setApproval({ key: null, accepted: false });
        setShowPlanError(false);
        setPreviewNonce((nonce) => nonce + 1);
        setStep(1);
        return;
      }

      setFailure({
        error,
        // "unavailable": the backend refuses new plans altogether. Not a
        // conflict to resolve and nothing to resend.
        kind: isSmartSavingsDisabledError(error) ? "unavailable" : unknown ? "unknown" : "final",
        step: error?.code === "VALIDATION_ERROR" ? getErrorStep(error.errors) : null,
      });
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
    }
  };

  /* ---------- Page states ---------- */

  const backLink = (
    <p className="smart-wizard__back-row">
      <Link className="smart-wizard__back" to={isExisting ? getSavingsGoalDetailsPath(savingsGoalId) : PATH.USER.SAVINGS_GOALS}>
        <LuArrowLeft aria-hidden="true" />
        <span>{t(isExisting ? `${prefix}.backToGoal` : `${prefix}.backToGoals`)}</span>
      </Link>
    </p>
  );

  const pageState = (title, body, action) => (
    <div className="smart-wizard">
      {backLink}
      <div className="smart-wizard__state" role={action ? "alert" : "status"}>
        <h1>{title}</h1>
        <p>{body}</p>
        {action}
      </div>
    </div>
  );

  if (goalLoading) {
    return (
      <div className="smart-wizard">
        {backLink}
        <Loading variant="page" size="large" message={t(`${prefix}.loadingGoal`)} />
      </div>
    );
  }

  if (isExisting && goalState.error) {
    const notFound = goalState.error.code === "NOT_FOUND";
    return pageState(
      t(notFound ? "dashboard.savingsGoals.details.notFoundTitle" : `${prefix}.goalErrorTitle`),
      getGoalErrorMessage(goalState.error, t),
      notFound ? null : (
        <button type="button" onClick={() => setGoalReload((key) => key + 1)}>
          {t("common.retry")}
        </button>
      ),
    );
  }

  if (isExisting && goal) {
    const status = getGoalStatus(goal);
    const funded = isZeroAmount(getGoalProgress(goal)?.remaining_amount);
    const blocked = goalState.hasPlan ? "hasPlan" : status !== "active" ? status : funded ? "achieved" : null;

    if (blocked) {
      return pageState(
        t(`${prefix}.unavailable.title`),
        t(`${prefix}.unavailable.${blocked}`, { defaultValue: t(`${prefix}.unavailable.other`) }),
        <Link className="smart-wizard__state-link" to={getSavingsGoalDetailsPath(goal.id)}>
          {t(`${prefix}.backToGoal`)}
        </Link>,
      );
    }
  }

  if (!isExisting && workspaceState.key === workspaceReload && workspaceState.error) {
    return pageState(
      t(`${prefix}.goalErrorTitle`),
      getGoalErrorMessage(workspaceState.error, t),
      <button type="button" onClick={() => setWorkspaceReload((key) => key + 1)}>
        {t("common.retry")}
      </button>,
    );
  }

  /* ---------- Wizard ---------- */

  const stepName = STEPS[step];
  const summary = isExisting
    ? {
        existing: true,
        name: goal?.name,
        targetAmount: goal?.target_amount,
        targetDate: goal?.target_date ? String(goal.target_date).slice(0, 10) : null,
      }
    : { existing: false, name: form.name.trim(), targetAmount: form.target_amount.trim(), targetDate: form.target_date || null };

  return (
    <div className="smart-wizard">
      {backLink}

      <header className="smart-wizard__head">
        <p className="smart-wizard__eyebrow">
          <LuSparkles aria-hidden="true" />
          <span>{t(`${prefix}.eyebrow`)}</span>
        </p>
        <h1 dir="auto">{isExisting ? t(`${prefix}.titleExisting`, { name: goal?.name ?? "" }) : t(`${prefix}.title`)}</h1>
        <p>{t(`${prefix}.subtitle`)}</p>
      </header>

      <WizardStepper current={step} onSelect={(index) => index < step && setStep(index)} />

      <section className="smart-wizard__panel" aria-labelledby="smart-wizard-step-title">
        <h2 id="smart-wizard-step-title" className="smart-wizard__step-title">
          {t(`${prefix}.steps.${stepName}`)}
        </h2>

        {stepName === "goal" && (
          <GoalStep
            goal={goal}
            form={form}
            errors={showGoalErrors ? goalErrors : {}}
            onChange={updateForm}
            onChooseFree={() => navigate(getNewSavingsGoalPath())}
            money={money}
            day={day}
          />
        )}

        {stepName === "plan" && (
          <>
            <PlanStep
              preview={previewView}
              selected={selectedOption?.intensity ?? null}
              onSelect={(intensity) => {
                setSelection({ key: previewKey, intensity });
                setStale(null);
              }}
              onRetry={() => setPreviewNonce((nonce) => nonce + 1)}
              onEditGoal={() => setStep(0)}
              stale={stale}
              money={money}
              day={day}
              locale={locale}
            />
            {showPlanError && !selectedOption && previewView.data?.options?.length > 0 && (
              <p className="smart-wizard__error" role="alert">
                {t(`${prefix}.validation.choosePlan`)}
              </p>
            )}
          </>
        )}

        {stepName === "funding" && (
          <FundingStep
            funding={effectiveFunding}
            accounts={{
              loading: !accountsLoaded,
              error: accountsLoaded ? accountsState.error : null,
              list: eligibleAccounts,
            }}
            currency={currency}
            error={showFundingError ? fundingError : null}
            onChange={setFunding}
            onRetry={() => setAccountsReload((key) => key + 1)}
          />
        )}

        {stepName === "review" && selectedOption && (
          <ReviewStep
            summary={summary}
            option={selectedOption}
            funding={effectiveFunding}
            accountsById={accountsById}
            accepted={accepted}
            onAcceptedChange={(value) => setApproval({ key: reviewSignature, accepted: value })}
            onEdit={(index) => setStep(index)}
            failure={failure}
            disabled={isRunning}
            money={money}
            day={day}
            locale={locale}
          />
        )}
      </section>

      <footer className="smart-wizard__nav">
        <button type="button" className="smart-wizard__button" onClick={goBack} disabled={isRunning}>
          <LuArrowLeft aria-hidden="true" />
          <span>{t(step === 0 ? "common.cancel" : `${prefix}.back`)}</span>
        </button>

        {stepName === "review" ? (
          <button
            type="button"
            className="smart-wizard__button smart-wizard__button--primary"
            onClick={handleCreate}
            disabled={!accepted || isRunning || !selectedOption || failure?.kind === "unavailable"}
            aria-busy={isRunning || undefined}
          >
            <span>
              {t(
                isRunning
                  ? `${prefix}.creating`
                  : failure?.kind === "unknown"
                    ? `${prefix}.retryCreate`
                    : isExisting
                      ? `${prefix}.createExisting`
                      : `${prefix}.create`,
              )}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="smart-wizard__button smart-wizard__button--primary"
            onClick={handleContinue}
            // On the plan stage there must be something to choose.
            disabled={step === 1 && (previewView.loading || !previewView.data?.options?.some(isSelectableOption))}
          >
            <span>{t(`${prefix}.continue`)}</span>
            <LuArrowRight aria-hidden="true" />
          </button>
        )}
      </footer>

      <UnsavedChangesGuard when={isDirty} />
    </div>
  );
}
