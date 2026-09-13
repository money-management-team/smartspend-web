import { useTranslation } from "react-i18next";
import {
  LuBell,
  LuBrainCircuit,
  LuChartNoAxesCombined,
  LuCreditCard,
  LuHouse,
  LuPiggyBank,
  LuReceiptText,
  LuTarget,
  LuWalletCards,
} from "react-icons/lu";
import logo from "../../../../assets/smart-spend-logo.png";

export default function DashboardPreview() {
  const { t } = useTranslation();

  return (
    <section className="home-section dashboard-preview-section">
      <div className="home-container">
        <header className="home-section-header">
          <span className="home-section-eyebrow">{t("home.dashboardPreview.eyebrow")}</span>
          <h2>{t("home.dashboardPreview.title")}</h2>
          <p>{t("home.dashboardPreview.subtitle")}</p>
        </header>

        <div className="dashboard-stage">
          <div className="dashboard-stage__glow" />
          <div className="dashboard-browser">
            <div className="dashboard-browser__chrome">
              <div className="dashboard-browser__dots"><span /><span /><span /></div>
              <div className="dashboard-browser__url"><span>smartspend.app/dashboard</span></div>
              <span className="dashboard-browser__status" />
            </div>

            <div className="dashboard-browser__app">
              <aside className="dashboard-browser__sidebar">
                <div className="dashboard-browser__brand"><img src={logo} alt="" /><strong>Smart Spend</strong></div>
                <nav aria-hidden="true">
                  <span className="is-active"><LuHouse /></span>
                  <span><LuWalletCards /></span>
                  <span><LuReceiptText /></span>
                  <span><LuTarget /></span>
                  <span><LuPiggyBank /></span>
                  <span className="is-ai"><LuBrainCircuit /></span>
                </nav>
              </aside>

              <div className="dashboard-browser__main">
                <div className="dashboard-browser__topbar">
                  <div><small>{t("home.dashboardPreview.welcome")}</small><strong>{t("home.dashboardPreview.overview")}</strong></div>
                  <div className="dashboard-browser__actions"><span><LuBell /></span><span className="dashboard-browser__avatar">AN</span></div>
                </div>

                <div className="dashboard-browser__summary">
                  <article className="dashboard-summary-card dashboard-summary-card--primary">
                    <small>{t("home.preview.totalBalance")}</small>
                    <strong>$24,580.90</strong>
                    <span>+8.4% {t("home.dashboardPreview.vsLastMonth")}</span>
                  </article>
                  <article className="dashboard-summary-card"><span className="dashboard-summary-card__icon dashboard-summary-card__icon--success">↑</span><small>{t("home.preview.income")}</small><strong>$5,400</strong></article>
                  <article className="dashboard-summary-card"><span className="dashboard-summary-card__icon dashboard-summary-card__icon--danger">↓</span><small>{t("home.preview.expenses")}</small><strong>$3,120</strong></article>
                  <article className="dashboard-summary-card"><span className="dashboard-summary-card__icon dashboard-summary-card__icon--blue"><LuPiggyBank /></span><small>{t("home.preview.savings")}</small><strong>$1,850</strong></article>
                </div>

                <div className="dashboard-browser__content-grid">
                  <article className="dashboard-panel dashboard-panel--chart">
                    <div className="dashboard-panel__head"><div><small>{t("home.dashboardPreview.cashFlow")}</small><strong>$2,280 net</strong></div><span>6 months</span></div>
                    <div className="dashboard-large-chart" aria-hidden="true">
                      <span className="dashboard-large-chart__grid dashboard-large-chart__grid--one" />
                      <span className="dashboard-large-chart__grid dashboard-large-chart__grid--two" />
                      <span className="dashboard-large-chart__grid dashboard-large-chart__grid--three" />
                      <svg viewBox="0 0 620 210" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="dashboardArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M0 165 C65 154 92 104 150 122 S226 160 286 116 S365 52 420 82 S515 120 620 42 L620 210 L0 210 Z" fill="url(#dashboardArea)" />
                        <path d="M0 165 C65 154 92 104 150 122 S226 160 286 116 S365 52 420 82 S515 120 620 42" fill="none" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="dashboard-chart-labels"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div>
                  </article>

                  <article className="dashboard-panel dashboard-panel--budget">
                    <div className="dashboard-panel__head"><div><small>{t("home.preview.monthlyBudget")}</small><strong>77% used</strong></div><span className="dashboard-panel__head-icon"><LuTarget /></span></div>
                    <div className="dashboard-budget-ring"><span><strong>23%</strong><small>left</small></span></div>
                    <div className="dashboard-budget-meta"><span>$1,860 spent</span><b>$2,400</b></div>
                  </article>

                  <article className="dashboard-panel dashboard-panel--transactions">
                    <div className="dashboard-panel__head"><strong>{t("home.preview.recentTransactions")}</strong><span>{t("home.hero.visual.viewAll")}</span></div>
                    <DashboardTransaction icon={<LuCreditCard />} name="Whole Foods" category="Groceries" amount="-$84.20" />
                    <DashboardTransaction icon={<LuReceiptText />} name="Netflix" category="Subscription" amount="-$19.00" />
                    <DashboardTransaction icon={<LuWalletCards />} name="Salary" category="Income" amount="+$4,200" positive />
                  </article>

                  <article className="dashboard-panel dashboard-panel--ai">
                    <div className="dashboard-panel__head"><strong><LuBrainCircuit /> {t("home.ai.badge")}</strong><span className="dashboard-ai-live">Live</span></div>
                    <p>{t("home.ai.recommendationText")}</p>
                    <div className="dashboard-ai-action">{t("home.ai.primary")} <span>↗</span></div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardTransaction({ icon, name, category, amount, positive = false }) {
  return (
    <div className="dashboard-transaction-row">
      <span>{icon}</span>
      <div><strong>{name}</strong><small>{category}</small></div>
      <b className={positive ? "is-positive" : ""}>{amount}</b>
    </div>
  );
}
