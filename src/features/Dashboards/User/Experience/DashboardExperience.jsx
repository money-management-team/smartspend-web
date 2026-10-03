import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LuArrowUp,
  LuArrowDown,
  LuSlidersHorizontal,
  LuSparkles,
  LuX,
} from "react-icons/lu";
import { PATH } from "../../../../routes/Path";
import { useExperience } from "./useExperience";
import { DASHBOARD_BLOCKS } from "./experienceStore";

export function GettingStartedCard() {
  const { t } = useTranslation("experience"),
    { preferences, update } = useExperience();
  if (preferences.guideDismissed) return null;
  return (
    <section className="exp-card exp-onboarding">
      <span className="exp-hero-icon">
        <LuSparkles aria-hidden="true" />
      </span>
      <div>
        <h2>{t("startTitle")}</h2>
        <p className="exp-muted">{t("startHint")}</p>
      </div>
      <Link className="exp-button" to={PATH.USER.GETTING_STARTED}>
        {t("start")}
      </Link>
      <button
        className="exp-button exp-button--subtle"
        type="button"
        aria-label={t("dismiss")}
        onClick={() => update({ guideDismissed: true })}
      >
        <LuX aria-hidden="true" />
      </button>
    </section>
  );
}
export default function DashboardExperience({ blocks }) {
  const { t } = useTranslation("experience"),
    { preferences, update } = useExperience();
  const [customizing, setCustomizing] = useState(false);
  const visible = preferences.dashboardOrder.filter(
    (id) => !preferences.hiddenDashboard.includes(id) && blocks[id],
  );
  const toggle = (id) =>
    update((current) => ({
      ...current,
      hiddenDashboard: current.hiddenDashboard.includes(id)
        ? current.hiddenDashboard.filter((key) => key !== id)
        : [...current.hiddenDashboard, id],
    }));
  const move = (id, offset) =>
    update((current) => {
      const order = [...current.dashboardOrder],
        index = order.indexOf(id),
        next = index + offset;
      if (next < 0 || next >= order.length) return current;
      [order[index], order[next]] = [order[next], order[index]];
      return { ...current, dashboardOrder: order };
    });
  const reset = () =>
    update({ dashboardOrder: DASHBOARD_BLOCKS, hiddenDashboard: [] });
  return (
    <>
      <div className="exp-toolbar">
        <button
          className="exp-button exp-button--subtle"
          type="button"
          aria-expanded={customizing}
          aria-controls="dashboard-customization"
          onClick={() => setCustomizing(!customizing)}
        >
          <LuSlidersHorizontal aria-hidden="true" />
          {t("customizeDashboard")}
        </button>
        <Link
          className="exp-button exp-button--subtle"
          to={PATH.USER.ATTENTION}
        >
          {t("attention")}
        </Link>
        <Link
          className="exp-button exp-button--subtle"
          to={PATH.USER.MONTHLY_REVIEW}
        >
          {t("monthly")}
        </Link>
      </div>
      {customizing && (
        <section className="exp-card" id="dashboard-customization">
          <header className="exp-toolbar">
            <h2>{t("customizeDashboard")}</h2>
            <button
              className="exp-button exp-button--subtle"
              type="button"
              onClick={reset}
            >
              {t("reset")}
            </button>
          </header>
          <p className="exp-muted">
            {t("dashboardHint")} {t("deviceOnly")}
          </p>
          <ol className="exp-order-list">
            {preferences.dashboardOrder.map((id, index) => (
              <li key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!preferences.hiddenDashboard.includes(id)}
                    onChange={() => toggle(id)}
                  />
                  {t(`block.${id}`)}
                </label>
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`${t("moveUp")} ${t(`block.${id}`)}`}
                  onClick={() => move(id, -1)}
                >
                  <LuArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={index === preferences.dashboardOrder.length - 1}
                  aria-label={`${t("moveDown")} ${t(`block.${id}`)}`}
                  onClick={() => move(id, 1)}
                >
                  <LuArrowDown aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!visible.length && (
        <section className="exp-card exp-state">
          <p>{t("dashboardEmpty")}</p>
          <button type="button" className="exp-button" onClick={reset}>
            {t("reset")}
          </button>
        </section>
      )}
      <div className="exp-dashboard-grid">
        {visible.map((id) => (
          <div
            className={`exp-dashboard-block exp-dashboard-block--${id}`}
            key={id}
          >
            {blocks[id]}
          </div>
        ))}
      </div>
    </>
  );
}
