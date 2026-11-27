# Mobile — sign-in screen design

`/m/signin` (`src/mobile/auth/MobileAuth.jsx`, `MobileSignIn`) has its own premium frame. Registration (`/m/register`) shares `AuthFrame` but keeps the plain frame: only `screen === "signin"` gets the new markup.

## Structure

`AuthFrame` for sign-in renders, in order:

1. `.sm-auth-hero`: a decorative navy band at the top of the page (`aria-hidden`).
   - It combines `--sm-hero` with a soft blue light from the start corner.
   - It fades into the page through a mask instead of ending in a hard edge.
2. `.sm-auth-brand`: the logo on a white tile, and the wordmark "SmartSpend".
   - The wordmark is `aria-hidden`, because the logo's `alt` already names the app.
   - It is wrapped in `<bdi dir="ltr">`, so it stays Latin in Arabic.
3. `.sm-auth-card`: one elevated card holding the heading, intro, sign-out notice, form, the "or" divider, Google sign-in and the "Create an account" link.
4. "Use the full version instead": quiet, below the card.

**What the sign-in markup adds:**
- the email/phone input sits in `.sm-auth-control` with a leading `LuUserRound` icon;
- `PasswordInput` takes an optional `icon` (sign-in passes `LuLockKeyhole`; registration passes none and is unchanged);
- the submit button wraps its label in a `<span>` and shows a `LuArrowRight` when not busy;
- the classes `sm-auth-premium`, `sm-auth-intro`, `sm-auth-remember`, `sm-auth-submit` and `sm-auth-switch`.

All icons are `aria-hidden`. Fields, handlers, `data-sm-*` hooks, `claimMobile()`, the destination logic and the Google component are unchanged.

## Styles

They are in `src/mobile/styles/mobile.css`, section "Mobile sign-in, premium frame". Every rule is under `.sm-root.sm-auth-premium`. They use only existing tokens, plus three local custom properties: `--sm-auth-field`, `--sm-auth-ring` and `--sm-auth-ease`. Light and dark follow `html[data-theme]`.

- **Fields:** each is one composite control, about 3.125rem tall: the leading icon, then the input, then (for the password) Show/Hide.
  - It is lightly filled (`--sm-auth-field`), with a 1.5px border. The input inside draws no border or outline.
  - On focus (`:has(.sm-input:focus)`) the control turns the surface colour, its border becomes `--sm-focus`, it gets a soft 4px ring, and the icon takes the brand colour.
  - When invalid, the control takes a `--sm-neg` border, a faint red tint and a red icon.
  - When disabled (busy), it is dimmed.
- **Icon side:** the icon is a flex sibling of the input, not padding inside it. The inputs are `dir="ltr"` for email and phone, so padding would land on the wrong side in Arabic. As a sibling, the icon always sits at the reading start.
- **Show/Hide:** a quiet text button inside the password control that keeps the 44px target.
- **Validation text:** 0.8125rem, semibold, in the error colour.
- **Primary button:**
  - full width, 3.25rem tall, a restrained blue gradient and a soft glow;
  - on hover, slightly brighter, and the arrow leans forward 3px;
  - on press, a slight scale;
  - the arrow is mirrored in Arabic (`:dir(rtl)`);
  - while busy (`aria-busy`), the arrow is replaced by a spinner (`::before`, reusing `sm-spin`).
- **Errors and the sign-out note:** tinted panels with a 3px accent on the inline-start edge. The error panel rises in briefly.
- **Remember me:** a plain checkbox row, not a bordered option card.
- **Google:** Google renders its own button, which can't be restyled.
  - It is centred.
  - While it loads, a quiet pill placeholder of the same height keeps the layout still.
  - Its notes are small and centred.
- **"Create an account":** wraps as one unit (`inline-block`), never split across lines.
- **Motion:** the brand, then the card, then the way out rise in once (`sm-auth-rise`, about 0.5s, staggered). With `prefers-reduced-motion: reduce` there is:
  - no entrance or error animation;
  - no transitions, no press scale and no arrow movement;
  - no spinning (the spinner stays static).

## Constraints the CSS respects

These are enforced by `tests/mobileBoundaries.test.mjs`:
- every selector starts with `.sm-root` (or `:root[data-theme="dark"] .sm-root`);
- no media query other than `prefers-reduced-motion`, so narrow screens use `clamp()` for the gutter, card padding and title size;
- logical properties only.

Arabic gets no negative letter-spacing on the title, and a taller line height (`:lang(ar)`).

## Checked

In headless Chrome, at 360, 390 and 430 px, in English and Arabic, light and dark (390 px), and Arabic at 320 px with 2× text:
- no horizontal overflow;
- the focus ring shows on the password control;
- the error states render;
- no page errors.

The checks used a local dev server with no API. Real devices were not checked.

## Known limit

Google chooses its button's language itself. In local checks it rendered in Arabic on English pages, even in a fresh browser profile, although the button is given `locale: "en"` (`getGoogleButtonOptions` in the shared `googleIdentity.js`, unchanged here). This needs a check on real devices and accounts.
