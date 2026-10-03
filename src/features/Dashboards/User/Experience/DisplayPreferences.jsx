import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LuEye,
  LuEyeOff,
  LuCompass,
  LuLayers,
  LuLayoutDashboard,
} from "react-icons/lu";
import { PATH } from "../../../../routes/Path";
import { useExperience } from "./useExperience";
export default function DisplayPreferences() {
  const { t } = useTranslation("experience"),
    { preferences, update } = useExperience();
  const reset = () => {
    if (window.confirm(t("localResetConfirm")))
      update({ templates: [], savedViews: [] });
  };
  return (
    <section className="exp-card">
      <h2>{t("displaySettings")}</h2>
      <p className="exp-muted">{t("displayHint")}</p>
      <div className="exp-toolbar">
        <button
          className="exp-button exp-button--subtle"
          type="button"
          aria-pressed={preferences.hiddenMoney}
          onClick={() =>
            update((state) => ({ ...state, hiddenMoney: !state.hiddenMoney }))
          }
        >
          {preferences.hiddenMoney ? (
            <LuEye aria-hidden="true" />
          ) : (
            <LuEyeOff aria-hidden="true" />
          )}
          {t(preferences.hiddenMoney ? "showMoney" : "hideMoney")}
        </button>
        <Link
          className="exp-button exp-button--subtle"
          to={PATH.USER.DASHBOARD}
        >
          <LuLayoutDashboard aria-hidden="true" />
          {t("customizeDashboard")}
        </Link>
        <Link
          className="exp-button exp-button--subtle"
          to={PATH.USER.QUICK_TEMPLATES}
        >
          <LuLayers aria-hidden="true" />
          {t("templates")}
        </Link>
        <Link
          className="exp-button exp-button--subtle"
          to={PATH.USER.GETTING_STARTED}
        >
          <LuCompass aria-hidden="true" />
          {t("guide")}
        </Link>
      </div>
      <p className="exp-muted">{t("privacyHint")}</p>
      <div className="exp-toolbar">
        <button
          className="exp-button exp-button--subtle"
          type="button"
          onClick={() => update({ guideDismissed: false })}
        >
          {t("start")}
        </button>
        <button
          className="exp-button exp-button--danger"
          type="button"
          onClick={reset}
        >
          {t("localReset")}
        </button>
      </div>
      {!preferences.persisted && (
        <p className="exp-muted" role="status">
          {t("storageUnavailable")}
        </p>
      )}
    </section>
  );
}
