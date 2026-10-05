import { useState } from "react";
import { LuChevronDown, LuShieldCheck, LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import AccountStep from "../AccountStep/AccountStep";
import NewOperation from "../NewOperation/NewOperation";
import ReceiptCapture from "../ReceiptCapture/ReceiptCapture";
import VoiceCaptureWorkflow from "../VoiceCapture/VoiceCaptureWorkflow";
import AiInputAllowance from "../AiInputAllowance/AiInputAllowance";
import useAiInputQuotas from "../../useAiInputQuotas.js";
import "./CaptureStep.css";

const METHODS = ["manual", "voice", "scan"];
const TYPES = ["expense", "income"];

export default function CaptureStep({ account, accounts, categories, onCaptureConfirmed,
  initialType, initialMethod = "manual", workspaceId, initialCaptureId,
  initialCaptureWorkspace, onSelectAccount, isLoadingOptions, optionsError,
  onRetryOptions, onRequireAccount, onReview, accountSelectorRef }) {
  const { t } = useTranslation();
  const quota = useAiInputQuotas();
  const [method, setMethod] = useState(() => METHODS.includes(initialMethod) ? initialMethod : "manual");
  const [manualType, setManualType] = useState(() => TYPES.includes(initialType) ? initialType : "expense");
  // Both existing AI workflows capture expenses only; they must never look like income entry.
  const type = method === "manual" ? manualType : "expense";
  const goManual = () => setMethod("manual");

  return (
    <section className="capture-step" aria-labelledby="capture-step-title">
      <div className="capture-card">
        <header className="capture-card__heading">
          <h2 id="capture-step-title"><LuPlus aria-hidden="true" />{t("dashboard.financialOperations.ui.newOperation")}</h2>
          <p>{t("dashboard.financialOperations.ui.entryHint")}</p>
        </header>
        <div className="capture-card__selectors">
          <div>
            <label className="capture-selector">
              <span>{t("dashboard.transactions.fields.type")}</span>
              <div className="capture-selector__control">
                <select value={type} disabled={method !== "manual"}
                  aria-describedby={method !== "manual" ? "operation-smart-type-hint" : undefined}
                  onChange={(event) => setManualType(event.target.value)}>
                  {TYPES.map((item) => <option key={item} value={item}>{t(`dashboard.financialOperations.newOperation.${item}`)}</option>)}
                </select>
                <LuChevronDown aria-hidden="true" />
              </div>
            </label>
            {method !== "manual" && <p id="operation-smart-type-hint" className="capture-selector__hint">
              {t("dashboard.financialOperations.ui.expensesOnly")}
            </p>}
          </div>
          <AccountStep accounts={accounts} selectedAccountId={account ? String(account.id) : ""}
            onSelect={onSelectAccount} isLoading={isLoadingOptions} error={optionsError}
            onRetry={onRetryOptions} selectorRef={accountSelectorRef} />
          <label className="capture-selector">
            <span>{t("dashboard.financialOperations.review.method")}</span>
            <div className="capture-selector__control">
              <select id="operation-method" value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((item) => <option key={item} value={item}>{t(`dashboard.financialOperations.methods.${item}.label`)}</option>)}
              </select>
              <LuChevronDown aria-hidden="true" />
            </div>
          </label>
        </div>
        {method !== "manual" && <AiInputAllowance compact quota={quota}
          channels={[method === "voice" ? "voice" : "receipt"]} onSwitchToManual={goManual} />}
        <div className="capture-card__panel" key={method}>
          {method === "voice" && <VoiceCaptureWorkflow
            key={`${account?.id ?? "no-account"}:${workspaceId}`}
            workspaceId={workspaceId} initialCaptureId={initialCaptureId}
            initialCaptureWorkspace={initialCaptureWorkspace} account={account}
            accounts={accounts} categories={categories} quota={quota}
            onConfirmed={onCaptureConfirmed} isLoadingOptions={isLoadingOptions}
            optionsError={optionsError} onRetryOptions={onRetryOptions}
            onRequireAccount={onRequireAccount} onSwitchToManual={goManual} />}
          {method === "scan" && <ReceiptCapture key={account?.id ?? "no-account"}
            account={account} onRequireAccount={onRequireAccount} quota={quota} onSwitchToManual={goManual} />}
          {method === "manual" && <NewOperation accounts={accounts} account={account}
            categories={categories} onSelectAccount={onSelectAccount}
            type={type} onTypeChange={setManualType}
            isLoadingOptions={isLoadingOptions} optionsError={optionsError}
            onRetryOptions={onRetryOptions} onRequireAccount={onRequireAccount} onReview={onReview} />}
        </div>
        <p className="capture-card__secure"><LuShieldCheck aria-hidden="true" />
          <span>{t("dashboard.financialOperations.captureStep.secure")}</span>
        </p>
      </div>
    </section>
  );
}
