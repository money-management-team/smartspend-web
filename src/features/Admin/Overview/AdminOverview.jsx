import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PATH } from "../../../routes/Path";
import { FiRefreshCw, FiDownload, FiCreditCard, FiLifeBuoy, FiShield, FiUsers, FiBriefcase, FiDollarSign, FiAlertCircle, FiArrowUp, FiArrowUpRight } from "react-icons/fi";
import AdminShell from "../components/AdminShell";
import AdminDialog from "../components/AdminDialog";
import AdminGrowthChart from "../components/AdminGrowthChart";
import "../admin.css";

const metrics = [
  { label: "personalUsers", value: "18,492", note: "userGrowth", icon: FiUsers, color: "blue" },
  { label: "workspaces", value: "326", note: "activeWorkspaces", icon: FiBriefcase, color: "green" },
  { label: "revenue", value: "$72.2K", note: "revenueGrowth", icon: FiDollarSign, color: "purple" },
  { label: "followUp", value: "13", note: "followUpHint", icon: FiAlertCircle, color: "orange" },
];
const priorities = [
  { title: "payments", hint: "paymentsHint", detail: "paymentDetail", icon: FiCreditCard, color: "red" },
  { title: "tickets", hint: "ticketsHint", detail: "ticketDetail", icon: FiLifeBuoy, color: "orange" },
  { title: "alerts", hint: "alertsHint", detail: "securityDetail", icon: FiShield, color: "red" },
];
const services = [
  { name: "coreApi", latency: "118 ms", uptime: "99.99%" },
  { name: "database", latency: "12 ms", uptime: "99.99%" },
  { name: "queue", latency: "2.4 s", uptime: "99.91%", degraded: true },
  { name: "aiProvider", latency: "1.8 s", uptime: "99.95%" },
  { name: "gateway", latency: "480 ms", uptime: "99.98%" },
];

export default function AdminOverview() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState(null);
  const openDetail = (title, body) => setDetail({ title, body });
  function refresh() {
    setMessage({ key: "refreshed", time: Date.now() });
  }
  function exportSummary() {
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [[t("admin.metric"), t("admin.value")], [t("admin.demoSource"), t("admin.demo")], ...metrics.map(metric => [t(`admin.${metric.label}`), metric.value])];
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `smartspend-admin-demo-${i18n.language}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ key: "exported" });
  }

  return <AdminShell openDetail={openDetail}>
    <div className="admin-preview-note">{t("admin.preview")}</div>
    <div className="admin-page-heading">
      <div><div className="admin-eyebrow">{t("admin.overview")}</div><h1>{t("admin.title")}</h1><p>{t("admin.subtitle")}</p></div>
      <div className="admin-page-heading__actions"><button className="admin-button" onClick={refresh}><FiRefreshCw />{t("admin.refresh")}</button><button className="admin-button admin-button--primary" onClick={exportSummary}><FiDownload />{t("admin.export")}</button></div>
    </div>
    <div className="admin-live" role="status" aria-live="polite">{message && t(`admin.${message.key}`, {
      time: message.time ? new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(message.time) : undefined,
    })}</div>
    <section className="admin-panel admin-priorities" aria-labelledby="admin-priority-title">
      <div className="admin-panel__header"><div><h2 id="admin-priority-title">{t("admin.priority")}</h2><p>{t("admin.priorityHint")}</p></div><span className="admin-pill admin-pill--warning">{t("admin.itemCount")}</span></div>
      <div className="admin-priority-grid">{priorities.map(({ title, hint, detail: body, icon: Icon, color }) => <button className="admin-priority" key={title} onClick={() => openDetail(title, body)}><span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon /></span><span><strong>{t(`admin.${title}`)}</strong><small><bdi>{t(`admin.${hint}`)}</bdi></small></span><FiArrowUpRight className="admin-link-arrow" /></button>)}</div>
      <div className="admin-privacy"><FiShield /><div><strong>{t("admin.privacy")}</strong><p>{t("admin.privacyHint")}</p></div></div>
    </section>
    <section className="admin-metrics" aria-label={t("admin.overview")}>
      {metrics.map(({ label, value, note, icon: Icon, color }, index) => <article className="admin-panel admin-metric" key={label}><span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon /></span><div><h2>{t(`admin.${label}`)}</h2><strong className="admin-metric__value"><bdi>{value}</bdi></strong><p>{index < 3 && <FiArrowUp />}<bdi>{t(`admin.${note}`)}</bdi></p></div></article>)}
    </section>
    <section className="admin-products" aria-label={t("admin.products")}>
      {[{ key: "personal", icon: FiUsers, color: "blue", stats: [["12.8K", "active30"], ["98.9%", "recording"], ["94.2%", "reports"]] }, { key: "business", icon: FiBriefcase, color: "purple", stats: [["294", "active"], ["87%", "readiness"], ["23", "control"]] }].map(({ key, icon: Icon, color, stats }) => <button className="admin-panel admin-product" key={key} onClick={() => key === "personal" ? navigate(PATH.ADMIN_PERSONAL) : navigate(PATH.ADMIN_BUSINESS)}>
        <span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon /></span>
        <div className="admin-product__body"><div className={`admin-eyebrow admin-text--${color}`}>{t(`admin.${key}`)}</div><h2>{t(`admin.${key}Title`)}</h2><p>{t(`admin.${key}Hint`)}</p><div className="admin-product__stats">{stats.map(([value, label]) => <div key={label}><strong><bdi>{value}</bdi></strong><span>{t(`admin.${label}`)}</span></div>)}</div></div><FiArrowUpRight className="admin-product__arrow" />
      </button>)}
    </section>
    <section className="admin-panel admin-growth" aria-labelledby="admin-growth-title"><div className="admin-panel__header"><div><h2 id="admin-growth-title">{t("admin.growth")}</h2><p>{t("admin.growthHint")}</p></div><button className="admin-text-link" onClick={() => openDetail("subscriptions", "subscriptionsText")}>{t("admin.subscriptions")}<FiArrowUpRight /></button></div><AdminGrowthChart /></section>
    <section className="admin-panel admin-services" aria-labelledby="admin-services-title"><div className="admin-panel__header"><div><h2 id="admin-services-title">{t("admin.status")}</h2><p>{t("admin.statusHint")}</p></div></div><div className="admin-service-grid">{services.map(service => <div className="admin-service" key={service.name}><i className={`admin-dot${service.degraded ? " admin-dot--warning" : ""}`} /><div><strong>{t(`admin.${service.name}`)}</strong><small><bdi>{service.latency} · {service.uptime}</bdi></small></div><span className={`admin-pill${service.degraded ? " admin-pill--warning" : ""}`}>{t(service.degraded ? "admin.degraded" : "admin.operational")}</span></div>)}</div></section>
    <AdminDialog detail={detail} onClose={() => setDetail(null)} />
  </AdminShell>;
}
