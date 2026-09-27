# Smart Insights Center (مركز الرؤى الذكية) - Implementation Guide

## Architecture

The Smart Insights module is located at `src/features/Dashboards/User/SmartInsights/`:

```
src/features/Dashboards/User/SmartInsights/
├── SmartInsights.jsx
├── SmartInsights.css
└── components/
    ├── SmartInsightsHeader/
    │   ├── SmartInsightsHeader.jsx
    │   └── SmartInsightsHeader.css
    ├── MetricsOverview/
    │   ├── MetricsOverview.jsx
    │   └── MetricsOverview.css
    ├── ForecastCard/
    │   ├── ForecastCard.jsx
    │   └── ForecastCard.css
    ├── RecommendationCards/
    │   ├── RecommendationCards.jsx
    │   └── RecommendationCards.css
    ├── SpendingAlertModal/
    │   ├── SpendingAlertModal.jsx
    │   └── SpendingAlertModal.css
    ├── SavingsSuggestionsModal/
    │   ├── SavingsSuggestionsModal.jsx
    │   └── SavingsSuggestionsModal.css
    └── BottomSavingsBar/
        ├── BottomSavingsBar.jsx
        └── BottomSavingsBar.css
```

## Routing & Navigation

- **Path Constant**: `PATH.USER.SMART_INSIGHTS = "/dashboard/smart-insights"` in `src/routes/Path.js`.
- **Sidebar Integration**: Registered in `src/layouts/DashboardLayout/components/DashboardSidebar/DashboardSidebar.jsx` under the `sections.more` group between `aiAssistant` and `notifications`.
- **AI Assistant Header Link**: The insights center button in `AIAssistantHeader.jsx` routes directly to `PATH.USER.SMART_INSIGHTS`.

## State & Data Flow

1. **Header & Period Filtering**:
   - `selectedPeriod`: Controlled dropdown (`july2024`, `june2024`, `may2024`, `q2_2024`).
   - `handleRefresh`: Simulates live analytics synchronization with spinning indicator and auto-dismissing toast feedback.

2. **Action Handlers & Interactive Feedback**:
   - `isDiningApplied`: Tracks 500 SAR dining cap application state with checkmark badges across both the card and the modal.
   - `isAutoTransferEnabled`: Sets up automated cash surplus routing to high-yield deposit.
   - `isReminderScheduled`: Schedules calendar reminder 2 days prior to debit date.
   - `isRebalanced`: Confirms asset rebalancing orders for defense assets/sukuk.

3. **Modal Dialogs**:
   - Both `SpendingAlertModal` and `SavingsSuggestionsModal` feature backdrop blur, accessible ARIA attributes (`role="dialog"`, `aria-modal="true"`), auto-focusing primary buttons, and Escape key listener cleanup.

## Localization & RTL

- Complete key parity established in:
  - `src/locales/ar/ar.json` under `dashboard.smartInsights.*` and `dashboard.sidebar.smartInsights`
  - `src/locales/en/en.json` under `dashboard.smartInsights.*` and `dashboard.sidebar.smartInsights`
- SVG curves, segmented bars, and dropdown arrows support directional flips via `[dir="rtl"]` selectors.
