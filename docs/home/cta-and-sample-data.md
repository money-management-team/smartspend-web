# Home: buttons and sample data

## Buttons

| Button | Action |
| --- | --- |
| Hero "Watch the demo" | `scrollToSection("product-preview")`: scrolls to the dashboard preview section and focuses it. There is no video; the preview is the demo |
| AI section primary ("View insights") | `Link` to `PATH.USER.AI_ASSISTANT`. A guest is sent to sign-in by `RequireAuth` and returns to the assistant after signing in |
| AI section secondary ("See recommendations") | `scrollToSection("home-ai-example")`: scrolls to and focuses the example conversation next to it |
| Decorative send arrow in the AI example | Not a button any more (`role="img"` with an "example" label): the card is an illustration |

`components/scrollToSection.js` uses smooth scrolling unless `prefers-reduced-motion` is set, and moves keyboard focus to the target section (`tabIndex={-1}`), so keyboard and screen-reader users land there too. Targets have `scroll-margin-top` and no focus outline on the section itself. The new link/buttons have a visible `:focus-visible` ring.

## Sample data

Everything numeric on the page is illustrative. All text in those previews comes from `home.sample.*` (categories, transactions, months, "net", "used", "left", "spent", etc.) in both locales; month names come from `Intl.DateTimeFormat` in the current language; amounts and percentages stay LTR inside `<bdi>`. Brand-like names (Whole Foods, Netflix) are data and stay as they are.

The two product previews (hero mock and the browser mock) carry a small "Sample data" pill (`.home-sample-tag`, `home.sample.label`), and the AI card's "Live" badge became "Sample" (`home.sample.badge`). The section subtitle already says the numbers are not a real account.
