import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LuBrainCircuit,
  LuChartNoAxesCombined,
  LuShieldCheck,
  LuWalletCards,
} from "react-icons/lu";

import logo from "../../../../assets/smart-spend-logo.png";
import { AUTH_INTENT, getAccountTypePath } from "../../../../routes/Path";


export default function Ready() {
  const { t } = useTranslation();

  return (
    <>
      <section className="home-cta-section">
        <div className="home-container">
          <div className="home-cta">
            <div className="home-cta__glow" />

            <div className="home-cta__content">
              <span className="home-cta__eyebrow">{t("home.cta.eyebrow")}</span>
              <h2>{t("home.cta.title")}</h2>
              <p>{t("home.cta.subtitle")}</p>

              <div className="home-cta__actions">
                <Link
                  to={getAccountTypePath(AUTH_INTENT.REGISTER)}
                  className="home-cta__primary"
                >
                  {t("home.cta.signup")}
                  <span aria-hidden="true">↗</span>
                </Link>

                <button type="button" className="home-cta__secondary">
                  {t("home.cta.sales")}
                </button>
              </div>
            </div>

            <div className="home-cta__visual" aria-hidden="true">
              <div className="home-cta__orbit home-cta__orbit--one" />
              <div className="home-cta__orbit home-cta__orbit--two" />
              <span className="home-cta__visual-core"><img src={logo} alt="" /></span>
              <span className="home-cta__visual-icon home-cta__visual-icon--wallet"><LuWalletCards /></span>
              <span className="home-cta__visual-icon home-cta__visual-icon--chart"><LuChartNoAxesCombined /></span>
              <span className="home-cta__visual-icon home-cta__visual-icon--ai"><LuBrainCircuit /></span>
              <span className="home-cta__visual-icon home-cta__visual-icon--shield"><LuShieldCheck /></span>
            </div>
          </div>
        </div>
      </section>

    
    </>
  );
}

