import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSparkles, LuX } from "react-icons/lu";
import "./BottomSavingsBar.css";

export default function BottomSavingsBar({ onViewDetails }) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <aside className="bottom-savings-bar" aria-label="Smart savings prompt">
      <div className="bottom-savings-bar__content">
        <div className="bottom-savings-bar__main">
          <div className="bottom-savings-bar__icon-wrap">
            <LuSparkles />
          </div>

          <div className="bottom-savings-bar__text">
            <h4 className="bottom-savings-bar__title">
              {t("dashboard.smartInsights.bottomBar.title")}
            </h4>
            <p className="bottom-savings-bar__desc">
              {t("dashboard.smartInsights.bottomBar.desc")}
            </p>
          </div>
        </div>

        <div className="bottom-savings-bar__right">
          <div className="bottom-savings-bar__chips">
            <span className="bottom-savings-chip">
              {t("dashboard.smartInsights.bottomBar.chipDining")}
            </span>
            <span className="bottom-savings-chip">
              {t("dashboard.smartInsights.bottomBar.chipSubs")}
            </span>
          </div>

          <button
            type="button"
            className="bottom-savings-bar__btn"
            onClick={onViewDetails}
          >
            {t("dashboard.smartInsights.bottomBar.viewDetailsBtn")}
          </button>

          <button
            type="button"
            className="bottom-savings-bar__close-btn"
            onClick={() => setIsVisible(false)}
            aria-label="Dismiss banner"
          >
            <LuX />
          </button>
        </div>
      </div>
    </aside>
  );
}
