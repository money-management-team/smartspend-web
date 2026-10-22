import { createElement } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCirclePause,
  LuClock3,
  LuRotateCcw,
  LuSkipForward,
  LuTrendingUp,
  LuTriangleAlert,
} from "react-icons/lu";

import { getHealthSignals } from "../../smartPlanHelpers";

import "./PlanHealth.css";

const ICONS = {
  onHold: LuCirclePause,
  overdue: LuClock3,
  uncovered: LuTriangleAlert,
  endsAfterTarget: LuTriangleAlert,
  delayed: LuCircleAlert,
  skipped: LuSkipForward,
  partiallyReversed: LuRotateCcw,
  ahead: LuTrendingUp,
};

export default function PlanHealth({ health, money, day }) {
  const { t } = useTranslation();
  const signals = getHealthSignals(health);
  const prefix = "dashboard.savingsGoals.smartPlan.health";

  return (
    <section className="plan-health" aria-labelledby="plan-health-title">
      <h3 id="plan-health-title" className="plan-health__title">
        {t(`${prefix}.title`)}
      </h3>

      {signals.length === 0 ? (
        <p className="plan-health__signal plan-health__signal--ok">
          <LuCircleCheck aria-hidden="true" />
          <span>
            <strong>{t(`${prefix}.onTrack`)}</strong>
            <span>{t(`${prefix}.onTrackHint`)}</span>
          </span>
        </p>
      ) : (
        <ul className="plan-health__signals">
          {signals.map((signal) => (
            <li key={signal.key} className={`plan-health__signal plan-health__signal--${signal.tone}`}>
              {createElement(ICONS[signal.key], { "aria-hidden": "true" })}
              <span>
                <strong>{t(`${prefix}.${signal.key}.title`, { count: signal.count })}</strong>
                <span>
                  {t(`${prefix}.${signal.key}.detail`, { count: signal.count })}
                  {signal.amount != null && (
                    <>
                      {" "}
                      {money(signal.amount)}
                    </>
                  )}
                  {signal.date && (
                    <>
                      {" · "}
                      {t(`${prefix}.dateLabel.${signal.key}`)} {day(signal.date)}
                    </>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
