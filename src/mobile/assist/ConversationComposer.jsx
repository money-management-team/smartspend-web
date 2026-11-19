import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowUp, LuLoader } from "react-icons/lu";

import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import WriteOutcome from "../forms/WriteOutcome.jsx";
import { useWorkflowSubmit } from "../forms/useWorkflowSubmit.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildMessagePair } from "../models/aiWrites.js";
import { aiConversationPath } from "../navigation.js";
import MobileSheet from "../shell/MobileSheet.jsx";

export const MESSAGE_MAX = 4000;

/*
 * The box a question is typed in, inside one conversation. Sending is POST /ai/conversations/{id}/messages (data/writeApi.js, behind the
 * write gate): ONE request per submission, with a client_request_id that is kept (forms/useWorkflowSubmit.js, data/pendingWriteStorage.js)
 * for exactly this conversation and this text, so the same question can never be answered twice.
 *
 *   sending     the request is on its way (the backend waits for the AI provider; up to 90 s). Nothing else can be sent.
 *   answered    the server stored the question and its reply: the box is emptied (a fresh submission starts) and the reply is read again.
 *   failed      the server answered but the assistant could not (a limit, or the provider): the attempt is stored as unanswered, the
 *               question stays in the box, and the next send is a NEW question (a new id).
 *   unknown     nothing came back: the question may or may not have been received. Nothing is resent by itself. "Try sending again"
 *               sends the same text with the same id, which SmartSpend recognises (it returns the stored answer or answers once).
 *
 * The text is kept in this component's state only; the key and a hash of the question are all that is stored.
 */
function Box({ conversationId, text, setText, onSent, onRetry }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const sent = useWorkflowSubmit();
  const guard = useLeaveGuard(text.trim() !== "" && !sent.sending);
  const length = [...text].length;
  const empty = text.trim() === "";
  const tooLong = length > MESSAGE_MAX;
  const stuck = sent.phase === "unknown" || sent.phase === "changed";

  const send = async () => {
    if (empty || tooLong || sent.sending || stuck) return;
    const content = text.trim();
    const outcome = await sent.submit({ operation: "ai.message", ids: { conversationId }, input: { content } });
    if (outcome?.kind !== "confirmed") return;
    const pair = buildMessagePair(outcome.data, content, conversationId);
    onSent(pair ?? { state: "unverified" });
  };

  return (
    <div className="sm-composer-box" data-sm-phase={sent.phase}>
      <label className="sm-label sm-composer-label" htmlFor={`${ids}-message`}>{t("assist.message")}</label>
      <textarea
        id={`${ids}-message`}
        className="sm-input sm-textarea"
        dir="auto"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={sent.sending || stuck}
        aria-describedby={`${ids}-count`}
        aria-invalid={tooLong ? "true" : undefined}
      />
      <div className="sm-composer-foot">
        <p id={`${ids}-count`} className={`sm-text sm-fine ${tooLong ? "sm-form-error" : "sm-muted"}`}>{t("assist.count", { count: length, max: MESSAGE_MAX })}</p>
        <button type="button" className="sm-button sm-button-small" onClick={send} disabled={empty || tooLong || sent.sending || stuck} aria-busy={sent.sending ? "true" : undefined} data-sm-action="send-message" data-sm-open="true">
          {sent.sending ? <LuLoader aria-hidden="true" /> : <LuArrowUp aria-hidden="true" />}
          <span>{t("assist.composerSend")}</span>
        </button>
      </div>
      {sent.sending && <p className="sm-text sm-muted" role="status" data-sm-note="asking">{t("assist.asking")}</p>}
      {sent.phase === "rejected" && <WriteOutcome outcome={sent} operation="ai.message" outcomeRef={null} backTo={aiConversationPath(conversationId)} t={t} />}
      {stuck && (
        <>
          <WriteOutcome outcome={sent} operation="ai.message" outcomeRef={null} backTo={aiConversationPath(conversationId)} t={t} />
          <p className="sm-text sm-muted sm-fine">{t("assist.tryAgainHint")}</p>
          <button type="button" className="sm-button sm-button-quiet" onClick={onRetry} data-sm-action="try-again">{t("assist.tryAgain")}</button>
        </>
      )}
      <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t("forms.discardTitle")}>
        <p className="sm-text">{t("assist.discardBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t("forms.keepEditing")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
        </div>
      </MobileSheet>
    </div>
  );
}

/* One conversation's composer and what the last send ended in. A fresh Box (a new submission) starts after an answer and on "Try sending again". */
export default function ConversationComposer({ conversationId, initialDraft = "" }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [text, setText] = useState(initialDraft);
  const [round, setRound] = useState(0);
  const [last, setLast] = useState(null);

  return (
    <section className="sm-card sm-composer" aria-labelledby="sm-ai-ask" data-sm-section="composer" data-sm-composer="conversation">
      <h2 id="sm-ai-ask" className="sm-card-title">{t("assist.askTitle")}</h2>
      {last && (
        <p className="sm-text sm-muted" role="status" data-sm-last={last.state} data-sm-replayed={last.replayed ? "true" : undefined}>
          {t(last.state === "failed" ? "assist.answerFailed" : last.state === "pending" ? "assist.answerPending" : last.state === "unverified" ? "assist.sentUnverified" : "assist.answered")}
          {last.replayed ? ` ${t("assist.replayedNote")}` : ""}
        </p>
      )}
      <Box
        key={round}
        conversationId={conversationId}
        text={text}
        setText={setText}
        onSent={(pair) => {
          // An answered question is done: the box is emptied. One that failed stays, to be asked again as a new question.
          if (pair.state !== "failed") setText("");
          setLast(pair);
          setRound((value) => value + 1);
        }}
        onRetry={() => setRound((value) => value + 1)}
      />
      <p className="sm-text sm-muted sm-fine">{t("assist.limitNote")}</p>
    </section>
  );
}
