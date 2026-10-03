# Business account routes

The personal backend's registration always creates a personal workspace and
does not validate or persist the company name or team size from the legacy web
form. Both company auth routes now show `CompanyUnavailable` and do not call
`/register` or `/login`. The account type card says "Coming soon".

The previous company presentation components remain in the source as design
references. Enable a real company flow only after a dedicated backend contract
defines registration, business workspace creation, roles, ownership and
post-login routes. Apple OAuth has no backend endpoint, so its inert button is
not rendered by `AuthSocial`.
