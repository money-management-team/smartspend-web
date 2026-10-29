import { useLanding } from "../landingContext";

const ITEMS = ["accounts", "incomeSpending", "budgets", "goals", "bills", "debts", "recurring", "reports"];

/**
 * Editorial capability ribbon between the hero and the demo. It names the
 * breadth of SmartSpend in one glance; the Features section carries the detail,
 * so the band is decorative for assistive technology.
 */
export default function Ribbon() {
  const { t } = useLanding();
  const run = <div className="ribbon-run">{ITEMS.map((key, index) => <span className="ribbon-item" key={key} data-tone={index % 2 ? "soft" : undefined}>
    {t(`ribbon.${key}`)}<i className="ribbon-dots"><b /><b /></i>
  </span>)}</div>;
  return <div className="ribbon" aria-hidden="true">
    <div className="ribbon-track">{run}{run}</div>
  </div>;
}
