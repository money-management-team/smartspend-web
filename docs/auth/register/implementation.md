# Register — Implementation

Registration page at `/register`:

- `src/features/Auth/Register/Register.jsx`
- `src/features/Auth/Register/Register.css`, which holds only the promo feature cards and the tighter form gap.

## Structure

```
AuthPromo (register.promo.title / subtitle)
  ul.register-features → 3 × li.register-feature (Shield / Sparkles / Card icon + title + description)

section.auth-panel
  AuthHeading (register.title / subtitle)
  form.auth-form.register-form          16px gap instead of 18px (four fields + consent)
    AuthField      #register-name              UserIcon, autocomplete "name"
    AuthField      #register-identifier        MailIcon, autocomplete "username"
    PasswordField  #register-password          minLength 8, autocomplete "new-password"
    PasswordField  #register-confirm-password  minLength 8
    AuthCheckbox   #register-terms             label contains the terms link (#terms)
    AuthAlert                                  general error
    AuthButton     submit                      loading → auth.register.loading
  AuthSocial                                   register.social.*
  AuthSwitchPrompt                             → PATH.AUTH.SIGNIN
```

## Form state

The form state uses camelCase names. Backend names appear only in the payload built at submit time.

```js
{ name, identifier, password, passwordConfirmation, termsAccepted }
```

Each input's `name` attribute matches its state key, so the shared `handleChange` updates the right key and clears that field's errors.

## Payload mapping

`toRegisterPayload(form)` in `Register.jsx` builds the body for `POST /register` (contract in [../api.md](../api.md#register-request-body)):

| Form state | Backend field |
| --- | --- |
| `name` (trimmed) | `name` |
| `identifier` (trimmed) | `identifier` |
| `password` | `password` |
| `passwordConfirmation` | `password_confirmation` |
| `termsAccepted` | `terms_accepted` |
| `termsAccepted` | `privacy_accepted` |

**Single consent checkbox:** the page has one checkbox, labelled "I agree to the Terms & Privacy Policy". It covers both documents, so its value is sent as both `terms_accepted` and `privacy_accepted`. If the product later needs separate consent, add a second `AuthCheckbox`, a `privacyAccepted` state key, and point `privacy_accepted` at it in both maps. Note that the `auth.register.terms.*` keys are shared with `CompanyRegister`.

## Validation

| Rule | Where | Message |
| --- | --- | --- |
| All four text fields required | Browser (`required`) | Native |
| Passwords ≥ 8 characters | Browser (`minLength={8}`) | Native |
| Consent must be accepted | `handleSubmit`, before any request | `auth.register.terms.required`, shown under the checkbox |
| Server rules (length, unique identifier, email/phone format, letter + number in password, password match, consent) | Backend `VALIDATION_ERROR` | Per field, see below |

The page doesn't repeat the backend rules. The backend stays the source of truth.

## Error handling

On `VALIDATION_ERROR`, `toFormErrors(error.errors)` renames the backend fields through `FORM_FIELD_BY_API_FIELD`:

| Backend field | Shown under |
| --- | --- |
| `name` | `#register-name` |
| `identifier` | `#register-identifier` |
| `password` | `#register-password` |
| `password_confirmation` | `#register-confirm-password` |
| `terms_accepted`, `privacy_accepted` | `#register-terms` (messages merged, duplicates removed) |

Unknown backend fields are ignored for per-field display. Every error, validation included, also shows `getApiErrorMessage(error, t)` in `AuthAlert`, so rate-limit, network, timeout, server, and malformed-response errors use the shared `api.errors.*` copy instead of raw technical messages.

On failure, every entered value is kept, passwords included.

## Success

1. `AuthProvider.register()` validates the response (`token` and `user` are required).
2. It persists the token, user, personal workspace, and role through `persistAuthSession` (always `localStorage`) and updates the in-memory session. No login request is made. See [../flow.md](../flow.md#register).
3. The page navigates to `PATH.USER.DASHBOARD` with `replace: true`.

## Submitting state

While a request is in flight, `isSubmitting` disables every input, the checkbox, the password toggles, and the button. The button shows a spinner and `auth.register.loading`. `handleSubmit` also returns early, so the form cannot be submitted twice.

## Layout notes

- The form is the tallest in the auth flow (about 790px card height on desktop). The brand panel stretches to match, and its content stays vertically centered. The fields stay single-column so the long placeholders and the show/hide toggle have room.
- The feature cards use the same frosted-glass treatment as the promo chips. At ≤1024px they get tighter padding. At ≤900px the whole panel is hidden.

## Notes

- The terms error used to be a hard-coded Arabic string. It now comes from the locale files.
- The submit button used to go blank while submitting. It now shows `auth.register.loading` with a spinner.
- The terms link (`#terms`) has no destination page yet.
- The Google button signs up or in through `loginWithGoogle` (always remembered). The consent checkbox isn't required for it. See [google-sign-in](../google-sign-in/implementation.md).
- `CompanyRegister` still sends the older payload without `terms_accepted` / `privacy_accepted`. It is not part of the personal registration integration.
