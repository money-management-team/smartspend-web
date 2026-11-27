import { LuArrowLeftRight, LuBell, LuBellRing, LuCalendarCheck, LuChartColumn, LuCompass, LuLayoutTemplate, LuMessageCircle, LuScanLine, LuSearch, LuSparkles, LuUpload, LuWallet } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_ACCOUNTS, MOBILE_AI, MOBILE_ATTENTION, MOBILE_CAPTURES, MOBILE_GETTING_STARTED, MOBILE_IMPORTS, MOBILE_NOTIFICATIONS, MOBILE_PROFILE, MOBILE_REPORTS, MOBILE_REVIEW, MOBILE_SEARCH, MOBILE_TEMPLATES, MOBILE_TRANSFERS, MOBILE_WHATSAPP } from "../navigation.js";
import { PRESENTATION_PREFERENCES } from "../presentation/preference.js";
import { usePresentation } from "../presentation/usePresentation.js";
import { InstallCard } from "../pwa/PwaNotices.jsx";
import { usePwaState } from "../pwa/pwaContext.js";
import { PWA_BUILD } from "../pwa/worker.js";
import Chevron from "../ui/Chevron.jsx";
import DisplayChoices from "../ui/DisplayChoices.jsx";
import LabelledGroup, { GroupLink } from "../ui/LabelledGroup.jsx";

/*
 * More: Accounts and the other read-only pages (transfers, notifications, ...), the display choices that already exist elsewhere in
 * the app (theme, language) plus the presentation switch. The switch is how
 * a visitor leaves Mobile for the full version; it stores one word on this
 * device and nothing else.
 */
export default function MobileMore() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { preference, setPreference } = usePresentation();
  const pwa = usePwaState();
  const { user, workspace } = useAuthContext();
  const name = typeof user?.name === "string" && user.name.trim() ? user.name.trim() : null;
  const initial = name ? [...name][0].toLocaleUpperCase() : "·";

  return (
    <section className="sm-page" data-sm-screen="more">
      <Link className="sm-card sm-profile-card" to={MOBILE_PROFILE} aria-label={t("moreLinks.profile")}>
        <span className="sm-avatar" aria-hidden="true">{initial}</span>
        <span className="sm-row-main">
          <span className="sm-row-title sm-user-text">{name ?? t("moreLinks.profile")}</span>
          <span className="sm-row-meta">{[user?.email, workspace?.name].filter((part) => typeof part === "string" && part).map((part, index) => <span key={part}>{index > 0 && " · "}<bdi dir="auto">{part}</bdi></span>)}</span>
        </span>
        <Chevron />
      </Link>

      <LabelledGroup title={t("moreLinks.focus")}>
        <GroupLink to={MOBILE_GETTING_STARTED} icon={LuCompass} title={t("titles.gettingStarted")} hint={t("guide.moreHint")} />
        <GroupLink to={MOBILE_ATTENTION} icon={LuBellRing} title={t("titles.attention")} hint={t("attentionCenter.moreHint")} />
        <GroupLink to={MOBILE_NOTIFICATIONS} icon={LuBell} title={t("moreLinks.notifications")} hint={t("moreLinks.notificationsHint")} />
        <GroupLink to={MOBILE_SEARCH} icon={LuSearch} title={t("moreLinks.search")} hint={t("moreLinks.searchHint")} />
      </LabelledGroup>

      <LabelledGroup title={t("more.yourMoney")}>
        <GroupLink to={MOBILE_ACCOUNTS} icon={LuWallet} title={t("more.accounts")} hint={t("more.accountsHint")} />
        <GroupLink to={MOBILE_TRANSFERS} icon={LuArrowLeftRight} title={t("moreLinks.transfers")} hint={t("moreLinks.transfersHint")} />
        <GroupLink to={MOBILE_REPORTS} icon={LuChartColumn} title={t("moreLinks.reports")} hint={t("moreLinks.reportsHint")} />
        <GroupLink to={MOBILE_IMPORTS} icon={LuUpload} title={t("moreLinks.imports")} hint={t("moreLinks.importsHint")} />
      </LabelledGroup>

      <LabelledGroup title={t("moreLinks.capture")}>
        <GroupLink to={MOBILE_CAPTURES} icon={LuScanLine} title={t("moreLinks.captures")} hint={t("moreLinks.capturesHint")} />
        <GroupLink to={MOBILE_AI} icon={LuSparkles} title={t("moreLinks.assistant")} hint={t("moreLinks.assistantHint")} />
        <GroupLink to={MOBILE_WHATSAPP} icon={LuMessageCircle} title={t("moreLinks.whatsapp")} hint={t("moreLinks.whatsappHint")} />
      </LabelledGroup>

      <LabelledGroup title={t("moreLinks.tools")}>
        <GroupLink to={MOBILE_REVIEW} icon={LuCalendarCheck} title={t("moreLinks.review")} hint={t("moreLinks.reviewHint")} />
        <GroupLink to={MOBILE_TEMPLATES} icon={LuLayoutTemplate} title={t("moreLinks.templates")} hint={t("moreLinks.templatesHint")} />
      </LabelledGroup>

      <LabelledGroup title={t("more.appearance")}>
        <DisplayChoices />
      </LabelledGroup>

      <InstallCard pwa={pwa} enabled={PWA_BUILD} />

      <div className="sm-card">
        <fieldset className="sm-fieldset">
          <legend className="sm-card-title">{t("more.presentation")}</legend>
          <p className="sm-text sm-muted">{t("more.presentationHint")}</p>
          {PRESENTATION_PREFERENCES.map((value) => (
            <label key={value} className="sm-choice">
              <input
                type="radio"
                name="sm-presentation"
                value={value}
                checked={preference === value}
                onChange={() => setPreference(value)}
              />
              <span>{t(`more.${value}`)}</span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="sm-button sm-button-quiet" onClick={() => setPreference("desktop")}>
          {t("more.openFull")}
        </button>
      </div>
    </section>
  );
}
