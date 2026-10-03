import { useState } from "react";
import {
  LuCamera,
  LuMic,
  LuPencil,
  LuShieldCheck,
  LuWalletCards,
} from "react-icons/lu";
import { useTranslation } from "react-i18next";

import NewOperation from "../NewOperation/NewOperation";
import ReceiptCapture from "../ReceiptCapture/ReceiptCapture";
import VoiceCaptureWorkflow from "../VoiceCapture/VoiceCaptureWorkflow";
import AiInputAllowance from "../AiInputAllowance/AiInputAllowance";
import useAiInputQuotas from "../../useAiInputQuotas.js";

import "./CaptureStep.css";

const METHODS = ["voice", "scan", "manual"];

const METHOD_ICONS = {
  voice: LuMic,
  scan: LuCamera,
  manual: LuPencil,
};

/*
 * Three capture methods: AI inputs create review drafts; explicit confirmation posts money.
 */
export default function CaptureStep({
  account,
  accounts,
  categories,
  onCaptureConfirmed,
  initialType,
  initialMethod = "voice",
  workspaceId,
  initialCaptureId,
  initialCaptureWorkspace,
  onSelectAccount,
  isLoadingOptions,
  optionsError,
  onRetryOptions,
  onRequireAccount,
  onReview,
}) {
  const { t } = useTranslation();
  const quota = useAiInputQuotas();
  const [method, setMethod] = useState(() =>
    METHODS.includes(initialMethod) ? initialMethod : "voice",
  );

  const goManual = () => setMethod("manual");

  return (
    <section className="capture-step" aria-labelledby="capture-step-title">
      <header className="step-heading">
        <span className="step-heading__number" aria-hidden="true">
          2
        </span>

        <div className="step-heading__copy">
          <h2 id="capture-step-title">
            {t("dashboard.financialOperations.captureStep.title")}
          </h2>
          <p>{t("dashboard.financialOperations.captureStep.description")}</p>
        </div>

        {account && (
          <span className="step-heading__pill">
            <LuWalletCards aria-hidden="true" />
            <span dir="auto">{account.name}</span>
            {account.last_four_digits && (
              <b dir="ltr">•••• {account.last_four_digits}</b>
            )}
          </span>
        )}
      </header>

      <div className="capture-card">
        <div
          className="capture-card__tabs"
          role="tablist"
          aria-label={t("dashboard.financialOperations.captureStep.title")}
        >
          {METHODS.map((item) => {
            const MethodIcon = METHOD_ICONS[item];
            const isActive = method === item;

            return (
              <button
                type="button"
                key={item}
                role="tab"
                id={`capture-tab-${item}`}
                aria-selected={isActive}
                aria-controls="capture-panel"
                className={
                  isActive
                    ? "capture-card__tab capture-card__tab--active"
                    : "capture-card__tab"
                }
                onClick={() => setMethod(item)}
              >
                <span className="capture-card__tab-icon" aria-hidden="true">
                  <MethodIcon />
                </span>

                <span className="capture-card__tab-copy">
                  <strong>
                    {t(`dashboard.financialOperations.methods.${item}.label`)}
                  </strong>
                  <small>
                    {t(`dashboard.financialOperations.methods.${item}.hint`)}
                  </small>
                </span>
              </button>
            );
          })}
        </div>

        <AiInputAllowance quota={quota} onSwitchToManual={goManual} />

        <div
          className="capture-card__panel"
          id="capture-panel"
          role="tabpanel"
          aria-labelledby={`capture-tab-${method}`}
          key={method}
        >
          {method === "voice" && (
            <VoiceCaptureWorkflow
              key={`${account?.id ?? "no-account"}:${workspaceId}`}
              workspaceId={workspaceId}
              initialCaptureId={initialCaptureId}
              initialCaptureWorkspace={initialCaptureWorkspace}
              account={account}
              accounts={accounts}
              categories={categories}
              quota={quota}
              onConfirmed={onCaptureConfirmed}
              isLoadingOptions={isLoadingOptions}
              optionsError={optionsError}
              onRetryOptions={onRetryOptions}
              onRequireAccount={onRequireAccount}
              onSwitchToManual={goManual}
            />
          )}

          {method === "scan" && (
            <ReceiptCapture
              key={account?.id ?? "no-account"}
              account={account}
              onRequireAccount={onRequireAccount}
              quota={quota}
              onSwitchToManual={goManual}
            />
          )}

          {method === "manual" && (
            <NewOperation
              accounts={accounts}
              onSelectAccount={onSelectAccount}
              account={account}
              categories={categories}
              initialType={initialType}
              isLoadingOptions={isLoadingOptions}
              optionsError={optionsError}
              onRetryOptions={onRetryOptions}
              onRequireAccount={onRequireAccount}
              onReview={onReview}
            />
          )}
        </div>

        <p className="capture-card__secure">
          <LuShieldCheck aria-hidden="true" />
          <span>{t("dashboard.financialOperations.captureStep.secure")}</span>
        </p>
      </div>
    </section>
  );
}
