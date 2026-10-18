import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Keyboard, Mic, ScanLine, ShoppingBasket, Wallet } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { money } from "../landingDemo";
import { onTabKey } from "../landingUi";
import { Bezel, ButtonIcon, Eyebrow, Heading, SampleBadge } from "./Shared";

/** Fixed, deterministic bar heights so the waveform never jumps between renders. */
const WAVE = Array.from({ length: 40 }, (_, i) => 0.22 + Math.abs(Math.sin(i * 1.7)) * (0.42 + Math.sin(i * 0.31) * 0.34));

/** Amount of each illustrative example, in dollars. */
const EXAMPLE_AMOUNTS = { voice: 45, receipt: 62.5, text: 28 };

const METHODS = [
  { id: "voice", Icon: Mic },
  { id: "receipt", Icon: ScanLine },
  { id: "text", Icon: Keyboard },
];
const STEPS = ["capture", "review", "update"];

export default function Capture({ onAdd }) {
  const { t, lang } = useLanding();
  const [method, setMethod] = useState("voice");
  const [review, setReview] = useState(false);
  const [text, setText] = useState("");
  const amount = EXAMPLE_AMOUNTS[method];
  const description = method === "text" && text.trim() ? text.trim() : t("capture.defaultDescription");
  const active = METHODS.findIndex((item) => item.id === method);
  const select = (id) => { setMethod(id); setReview(false); };
  const add = () => { onAdd({ amount, description, category: "food" }); setReview(false); };

  return <section id={HOME_SECTIONS.CAPTURE} className="section section-capture" aria-labelledby="capture-title">
    <div className="container split">
      <div className="split-copy" data-reveal>
        <Eyebrow>{t("capture.eyebrow")}</Eyebrow>
        <Heading id="capture-title" title={t("capture.title")} accent={t("capture.accent")} />
        <p className="lede">{t("capture.lede")}</p>
        <ol className="steps">{STEPS.map((step, index) => <li key={step}>
          <span className="step-index num" dir="ltr">0{index + 1}</span>
          <div><strong>{t(`capture.steps.${step}.title`)}</strong><p>{t(`capture.steps.${step}.text`)}</p></div>
        </li>)}</ol>
      </div>

      <Bezel className="capture" data-reveal style={{ "--reveal-delay": "120ms" }}>
        <div className="capture-head">
          <span className="capture-head-title">{t("capture.tryMethod")}</span>
          <SampleBadge>{t("capture.sample")}</SampleBadge>
        </div>
        <div className="segmented segmented-full" role="tablist" aria-label={t("capture.methodsLabel")} style={{ "--active": active, "--count": METHODS.length }}>
          <span className="segmented-thumb" aria-hidden="true" />
          {METHODS.map(({ id, Icon }, index) => <button key={id} id={`capture-tab-${id}`} role="tab" aria-selected={method === id} aria-controls="capture-panel"
            tabIndex={method === id ? 0 : -1} onClick={() => select(id)}
            onKeyDown={(event) => onTabKey(event, METHODS.map((item) => item.id), index, lang === "ar", select, "capture-tab-")}><Icon size={16} /><span>{t(`capture.methods.${id}`)}</span></button>)}
        </div>

        <div className="capture-stage" id="capture-panel" role="tabpanel" aria-labelledby={`capture-tab-${method}`} key={method}>
          {method === "voice" && <div className="voice">
            <div className="voice-meta"><span className="voice-dot" aria-hidden="true" /><span>{t("capture.transcript")}</span><span className="num" dir="ltr">0:04</span></div>
            <div className="waveform" aria-hidden="true">{WAVE.map((height, i) => <i key={i} style={{ "--h": height, "--i": i }} />)}</div>
            <blockquote>{t("capture.quote")}</blockquote>
          </div>}
          {method === "receipt" && <div className="receipt-wrap">
            <div className="sample-receipt" dir="ltr" lang="en">
              <span className="receipt-scan" aria-hidden="true" />
              <strong>THE DAILY MARKET</strong>
              <span className="receipt-sub">SAMPLE RECEIPT</span>
              <div><span>Groceries</span><span>$55.00</span></div>
              <div><span>Household items</span><span>$7.50</span></div>
              <div className="receipt-total"><strong>TOTAL</strong><strong>$62.50</strong></div>
              <span className="receipt-barcode" aria-hidden="true" />
            </div>
            <p>{t("capture.receiptNote")}</p>
          </div>}
          {method === "text" && <div className="text-capture">
            <label htmlFor="capture-description">{t("capture.textLabel")}</label>
            <input id="capture-description" value={text} onChange={(event) => { setText(event.target.value); setReview(false); }} placeholder={t("capture.textPlaceholder")} maxLength={80} autoComplete="off" />
            <div className="text-amount"><span>{t("capture.exampleAmount")}</span><strong className="num" dir="ltr">$28</strong></div>
          </div>}
        </div>

        {!review
          ? <button className="review-btn" onClick={() => setReview(true)}><span>{t("capture.review")}</span><ButtonIcon>{lang === "ar" ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</ButtonIcon></button>
          : <div className="capture-result" aria-live="polite">
            <div className="capture-result-label"><CircleCheck size={15} />{t("capture.ready")}</div>
            <div className="capture-result-row">
              <span className="tx-icon"><ShoppingBasket size={17} /></span>
              <span className="tx-text"><strong>{description}</strong><small>{t("categories.food")}</small></span>
              <strong className="num capture-result-amount" dir="ltr">${money(amount)}</strong>
            </div>
            <div className="capture-account"><Wallet size={14} /><span>{t("personalAccountUsd")}</span><Check size={14} /></div>
            <button className="btn btn-primary btn-block" onClick={add}><span>{t("capture.add")}</span><Check size={16} /></button>
          </div>}
        <p className="capture-note">{t("capture.note")}</p>
      </Bezel>
    </div>
  </section>;
}
