# AI Copilot page: UI structure

The redesign of 2026-09-29 turned `/dashboard/ai-assistant` from a hero banner plus loosely styled sections into an app-style workspace. The API behavior is described in [integration.md](integration.md) and did not change.

## Structure

`AIAssistant.jsx` owns every request and every piece of state: settings, conversations, messages, insights, forecast, feedback target, busy/sending flags and alerts. The components only present that state and call back into it.

```
AIAssistant/
├── AIAssistant.jsx / .css      # state, API calls, view routing; page tokens + shared primitives
├── aiFormat.js                 # formatAiMoney / formatAiDate / sourcePath (display only)
├── aiSuggestedAction.js        # validated, read-only savings-contribution suggestion
└── components/
    ├── AssistantTopbar/        # title, status pill, view switcher (Chat · Insights · Forecast · Settings)
    ├── ChatWorkspace/          # fixed-height surface; owns only the history-drawer state
    ├── ConversationsSidebar/   # rail (desktop) / drawer (≤1024px); new chat, delete, load more
    ├── ChatPanel/              # toolbar, message log, welcome prompts, composer
    ├── InsightsPanel/          # refresh, filters, insight cards
    ├── ForecastPanel/          # summary, assumptions, KPI tiles, balance chart, pressure days, daily table
    ├── SettingsPanel/          # feature switches, preferences, privacy & delete data
    ├── ActivationCard/         # consent onboarding
    ├── FeedbackDialog/         # rating reason + comment
    └── AiShared/               # SourceChips, FeedbackButtons, SuggestedContribution
```

## Behavior worth knowing

- **Chat height**: the workspace is `100dvh − --ai-chrome` (at least 480px). `--ai-chrome` is set per breakpoint in `AIAssistant.css` and covers the dashboard header, page padding and topbar. Only the message log and the conversation list scroll. The old `scrollIntoView` also scrolled the whole page, so it was replaced by scrolling the log element. The log follows a new last message or the "thinking" state; loading older messages does not jump to the bottom.
- **History drawer**: below 1024px the conversation rail is an off-canvas drawer inside the workspace. It is opened by the toolbar button (`aria-expanded` / `aria-controls`) and closed by the backdrop, Escape, its close button, choosing a conversation or starting a new one. When closed it is hidden with `visibility`, so it is out of the tab order.
- **Composer**: auto-grows up to 180px. Enter sends, Shift+Enter adds a new line, and IME composition is respected. The 4,000-character counter turns amber past 90%.
- **Direction**: every message, insight text, assumption and comment uses `dir="auto"`, so English answers in the Arabic UI (and the reverse) keep their punctuation in place. Amounts are isolated in `<bdi dir="ltr">`.
- **Formatting**: amounts use `formatAiMoney` (currency formatting; a plain number when the currency code is not valid ISO; "—" when missing). Dates use `formatAiDate`. The forecast chart converts `closing_balance` to a number only to place points; tooltips show the backend strings, formatted.
- **Feedback**: helpful / not helpful / inaccurate are icon buttons with accessible names and tooltips, on answers and on insights. They open `FeedbackDialog`.
- **Insight details**: opening calls `GET /ai/insights/{id}`. Closing only hides the facts; it no longer re-requests them.
- **Insight tones**: each documented insight type has an icon and a tone (warning, danger, success, primary, insights). This is presentation only.
- **Alerts**: the error and success alerts can be dismissed. While the feedback dialog is open, the error appears only inside it.
- **Settings switches**: native checkboxes with `role="switch"`, so keyboard and form behavior stay native.

## Styling

- Page tokens on `.ai-assistant-page`: `--ai-line`, `--ai-rail` (soft surface, adjusted for dark mode), `--ai-gradient` (primary → insights), `--ai-chrome`.
- Shared primitives in `AIAssistant.css`: `.ai-button` (`--primary`, `--secondary`, `--danger`), `.ai-field`, `.ai-alert`, `.ai-panel` / `.ai-panel__head`, `.ai-empty`, `.ai-state`, `.ai-icon-button` (in `AiShared.css`).
- All CSS is global, so class names must not collide with other pages. The chat surface is `.ai-chat-workspace` because the home page already uses `.ai-workspace`.
- Breakpoints: 1024px (rail → drawer), 900px (settings and forecast summary go to one column; activation card stacks), 640px (phone: stacked view switcher, 2-up KPI tiles, single-column prompts).
- Animations (thinking dots, skeleton, refresh spinner, drawer) are turned off under `prefers-reduced-motion`.

## Verification

Headless Chrome against the built app with a mocked `/ai/*` backend covered two conversations with sources, facts and a suggested action, four insights, a 30-day forecast and the no-consent state. It rendered chat, the welcome screen, insights, forecast, settings and onboarding at 360–1920px in English and Arabic, plus dark-mode spot checks. There was no horizontal overflow and no console error or warning. `npm run lint` and `npm run build` pass.
