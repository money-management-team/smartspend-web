# WhatsApp experience design (Settings → Integrations)

The WhatsApp tab explains the feature and runs it. Behaviour (APIs, linking, preferences, unlink) is unchanged and documented in `linking-ui.md`. This page covers the layout, copy and visual rules (layout v2, 2026-10-14).

## Principles

- The Settings page already has the large header, so the tab opens with a small introduction, not a second hero.
- One card does the job of the state. Everything else is a quiet row, or sits behind a fold.
- One primary action per state. Related actions sit together in the same card.
- Nothing rarely needed is shown open. Settings and help start collapsed.

## Page structure per state

| Block | connected | not connected | unavailable |
| --- | --- | --- | --- |
| A. Introduction: «واتساب SmartSpend», one line, status badge | yes | yes | yes |
| Main card | **Connection card**: status, one line, masked number and link date, **Open SmartSpend on WhatsApp** (primary) and **View drafts** (secondary, pending count when non-zero) | **Onboarding card**: pitch, **Connect WhatsApp**, three activation steps, privacy line, the example chat beside them. The linking flow replaces the pitch and steps in the same card once started. | Calm unavailable card (masked digits of an old link as information) |
| C. Usage: open WhatsApp → record → review, one row of three | yes | no | no |
| D. Safety row (drafts only, nothing charged before confirming) | yes | yes | yes |
| Drafts link as a quiet row | in the card | after the safety row | after the card |
| E. **WhatsApp settings** fold: language, default account, Save, Disconnect; summary shows current language · account | collapsed (opens on a failed disconnect) | no | no |
| F. **Help and FAQ** fold, 6 questions | collapsed | collapsed | collapsed |

- Without a usable `public_number`, View drafts becomes the primary action and a one-line hint says to open the chat and send «مرحبا».
- "linked" without integration details shows the connection card without the facts and without settings.
- Loading is a skeleton in the page's shape.
- A load error shows only the retryable message.

## Content rules

- Arabic first. Arabic strings write the brand as «سمارت سبند», except «SmartSpend» in the page title, the chat button and the safety row, as the owner specified. This is the only Latin allowed (tested). English mirrors the Arabic.
- The "no money moves" rule appears once per page (the safety row), plus the FAQ.
- The chat example (`WhatsAppChatPreview`) uses the backend's v2 wording. It is shown only before linking, as a `<figure>` labelled "Example": its inner markup is `aria-hidden`, a one-sentence `aria-label` describes it, and it contains no controls.
- **Open SmartSpend on WhatsApp**: `https://wa.me/<public_number>?text=<greeting>`, built by `buildWhatsAppChatLink` from `data.public_number` of `GET /integrations/whatsapp` (backend `docs/whatsapp/PUBLIC_NUMBER.md`). It opens a new tab with `noopener noreferrer` and an announced "opens in a new tab". It is never hard-coded and never shown before linking or while disabled.

## Visual rules

- SmartSpend blue (`--color-primary`, `--gradient-primary`), a component-scoped cyan (`--wa-cyan`) and navy (`--wa-navy`). WhatsApp green (`--wa-accent`) only marks the integration: the intro and status icons, the first usage step, the logo disc in the chat button, and the "Open WhatsApp" link during linking.
- Cards match the sibling Settings cards: 21px radius, `--fin-line`, `--fin-shadow`. The tab content has no top margin, so it aligns with the tab list.
- Container queries on `.wa-integration`:
  - the connection card puts its actions beside the information from 700 px;
  - the usage steps sit in one row from 620 px;
  - the settings form puts language and account side by side from 640 px;
  - the onboarding illustration sits beside the copy from 720 px;
  - below 560 px everything is one column with full-width buttons.
- No decorative motion. Only the linking spinner and the skeleton shimmer move, and `prefers-reduced-motion` stops them.

## Discoverability

Settings → Integrations (`?tab=integrations`), the dashboard search ("واتساب"/"whatsapp"), the sidebar draft inbox, the drafts page header link, and the empty pending-drafts state ("How to record from WhatsApp").

## Tests

- `tests/whatsapp-ui/whatsappUi.test.mjs` → "layout v2":
  - the connected order and the single connection card with both actions;
  - one primary action; collapsed settings and help;
  - the settings summary, and settings opening on a failed disconnect;
  - no number: drafts becomes primary;
  - the chat link in both languages;
  - the onboarding card; verification inside the same card, with focus moved;
  - unavailable, loading and load error;
  - "linked" without details.
- The earlier suites (states, linking, preferences, unlinking, languages, accessibility, inbox entry) are unchanged.

Visual review: Chrome through the DevTools protocol (true 390 px mobile emulation) against a local backend and a temporary SQLite database. Covered connected and not-connected Arabic on desktop and mobile, English with the folds open, dark mode, and the linking flow.
