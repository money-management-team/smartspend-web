import { useRef } from "react";
import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./VerifyCode.css";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  );
}

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
      {/* ==========================
          PROMO SECTION
      ========================== */}

      <section
        className="verify-promo"
        aria-label={t(
          "auth.verifyCode.promo.title",
        )}
      >
        <div
          className="verify-promo__rings"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        <div className="verify-promo__content">
          <div className="verify-promo__logo">
            <img
              src={logo}
              alt="Smart Spend"
            />
          </div>

          <h2>
            {t(
              "auth.verifyCode.promo.title",
            )}
          </h2>

          <p className="verify-promo__subtitle">
            {t(
              "auth.verifyCode.promo.subtitle",
            )}
          </p>

          <div className="verify-users">
            <div
              className="verify-users__avatars"
              aria-hidden="true"
            >
              <span>S</span>
              <span>M</span>
              <span>A</span>
            </div>

            <span className="verify-users__text">
              {t(
                "auth.verifyCode.promo.users",
              )}
            </span>
          </div>
        </div>
      </section>

      {/* ==========================
          VERIFY FORM
      ========================== */}

      <section className="verify-form-panel">
        <div
          className="verify-progress"
          aria-hidden="true"
        >
          <span className="verify-progress__item verify-progress__item--active" />
          <span className="verify-progress__item verify-progress__item--active" />
          <span className="verify-progress__item" />
          <span className="verify-progress__item" />
        </div>

        <header className="verify-header">
          <h1>
            {t("auth.verifyCode.title")}
          </h1>

          <p>
            {t("auth.verifyCode.subtitle")}
          </p>
        </header>

        <form
          className="verify-form"
          onSubmit={handleSubmit}
        >
          <div
            className="verify-code-inputs"
            dir="ltr"
            onPaste={handlePaste}
          >
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] =
                    element;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={
                  index === 0
                    ? "one-time-code"
                    : "off"
                }
                maxLength={1}
                aria-label={`Code digit ${
                  index + 1
                }`}
                onChange={(event) =>
                  handleChange(
                    event,
                    index,
                  )
                }
                onKeyDown={(event) =>
                  handleKeyDown(
                    event,
                    index,
                  )
                }
              />
            ))}
          </div>

          <p className="verify-phone">
            {t(
              "auth.verifyCode.codeSent",
            )}{" "}
            <strong>05•••••21</strong>
          </p>

          <p className="verify-resend">
            {t(
              "auth.verifyCode.resend.prefix",
            )}{" "}
            <button
              type="button"
              onClick={handleResend}
            >
              {t(
                "auth.verifyCode.resend.link",
              )}
            </button>
          </p>

          <button
            className="verify-submit"
            type="submit"
          >
            {t(
              "auth.verifyCode.submit",
            )}
          </button>
        </form>

        <a
          href="#forgot-password"
          className="verify-edit-phone"
        >
          <ArrowIcon />

          <span>
            {t(
              "auth.verifyCode.editPhone",
            )}
          </span>
        </a>
      </section>
    </>
  );
}