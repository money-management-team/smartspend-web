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

import { AUTH_INTENT, getAccountTypePath } from "../../../../routes/Path";

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="hero-section">
      <div className="home-container">
        <div className="hero-section__grid">
          <div className="hero-section__content">
            <span className="home-badge hero-entrance hero-entrance--badge">
              <LuSparkles aria-hidden="true" />

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
                to={getAccountTypePath(AUTH_INTENT.REGISTER)}
                className="home-primary-button"
              >
                {t("home.hero.primaryButton")}
              </Link>

              <button
                type="button"
                className="home-secondary-button"
              >
                <FiPlayCircle aria-hidden="true" />

                {t("home.hero.watchDemo")}
              </button>
            </div>

            <div className="hero-users hero-entrance hero-entrance--users">
              <div className="hero-users__avatars" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <p>
                {t("home.hero.users")}
              </p>
            </div>
          </div>

          {/* Decorative product preview: hidden from assistive tech */}
          <div
            className="hero-dashboard hero-entrance hero-entrance--visual"
            aria-hidden="true"
          >
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
            tone="success"
            icon={<LuShieldCheck />}
            title={t("home.stats.security.title")}
            text={t("home.stats.security.text")}
          />

          <Stat
            tone="insights"
            icon={<LuBrainCircuit />}
            title={t("home.stats.ai.title")}
            text={t("home.stats.ai.text")}
          />

          <Stat
            tone="warning"
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
  tone,
}) {
  return (
    <article
      className={`hero-stat hero-entrance hero-entrance--stat${
        tone ? ` hero-stat--${tone}` : ""
      }`}
    >
      <span className="hero-stat__icon" aria-hidden="true">
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
          <bdi>$24,580.90</bdi>
        </strong>

        <div className="dashboard-mock__balance-row">
          <div>
            <small>
              {t("home.preview.income")}
            </small>

            <b><bdi>$5,400</bdi></b>
          </div>

          <div>
            <small>
              {t("home.preview.expenses")}
            </small>

            <b><bdi>$3,120</bdi></b>
          </div>

          <div>
            <small>
              {t("home.preview.savings")}
            </small>

            <b><bdi>$1,850</bdi></b>
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

          <p className="dashboard-mock__tx-row is-positive">
            <span>Salary</span>
            <b><bdi>+$4,200</bdi></b>
          </p>

          <p className="dashboard-mock__tx-row">
            <span>Whole Foods</span>
            <b><bdi>-$84</bdi></b>
          </p>

          <p className="dashboard-mock__tx-row">
            <span>Metro Card</span>
            <b><bdi>-$24</bdi></b>
          </p>
        </div>
      </div>
    </div>
  );
}
