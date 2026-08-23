import { useTranslation } from "react-i18next";
import { LuCalendarClock } from "react-icons/lu";

import SectionCard from "../shared/SectionCard";

import "./UpcomingBills.css";

const bills = ["rent", "cloud", "insurance"];

export default function UpcomingBills() {
  const { t } = useTranslation();

  return (
    <SectionCard
      className="upcoming-bills-card"
      title={t("dashboard.user.upcomingBills.title")}
    >
      <div className="upcoming-bills-card__list">
        {bills.map((key) => (
          <article className="upcoming-bill" key={key}>
            <span className="upcoming-bill__icon">
              <LuCalendarClock />
            </span>

            <div className="upcoming-bill__copy">
              <strong>{t(`dashboard.user.upcomingBills.items.${key}.name`)}</strong>
              <small>
                {t("dashboard.user.upcomingBills.due")} · {t(`dashboard.user.upcomingBills.items.${key}.date`)}
              </small>
            </div>

            <strong className="upcoming-bill__amount">
              {t(`dashboard.user.upcomingBills.items.${key}.amount`)}
            </strong>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
