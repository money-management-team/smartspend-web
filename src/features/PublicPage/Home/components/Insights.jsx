import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { DEMO, demoTotals, ltr, money, percent } from "../landingDemo";
import { Bezel, Logo, Progress, SampleBadge, SectionIntro } from "./Shared";

const QUESTIONS = ["spending", "goal", "month"];
/** The monthly amount the goal answer assumes. */
const GOAL_MONTHLY = 400;

export default function Insights({ entries }) {
  const { t, lang } = useLanding();
  const fig = (value) => (lang === "ar" ? ltr(value) : value);
  const [question, setQuestion] = useState(0);
  const totals = demoTotals(entries);
  const largest = [...totals.budgets].sort((a, b) => b.spent - a.spent)[0];
  const category = t(`categories.${largest.category}`);
  const share = percent(largest.spent, totals.expenses);
  const remaining = DEMO.goalTarget - DEMO.goalSaved;
  const questions = QUESTIONS.map((key) => t(`insights.questions.${key}`));
  const responses = [
    t("insights.responses.spending", { category, amount: fig(`$${money(largest.spent)}`), share: fig(`${share}%`) }),
    t("insights.responses.goal", { remaining: fig(`$${money(remaining)}`), monthly: fig(`$${GOAL_MONTHLY}`) }),
    t("insights.responses.month", {
      income: fig(`$${money(totals.income)}`),
      expenses: fig(`$${money(totals.expenses)}`),
      result: totals.net >= 0 ? t("insights.surplus") : t("insights.shortfall"),
      net: fig(`$${money(Math.abs(totals.net))}`),
    }),
  ];

  return <section id={HOME_SECTIONS.ASSISTANT} className="section section-assistant" aria-labelledby="insights-title">
    <div className="container">
      <SectionIntro id="insights-title"
        eyebrow={t("insights.eyebrow")}
        title={t("insights.title")}
        accent={t("insights.accent")}
        description={t("insights.description")} />

      <Bezel className="assistant" data-reveal>
        <div className="assistant-head">
          <span className="assistant-id"><span className="assistant-avatar"><Logo size={26} /></span><span><strong>{t("insights.name")}</strong><small>{t("insights.basis")}</small></span></span>
          <SampleBadge>{t("insights.sample")}</SampleBadge>
        </div>

        <div className="assistant-thread">
          <div className="chat-question" key={`q${question}`}><span className="bubble">{questions[question]}</span><span className="chat-user">{t("insights.you")}</span></div>
          <div className="chat-response" aria-live="polite" key={`a${question}`}>
            <span className="assistant-avatar assistant-avatar-sm" aria-hidden="true"><Logo size={18} /></span>
            <div className="chat-response-body">
              <span className="typing" aria-hidden="true"><i /><i /><i /></span>
              <p>{responses[question]}</p>
              {question === 0 && <div className="answer-card">
                <div className="answer-row"><span>{category}</span><strong className="num" dir="ltr">${money(largest.spent)}</strong></div>
                <Progress value={share} />
                <small>{t("insights.shareOfMonth", { share: fig(`${share}%`) })}</small>
              </div>}
              {question === 1 && <div className="answer-card answer-facts">
                <span><small>{t("insights.eachMonth")}</small><strong className="num" dir="ltr">${GOAL_MONTHLY}</strong></span>
                <span><small>{t("insights.leftToSave")}</small><strong className="num" dir="ltr">${money(remaining)}</strong></span>
              </div>}
              {question === 2 && <div className="answer-card answer-facts">
                <span><small>{t("insights.income")}</small><strong className="num" dir="ltr">${money(totals.income)}</strong></span>
                <span><small>{t("insights.spending")}</small><strong className="num" dir="ltr">${money(totals.expenses)}</strong></span>
              </div>}
              <span className="fine-print">{t("insights.fine")}</span>
            </div>
          </div>
        </div>

        <div className="assistant-prompts">
          <span className="assistant-prompts-label">{t("insights.tryQuestion")}</span>
          <div className="chips">{questions.map((label, index) => <button key={QUESTIONS[index]} onClick={() => setQuestion(index)} aria-pressed={question === index} className="chip">
            <span>{label}</span><ArrowUpRight size={14} className="flip-rtl" aria-hidden="true" />
          </button>)}</div>
        </div>
      </Bezel>
    </div>
  </section>;
}
