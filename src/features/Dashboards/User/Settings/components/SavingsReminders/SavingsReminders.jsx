import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuBellRing, LuInfo, LuTriangleAlert } from "react-icons/lu";

import { ApiError, getApiErrorMessage } from "../../../api/apiClient";
import { notificationsApi } from "../../../api/notificationsApi";
import { readNotificationPreferences } from "../../../Notifications/notificationHelpers";

import "./SavingsReminders.css";

/*
 * The savings installment reminder preference (smart savings, gated by the
 * Settings page). In-app only, for every savings plan of the user.
 *
 * GET /notifications/preferences reads it; the switch sends PATCH with
 * `savings_installment_reminders` and nothing else, so no other preference
 * is touched, and shows exactly what the response says. One request at a
 * time; a failure keeps the last saved value and says so.
 *
 * `savings_installment_reminders_available` is the backend's global switch.
 * While it is false nothing is sent whatever the preference: the switch
 * still saves the choice, and the card explains that reminders are off for
 * everyone right now. The client never tries to turn that switch on.
 */
export default function SavingsReminders() {
  const { t } = useTranslation();
  const prefix = "dashboard.settings.savingsReminders";
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, value: null, error: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    notificationsApi
      .getPreferences({ signal: controller.signal })
      .then((response) => {
        const value = readNotificationPreferences(response?.data);
        setState(
          value
            ? { key: reload, value, error: null }
            : { key: reload, value: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setState({ key: reload, value: null, error });
      });

    return () => controller.abort();
  }, [reload]);

  const loading = state.key !== reload;
  const value = state.value;

  const toggle = async (enabled) => {
    if (pendingRef.current || !value) return;

    pendingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const response = await notificationsApi.updatePreferences({ savings_installment_reminders: enabled });
      const next = readNotificationPreferences(response?.data);
      if (!next) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      setState((current) => ({ ...current, value: next }));
      setSaved(true);
    } catch (error) {
      if (error?.code !== "UNAUTHENTICATED") setSaveError(error);
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="savings-reminders" aria-labelledby="savings-reminders-title" aria-busy={loading || saving || undefined}>
      <header className="savings-reminders__head">
        <span className="savings-reminders__icon" aria-hidden="true">
          <LuBellRing />
        </span>
        <div>
          <h2 id="savings-reminders-title">{t(`${prefix}.title`)}</h2>
          <p>{t(`${prefix}.description`)}</p>
        </div>
      </header>

      {loading ? (
        <div className="savings-reminders__skeleton" role="status">
          <span className="savings-reminders__sr-only">{t(`${prefix}.loading`)}</span>
          <span />
        </div>
      ) : !value ? (
        <div className="savings-reminders__error" role="alert">
          <p>{getApiErrorMessage(state.error, t)}</p>
          <button type="button" onClick={() => setReload((count) => count + 1)}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          <label className={`savings-reminders__switch${value.enabled ? " savings-reminders__switch--on" : ""}`}>
            <span className="savings-reminders__switch-copy">
              <strong>{t(`${prefix}.label`)}</strong>
              <span id="savings-reminders-hint">{t(`${prefix}.hint`)}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={value.enabled}
              disabled={saving}
              aria-describedby="savings-reminders-hint"
              onChange={(event) => toggle(event.target.checked)}
            />
            <span className="savings-reminders__track" aria-hidden="true">
              <span />
            </span>
          </label>

          {!value.available && (
            <p className="savings-reminders__note savings-reminders__note--off" role="note">
              <LuInfo aria-hidden="true" />
              <span>{t(`${prefix}.unavailable`)}</span>
            </p>
          )}

          <p className="savings-reminders__status" aria-live="polite">
            {saving
              ? t(`${prefix}.saving`)
              : saved
                ? t(value.enabled ? `${prefix}.savedOn` : `${prefix}.savedOff`)
                : ""}
          </p>

          {saveError && (
            <p className="savings-reminders__note savings-reminders__note--error" role="alert">
              <LuTriangleAlert aria-hidden="true" />
              <span>
                {t(`${prefix}.saveFailed`)} {getApiErrorMessage(saveError, t)}
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
