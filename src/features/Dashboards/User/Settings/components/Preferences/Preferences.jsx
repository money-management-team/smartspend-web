import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { useThemeContext } from "../../../../../../contexts/theme/useThemeContext";
import { authApi } from "../../../api/authApi";
import { getApiErrorMessage } from "../../../api/apiClient";
import { PATH } from "../../../../../../routes/Path";

const timezones = Intl.supportedValuesOf?.("timeZone") ?? ["Asia/Hebron", "UTC"];

export default function Preferences() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuthContext();
  const { theme, changeTheme } = useThemeContext();
  const [locale, setLocale] = useState(user?.locale ?? (i18n.language?.startsWith("ar") ? "ar" : "en"));
  const [timezone, setTimezone] = useState(user?.timezone ?? "Asia/Hebron");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const x = "dashboard.settings.preferences";

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await authApi.updateProfile({ locale, timezone });
      updateUser(response.data);
      await i18n.changeLanguage(locale);
      setNotice(t(`${x}.saved`));
    } catch (failure) { setError(getApiErrorMessage(failure, t)); }
    finally { setBusy(false); }
  }

  return <section className="profile-settings">
    <h2>{t(`${x}.title`)}</h2>
    <form className="profile-settings__form" onSubmit={save}>
      <div className="profile-settings__grid">
        <label className="settings-field">{t(`${x}.language`)}
          <select value={locale} onChange={(event) => setLocale(event.target.value)} disabled={busy}>
            <option value="ar">العربية</option><option value="en">English</option>
          </select>
        </label>
        <label className="settings-field">{t(`${x}.timezone`)}
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={busy}>
            {!timezones.includes(timezone) && <option value={timezone}>{timezone}</option>}
            {timezones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}
          </select>
        </label>
        <label className="settings-field">{t(`${x}.theme`)}
          <select value={theme} onChange={(event) => changeTheme(event.target.value)}>
            <option value="light">{t(`${x}.light`)}</option><option value="dark">{t(`${x}.dark`)}</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={busy}>{busy ? t(`${x}.saving`) : t(`${x}.save`)}</button>
    </form>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    <p><Link to={PATH.USER.AI_ASSISTANT}>{t(`${x}.aiSettings`)}</Link></p>
  </section>;
}
