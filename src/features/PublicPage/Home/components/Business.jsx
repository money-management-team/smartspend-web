import { ArrowUpRight, ChartPie, LockKeyhole, Users } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { Brand, ButtonIcon, Heading } from "./Shared";

const CONCEPT = [
  { key: "workspaces", Icon: Users },
  { key: "roles", Icon: LockKeyhole },
  { key: "shared", Icon: ChartPie },
];

/* The business extension is not available yet; the section says so in every place it appears. */
export default function Business({ onOpen }) {
  const { t } = useLanding();
  return <section id={HOME_SECTIONS.BUSINESS} className="section section-business" aria-labelledby="business-title">
    <div className="container">
      <div className="business bezel bezel-night" data-reveal>
        <div className="bezel-core business-core">
          <div className="business-copy">
            <span className="status-pill"><i aria-hidden="true" />{t("business.status")}</span>
            <Heading id="business-title" title={t("business.title")} accent={t("business.accent")} />
            <p>{t("business.text")}</p>
            <button className="btn btn-light business-button" onClick={onOpen}><span>{t("business.explore")}</span><ButtonIcon><ArrowUpRight size={15} className="flip-rtl" /></ButtonIcon></button>
          </div>
          <div className="business-concept" aria-label={t("business.conceptLabel")} role="group">
            <div className="business-concept-head"><Brand size="sm" /><span>{t("business.conceptTag")}</span></div>
            <ul>{CONCEPT.map(({ key, Icon }) => <li key={key}>
              <span className="business-icon"><Icon size={18} /></span>
              <div><strong>{t(`business.items.${key}.title`)}</strong><p>{t(`business.items.${key}.text`)}</p></div>
            </li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
