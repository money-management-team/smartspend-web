# Password Changed — Implementation

Recovery step 4 (success) at `/password-changed`: `src/features/Auth/PasswordChanged/PasswordChanged.jsx`. It has no page stylesheet.

## Structure

```
AuthPromo (passwordChanged.promo.title / subtitle)      no extras

section.auth-panel
  AuthSteps current=4                                    all bars filled
  AuthHeading  tone="success", icon = CheckIcon (passwordChanged.title / subtitle)
  div.auth-form
    AuthButton to = PATH.AUTH.SIGNIN                     renders a router <Link> styled as the primary CTA
```

## Design

- The success state reuses the shared heading with `tone="success"`:
  - a 68px green gradient circle with soft halo rings and a larger check;
  - a one-time pop-in animation, disabled under reduced motion.
- The return-to-sign-in action uses the same primary button as every other auth CTA, so the page stays inside the auth system rather than being a separate success screen.

## Notes

- The sign-in link used to be `href="#login"`, which only changed the URL hash. It is now a router link to `PATH.AUTH.SIGNIN`.
- The page previously had an RTL-only shorter brand panel and an unused `isArabic` variable, which was a lint error. Both were removed.
