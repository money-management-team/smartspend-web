import { Link } from "react-router-dom";

import Chevron from "../ui/Chevron.jsx";

/*
 * The answer to a sent write, as the server gave it; an unknown one claims
 * nothing either way. Shared by forms/DraftForm.jsx (a draft's review step)
 * and assist/useCaptureUpload.js's screens (a receipt or voice upload): both
 * go through forms/useWorkflowSubmit.js's classifyWriteOutcome() and land on
 * the same four non-"confirmed" outcomes, so they share this one rendering.
 * A caller that wants to show "confirmed" writes its own copy: this project's
 * wording for it ("Recorded") names a financial posting, which an upload by
 * itself never is.
 */
export default function WriteOutcome({ outcome, outcomeRef, backTo, t }) {
  const kind = outcome.phase;
  const serverMessage = kind === "rejected" && typeof outcome.error?.message === "string" ? outcome.error.message.slice(0, 300) : null;
  const fieldMessages = kind === "rejected" && outcome.error?.errors && typeof outcome.error.errors === "object"
    ? Object.values(outcome.error.errors).flat().filter((item) => typeof item === "string").slice(0, 6).map((item) => item.slice(0, 300))
    : [];
  const bodyKey = kind === "rejected" ? (outcome.code === "RATE_LIMITED" ? "rateLimited" : outcome.code === "NO_WORKSPACE" ? "noWorkspace" : outcome.code === "WRITE_CLOSED" ? "closed" : "rejectedBody") : `${kind}Body`;
  const refused = kind === "rejected";

  return (
    <div
      className={refused ? "sm-card sm-error" : "sm-card"}
      role={kind === "rejected" ? "alert" : "status"}
      tabIndex={-1}
      ref={outcomeRef}
      data-sm-outcome={kind}
      data-sm-code={outcome.code ?? undefined}
    >
      <h2 className="sm-card-title">{t(`forms.outcome.${kind}Title`)}</h2>
      <p className="sm-text">{t(`forms.outcome.${bodyKey}`)}</p>
      {serverMessage && <p className="sm-text sm-muted" dir="auto">{serverMessage}</p>}
      {fieldMessages.length > 0 && (
        <ul className="sm-cat-summary-list">
          {fieldMessages.map((message) => <li key={message} dir="auto">{message}</li>)}
        </ul>
      )}
      {kind !== "rejected" && (
        <Link className="sm-link-row" to={backTo} data-sm-action="after-write">
          <span>{t("forms.outcome.back")}</span>
          <Chevron />
        </Link>
      )}
    </div>
  );
}
