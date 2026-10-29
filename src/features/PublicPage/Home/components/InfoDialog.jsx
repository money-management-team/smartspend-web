import { ChartPie, LockKeyhole, Users } from "lucide-react";

import { useLanding } from "../landingContext";
import { Brand, Dialog, PlatformLink, SampleBadge } from "./Shared";

const BUSINESS_ITEMS = [
  { key: "workspaces", Icon: Users },
  { key: "roles", Icon: LockKeyhole },
  { key: "shared", Icon: ChartPie },
];
const CONTROL_POINTS = ["review", "records", "demo"];

/** `info` is "business", "control", "about" or null (closed). */
export default function InfoDialog({ info, onClose }) {
  const { t } = useLanding();
  const title = info === "business" ? t("info.businessTitle")
    : info === "control" ? t("info.controlTitle")
    : t("info.aboutTitle");
  return <Dialog open={info !== null} onClose={onClose} title={title}>
    {info === "business" && <>
      <SampleBadge className="dialog-badge">{t("info.inDevelopment")}</SampleBadge>
      <p className="dialog-description">{t("info.businessText")}</p>
      <ul className="dialog-list">{BUSINESS_ITEMS.map(({ key, Icon }) => <li key={key}><span className="tx-icon"><Icon size={17} /></span><div><strong>{t(`info.businessItems.${key}.title`)}</strong><p>{t(`info.businessItems.${key}.text`)}</p></div></li>)}</ul>
    </>}
    {info === "control" && <>
      <p className="dialog-description">{t("info.controlText")}</p>
      <ul className="dialog-bullets">
        {CONTROL_POINTS.map((key) => <li key={key}>{t(`info.controlPoints.${key}`)}</li>)}
      </ul>
    </>}
    {info === "about" && <>
      <span className="dialog-brand"><Brand size="md" /></span>
      <p className="dialog-description">{t("info.aboutText")}</p>
      <PlatformLink className="dialog-cta" onClick={onClose} />
    </>}
  </Dialog>;
}
