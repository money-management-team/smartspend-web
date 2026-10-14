# WhatsApp experience design (Settings → Integrations)

The WhatsApp tab explains the feature and runs it. Behaviour (APIs, linking, preferences, unlink) is unchanged and documented in `linking-ui.md`. This page covers layout, copy and visual rules.

## Page order per state

| Block | disabled | not_linked | linked |
| --- | --- | --- | --- |
| Hero (value, status badge, example chat) | yes, no action | yes, **Connect WhatsApp** | compact, no example, no action |
| State body | unavailable panel | 3 onboarding steps, or the linking flow once started | status + featured drafts card |
| Drafts inbox link | after the panel | last on the page | featured beside the status |
| Trust note (no money moves from WhatsApp) | yes | yes | yes |
| How it works (5 steps) | no | open | folded (`<details>`) |
| Manage link (preferences, disconnect) | no | no | if `can_manage_link` |
| FAQ (6 questions, `<details>`) | yes | yes | yes |

One primary action per screen: Connect when not linked, the drafts card when linked. Starting the link moves focus to the flow panel.

## Content rules

- Arabic first; Arabic strings write the brand as «سمارت سبند» and contain no Latin words (tested), English mirrors them.
- The chat example (`WhatsAppChatPreview`) uses the backend's v2 wording (menu, buttons, summary, saved draft). It is a `<figure>` labelled "Example", its inner markup is `aria-hidden`, the figure's `aria-label` describes it in one sentence, and it contains no buttons or links.
- Only real capabilities are described: drafts only, confirmation in SmartSpend, automatic default account changeable via Edit, link messages that expire. No security claims beyond that.
- There is no "Open WhatsApp" button once linked: `GET /integrations/whatsapp` does not return the service number (only the link-challenge response does). The connected state says to open the SmartSpend chat and send «مرحبا». Adding `public_number` to the availability response would allow a `wa.me` button later.

## Visual rules

- SmartSpend blue (`--color-primary`, `--gradient-primary`), a component-scoped cyan (`--wa-cyan`) and navy (`--wa-navy`) carry the page. WhatsApp green (`--wa-accent`) appears only on the WhatsApp mark, the first how-it-works step, the linked status icon and the "Open WhatsApp" link in the linking flow (button width, full width only on narrow screens).
- Light and dark through tokens; dark mode switches the hero to a navy gradient and the chat to dark bubbles.
- Layout uses container queries on `.wa-integration`, so it follows the width of the Settings area: hero art beside the copy from 760 px, onboarding in 3 columns from 640 px, connected status + drafts side by side from 820 px, how-it-works in 5 columns from 900 px, single column below 560 px.
- Loading is a skeleton with the page's shape (`role="status"`, `aria-busy`, a visually hidden text).
- Motion: entrance rise, staggered chat bubbles, a 3-cycle pulse on the linked dot, skeleton shimmer. All disabled by `prefers-reduced-motion`.

## Discoverability

Settings → Integrations (`?tab=integrations`), the dashboard search ("واتساب"/"whatsapp" finds Settings), the sidebar draft inbox, the drafts page header link, and the empty pending-drafts state, which links to this tab ("How to record from WhatsApp"). No dashboard card was added: it would need an extra availability request on every dashboard load.

## Tests

`tests/whatsapp-ui/whatsappUi.test.mjs` → "experience redesign": one primary action per state, onboarding replaced by the flow with focus moved, the example has no controls, linked order (status → trust → manage → FAQ), folded guide, linked without details still links to the inbox, disabled keeps only the inbox link, skeleton, Arabic content. `draftInbox.test.mjs` checks the empty-state link.
