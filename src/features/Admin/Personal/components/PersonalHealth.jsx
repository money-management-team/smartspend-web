import { useTranslation } from "react-i18next";
import { FiCreditCard, FiFileText, FiClock, FiPercent, FiZap, FiActivity } from "react-icons/fi";

const modules = [
  { key: "accounts", rate: "99.3%", icon: FiCreditCard, color: "blue" },
  { key: "income", rate: "98.9%", icon: FiFileText, color: "green" },
  { key: "recurring", rate: "97.8%", icon: FiClock, color: "blue" },
  { key: "budgets", rate: "96.4%", icon: FiPercent, color: "orange" },
  { key: "documents", rate: "94.8%", icon: FiZap, color: "purple", warning: true },
  { key: "reportModule", rate: "94.2%", icon: FiFileText, color: "blue" },
];

export default function PersonalHealth({ reportsOnly = false }) {
  const { t } = useTranslation();
  const p = key => t(`admin.personalPage.${key}`);
  const visible = reportsOnly ? modules.filter(module => module.key === "reportModule") : modules;
  return <section className="admin-panel admin-personal-health" aria-labelledby="admin-personal-health-title">
    <div className="admin-panel__header"><div><h2 id="admin-personal-health-title">{p(reportsOnly ? "reportsTitle" : "healthTitle")}</h2><p>{p(reportsOnly ? "reportsHint" : "healthHint")}</p></div></div>
    <div className={`admin-personal-health__grid${reportsOnly ? " admin-personal-health__grid--single" : ""}`}>
      {visible.map(({ key, rate, icon: Icon, color, warning }) => <article className="admin-personal-health__module" key={key}>
        <span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon /></span>
        <div className="admin-personal-health__copy"><h3>{p(key)} <span>{p(`${key}Hint`)}</span></h3></div>
        <div className="admin-personal-health__status"><strong><bdi>{rate}</bdi></strong><span className={`admin-pill${warning ? " admin-pill--warning" : ""}`}>{warning ? p("warning") : t("admin.operational")}</span></div>
      </article>)}
    </div>
    {reportsOnly && <div className="admin-personal-health__privacy"><FiActivity /><span>{p("privacyHint")}</span></div>}
  </section>;
}
