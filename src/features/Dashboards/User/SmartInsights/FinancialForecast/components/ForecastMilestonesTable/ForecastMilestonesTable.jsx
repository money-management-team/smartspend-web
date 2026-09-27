import { useTranslation } from "react-i18next";
import "./ForecastMilestonesTable.css";

export default function ForecastMilestonesTable({ activeTab = "all", onViewAll }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  const allRows = [
    {
      id: 1,
      date: isArabic ? "10 أغسطس" : "10 Aug",
      title: isArabic ? "أرباح صكوك حكومية" : "Gov Sukuk Dividends",
      subtitle: isArabic ? "إيداع في الحساب الاستثماري" : "Deposit into Investment Account",
      category: isArabic ? "عوائد استثمار" : "Investment Return",
      amount: "+2,500",
      isPositive: true,
      confidence: 98,
      confidenceColor: "#10b981",
      status: isArabic ? "عزز الفائض" : "Boost Surplus",
      statusClass: "badge--green",
    },
    {
      id: 2,
      date: isArabic ? "15 أغسطس" : "15 Aug",
      title: isArabic ? "قسط التمويل التأجيري" : "Auto Lease Installment",
      subtitle: isArabic ? "بنك الراجحي - استقطاع سيارة" : "Al Rajhi - Auto Deduction",
      category: isArabic ? "التزامات وأقساط" : "Obligations & Loans",
      amount: "-1,850",
      isPositive: false,
      confidence: 100,
      confidenceColor: "#2563eb",
      status: isArabic ? "مجدول مؤكد" : "Confirmed Scheduled",
      statusClass: "badge--blue",
    },
    {
      id: 3,
      date: isArabic ? "22 أغسطس" : "22 Aug",
      title: isArabic ? "حزمة فواتير دورية (كهرباء + اتصالات)" : "Bills Bundle (Electricity + Telecom)",
      subtitle: isArabic ? "سداد الفواتير الشهرية" : "Monthly Bills Payment",
      category: isArabic ? "فواتير وخدمات" : "Utilities & Services",
      amount: "-1,140",
      isPositive: false,
      confidence: 92,
      confidenceColor: "#f59e0b",
      status: isArabic ? "منطقة ضغط" : "Stress Zone",
      statusClass: "badge--amber",
    },
    {
      id: 4,
      date: isArabic ? "27 أغسطس" : "27 Aug",
      title: isArabic ? "الراتب الشهري الأساسي" : "Main Monthly Salary",
      subtitle: isArabic ? "شركة التقنية المتقدمة" : "Advanced Tech Co.",
      category: isArabic ? "دخل أساسي" : "Primary Income",
      amount: "+16,000",
      isPositive: true,
      confidence: 99,
      confidenceColor: "#10b981",
      status: isArabic ? "إعادة امتلاء السيولة" : "Refill Liquidity",
      statusClass: "badge--cyan",
    },
  ];

  const incomeRows = [
    {
      id: 1,
      date: isArabic ? "10 أغسطس" : "10 Aug",
      title: isArabic ? "أرباح صكوك حكومية" : "Gov Sukuk Dividends",
      subtitle: isArabic ? "إيداع في الحساب الاستثماري" : "Deposit into Investment Account",
      category: isArabic ? "عوائد استثمار" : "Investment Return",
      amount: "+2,500",
      isPositive: true,
      confidence: 98,
      confidenceColor: "#10b981",
      status: isArabic ? "عزز الفائض" : "Boost Surplus",
      statusClass: "badge--green",
    },
    {
      id: 2,
      date: isArabic ? "27 أغسطس" : "27 Aug",
      title: isArabic ? "الراتب الشهري الأساسي" : "Main Monthly Salary",
      subtitle: isArabic ? "شركة التقنية المتقدمة" : "Advanced Tech Co.",
      category: isArabic ? "دخل أساسي" : "Primary Income",
      amount: "+16,000",
      isPositive: true,
      confidence: 99,
      confidenceColor: "#10b981",
      status: isArabic ? "إعادة امتلاء السيولة" : "Refill Liquidity",
      statusClass: "badge--cyan",
    },
    {
      id: 3,
      date: isArabic ? "30 أغسطس" : "30 Aug",
      title: isArabic ? "توزيع أرباح صندوق سيولة" : "Liquidity Fund Dividend",
      subtitle: isArabic ? "محفظة الراجحي المالية" : "Al Rajhi Portfolio",
      category: isArabic ? "دخل إضافي" : "Extra Income",
      amount: "+350",
      isPositive: true,
      confidence: 85,
      confidenceColor: "#059669",
      status: isArabic ? "متوقع تقديرياً" : "Estimated",
      statusClass: "badge--gray",
    },
  ];

  const expensesRows = [
    {
      id: 1,
      date: isArabic ? "5 أغسطس" : "5 Aug",
      title: isArabic ? "اشتراكات برمجيات وسحابة" : "Cloud & Software Subscriptions",
      subtitle: isArabic ? "Google & App Subscriptions" : "Google & App Subscriptions",
      category: isArabic ? "اشتراكات دورية" : "Recurring Subscriptions",
      amount: "-220",
      isPositive: false,
      confidence: 100,
      confidenceColor: "#2563eb",
      status: isArabic ? "مجدول تلقائياً" : "Auto Scheduled",
      statusClass: "badge--green",
    },
    {
      id: 2,
      date: isArabic ? "10 أغسطس" : "10 Aug",
      title: isArabic ? "فاتورة المياه الوطنية" : "National Water Bill",
      subtitle: isArabic ? "سداد الفواتير الخدمية" : "Utility Payment",
      category: isArabic ? "فواتير وخدمات" : "Utilities & Services",
      amount: "-140",
      isPositive: false,
      confidence: 95,
      confidenceColor: "#2563eb",
      status: isArabic ? "بانتظار الإشعار" : "Awaiting Notice",
      statusClass: "badge--gray",
    },
    {
      id: 3,
      date: isArabic ? "15 أغسطس" : "15 Aug",
      title: isArabic ? "قسط التمويل التأجيري" : "Auto Lease Installment",
      subtitle: isArabic ? "مصرف الراجحي - استقطاع شهري" : "Al Rajhi - Auto Deduction",
      category: isArabic ? "التزامات وأقساط" : "Obligations & Loans",
      amount: "-1,850",
      isPositive: false,
      confidence: 100,
      confidenceColor: "#10b981",
      status: isArabic ? "استقطاع مباشر" : "Direct Debit",
      statusClass: "badge--blue",
    },
    {
      id: 4,
      date: isArabic ? "22 أغسطس" : "22 Aug",
      title: isArabic ? "حزمة فواتير دورية (كهرباء + STC)" : "Bills Bundle (Electricity + STC)",
      subtitle: isArabic ? "سداد الفواتير المركزية" : "Central Bills Payment",
      category: isArabic ? "فواتير وخدمات" : "Utilities & Services",
      amount: "-1,140",
      isPositive: false,
      confidence: 92,
      confidenceColor: "#f59e0b",
      status: isArabic ? "منطقة ضغط سيولة" : "Liquidity Stress",
      statusClass: "badge--amber",
    },
    {
      id: 5,
      date: isArabic ? "24 أغسطس" : "24 Aug",
      title: isArabic ? "صيانة دورية وتأمين مركبة" : "Vehicle Maintenance & Insurance",
      subtitle: isArabic ? "مركز الصيانة المعتمد" : "Certified Service Center",
      category: isArabic ? "صيانة ومرونة" : "Maintenance & Discretionary",
      amount: "-700",
      isPositive: false,
      confidence: 88,
      confidenceColor: "#2563eb",
      status: isArabic ? "مرن قابل للتأجيل" : "Deferrable",
      statusClass: "badge--purple",
    },
    {
      id: 6,
      date: isArabic ? "30 أغسطس" : "30 Aug",
      title: isArabic ? "مستلزمات دورية وتسوق منزلي" : "Household & Grocery Supplies",
      subtitle: isArabic ? "مخصص نهاية الشهر" : "Month-end Allocation",
      category: isArabic ? "مصروفات معيشية" : "Living Expenses",
      amount: "-1,500",
      isPositive: false,
      confidence: 85,
      confidenceColor: "#2563eb",
      status: isArabic ? "ضمن الميزانية" : "Within Budget",
      statusClass: "badge--green",
    },
  ];

  const currentRows =
    activeTab === "income"
      ? incomeRows
      : activeTab === "expenses"
      ? expensesRows
      : allRows;

  return (
    <div className="forecast-milestones-card">
      <div className="forecast-milestones-card__header">
        <div className="forecast-milestones-card__title-group">
          <h3 className="forecast-milestones-card__title">
            {activeTab === "expenses"
              ? t("dashboard.smartInsights.detailedForecast.tables.upcomingExpensesTitle")
              : t("dashboard.smartInsights.detailedForecast.tables.milestonesTitle")}
          </h3>
          <p className="forecast-milestones-card__subtitle">
            {activeTab === "expenses"
              ? t("dashboard.smartInsights.detailedForecast.tables.upcomingExpensesSub")
              : t("dashboard.smartInsights.detailedForecast.tables.milestonesSub")}
          </p>
        </div>

        <button
          type="button"
          className="forecast-milestones-card__link-btn"
          onClick={onViewAll}
        >
          {t("dashboard.smartInsights.detailedForecast.tables.viewAll")}
        </button>
      </div>

      {/* Table Container */}
      <div className="forecast-table-wrapper">
        <table className="forecast-table">
          <thead>
            <tr>
              <th className="forecast-th forecast-th--date">
                {t("dashboard.smartInsights.detailedForecast.tables.colDate")}
              </th>
              <th className="forecast-th forecast-th--desc">
                {t("dashboard.smartInsights.detailedForecast.tables.colDescription")}
              </th>
              <th className="forecast-th forecast-th--cat">
                {t("dashboard.smartInsights.detailedForecast.tables.colCategory")}
              </th>
              <th className="forecast-th forecast-th--amount">
                {t("dashboard.smartInsights.detailedForecast.tables.colAmount")}
              </th>
              <th className="forecast-th forecast-th--conf">
                {t("dashboard.smartInsights.detailedForecast.tables.colConfidence")}
              </th>
              <th className="forecast-th forecast-th--status">
                {t("dashboard.smartInsights.detailedForecast.tables.colStatus")}
              </th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row) => (
              <tr key={row.id} className="forecast-tr">
                <td className="forecast-td forecast-td--date">
                  <span className="forecast-date-badge">{row.date}</span>
                </td>

                <td className="forecast-td forecast-td--desc">
                  <div className="forecast-cell-desc">
                    <span className="forecast-cell-title">{row.title}</span>
                    <span className="forecast-cell-sub">{row.subtitle}</span>
                  </div>
                </td>

                <td className="forecast-td forecast-td--cat">
                  <span className="forecast-category-pill">{row.category}</span>
                </td>

                <td className="forecast-td forecast-td--amount">
                  <span
                    className={`forecast-amount ${
                      row.isPositive ? "forecast-amount--pos" : "forecast-amount--neg"
                    }`}
                  >
                    {row.amount} {isArabic ? "ر.س" : "SAR"}
                  </span>
                </td>

                <td className="forecast-td forecast-td--conf">
                  <div className="forecast-conf-cell">
                    <div className="forecast-conf-bar">
                      <div
                        className="forecast-conf-fill"
                        style={{
                          width: `${row.confidence}%`,
                          backgroundColor: row.confidenceColor,
                        }}
                      />
                    </div>
                    <span className="forecast-conf-pct">{row.confidence}%</span>
                  </div>
                </td>

                <td className="forecast-td forecast-td--status">
                  <span className={`forecast-status-badge ${row.statusClass}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
