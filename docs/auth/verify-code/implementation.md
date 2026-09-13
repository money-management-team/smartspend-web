# Verify Code — Implementation

Recovery step 2 at `/verify-code`:

- `src/features/Auth/VerifyCode/VerifyCode.jsx`
- `src/features/Auth/VerifyCode/VerifyCode.css`, which holds the OTP inputs, the sent-to and resend lines, and the promo users pill.

## Structure

```
AuthPromo (verifyCode.promo.title / subtitle)
  .verify-users → decorative avatars (S, M, A) + verifyCode.promo.users

section.auth-panel
  AuthSteps current=2
  AuthHeading  icon = ShieldCheckIcon (verifyCode.title / subtitle)
  form.auth-form
    div.verify-code[role=group][dir=ltr]   4 × input.verify-code__input
    p.verify-sent                          codeSent + <strong><bdi>05•••••21</bdi></strong>
    AuthButton submit                      verifyCode.submit
    p.verify-resend                        prefix + text button (secondary, below the CTA)
  AuthBackLink → PATH.AUTH.FORGOT_PASSWORD (verifyCode.editPhone)
```

## OTP input logic (unchanged)

- The inputs are **uncontrolled** and tracked in `inputsRef`.
- **Typing:** each input keeps one digit (non-digits are stripped) and moves focus to the next input.
- **Backspace** on an empty input moves focus back one.
- **Paste** anywhere in the group fills up to 4 digits and focuses the last filled input.
- **Submit** joins the values and logs them. **Resend** logs a message. No API is wired yet.
- The masked phone number is a hard-coded placeholder.

## Input states

| State | How it's detected | Style |
| --- | --- | --- |
| Empty | `:placeholder-shown` (placeholder is a single invisible space) | Control background, standard border |
| Filled | `:not(:placeholder-shown)` | Primary-tinted border and background |
| Focus | `:focus` | Primary border + 4px focus ring |
| Error | `[aria-invalid="true"]` | Danger border and tint; danger focus ring. Ready for when verification returns an error; nothing sets it yet |
| Disabled | `:disabled` | 60% opacity, not-allowed cursor |

The inputs use `flex: 0 1 60px; min-width: 0`, so they shrink on narrow screens (they fit at 320px) instead of overflowing.

## Accessibility and i18n

- The group is labelled by the page title. Each input gets `auth.verifyCode.digitLabel` ("Digit 1 of 4"), which replaced a hard-coded English label.
- The digits stay LTR in Arabic (`dir="ltr"` on the group). The phone number is isolated with `<bdi>`.
- The users pill keeps its avatars LTR so the overlap order is stable, and swaps its padding in RTL.

## Notes

- "Edit phone number" used to be `href="#forgot-password"`, which only changed the URL hash. It is now a router link to `PATH.AUTH.FORGOT_PASSWORD`.
- There is no resend countdown in the current logic, so none is shown.
