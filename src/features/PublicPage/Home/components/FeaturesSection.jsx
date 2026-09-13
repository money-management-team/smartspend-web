import { useTranslation } from "react-i18next";
import {
  LuBellRing,
  LuChartNoAxesCombined,
  LuRefreshCcw,
  LuShieldCheck,
  LuTarget,
  LuUsers,
} from "react-icons/lu";

const features = [
  { key: "sync", icon: LuRefreshCcw, index: "01" },
  { key: "analytics", icon: LuChartNoAxesCombined, index: "02" },
  { key: "goals", icon: LuTarget, index: "03" },
  { key: "security", icon: LuShieldCheck, index: "04" },
  { key: "alerts", icon: LuBellRing, index: "05" },
  { key: "budgets", icon: LuUsers, index: "06" },
];

export default function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="home-section features-section" id="features">
      <div className="home-container">
        <header className="home-section-header home-section-header--split">
          <div>
            <span className="home-section-eyebrow">{t("home.features.eyebrow")}</span>
            <h2>{t("home.features.title")}</h2>
          </div>
          <p>{t("home.features.subtitle")}</p>
        </header>

        <div className="features-bento">
          {features.map(({ key, icon: Icon, index }) => (
            <article className={`feature-card feature-card--${key}`} key={key}>
              <div className="feature-card__top">
                <span className="feature-card__icon"><Icon /></span>
                <span className="feature-card__index">{index}</span>
              </div>

              <div className="feature-card__copy">
                <h3>{t(`home.features.items.${key}.title`)}</h3>
                <p>{t(`home.features.items.${key}.description`)}</p>
              </div>

              <FeatureVisual feature={key} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureVisual({ feature }) {
  if (feature === "sync") {
    return (
      <div className="feature-visual feature-visual--sync" aria-hidden="true">
        <span className="feature-sync-node">Bank</span>
        <span className="feature-sync-line"><i /></span>
        <span className="feature-sync-core">S</span>
        <span className="feature-sync-line feature-sync-line--two"><i /></span>
        <span className="feature-sync-node">Wallet</span>
      </div>
    );
  }

  if (feature === "analytics") {
    return (
      <div className="feature-visual feature-visual--analytics" aria-hidden="true">
        <span style={{ "--bar": "42%" }} />
        <span style={{ "--bar": "58%" }} />
        <span style={{ "--bar": "47%" }} />
        <span style={{ "--bar": "78%" }} />
        <span style={{ "--bar": "64%" }} />
        <span style={{ "--bar": "88%" }} />
      </div>
    );
  }

  if (feature === "goals") {
    return (
      <div className="feature-visual feature-visual--goal" aria-hidden="true">
        <div className="feature-goal-ring"><span>72%</span></div>
        <div><strong>$3,600</strong><small>of $5,000</small></div>
      </div>
    );
  }

  if (feature === "security") {
    return (
      <div className="feature-visual feature-visual--security" aria-hidden="true">
        <span className="feature-security-shield"><LuShieldCheck /></span>
        <div><i /><i /><i /></div>
      </div>
    );
  }

  if (feature === "alerts") {
    return (
      <div className="feature-visual feature-visual--alerts" aria-hidden="true">
        <span><LuBellRing /></span>
        <div><strong>Budget alert</strong><small>Dining is at 82%</small></div>
      </div>
    );
  }

  return (
    <div className="feature-visual feature-visual--budgets" aria-hidden="true">
      <div className="feature-budget-row"><span>Home</span><b>64%</b></div>
      <div className="feature-budget-track"><span /></div>
      <div className="feature-budget-row"><span>Travel</span><b>38%</b></div>
      <div className="feature-budget-track feature-budget-track--two"><span /></div>
    </div>
  );
}
