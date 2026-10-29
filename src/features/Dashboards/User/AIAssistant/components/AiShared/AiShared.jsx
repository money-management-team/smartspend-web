import PrivateMoney from "../../../Experience/PrivateMoney";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LuArrowRight,
  LuFileText,
  LuFlag,
  LuPiggyBank,
  LuThumbsDown,
  LuThumbsUp,
} from "react-icons/lu";

import { getSavingsContributionSuggestion } from "../../aiSuggestedAction";
import {
  aiLocale,
  formatAiDate,
  formatAiMoney,
  sourcePath,
} from "../../aiFormat";

import "./AiShared.css";

const x = "dashboard.aiAssistant.extra";
const FEEDBACK = [
  { rating: "helpful", icon: LuThumbsUp },
  { rating: "not_helpful", icon: LuThumbsDown },
  { rating: "inaccurate", icon: LuFlag },
];

/* Records an answer or insight was built from; known types link in-app. */
export function SourceChips({ sources, label }) {
  const { t } = useTranslation();

  if (!sources?.length) return null;

  return (
    <ul className="ai-sources" aria-label={label ?? t(`${x}.sourcesLabel`)}>
      {sources.map((source) => {
        const path = sourcePath(source);

        return (
          <li key={source.key}>
            {path ? (
              <Link
                to={path}
                className="ai-sources__chip ai-sources__chip--link"
              >
                <LuFileText aria-hidden="true" />
                <bdi>{source.label}</bdi>
              </Link>
            ) : (
              <span className="ai-sources__chip">
                <LuFileText aria-hidden="true" />
                <bdi>{source.label}</bdi>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* Helpful / not helpful / inaccurate as compact icon buttons with names. */
export function FeedbackButtons({ onRate, disabled = false }) {
  const { t } = useTranslation();

  return (
    <div
      className="ai-feedback-buttons"
      role="group"
      aria-label={t(`${x}.feedbackLabel`)}
    >
      {FEEDBACK.map(({ rating, icon: Icon }) => (
        <button
          type="button"
          key={rating}
          className="ai-icon-button"
          disabled={disabled}
          onClick={() => onRate(rating)}
          aria-label={t(`${x}.${rating}`)}
          title={t(`${x}.${rating}`)}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/*
 * A suggested savings contribution. Only the validated, read-only navigation
 * target is accepted (see aiSuggestedAction.js); nothing is posted.
 */
export function SuggestedContribution({ action, onOpen }) {
  const { t, i18n } = useTranslation();
  const suggestion = getSavingsContributionSuggestion(action);

  if (!suggestion) return null;

  const locale = aiLocale(i18n);

  return (
    <button
      type="button"
      className="ai-suggestion"
      onClick={() => onOpen(action)}
    >
      <span className="ai-suggestion__icon" aria-hidden="true">
        <LuPiggyBank />
      </span>
      <span className="ai-suggestion__copy">
        <strong>{t(`${x}.openContribution`)}</strong>
        <span>
          <bdi dir="ltr">
            <PrivateMoney>
              {formatAiMoney(suggestion.amount, suggestion.currency, locale)}
            </PrivateMoney>
          </bdi>
          {suggestion.date && (
            <>
              {" · "}
              <bdi>{formatAiDate(suggestion.date, locale)}</bdi>
            </>
          )}
        </span>
      </span>
      <LuArrowRight className="ai-suggestion__arrow" aria-hidden="true" />
    </button>
  );
}
