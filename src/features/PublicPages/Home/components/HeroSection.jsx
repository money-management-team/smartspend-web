import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiPlayCircle } from "react-icons/fi";

import {
  LuSparkles,
  LuUsers,
  LuShieldCheck,
  LuBrainCircuit,
  LuActivity,
} from "react-icons/lu";

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="hero-section">
      <div className="home-container">
        <div className="hero-section__grid">
          <div className="hero-section__content">
            <span className="home-badge hero-entrance hero-entrance--badge">
              <LuSparkles />

              {t("home.hero.badge")}
            </span>

            <h1 className="hero-entrance hero-entrance--heading">
              {t("home.hero.titleStart")}{" "}
              <span>
                {t("home.hero.titleHighlight")}
              </span>
            </h1>

            <p className="hero-entrance hero-entrance--description">
              {t("home.hero.description")}
            </p>

            <div className="hero-section__buttons hero-entrance hero-entrance--actions">
              <Link
                to="/register"
                className="home-primary-button"
              >
                {t("home.hero.primaryButton")}
              </Link>

              <button
                type="button"
                className="home-secondary-button"
              >
                <FiPlayCircle />


                {t("home.hero.watchDemo")}
              </button>
            </div>

            <div
              className="hero-users hero-entrance hero-entrance--users"
              aria-label={t("home.hero.users")}
            >
              <div className="hero-users__avatars">
                <span />
                <span />
                <span />
              </div>

              <p>
                {t("home.hero.users")}
              </p>
            </div>
          </div>

          <div className="hero-dashboard hero-entrance hero-entrance--visual">
            <DashboardMock />
          </div>
        </div>

        <div className="hero-stats">
          <Stat
            icon={<LuUsers />}
            title={t("home.stats.users.title")}
            text={t("home.stats.users.text")}
          />

          <Stat
            icon={<LuShieldCheck />}
            title={t("home.stats.security.title")}
            text={t("home.stats.security.text")}
          />

          <Stat
            icon={<LuBrainCircuit />}
            title={t("home.stats.ai.title")}
            text={t("home.stats.ai.text")}
          />

          <Stat
            icon={<LuActivity />}
            title={t("home.stats.monitoring.title")}
            text={t("home.stats.monitoring.text")}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon,
  title,
  text,
}) {
  return (
    <article className="hero-stat hero-entrance hero-entrance--stat">
      <span>
        {icon}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <small>
          {text}
        </small>
      </div>
    </article>
  );
}

function DashboardMock() {
  const { t } = useTranslation();

  return (
    <div className="dashboard-mock">
      <div className="dashboard-mock__top">
        <span />
        <span />
        <span />
      </div>

      <div className="dashboard-mock__balance">
        <small>
          {t("home.preview.totalBalance")}
        </small>

        <strong>
          $24,580.90
        </strong>

        <div className="dashboard-mock__balance-row">
          <div>
            <small>
              {t("home.preview.income")}
            </small>

            <b>$5,400</b>
          </div>

          <div>
            <small>
              {t("home.preview.expenses")}
            </small>

            <b>$3,120</b>
          </div>

          <div>
            <small>
              {t("home.preview.savings")}
            </small>

            <b>$1,850</b>
          </div>
        </div>
      </div>

      <div className="dashboard-mock__bottom">
        <div className="dashboard-mock__chart">
          <strong>
            {t("home.preview.monthlyBudget")}
          </strong>

          <div className="fake-bars">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="dashboard-mock__transactions">
          <strong>
            {t("home.preview.recentTransactions")}
          </strong>

          <p>
            Salary
            <b>+$4,200</b>
          </p>

          <p>
            Whole Foods
            <b>-$84</b>
          </p>

          <p>
            Metro Card
            <b>-$24</b>
          </p>
        </div>
      </div>
    </div>
  );
}
