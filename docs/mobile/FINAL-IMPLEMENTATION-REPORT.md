# Mobile — implementation report (after the product decisions)

**Verdict: UI SOURCE COMPLETE WITHIN THE PRODUCT DECISIONS — BACKEND, STAGING AND DEVICE GATES REMAIN OPEN.**

Every Mobile feature allowed by the product owner's decisions exists in source. The decisions:
- **A — PDF:** approved, backend PDFs only.
- **B — funding preview:** not approved; stays blocked.
- **C — Google sign-in:** conditionally approved, local source only.

What is left needs external evidence. The item list for each is in BACKEND-VERIFICATION-HANDOFF.md:
- **Backend:** no write can open until it is verified against Laravel.
- **Decision B:** `POST …/funding-preview` stays blocked until the backend shows it has no lasting or consequential effect (handoff §4).
- **Google:** real Google OAuth on an authorised staging origin (handoff §6).
- **Staging and devices:** hosting and physical-device validation.

None of this means production-ready. Nothing was pushed, merged or deployed.

Branch: local `integration/mobile`.

| Pass | Range | Commits |
|---|---|---|
| Earlier passes | `eff8fff` → `f8003b3` | see git log |
| Final source closure | `f8003b3` → `ac7e7ae` | documentation, PWA re-run, coverage matrix |
| Product decisions | `ac7e7ae` → final | `39db937` (decisions A and C, funding preview stays blocked, title fix) and the documentation commit (handoff, verdicts) |

## Verdicts, kept separate

| Question | Answer |
|---|---|
| Mobile UI source complete | **Yes**, within decisions A–C. Funding preview is blocked by decision B, not missing. |
| Verified through tests and mocks | **Yes**: unit and jsdom tests, plus Chrome against a fictional mock API. |
| Verified against the real Laravel backend | **No.** |
| Financially safe for real users | **No financial write is enabled**, so no money can move from Mobile. Opening any write needs the handoff evidence. |
| PWA verified on staging | **No**: verified locally only. |
| Verified on physical devices | **No.** |
| Ready for a controlled production release | **No.** |

## Decisions applied

| Decision | What the source does |
|---|---|
| A — PDF | Exports downloads ready PDFs from `GET …/download` only. Saved names are cleaned (basename only, no control or reserved characters, no leading dots, 120 characters at most, fallback `smartspend-{report}-{id}.pdf`). Denied (403), gone (404/410), failed and expired states are shown. No PDF library or Desktop PDF module is imported. The export form offers PDF and ends disabled. |
| B — funding preview | No Mobile code calls `POST …/funding-preview` (guard test in `tests/mobileReadOnly.test.mjs`). The confirm review says multi-account funding information is unavailable. The write gate is unchanged: no POST is exempted. |
| C — Google | `/m/signin` uses the full version's `useGoogleSignIn` hook and `googleIdentity` loader. These are the only two files allowed across the boundary, and they are unchanged. It uses the same AuthProvider and session storage. Handled: consent required (accept or cancel), failure, Google not loading or not configured, popup and installed-app notes. Password sign-in stays. Covered by mocks only. |
| Title | The sign-in heading is "Sign in" / "تسجيل الدخول", with SmartSpend in the intro. Titles wrap at word boundaries. No scaling cap and no clipping (checked at 320 px with 2× text, both languages and themes). |

## Evidence (final source `39db937`)

- **Tests:** 1,591 of 1,591 pass; lint is clean; Smart Savings flag on 12 of 12.
  - The real AuthProvider runs against a fake server. Sign-in sends `POST /login` + `GET /user`; registration sends `POST /register` and goes on to Profile; a 401 stores nothing and is not retried.
  - This found and fixed a defect: a successful registration skipped Profile.
- **Builds:**
  - Flag-off is byte-identical to the build verified in earlier passes (150 files).
  - The Google modules stay in the full version's existing chunk.
  - A retire build emits no worker.
- **Mobile browser:** 0 JavaScript errors and 0 non-GET requests in every run. Jobs:
  - 48 on the decisions (sign-in, registration, exports, funding note), with sign-in in all four language and theme combinations at 320 px and 2×;
  - 171 on the six groups;
  - 265 on earlier screens.

  The only elements wider than the screen are cells of the forecast and trend tables, which scroll inside their cards. The list is identical to the previous pass.
- **Desktop:** flag off and flag on, 36 jobs each against baseline `33070de`.
  - Text and HTML are identical; no writes; Mobile code is never loaded.
  - Pixel differences are the logo anti-aliasing patch and today's date only.
- **Two tabs:** 18 jobs, 0 errors, 0 writes. A sign-out elsewhere goes to `/signin` or `/m/signin`.
- **PWA:** see PWA-AND-DEVICE-QA.md, "Product-decision re-run".
- **Review package:** `F:\Projects\smartspend-mobile-review\smartspend-mobile-product-decisions-review.zip`. 574 screenshots and `INDEX.txt` only, fictional data.

## Not verified

- **Backend:** no Laravel backend; no write is enabled; handoff evidence is not yet supplied. The 2026-11-01 discovery pass could not reach the backend source (BACKEND-VERIFICATION-RESULTS.md).
- **Google:** no real Google OAuth; the client ID origin is not checked.
- **Devices:** no physical device, screen reader, real microphone or camera.
- **Staging:** no staging host.
- **Coverage:** the browser matrix is sampled, not every combination.
