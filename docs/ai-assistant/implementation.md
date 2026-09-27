# AI Financial Assistant - Implementation

## Component Architecture

The feature is located under `src/features/Dashboards/User/AIAssistant/` and broken into modular components:

- **`AIAssistant.jsx`**: Main page coordinator. Manages conversation selection, message threads, user prompt submissions, retry routines, and modal visibility.
- **`components/AIAssistantHeader/`**:
  - `AIAssistantHeader.jsx`: Title, dynamic contextual subtitle per conversation, and "مركز الرؤى الذكية" pill button.
  - `AIAssistantHeader.css`: Flexible responsive header with RTL alignment.
- **`components/ConversationsSidebar/`**:
  - `ConversationsSidebar.jsx`: Thread navigation, new chat initiator, active indicator dots, alert/error badges, and docked bottom educational tips.
  - `ConversationsSidebar.css`: BEM-styled sidebar card with sticky layout and responsive collapse.
- **`components/ChatPanel/`**:
  - `ChatPanel.jsx`: Scrollable thread viewport, suggestion chip triggers, input composer with clear button, and disclaimer footer.
  - `ChatMessage.jsx`: Renders message bubbles, avatar indicators (`LH` for user, sparkle icon for AI), and timestamps.
  - `ChatErrorCard.jsx`: ERR_503_TIMEOUT alert card with retry handler, live connection check, and clipboard copy.
  - `ChatForecastSkeleton.jsx`: Shimmering CSS skeleton loader with SVG forecast path and KPI placeholders.
  - `ChatProgressCard.jsx`: Multi-step transaction processing card with animated progress bar and spinner.
  - `ChatWelcomeCard.jsx`: Onboarding and empty state welcoming card with badge aura, dual-row suggestion chips, start conversation trigger, and AES-256 footer badge.
- **`components/AIPrivacyModal/`**:
  - `AIPrivacyModal.jsx`: Accessible modal with Escape key handling, backdrop click dismiss, AES-256 badge, and interactive consent checkboxes persisted to `smartspend_ai_privacy_consent`.
  - `AIPrivacyModal.css`: Centered backdrop with frosted blur and design-token borders.

## i18n and RTL

- All text strings are bilingual and maintained in strict key parity across `src/locales/ar/ar.json` and `src/locales/en/en.json`.
- CSS utilizes logical properties (`padding-inline`, `inset-inline-start`, `inset-inline-end`) and explicit `[dir="rtl"]` overrides for directional elements.
- Numbers, abbreviations, and monetary strings are formatted safely.
