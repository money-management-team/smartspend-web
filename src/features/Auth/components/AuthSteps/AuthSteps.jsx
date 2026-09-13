import { useTranslation } from "react-i18next";

import "./AuthSteps.css";

/*
 * Progress bars for the password-recovery flow
 * (forgot → verify → reset → changed).
 */
export default function AuthSteps({ current, total = 4 }) {
  const { t } = useTranslation();

  return (
    <div className="auth-steps">
      <span className="auth-steps__label">
        {t("auth.common.step", { current, total })}
      </span>

      <span className="auth-steps__track" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => {
          const state =
            index + 1 === current
              ? "auth-steps__item--current"
              : index + 1 < current
                ? "auth-steps__item--done"
                : "";

          return <span className={`auth-steps__item ${state}`} key={index} />;
        })}
      </span>
    </div>
  );
}
