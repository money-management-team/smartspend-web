import { useTranslation } from "react-i18next";
import { LuSparkles } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { getSuggestionEntries, humanizeCaptureField } from "../../captureHelpers";

import "./AiSuggestions.css";

/*
 * What the AI read off the receipt. Hints only: nothing here is edited, sent
 * back, or copied into the review draft — not even at high confidence. The
 * user decides what the operation says; the model only suggests.
 *
 * Fields are rendered from whatever `ai_suggested_values` contains. The AI's
 * field names are its own and need not match the review fields, so an
 * unrecognised one gets a humanised label instead of being dropped.
 */
export default function AiSuggestions({ capture }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const entries = getSuggestionEntries(capture);

  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });

  const label = (field) => {
    const key = `dashboard.aiCaptures.fields.${field}`;
    return i18n.exists(key) ? t(key) : humanizeCaptureField(field);
  };

  return (
    <section className="ai-suggestions" aria-labelledby="ai-suggestions-title">
      <header className="ai-suggestions__header">
        <h2 id="ai-suggestions-title">
          <LuSparkles aria-hidden="true" />
          {t("dashboard.aiCaptures.details.suggestions.title")}
        </h2>
        <p>{t("dashboard.aiCaptures.details.suggestions.description")}</p>
      </header>

      {entries.length === 0 ? (
        <p className="ai-suggestions__empty">
          {t("dashboard.aiCaptures.details.suggestions.empty")}
        </p>
      ) : (
        <ul className="ai-suggestions__list">
          {entries.map((entry) => (
            <li className="ai-suggestions__item" key={entry.field}>
              <span className="ai-suggestions__field">{label(entry.field)}</span>

              <span className="ai-suggestions__value" dir="auto">{entry.value}</span>

              {/* How sure the model was — never a sign the value is correct,
                  so it stays plain secondary text with no success tone. */}
              {entry.confidence != null && (
                <span className="ai-suggestions__confidence">
                  {t("dashboard.aiCaptures.details.suggestions.confidence")}
                  {": "}
                  <bdi dir="ltr">{percent.format(entry.confidence)}</bdi>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
