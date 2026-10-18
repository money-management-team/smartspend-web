import { ArrowUpRight, Languages, ReceiptText, ShieldCheck } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { Eyebrow, Heading } from "./Shared";

const POINTS = [
  { key: "review", Icon: ShieldCheck },
  { key: "records", Icon: ReceiptText },
  { key: "language", Icon: Languages },
];

export default function Trust({ onOpen }) {
  const { t } = useLanding();
  return <section id={HOME_SECTIONS.TRUST} className="section section-trust" aria-labelledby="trust-title">
    <div className="container trust">
      <div className="trust-copy" data-reveal>
        <Eyebrow>{t("trust.eyebrow")}</Eyebrow>
        <Heading id="trust-title" title={t("trust.title")} accent={t("trust.accent")} />
        <button className="text-link" onClick={onOpen}>{t("trust.link")}<ArrowUpRight size={15} className="flip-rtl" /></button>
      </div>
      <ul className="trust-list">{POINTS.map(({ key, Icon }) => <li key={key} data-reveal>
        <span className="trust-icon"><Icon size={20} /></span>
        <div><h3>{t(`trust.points.${key}.title`)}</h3><p>{t(`trust.points.${key}.text`)}</p></div>
      </li>)}</ul>
    </div>
  </section>;
}
