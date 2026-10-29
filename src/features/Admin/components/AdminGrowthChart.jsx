import { useId } from "react";
import { useTranslation } from "react-i18next";

export default function AdminGrowthChart() {
  const { t } = useTranslation();
  const gradientId = useId();
  const months = t("admin.months", { returnObjects: true });
  return <div className="admin-chart" role="img" aria-label={t("admin.chartLabel")}>
    <div className="admin-chart__axis" aria-hidden="true">{["20K", "15K", "10K", "5K", "0"].map(value => <span key={value}>{value}</span>)}</div>
    <div className="admin-chart__plot" aria-hidden="true">
      <svg viewBox="0 0 1000 240" preserveAspectRatio="none">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--admin-accent)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--admin-accent)" stopOpacity=".015" /></linearGradient></defs>
        {[0, 60, 120, 180, 240].map(y => <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="var(--admin-border)" strokeDasharray="3 3" />)}
        <path d="M0 82 L200 70 L400 55 L600 43 L800 28 L1000 18 L1000 240 L0 240 Z" fill={`url(#${gradientId})`} />
        <path d="M0 82 L200 70 L400 55 L600 43 L800 28 L1000 18" fill="none" stroke="var(--admin-accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="admin-chart__months">{months.map(month => <span key={month}>{month}</span>)}</div>
    </div>
  </div>;
}
