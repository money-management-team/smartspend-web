import { Plus } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { SectionIntro } from "./Shared";

const QUESTIONS = ["what", "bank", "record", "accounts", "business", "languages"];

export default function FAQ() {
  const { t } = useLanding();
  return <section id={HOME_SECTIONS.FAQ} className="section section-faq" aria-labelledby="faq-title">
    <div className="container faq">
      <SectionIntro id="faq-title" align="start"
        eyebrow={t("faq.eyebrow")}
        title={t("faq.title")}
        accent={t("faq.accent")} />
      <div data-reveal>{QUESTIONS.map((key, index) => <details key={key} className="faq-item" name="smartspend-faq">
        <summary><span className="faq-index num" dir="ltr">0{index + 1}</span><span className="faq-q">{t(`faq.items.${key}.question`)}</span><span className="faq-toggle" aria-hidden="true"><Plus size={16} /></span></summary>
        <p>{t(`faq.items.${key}.answer`)}</p>
      </details>)}</div>
    </div>
  </section>;
}
