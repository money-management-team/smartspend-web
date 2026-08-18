import {
  LuSparkles,
  LuCamera,
  LuMic,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./SmartCapture.css";

export default function SmartCapture() {
  const { t } = useTranslation();

  const handleScan = () => {
    console.log("Scan receipt");
  };

  const handleUpload = () => {
    console.log("Upload transfer screenshot");
  };

  return (
    <section className="smart-capture">
      <div className="smart-capture__title">
        <LuSparkles />

        <h2>
          {t(
            "dashboard.financialOperations.smartCapture.title",
          )}
        </h2>
      </div>

      <p>
        {t(
          "dashboard.financialOperations.smartCapture.description",
        )}
      </p>

      <div className="smart-capture__actions">
        <button
          type="button"
          className="smart-capture__primary"
          onClick={handleScan}
        >
          <LuCamera />

          <span>
            {t(
              "dashboard.financialOperations.smartCapture.scan",
            )}
          </span>
        </button>

        <button
          type="button"
          className="smart-capture__secondary"
          onClick={handleUpload}
        >
          <LuMic />

          <span>
            {t(
              "dashboard.financialOperations.smartCapture.upload",
            )}
          </span>
        </button>
      </div>
    </section>
  );
}