import { useTranslation } from "react-i18next";

export default function DashboardPreview() {
  const { t } = useTranslation();

  return (
    <section className="home-section dashboard-preview-section">
      <div className="home-container">
        <header className="home-section-header">
          <h2>
            {t(
              "home.dashboardPreview.title",
            )}
          </h2>

          <p>
            {t(
              "home.dashboardPreview.subtitle",
            )}
          </p>
        </header>

        <div className="dashboard-preview-section__mock">
          <div className="dashboard-mock dashboard-mock--large">
            <div className="dashboard-mock__top">
              <span />
              <span />
              <span />
            </div>

            <div className="dashboard-mock__balance">
              <small>
                {t(
                  "home.preview.totalBalance",
                )}
              </small>

              <strong>
                $24,580.90
              </strong>

              <div className="dashboard-mock__balance-row">
                <div>
                  <small>
                    {t(
                      "home.preview.income",
                    )}
                  </small>
                  <b>$5,400</b>
                </div>

                <div>
                  <small>
                    {t(
                      "home.preview.expenses",
                    )}
                  </small>
                  <b>$3,120</b>
                </div>

                <div>
                  <small>
                    {t(
                      "home.preview.savings",
                    )}
                  </small>
                  <b>$1,850</b>
                </div>
              </div>
            </div>

            <div className="dashboard-mock__bottom">
              <div className="dashboard-mock__chart">
                <strong>
                  {t(
                    "home.preview.monthlyBudget",
                  )}
                </strong>

                <div className="fake-bars fake-bars--large">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="dashboard-mock__transactions">
                <strong>
                  {t(
                    "home.preview.recentTransactions",
                  )}
                </strong>

                <p>
                  Salary
                  <b>+$4,200</b>
                </p>

                <p>
                  Whole Foods
                  <b>-$84</b>
                </p>

                <p>
                  Metro Card
                  <b>-$24</b>
                </p>

                <p>
                  Electricity bill
                  <b>-$112</b>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}