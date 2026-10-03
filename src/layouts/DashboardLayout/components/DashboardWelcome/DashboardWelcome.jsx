import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LuSparkles,
  LuWalletCards,
  LuMic,
  LuShieldCheck,
  LuArrowUpRight,
} from "react-icons/lu";
import GlassDialog from "../../../../components/AccessExperience/GlassDialog";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import {
  isWelcomeForUser,
  welcomeGreeting,
} from "../../../../contexts/auth/welcomeNotice";
import { PATH } from "../../../../routes/Path";

function WelcomeCard({ notice, user, workspace, onClose }) {
  const { t } = useTranslation("access");
  const [greeting] = useState(() =>
    welcomeGreeting(user?.timezone ?? workspace?.timezone),
  );
  const isNew = notice.kind === "register",
    name = user.name?.trim().slice(0, 80) || t("member");
  const features = t("welcomeFeatures", { returnObjects: true }),
    icons = [LuWalletCards, LuMic, LuShieldCheck];
  return (
    <GlassDialog
      variant="welcome"
      title={t(isNew ? "newTitle" : "welcomeTitle", { name })}
      hint={t(isNew ? "newHint" : "welcomeHint")}
      kicker={t("welcomeKicker")}
      onClose={onClose}
    >
      <div className="access-welcome__scene" aria-hidden="true">
        <span className="access-welcome__orbit access-welcome__orbit--one" />
        <span className="access-welcome__orbit access-welcome__orbit--two" />
        <span className="access-welcome__star access-welcome__star--one">
          ✦
        </span>
        <span className="access-welcome__star access-welcome__star--two">
          ✦
        </span>
        <div className="access-welcome__emblem">
          <LuSparkles />
        </div>
      </div>
      <p className="access-welcome__greeting">
        {t(greeting)} <span aria-hidden="true">✦</span> SmartSpend
      </p>
      <div className="access-welcome__features">
        {features.map((feature, index) => {
          const Icon = icons[index];
          return (
            <article key={feature.title}>
              <span>
                <Icon aria-hidden="true" />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          );
        })}
      </div>
      <footer className="access-dialog__footer">
        <div className="access-dialog__actions">
          <button type="button" className="access-button" onClick={onClose}>
            {t("continue")}
            <LuArrowUpRight aria-hidden="true" />
          </button>
          <Link
            className="access-button access-button--secondary"
            to={isNew ? PATH.USER.GETTING_STARTED : PATH.USER.ATTENTION}
            onClick={onClose}
          >
            {t(isNew ? "firstSteps" : "focus")}
          </Link>
        </div>
        <p className="access-dialog__note">{t("welcomeNote")}</p>
      </footer>
    </GlassDialog>
  );
}
export default function DashboardWelcome() {
  const { user, workspace, welcomeNotice, dismissWelcome } = useAuthContext();
  if (!isWelcomeForUser(welcomeNotice, user)) return null;
  return (
    <WelcomeCard
      key={welcomeNotice.id}
      notice={welcomeNotice}
      user={user}
      workspace={workspace}
      onClose={() => dismissWelcome(welcomeNotice.id)}
    />
  );
}
