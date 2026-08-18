import "./Shared.css";

export default function ProgressBar({ value = 0, danger = false }) {
  const safeValue = Math.max(0, Math.min(Number(value) || 0, 100));

  return (
    <div
      className={`dashboard-progress-bar ${
        danger ? "dashboard-progress-bar--danger" : ""
      }`}
      aria-label={`${safeValue}%`}
    >
      <span style={{ width: `${safeValue}%` }} />
    </div>
  );
}
