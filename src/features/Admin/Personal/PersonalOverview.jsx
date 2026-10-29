import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiGrid, FiUsers, FiHeart, FiFileText, FiDownload, FiActivity, FiCreditCard, FiAlertCircle, FiCheckCircle, FiShield, FiCopy, FiArrowUpRight } from "react-icons/fi";
import AdminShell from "../components/AdminShell";
import AdminDialog from "../components/AdminDialog";
import PersonalHealth from "./components/PersonalHealth";
import PersonalUsers from "./components/PersonalUsers";
import PersonalProcessing from "./components/PersonalProcessing";
import PersonalReportUsage from "./components/PersonalReportUsage";
import "../admin.css";
import "./personal.css";

const tabs = [{ key: "overview", icon: FiGrid }, { key: "users", icon: FiUsers }, { key: "health", icon: FiHeart }, { key: "reports", icon: FiFileText }];
const metrics = [
  { label: "total", value: "18,492", note: "totalNote", icon: FiUsers, color: "blue" },
  { label: "active30", value: "12,804", note: "activeNote", icon: FiActivity, color: "green" },
  { label: "paid", value: "5,312", note: "paidNote", icon: FiCreditCard, color: "purple" },
  { label: "review", value: "61", note: "reviewNote", icon: FiAlertCircle, color: "orange" },
];
const followUps = [
  { key: "verification", icon: FiCheckCircle, color: "orange" },
  { key: "jobs", icon: FiCopy, color: "red" },
  { key: "security", icon: FiShield, color: "orange" },
];

export default function PersonalOverview() {
  const { t, i18n } = useTranslation();
  const p = key => t(`admin.personalPage.${key}`);
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(item => item.key === params.get("tab")) ? params.get("tab") : "overview";
  const [detail, setDetail] = useState(null);
  const [exported, setExported] = useState(false);
  const openDetail = (title, body) => setDetail({ title, body });
  function selectTab(key) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (key === "overview") next.delete("tab");
      else next.set("tab", key);
      return next;
    }, { replace: true });
  }
  function handleTabKey(event, index) {
    let next;
    const rtl = i18n.dir() === "rtl";
    if (event.key === "ArrowRight") next = (index + (rtl ? 3 : 1)) % tabs.length;
    if (event.key === "ArrowLeft") next = (index + (rtl ? 1 : 3)) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next].key);
    document.getElementById(`admin-personal-tab-${tabs[next].key}`).focus();
  }
  function exportSummary() {
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [[p("exportMetric"), p("exportValue")], [t("admin.demoSource"), p("exportSource")], ...metrics.map(metric => [p(metric.label), metric.value])];
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `smartspend-personal-demo-${i18n.language}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  }

  return <AdminShell openDetail={openDetail}>
    <div className="admin-personal-page">
      <div className="admin-preview-note">{t("admin.preview")}</div>
      <div className="admin-page-heading admin-personal-heading"><div><div className="admin-eyebrow">{p("eyebrow")}</div><h1>{p("title")}</h1><p>{p("subtitle")}</p></div><button className="admin-button admin-button--primary" onClick={exportSummary}><FiDownload />{t("admin.export")}</button></div>
      <div className="admin-live" role="status" aria-live="polite">{exported && p("exportSuccess")}</div>
      <div className="admin-panel admin-personal-tabs" role="tablist" aria-label={p("tabsLabel")}>
        {tabs.map(({ key, icon: Icon }, index) => <button role="tab" id={`admin-personal-tab-${key}`} key={key} aria-selected={tab === key} aria-controls="admin-personal-panel" tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)} onKeyDown={event => handleTabKey(event, index)}><Icon />{p(key)}</button>)}
      </div>
      <div role="tabpanel" id="admin-personal-panel" aria-labelledby={`admin-personal-tab-${tab}`} tabIndex={0}>
        {tab === "overview" && <section className="admin-metrics admin-personal-metrics" aria-label={p("overview")}>
          {metrics.map(({ label, value, note, icon: Icon, color }) => <article className="admin-panel admin-metric" key={label}><span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon /></span><div><h2>{p(label)}</h2><strong className="admin-metric__value"><bdi>{value}</bdi></strong><p><bdi>{p(note)}</bdi></p></div></article>)}
        </section>}
        {tab === "overview" && <div className="admin-personal-panels">
          <PersonalHealth />
          <section className="admin-panel admin-personal-follow" aria-labelledby="admin-personal-follow-title"><div className="admin-panel__header"><div><h2 id="admin-personal-follow-title">{p("followTitle")}</h2><p>{p("followHint")}</p></div></div>
            <div className="admin-personal-follow__items">{followUps.map(({ key, icon: Icon, color }) => <button key={key} onClick={() => openDetail(`personalPage.${key}Title`, `personalPage.${key}Detail`)}><span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon /></span><span><strong>{p(`${key}Title`)}</strong><small>{p(`${key}Hint`)}</small></span><FiArrowUpRight className="admin-link-arrow" /></button>)}</div>
            <div className="admin-privacy"><FiShield /><div><strong>{p("privacy")}</strong><p>{p("privacyHint")}</p></div></div>
          </section>
        </div>}
        {(tab === "overview" || tab === "users") && <PersonalUsers fullList={tab === "users"} onViewAll={() => { selectTab("users"); document.getElementById("admin-personal-tab-users").focus(); }} />}
        {tab === "health" && <PersonalProcessing />}
        {tab === "reports" && <PersonalReportUsage />}
      </div>
      <AdminDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  </AdminShell>;
}
