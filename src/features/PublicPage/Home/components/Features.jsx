import { ArrowLeftRight, CalendarClock, ChartLine, Landmark, Layers, Target } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { SectionIntro } from "./Shared";

/* Each card carries a small, purely decorative sketch of the idea. No figures are implied. */
function BudgetSketch() {
  return <div className="sketch sketch-budget" aria-hidden="true">
    {[78, 54, 36, 62].map((width, index) => <span key={index}><i style={{ "--w": `${width}%` }} /></span>)}
  </div>;
}
function GoalSketch() {
  return <div className="sketch sketch-goal" aria-hidden="true">
    <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" /><circle cx="60" cy="60" r="48" className="arc" /><circle cx="60" cy="60" r="30" className="inner" /></svg>
  </div>;
}
function AccountSketch() {
  return <div className="sketch sketch-accounts" aria-hidden="true"><span /><span /><span /></div>;
}
function CommitmentSketch() {
  return <div className="sketch sketch-calendar" aria-hidden="true">
    {Array.from({ length: 21 }, (_, index) => <i key={index} className={[3, 9, 15, 18].includes(index) ? "is-due" : index === 11 ? "is-today" : undefined} />)}
  </div>;
}
function ReportSketch() {
  return <div className="sketch sketch-report" aria-hidden="true">
    <svg viewBox="0 0 320 110" preserveAspectRatio="none">
      <path className="area" d="M0 88 C40 80 60 60 96 64 S150 86 186 58 S250 22 320 30 L320 110 L0 110 Z" />
      <path className="line" pathLength={1} d="M0 88 C40 80 60 60 96 64 S150 86 186 58 S250 22 320 30" />
      <path className="line line-ghost" d="M0 96 C50 92 80 84 120 86 S190 74 230 70 S290 60 320 62" />
    </svg>
  </div>;
}
function TransferSketch() {
  return <div className="sketch sketch-transfer" aria-hidden="true"><span /><i /><span /></div>;
}

const ITEMS = [
  { key: "budgets", Icon: Layers, Sketch: BudgetSketch },
  { key: "goals", Icon: Target, Sketch: GoalSketch },
  { key: "accounts", Icon: Landmark, Sketch: AccountSketch },
  { key: "commitments", Icon: CalendarClock, Sketch: CommitmentSketch },
  { key: "reports", Icon: ChartLine, Sketch: ReportSketch },
  { key: "transfers", Icon: ArrowLeftRight, Sketch: TransferSketch },
];

export default function Features() {
  const { t } = useLanding();
  return <section id={HOME_SECTIONS.FEATURES} className="section section-features" aria-labelledby="features-title">
    <div className="container">
      <SectionIntro id="features-title" align="start"
        eyebrow={t("features.eyebrow")}
        title={t("features.title")}
        accent={t("features.accent")}
        description={t("features.description")} />
      <div className="bento">
        {ITEMS.map(({ key, Icon, Sketch }, index) => <article className={`bezel bento-item bento-${key}`} key={key} data-reveal style={{ "--reveal-delay": `${(index % 2) * 90}ms` }}>
          <div className="bezel-core bento-core">
            <Sketch />
            <div className="bento-copy">
              <span className="bento-icon"><Icon size={19} /></span>
              <h3>{t(`features.items.${key}.title`)}</h3>
              <p>{t(`features.items.${key}.text`)}</p>
            </div>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
