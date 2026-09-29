import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { PATH } from "../../../routes/Path";

import AuthBackLink from "../components/AuthBackLink/AuthBackLink";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import { ShieldCheckIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSteps from "../components/AuthSteps/AuthSteps";

import "./VerifyCode.css";

const CODE_LENGTH = 4;
const CODE_SLOTS = Array.from({ length: CODE_LENGTH }, (_, index) => index);

export default function VerifyCode() {
  const { t } = useTranslation();

  const inputsRef = useRef([]);

  const handleChange = (event, index) => {
    const value = event.target.value.replace(/\D/g, "");

    event.target.value = value.slice(-1);

    if (value && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (event, index) => {
    if (
      event.key === "Backspace" &&
      !event.currentTarget.value &&
      index > 0
    ) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();

    const value = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);

    value.split("").forEach((number, index) => {
      if (inputsRef.current[index]) {
        inputsRef.current[index].value = number;
      }
    });

    const lastIndex = Math.min(value.length, 4) - 1;

    if (lastIndex >= 0) {
      inputsRef.current[lastIndex]?.focus();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const code = inputsRef.current
      .map((input) => input?.value || "")
      .join("");

    console.log("Verification code:", code);

    /*
      بعد ربط الـ API:

      if (code.length === 4) {
        verifyCode(code);
      }
    */
  };

  const handleResend = () => {
    console.log("Resend verification code");
  };

  return (
    <>
      <AuthPromo
        title={t("auth.verifyCode.promo.title")}
        subtitle={t("auth.verifyCode.promo.subtitle")}
      >
        <div className="verify-users">
          <div className="verify-users__avatars" aria-hidden="true">
            <span>S</span>
            <span>M</span>
            <span>A</span>
          </div>

          <span className="verify-users__text">
            {t("auth.verifyCode.promo.users")}
          </span>
        </div>
      </AuthPromo>

      <section className="auth-panel">
        <AuthSteps current={2} />

        <AuthHeading
          icon={<ShieldCheckIcon />}
          title={t("auth.verifyCode.title")}
          subtitle={t("auth.verifyCode.subtitle")}
        />

        <form className="auth-form" onSubmit={handleSubmit}>
          <div
            className="verify-code"
            role="group"
            aria-label={t("auth.verifyCode.title")}
            dir="ltr"
            onPaste={handlePaste}
          >
            {CODE_SLOTS.map((index) => (
              <input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                className="verify-code__input"
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                placeholder=" "
                aria-label={t("auth.verifyCode.digitLabel", {
                  index: index + 1,
                  total: CODE_LENGTH,
                })}
                onChange={(event) => handleChange(event, index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              />
            ))}
          </div>

          <p className="verify-sent">
            {t("auth.verifyCode.codeSent")}{" "}
            <strong>
              <bdi>05•••••21</bdi>
            </strong>
          </p>

          <AuthButton>{t("auth.verifyCode.submit")}</AuthButton>

          <p className="verify-resend">
            {t("auth.verifyCode.resend.prefix")}{" "}
            <button type="button" onClick={handleResend}>
              {t("auth.verifyCode.resend.link")}
            </button>
          </p>
        </form>

        <AuthBackLink to={PATH.AUTH.FORGOT_PASSWORD}>
          {t("auth.verifyCode.editPhone")}
        </AuthBackLink>
      </section>
    </>
  );
}
