import { useEffect, useState } from "react";
import { CircleCheck, X } from "lucide-react";

// Rules from the previous home stylesheet that the navbar, footer and other public pages still use.
// Imported first so they keep their place in the single CSS bundle.
import "./publicShared.css";
import "./styles/landing.css";

import Business from "./components/Business";
import Capture from "./components/Capture";
import { FinalCTA, LandingFooter } from "./components/Closing";
import ExpenseDialog from "./components/ExpenseDialog";
import FAQ from "./components/FAQ";
import Features from "./components/Features";
import Hero from "./components/Hero";
import InfoDialog from "./components/InfoDialog";
import Insights from "./components/Insights";
import LandingHeader from "./components/LandingHeader";
import ProductDemo from "./components/ProductDemo";
import Ribbon from "./components/Ribbon";
import { SectionLink } from "./components/Shared";
import Trust from "./components/Trust";
import { HOME_SECTIONS } from "./homeAnchors";
import { useLanding } from "./landingContext";
import LandingProvider from "./LandingProvider";
import { useSpotlight } from "./useSpotlight";

/**
 * Narrative: what SmartSpend is (hero) → how it helps (demo, features)
 * → how it works (capture, assistant) → why to trust it (control, business roadmap)
 * → what to do next (FAQ, call to action).
 *
 * Expenses added in the demos live in this component's state only: no API
 * call, no real transaction, and they reset on reload.
 */
function LandingPage() {
  const { t } = useLanding();
  useSpotlight();
  const [entries, setEntries] = useState([]);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const [notification, setNotification] = useState(0);
  useEffect(() => {
    if (!notification) return undefined;
    const timer = window.setTimeout(() => setNotification(0), 5000);
    return () => window.clearTimeout(timer);
  }, [notification]);
  const addExpense = (expense) => {
    setEntries((current) => [...current, { ...expense, id: Date.now() + Math.random() }]);
    setNotification((value) => value + 1);
  };

  return <>
    <a className="skip-link" href={`#${HOME_SECTIONS.MAIN}`}>{t("skipLink")}</a>
    <LandingHeader />
    <main id={HOME_SECTIONS.MAIN}>
      <Hero />
      <Ribbon />
      <ProductDemo entries={entries} onExpense={() => setExpenseOpen(true)} />
      <Features />
      <Capture onAdd={addExpense} />
      <Insights entries={entries} />
      <Trust onOpen={() => setInfo("control")} />
      <Business onOpen={() => setInfo("business")} />
      <FAQ />
      <FinalCTA />
    </main>
    <LandingFooter onOpen={setInfo} />
    <ExpenseDialog open={expenseOpen} onClose={() => setExpenseOpen(false)} onAdd={addExpense} />
    <InfoDialog info={info} onClose={() => setInfo(null)} />
    {notification > 0 && <div className="toast" role="status" key={notification}>
      <CircleCheck size={17} />
      <span>{t("toast.added")}</span>
      <SectionLink section={HOME_SECTIONS.EXPERIENCE} onClick={() => setNotification(0)}>{t("toast.view")}</SectionLink>
      <button className="icon-btn" onClick={() => setNotification(0)} aria-label={t("toast.dismiss")}><X size={15} /></button>
    </div>}
  </>;
}

export default function Home() {
  return <LandingProvider><LandingPage /></LandingProvider>;
}
