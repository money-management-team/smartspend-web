import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LuClock, LuCircleCheck } from "react-icons/lu";

import SmartInsightsHeader from "./components/SmartInsightsHeader/SmartInsightsHeader";
import MetricsOverview from "./components/MetricsOverview/MetricsOverview";
import ForecastCard from "./components/ForecastCard/ForecastCard";
import RecommendationCards from "./components/RecommendationCards/RecommendationCards";
import SpendingAlertModal from "./components/SpendingAlertModal/SpendingAlertModal";
import SavingsSuggestionsModal from "./components/SavingsSuggestionsModal/SavingsSuggestionsModal";
import BottomSavingsBar from "./components/BottomSavingsBar/BottomSavingsBar";
import AIPrivacyModal from "../AIAssistant/components/AIPrivacyModal/AIPrivacyModal";
import { PATH } from "../../../../routes/Path";

import "./SmartInsights.css";

const STORAGE_KEY_INSIGHTS_PRIVACY_SHOWN = "smartspend_smart_insights_privacy_shown";

const getInitialPrivacyModalOpen = () => {
  try {
    const alreadyShown = localStorage.getItem(STORAGE_KEY_INSIGHTS_PRIVACY_SHOWN);
    const hasConsent = localStorage.getItem("smartspend_ai_privacy_consent");
    if (alreadyShown || hasConsent) {
      return false;
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return true;
};

export default function SmartInsights() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [selectedPeriod, setSelectedPeriod] = useState("july2024");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Modals state - opens once on the user's first visit
  const [isSpendingModalOpen, setIsSpendingModalOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(() =>
    getInitialPrivacyModalOpen(),
  );

  // Cards interactive state
  const [isDiningApplied, setIsDiningApplied] = useState(false);
  const [isAutoTransferEnabled, setIsAutoTransferEnabled] = useState(false);
  const [isReminderScheduled, setIsReminderScheduled] = useState(false);
  const [isRebalanced, setIsRebalanced] = useState(false);

  // Handlers
  const handleRefresh = () => {
    setIsRefreshing(true);
    setToastMessage("");
    setTimeout(() => {
      setIsRefreshing(false);
      setToastMessage(t("dashboard.smartInsights.refreshedMsg"));
      setTimeout(() => setToastMessage(""), 3500);
    }, 700);
  };

  const handleApplyDiningCap = () => {
    setIsDiningApplied(true);
    setIsSpendingModalOpen(false);
    setToastMessage(t("dashboard.smartInsights.cards.dining.applied"));
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleEnableAutoTransfer = () => {
    setIsAutoTransferEnabled(true);
    setToastMessage(t("dashboard.smartInsights.cards.surplus.enabled"));
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleScheduleReminder = () => {
    setIsReminderScheduled(true);
    setToastMessage(t("dashboard.smartInsights.cards.subscriptions.scheduled"));
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleApplyRebalance = () => {
    setIsRebalanced(true);
    setToastMessage(t("dashboard.smartInsights.cards.portfolio.rebalanced"));
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleApplyAllSavings = () => {
    setIsSavingsModalOpen(false);
    setToastMessage(t("dashboard.smartInsights.cards.dining.applied"));
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleClosePrivacyModal = () => {
    try {
      localStorage.setItem(STORAGE_KEY_INSIGHTS_PRIVACY_SHOWN, "true");
    } catch {
      // Ignore localStorage write error
    }
    setIsPrivacyModalOpen(false);
  };

  const handleAcceptPrivacyModal = () => {
    try {
      localStorage.setItem(STORAGE_KEY_INSIGHTS_PRIVACY_SHOWN, "true");
    } catch {
      // Ignore localStorage write error
    }
    setIsPrivacyModalOpen(false);
  };

  return (
    <div className="smart-insights-page">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="insights-toast" role="status">
          <LuCircleCheck className="insights-toast__icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <SmartInsightsHeader
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Top 4 KPI Metrics Cards */}
      <MetricsOverview
        onOpenSavingsModal={() => setIsSavingsModalOpen(true)}
        onOpenSpendingModal={() => setIsSpendingModalOpen(true)}
      />

      {/* 30-Day Financial Forecast Featured Card */}
      <ForecastCard
        onViewDetails={() => navigate(PATH.USER.SMART_INSIGHTS_FORECAST)}
      />

      {/* 2x2 Recommendation Cards */}
      <RecommendationCards
        onOpenSpendingModal={() => setIsSpendingModalOpen(true)}
        onOpenSavingsModal={() => setIsSavingsModalOpen(true)}
        onApplyDiningCap={handleApplyDiningCap}
        onEnableAutoTransfer={handleEnableAutoTransfer}
        onScheduleReminder={handleScheduleReminder}
        onApplyRebalance={handleApplyRebalance}
        isDiningApplied={isDiningApplied}
        isAutoTransferEnabled={isAutoTransferEnabled}
        isReminderScheduled={isReminderScheduled}
        isRebalanced={isRebalanced}
      />

      {/* Bottom Floating Savings Opportunity Bar */}
      <BottomSavingsBar
        onViewDetails={() => setIsSavingsModalOpen(true)}
      />

      {/* Bottom Disclaimer Banner */}
      <footer className="smart-insights-footer">
        <div className="smart-insights-footer__info">
          <LuClock className="smart-insights-footer__icon" />
          <p className="smart-insights-footer__text">
            {t("dashboard.smartInsights.disclaimer.text")}{" "}
            <Link
              to={PATH.USER.AI_ASSISTANT}
              className="smart-insights-footer__link"
            >
              {t("dashboard.smartInsights.disclaimer.link")}
            </Link>
          </p>
        </div>

        <button
          type="button"
          className="smart-insights-footer__encrypted"
          onClick={() => setIsPrivacyModalOpen(true)}
          title={t("dashboard.smartInsights.disclaimer.encrypted")}
        >
          <span className="smart-insights-footer__dot" />
          <span>{t("dashboard.smartInsights.disclaimer.encrypted")}</span>
        </button>
      </footer>

      {/* Modal 1: Restaurant Spending Alert Modal */}
      <SpendingAlertModal
        isOpen={isSpendingModalOpen}
        onClose={() => setIsSpendingModalOpen(false)}
        onApply={handleApplyDiningCap}
        isApplied={isDiningApplied}
      />

      {/* Modal 2: Smart Savings Suggestions Modal */}
      <SavingsSuggestionsModal
        isOpen={isSavingsModalOpen}
        onClose={() => setIsSavingsModalOpen(false)}
        onApplyAll={handleApplyAllSavings}
      />

      {/* Modal 3: AI Data Privacy & Security Modal */}
      <AIPrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={handleClosePrivacyModal}
        onAccept={handleAcceptPrivacyModal}
      />
    </div>
  );
}
