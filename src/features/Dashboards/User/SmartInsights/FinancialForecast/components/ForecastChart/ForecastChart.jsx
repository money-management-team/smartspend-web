import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./ForecastChart.css";

export default function ForecastChart({ activeTab = "all" }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  const [viewMode, setViewMode] = useState("cumulative");
  const [activeTooltip, setActiveTooltip] = useState(true);

  // SVG dimensions
  const width = 860;
  const height = 340;
  const padding = { top: 30, right: 35, bottom: 45, left: 55 };

  return (
    <div className="forecast-chart-card">
      {/* Chart Header */}
      <div className="forecast-chart-card__header">
        <div className="forecast-chart-card__title-group">
          <h3 className="forecast-chart-card__title">
            {activeTab === "income"
              ? t("dashboard.smartInsights.detailedForecast.charts.incomeTitle")
              : activeTab === "expenses"
              ? t("dashboard.smartInsights.detailedForecast.charts.expensesTitle")
              : t("dashboard.smartInsights.detailedForecast.charts.allTitle")}
          </h3>
          <p className="forecast-chart-card__subtitle">
            {activeTab === "income"
              ? t("dashboard.smartInsights.detailedForecast.charts.incomeSubtitle")
              : activeTab === "expenses"
              ? t("dashboard.smartInsights.detailedForecast.charts.expensesSubtitle")
              : t("dashboard.smartInsights.detailedForecast.charts.allSubtitle")}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="forecast-chart-card__controls">
          <div className="forecast-chart-switcher">
            <button
              type="button"
              className={`forecast-chart-switcher__btn ${
                viewMode === "cumulative" ? "forecast-chart-switcher__btn--active" : ""
              }`}
              onClick={() => setViewMode("cumulative")}
            >
              {activeTab === "expenses"
                ? t("dashboard.smartInsights.detailedForecast.charts.viewExpenseCumul")
                : t("dashboard.smartInsights.detailedForecast.charts.viewCumulative")}
            </button>

            <button
              type="button"
              className={`forecast-chart-switcher__btn ${
                viewMode === "netDaily" ? "forecast-chart-switcher__btn--active" : ""
              }`}
              onClick={() => setViewMode("netDaily")}
            >
              {activeTab === "expenses"
                ? t("dashboard.smartInsights.detailedForecast.charts.viewDailyExpenses")
                : t("dashboard.smartInsights.detailedForecast.charts.viewNetDaily")}
            </button>

            <button
              type="button"
              className={`forecast-chart-switcher__btn ${
                viewMode === "compare" ? "forecast-chart-switcher__btn--active" : ""
              }`}
              onClick={() => setViewMode("compare")}
            >
              {activeTab === "expenses"
                ? t("dashboard.smartInsights.detailedForecast.charts.viewBudgetCeiling")
                : t("dashboard.smartInsights.detailedForecast.charts.viewAverageCompare")}
            </button>
          </div>
        </div>
      </div>

      {/* Chart Legend */}
      <div className="forecast-chart-legend">
        {activeTab === "all" && (
          <>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__dot forecast-chart-legend__dot--blue" />
              <span>{t("dashboard.smartInsights.detailedForecast.charts.legendExpectedBal")}</span>
            </span>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__pill-band" />
              <span>{t("dashboard.smartInsights.detailedForecast.charts.legendConfidence")}</span>
            </span>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__dot forecast-chart-legend__dot--green" />
              <span>{t("dashboard.smartInsights.detailedForecast.charts.legendMainIncome")}</span>
            </span>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__dot forecast-chart-legend__dot--red" />
              <span>{t("dashboard.smartInsights.detailedForecast.charts.legendMainExpense")}</span>
            </span>
          </>
        )}

        {activeTab === "income" && (
          <>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__dot forecast-chart-legend__dot--green" />
              <span>{isArabic ? "منحنى الدخل التراكمي" : "Cumulative Income Curve"}</span>
            </span>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__dot forecast-chart-legend__dot--blue" />
              <span>{isArabic ? "إيداع رئيسي مؤكد" : "Confirmed Main Deposit"}</span>
            </span>
          </>
        )}

        {activeTab === "expenses" && (
          <>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__dot forecast-chart-legend__dot--red" />
              <span>{isArabic ? "تراكم المصروفات المتوقعة" : "Cumulative Expected Expenses"}</span>
            </span>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__line--dashed-red" />
              <span>{t("dashboard.smartInsights.detailedForecast.charts.legendBudgetCap")}</span>
            </span>
            <span className="forecast-chart-legend__item">
              <span className="forecast-chart-legend__dot forecast-chart-legend__dot--amber" />
              <span>{isArabic ? "ذروة الالتزامات حرجة" : "Critical Obligations Peak"}</span>
            </span>
          </>
        )}
      </div>

      {/* SVG Canvas Container */}
      <div className="forecast-chart-canvas-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="forecast-chart-svg"
          preserveAspectRatio="xMidYMid meet"
          onClick={() => setActiveTooltip((prev) => !prev)}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="allConfidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>

            <linearGradient id="incomeAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
            </linearGradient>

            <linearGradient id="expensesAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines horizontal */}
          <g className="forecast-grid-lines">
            <line x1={padding.left} y1="60" x2={width - padding.right} y2="60" stroke="#f1f5f9" strokeWidth="1" />
            <line x1={padding.left} y1="120" x2={width - padding.right} y2="120" stroke="#f1f5f9" strokeWidth="1" />
            <line x1={padding.left} y1="180" x2={width - padding.right} y2="180" stroke="#f1f5f9" strokeWidth="1" />
            <line x1={padding.left} y1="240" x2={width - padding.right} y2="240" stroke="#f1f5f9" strokeWidth="1" />
            <line x1={padding.left} y1="295" x2={width - padding.right} y2="295" stroke="#e2e8f0" strokeWidth="1" />
          </g>

          {/* Y-Axis Value Labels */}
          <g className="forecast-axis-labels">
            <text x={padding.left - 10} y="64" textAnchor="end" className="forecast-axis-text">
              {isArabic ? "20,000 ر.س" : "20k SAR"}
            </text>
            <text x={padding.left - 10} y="124" textAnchor="end" className="forecast-axis-text">
              {isArabic ? "15,000 ر.س" : "15k SAR"}
            </text>
            <text x={padding.left - 10} y="184" textAnchor="end" className="forecast-axis-text">
              {isArabic ? "10,000 ر.س" : "10k SAR"}
            </text>
            <text x={padding.left - 10} y="244" textAnchor="end" className="forecast-axis-text">
              {isArabic ? "5,000 ر.س" : "5k SAR"}
            </text>
            <text x={padding.left - 10} y="299" textAnchor="end" className="forecast-axis-text">
              {isArabic ? "0 ر.س" : "0 SAR"}
            </text>
          </g>

          {/* Safety Threshold Line at 5,000 SAR (only for 'all' and 'expenses') */}
          {activeTab !== "income" && (
            <g className="forecast-safe-line">
              <line
                x1={padding.left}
                y1="240"
                x2={width - padding.right}
                y2="240"
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeOpacity="0.75"
              />
              <text
                x={width - padding.right - 10}
                y="256"
                textAnchor="end"
                className="forecast-safe-label"
              >
                {t("dashboard.smartInsights.detailedForecast.charts.safeLine")}
              </text>
            </g>
          )}

          {/* =========================================
              TAB: ALL FLOWS
          ========================================= */}
          {activeTab === "all" && (
            <g className="forecast-curve-all">
              {/* Shaded Confidence Area */}
              <path
                d="M 55,160 C 130,150 200,140 260,155 C 340,175 420,185 520,210 C 535,215 540,216 545,215 C 570,180 590,90 640,75 C 720,80 800,85 825,90 L 825,125 C 800,120 720,115 640,110 C 590,125 570,210 545,245 C 520,240 420,215 340,205 C 260,185 200,170 130,180 C 90,185 70,190 55,190 Z"
                fill="url(#allConfidenceGradient)"
              />

              {/* Main Line */}
              <path
                d="M 55,175 C 130,165 200,155 260,165 C 340,185 420,195 520,225 C 532,228 540,228 545,226 C 570,195 595,85 640,80 C 720,85 800,88 825,92"
                fill="none"
                stroke="#2563eb"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Aug 10 Investment Return Marker (+2,500) */}
              <circle cx="260" cy="165" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
              <g className="forecast-milestone-pill" transform="translate(260, 138)">
                <rect x="-90" y="-12" width="180" height="24" rx="12" fill="#ecfdf5" stroke="#10b981" strokeWidth="1" />
                <circle cx="-75" cy="0" r="3" fill="#10b981" />
                <text x="-65" y="4" className="forecast-milestone-text" fill="#065f46">
                  {t("dashboard.smartInsights.detailedForecast.charts.aug10Return")}
                </text>
              </g>

              {/* Aug 15 Auto Loan Installment Marker (-1,850) */}
              <circle cx="380" cy="190" r="4.5" fill="#e11d48" stroke="#ffffff" strokeWidth="2" />

              {/* Aug 22 Utilities Marker (-1,140) */}
              <circle cx="490" cy="215" r="4.5" fill="#e11d48" stroke="#ffffff" strokeWidth="2" />

              {/* Aug 24 Dip Marker (9,420 SAR) */}
              <line x1="545" y1="80" x2="545" y2="295" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx="545" cy="226" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2.5" />
              <circle cx="545" cy="226" r="10" fill="#f59e0b" fillOpacity="0.25" />

              {/* Interactive Tooltip over Aug 24 */}
              {activeTooltip && (
                <g className="forecast-chart-tooltip" transform="translate(100, 140)">
                  <rect
                    x="0"
                    y="0"
                    width="230"
                    height="100"
                    rx="8"
                    fill="#0f172a"
                    fillOpacity="0.95"
                    stroke="#334155"
                    strokeWidth="1"
                    filter="drop-shadow(0 4px 12px rgba(0,0,0,0.3))"
                  />
                  <text x="14" y="24" fill="#94a3b8" fontSize="10.5" fontWeight="600">
                    {t("dashboard.smartInsights.detailedForecast.charts.lowPointDate")}
                  </text>
                  <text x="216" y="24" textAnchor="end" fill="#f59e0b" fontSize="10" fontWeight="700">
                    {isArabic ? "أدنى نقطة" : "Low Point"}
                  </text>
                  <line x1="14" y1="33" x2="216" y2="33" stroke="#334155" strokeWidth="0.8" />
                  <text x="14" y="52" fill="#ffffff" fontSize="13" fontWeight="800">
                    {t("dashboard.smartInsights.detailedForecast.charts.lowPointBal")}
                  </text>
                  <text x="14" y="70" fill="#94a3b8" fontSize="10.5">
                    {t("dashboard.smartInsights.detailedForecast.charts.lowPointSpend")}
                  </text>
                  <rect x="14" y="77" width="202" height="17" rx="4" fill="rgba(16, 185, 129, 0.2)" />
                  <text x="20" y="89" fill="#34d399" fontSize="9.5" fontWeight="600">
                    {t("dashboard.smartInsights.detailedForecast.charts.lowPointBuffer")}
                  </text>
                </g>
              )}

              {/* Aug 27 Salary Surge (+16,000) */}
              <circle cx="640" cy="80" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
              <g className="forecast-milestone-pill" transform="translate(640, 52)">
                <rect x="-85" y="-12" width="170" height="24" rx="12" fill="#ecfdf5" stroke="#10b981" strokeWidth="1" />
                <text x="0" y="4" textAnchor="middle" className="forecast-milestone-text" fill="#065f46">
                  {t("dashboard.smartInsights.detailedForecast.charts.salaryJump")}
                </text>
              </g>
            </g>
          )}

          {/* =========================================
              TAB: INCOME ONLY
          ========================================= */}
          {activeTab === "income" && (
            <g className="forecast-curve-income">
              {/* Stepped Area */}
              <path
                d="M 55,295 L 260,295 L 260,265 L 640,265 L 640,80 L 825,80 L 825,295 Z"
                fill="url(#incomeAreaGradient)"
              />

              {/* Stepped Curve Line */}
              <path
                d="M 55,295 L 260,295 L 260,265 L 640,265 L 640,80 L 825,80"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Step 1: Aug 10 Sukuk Dividends */}
              <circle cx="260" cy="265" r="5.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
              <g className="forecast-milestone-pill" transform="translate(260, 235)">
                <rect x="-90" y="-12" width="180" height="24" rx="12" fill="#ecfdf5" stroke="#10b981" strokeWidth="1" />
                <text x="0" y="4" textAnchor="middle" className="forecast-milestone-text" fill="#065f46">
                  {t("dashboard.smartInsights.detailedForecast.charts.aug10Return")}
                </text>
              </g>

              {/* Step 2: Aug 27 Main Salary */}
              <circle cx="640" cy="80" r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
              <circle cx="640" cy="80" r="10" fill="#2563eb" fillOpacity="0.25" />

              {/* Tooltip on Aug 27 */}
              {activeTooltip && (
                <g className="forecast-chart-tooltip" transform="translate(510, 95)">
                  <rect
                    x="0"
                    y="0"
                    width="220"
                    height="85"
                    rx="8"
                    fill="#0f172a"
                    fillOpacity="0.95"
                    stroke="#334155"
                    strokeWidth="1"
                    filter="drop-shadow(0 4px 12px rgba(0,0,0,0.3))"
                  />
                  <text x="14" y="24" fill="#94a3b8" fontSize="10.5" fontWeight="600">
                    {isArabic ? "27 أغسطس 2024" : "27 August 2024"}
                  </text>
                  <text x="206" y="24" textAnchor="end" fill="#34d399" fontSize="10" fontWeight="700">
                    {isArabic ? "إيداع الراتب" : "Salary Deposit"}
                  </text>
                  <line x1="14" y1="33" x2="206" y2="33" stroke="#334155" strokeWidth="0.8" />
                  <text x="14" y="52" fill="#34d399" fontSize="14" fontWeight="800">
                    +16,000 {isArabic ? "ر.س" : "SAR"}
                  </text>
                  <text x="14" y="70" fill="#ffffff" fontSize="10.5">
                    {isArabic ? "إجمالي الدخل المتراكم: 18,500 ر.س" : "Total Cumulative: 18,500 SAR"}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* =========================================
              TAB: EXPENSES ONLY
          ========================================= */}
          {activeTab === "expenses" && (
            <g className="forecast-curve-expenses">
              {/* Budget Ceiling Dashed Line at 13,000 SAR (~y=140) */}
              <line
                x1={padding.left}
                y1="140"
                x2={width - padding.right}
                y2="140"
                stroke="#e11d48"
                strokeWidth="1.8"
                strokeDasharray="5 5"
              />
              <text x={padding.left + 10} y="132" fill="#e11d48" fontSize="10.5" fontWeight="700">
                {t("dashboard.smartInsights.detailedForecast.charts.legendBudgetCap")}
              </text>

              {/* Shaded Area Under Expense Curve */}
              <path
                d="M 55,295 C 150,290 200,270 260,265 C 340,250 420,230 480,210 C 520,195 560,165 600,158 C 700,150 780,148 825,145 L 825,295 Z"
                fill="url(#expensesAreaGradient)"
              />

              {/* Cumulative Expense Line */}
              <path
                d="M 55,295 C 150,290 200,270 260,265 C 340,250 420,230 480,210 C 520,195 560,165 600,158 C 700,150 780,148 825,145"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Milestone Aug 15 Auto Loan */}
              <circle cx="420" cy="230" r="5" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
              <g className="forecast-milestone-pill" transform="translate(420, 202)">
                <rect x="-85" y="-12" width="170" height="24" rx="12" fill="#fff1f2" stroke="#f43f5e" strokeWidth="1" />
                <text x="0" y="4" textAnchor="middle" className="forecast-milestone-text" fill="#9f1239">
                  {isArabic ? "15 أغسطس: قسط سيارة 1,850 ر.س" : "15 Aug: Auto Loan 1,850 SAR"}
                </text>
              </g>

              {/* Critical Peak Zone between Aug 21-24 */}
              <line x1="560" y1="60" x2="560" y2="295" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx="560" cy="175" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2.5" />
              <circle cx="560" cy="175" r="10" fill="#f59e0b" fillOpacity="0.25" />

              {/* Interactive Tooltip pinned on Peak */}
              {activeTooltip && (
                <g className="forecast-chart-tooltip" transform="translate(110, 130)">
                  <rect
                    x="0"
                    y="0"
                    width="240"
                    height="125"
                    rx="8"
                    fill="#0f172a"
                    fillOpacity="0.95"
                    stroke="#334155"
                    strokeWidth="1"
                    filter="drop-shadow(0 4px 12px rgba(0,0,0,0.3))"
                  />
                  <text x="14" y="24" fill="#f59e0b" fontSize="11" fontWeight="700">
                    {isArabic ? "ذروة الالتزامات: 21 - 24 أغسطس" : "Obligations Peak: 21-24 Aug"}
                  </text>
                  <text x="226" y="24" textAnchor="end" fill="#ffffff" fontSize="10" fontWeight="700">
                    {isArabic ? "تراكم 8,420 ر.س" : "Cumul 8,420 SAR"}
                  </text>
                  <line x1="14" y1="33" x2="226" y2="33" stroke="#334155" strokeWidth="0.8" />
                  <text x="14" y="50" fill="#cbd5e1" fontSize="10">
                    • {isArabic ? "قسط تمويل (بنك الراجحي): 1,850 ر.س" : "Auto loan (Al Rajhi): 1,850 SAR"}
                  </text>
                  <text x="14" y="66" fill="#cbd5e1" fontSize="10">
                    • {isArabic ? "حزمة فواتير (كهرباء + اتصالات): 1,140 ر.س" : "Bills bundle: 1,140 SAR"}
                  </text>
                  <text x="14" y="82" fill="#cbd5e1" fontSize="10">
                    • {isArabic ? "صيانة دورية للمركبة: 700 ر.س" : "Vehicle maintenance: 700 SAR"}
                  </text>
                  <rect x="14" y="94" width="212" height="20" rx="4" fill="rgba(245, 158, 11, 0.2)" />
                  <text x="20" y="108" fill="#fbbf24" fontSize="9.5" fontWeight="600">
                    ⚠️ {isArabic ? "أعلى ضغط سيولة قبل إيداع الراتب بـ 3 أيام" : "Peak liquidity pressure 3 days pre-salary"}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* X-Axis Dates */}
          <g className="forecast-xaxis-ticks" transform="translate(0, 316)">
            <text x="55" y="0" textAnchor="middle" className="forecast-axis-text">
              {isArabic ? "1 أغسطس" : "1 Aug"}
            </text>
            <text x="160" y="0" textAnchor="middle" className="forecast-axis-text">
              {isArabic ? "5 أغسطس" : "5 Aug"}
            </text>
            <text x="260" y="0" textAnchor="middle" className="forecast-axis-text forecast-axis-text--highlight">
              {isArabic ? "10 أغسطس" : "10 Aug"}
            </text>
            <text x="380" y="0" textAnchor="middle" className="forecast-axis-text">
              {isArabic ? "15 أغسطس" : "15 Aug"}
            </text>
            <text x="480" y="0" textAnchor="middle" className="forecast-axis-text">
              {isArabic ? "20 أغسطس" : "20 Aug"}
            </text>
            <text x="545" y="0" textAnchor="middle" className="forecast-axis-text forecast-axis-text--amber">
              {activeTab === "expenses"
                ? (isArabic ? "21-24 أغسطس (الذروة)" : "21-24 Aug (Peak)")
                : (isArabic ? "24 أغسطس (القاع)" : "24 Aug (Dip)")}
            </text>
            <text x="640" y="0" textAnchor="middle" className="forecast-axis-text forecast-axis-text--salary">
              {isArabic ? "27 أغسطس (الراتب)" : "27 Aug (Salary)"}
            </text>
            <text x="825" y="0" textAnchor="middle" className="forecast-axis-text">
              {isArabic ? "31 أغسطس" : "31 Aug"}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
