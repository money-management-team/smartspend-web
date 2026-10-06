# Business account routes

The personal backend's registration always creates a personal workspace and
does not validate or persist the company name or team size from the legacy web
form. Both company auth routes now show `CompanyUnavailable` and do not call
`/register` or `/login`. The account type card says "Coming soon".

## "Under development" page

`CompanyUnavailable` (`src/features/Auth/CompanyUnavailable/`) is the page served
at `/register/company` and the company sign-in route. It reuses `AuthPromo`,
`AuthHeading`, `AuthButton` and the `--auth-*` tokens, and adds its own
`company-unavailable*` classes in `CompanyUnavailable.css`:

- animated building illustration and an "Under development" badge;
- a short roadmap card (company registration, roles and permissions, shared
  budgets and reports);
- primary action to create a personal account, plus a link back to the account
  type screen.

Copy lives under `auth.companyUnavailable.*` in both locale files (`badge`,
`promo.*`, `roadmap.*` were added for this page). RTL: logical properties are
used throughout and the back arrow is mirrored under `[dir="rtl"]`. The pulse
and blink animations are disabled under `prefers-reduced-motion`.

The previous company presentation components remain in the source as design
references. Enable a real company flow only after a dedicated backend contract
defines registration, business workspace creation, roles, ownership and
post-login routes. Apple OAuth has no backend endpoint, so its inert button is
not rendered by `AuthSocial`.
