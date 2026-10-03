import { useTranslation } from "react-i18next";

import logo from "../../assets/smart-spend-logo-pdf.png";

import "./Loading.css";

/**
 * Reusable loading indicator: the Smart Spend logo breathing inside a
 * brand-gradient comet ring with a soft glow (the small size is the ring alone). It fades in after a short delay, so quick loads don't
 * flash a spinner.
 *
 * @param {object} props
 * @param {string|false} [props.message] Text displayed below the indicator.
 *   Defaults to the translated "Loading..."; `false` hides it (screen readers
 *   still hear "Loading...").
 * @param {"small"|"medium"|"large"} [props.size] Indicator size.
 * @param {"inline"|"section"|"page"} [props.variant] Container layout.
 * @param {string} [props.className] Additional class name for the container.
 */
export default function Loading({
  message,
  size = "medium",
  variant = "section",
  className = "",
}) {
  const { t } = useTranslation();
  const text = message === undefined ? t("common.loading") : message;

  const classes = [
    "loading",
    `loading--${variant}`,
    `loading--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loading__indicator" aria-hidden="true">
        <span className="loading__halo" />
        <span className="loading__track" />
        <span className="loading__spinner">
          <span className="loading__arc" />
          <span className="loading__head" />
        </span>
        <img
          className="loading__logo"
          src={logo}
          alt=""
          decoding="async"
          draggable="false"
        />
      </span>

      {text ? (
        <span className="loading__message">{text}</span>
      ) : (
        <span className="loading__sr-only">{t("common.loading")}</span>
      )}
    </div>
  );
}
``