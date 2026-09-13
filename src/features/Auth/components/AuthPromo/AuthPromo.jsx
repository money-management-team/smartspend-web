import logo from "../../../../assets/smart-spend-logo.png";

import "./AuthPromo.css";

/*
 * Blue brand panel shown beside the form on wide screens.
 * AuthLayout hides it at tablet-portrait widths and below.
 */
export default function AuthPromo({ title, subtitle, children }) {
  return (
    <section className="auth-promo" aria-label={title}>
      <div className="auth-promo__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="auth-promo__content">
        <div className="auth-promo__logo">
          <img src={logo} alt="Smart Spend" />
        </div>

        <h2 className="auth-promo__title">{title}</h2>

        {subtitle && <p className="auth-promo__subtitle">{subtitle}</p>}

        {children}
      </div>
    </section>
  );
}
