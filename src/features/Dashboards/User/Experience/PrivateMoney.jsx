import { useTranslation } from "react-i18next";
import { useExperience } from "./useExperience";

// Display only: raw values, form inputs, validation and financial payloads are untouched.
export default function PrivateMoney({ children }) {
  const { t } = useTranslation("experience");
  const experience = useExperience();
  return experience?.preferences.hiddenMoney ? (
    <span className="private-money" aria-label={t("moneyHidden")}>
      ••••
    </span>
  ) : (
    <>{children}</>
  );
}
