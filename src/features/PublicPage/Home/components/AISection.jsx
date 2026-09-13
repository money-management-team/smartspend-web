import { useTranslation } from "react-i18next";
import {
  LuBrainCircuit,
  LuChartPie,
  LuReceiptText,
  LuSparkles,
  LuTrendingDown,
} from "react-icons/lu";

export default function AISection() {
  const { t } = useTranslation();

  return (
    <section className="home-section ai-home-section">
      <div className="home-container">
        <div className="ai-home-panel">
          <div className="ai-home-panel__glow ai-home-panel__glow--blue" />
          <div className="ai-home-panel__glow ai-home-panel__glow--purple" />

          <div className="ai-home-section__content">
            <span className="home-badge home-badge--purple home-badge--dark">
              <LuSparkles />
              {t("home.ai.badge")}
            </span>

            <h2>{t("home.ai.title")}</h2>
            <p>{t("home.ai.description")}</p>

            <div className="ai-home-section__buttons">
              <button type="button" className="ai-primary-button">
                {t("home.ai.primary")}
                <span aria-hidden="true">↗</span>
              </button>
              <button type="button" className="home-secondary-button home-secondary-button--dark">
                {t("home.ai.secondary")}
              </button>
            </div>

            <div className="ai-home-section__proof">
              <span><LuReceiptText /> {t("home.ai.proofReceipts")}</span>
              <span><LuChartPie /> {t("home.ai.proofPatterns")}</span>
              <span><LuBrainCircuit /> {t("home.ai.proofGuidance")}</span>
            </div>
          </div>

          <div className="ai-workspace">
            <div className="ai-workspace__topbar">
              <div><span className="ai-workspace__dot" /> Smart Spend AI</div>
              <small>{t("home.ai.live")}</small>
            </div>

            <div className="ai-workspace__message ai-workspace__message--user">
              {t("home.ai.userPrompt")}
            </div>

            <div className="ai-workspace__message ai-workspace__message--assistant">
              <span className="ai-workspace__avatar"><LuSparkles /></span>
              <div>
                <small>{t("home.ai.recommendation")}</small>
                <p>{t("home.ai.recommendationText")}</p>
              </div>
            </div>

            <div className="ai-workspace__insights">
              <article>
                <span><LuTrendingDown /></span>
                <div><small>Dining</small><strong>-18%</strong></div>
              </article>
              <article>
                <span><LuChartPie /></span>
                <div><small>Transport</small><strong>-4%</strong></div>
              </article>
              <article>
                <span><LuSparkles /></span>
                <div><small>{t("home.ai.savingPotential")}</small><strong>$145</strong></div>
              </article>
            </div>

            <div className="ai-workspace__composer">
              <span>{t("home.ai.askAnything")}</span>
              <button type="button" aria-label="Send">↗</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
