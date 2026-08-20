import { useTranslation } from "react-i18next";

import ImportSteps from "./components/ImportSteps/ImportSteps";
import UploadStatement from "./components/UploadStatement/UploadStatement";

import "./Import.css";

export default function Import() {
  const { t } = useTranslation();

  return (
    <div className="import-page">
      <header className="import-page__header">
        <h1>
          {t("dashboard.importPage.title")}
        </h1>

        <p>
          {t("dashboard.importPage.subtitle")}
        </p>
      </header>

      <ImportSteps />

      <UploadStatement />
    </div>
  );
}