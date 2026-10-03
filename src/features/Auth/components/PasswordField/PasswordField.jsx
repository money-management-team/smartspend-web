import { useState } from "react";
import { useTranslation } from "react-i18next";

import AuthField from "../AuthField/AuthField";
import { EyeIcon, EyeOffIcon } from "../AuthIcons";

/*
 * AuthField with a show/hide toggle. Accepts every AuthField prop;
 * `type` is controlled here.
 */
export default function PasswordField(props) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <AuthField
      {...props}
      type={isVisible ? "text" : "password"}
      spellCheck={false}
      action={
        <button
          className="auth-field__toggle"
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={t("auth.common.showPassword")}
          aria-pressed={isVisible}
          aria-controls={props.id}
          disabled={props.disabled}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}
