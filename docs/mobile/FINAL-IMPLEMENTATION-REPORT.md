# Mobile — implementation report (after the final source closure)

**Verdict: MAXIMUM SAFE SOURCE IMPLEMENTATION COMPLETE — RELEASE GATES REMAIN OPEN.**

Every Mobile feature that can be built within the current rules now exists in source. That means without the backend, without a product decision and without crossing the Mobile import boundary.

What is left needs a decision or external evidence:
- **On-device PDF:** needs an import-boundary exception.
- **Multi-account funding review:** needs a decision that `POST …/funding-preview` is a read.
- **Google sign-in inside Mobile:** needs a boundary exception.
- **Backend:** no write can open until it is verified.
- **Staging and devices:** hosting and physical-device validation.

None of this means production-ready. Nothing was pushed, merged or deployed.

Branch: local `integration/mobile`.

| Pass | Range | Commits |
|---|---|---|
| Earlier passes | `eff8fff` → `17d78ee` | see git log |
| Final source closure | `17d78ee` → final | `7fb5c31` (Smart Savings, AI feedback and delete, trends, PDF downloads, mark as read), `9586419` (Mobile sign-in and registration), `f8003b3` (browser-pass fixes and docs), and the final documentation commit |

## The six feature groups

| Group | State |
|---|---|
| Smart Savings | **Shown:** plan details, health, open installments, and plan options per rhythm for a goal with no plan. **Reviews:** confirm (preview read first; backend's amount, accounts and blocker), postpone (the backend's stated date rules), skip ("Keep it" by default). **Sends nothing:** every last button is disabled. **Flag:** off means no code, string or request in the build. |
| AI feedback and delete | Feedback on answers and insights: rating, optional reason, comment of at most 1,000 characters. The delete review says what is known from the source and removes nothing. |
| Report trends | `trend_by_currency`, one chart per currency, in date order, with gaps and negatives as sent. A table has every figure. Day, week or month in the address. |
| PDF | Backend-built PDFs download from Exports ("Download PDF", named `smartspend-{report}-{id}.pdf`). PDF is offered in the export form, which ends disabled. On-device PDF is blocked by the import boundary (FEATURE-COVERAGE-MATRIX.md, "Still open"). |
| Mark as read | Per unread row and for all, both disabled with an explanation. The unread count is the server's and is never changed optimistically. |
| Mobile sign-in and registration | `/m/signin` and `/m/register` on the app's AuthProvider (`login`, `register`). The fields and the Remember me default are the full version's. Shell screens send signed-out visitors there with a safe return address. Google sign-in and password reset link to the full version's pages. |

## Evidence (final source `f8003b3`)

- **Tests:** 1,579 of 1,579 pass from `F:\` and from `f:\`; lint is clean. Smart Savings is tested with its flag off and on.
- **Builds:**
  - Flag-off is byte-identical to the build verified in earlier passes (150 files).
  - Smart Savings text exists only in its lazy chunk.
  - A production build with the retire option emits no worker.
- **Mobile browser:**
  - 171 jobs on the six groups: 19 screens and states × 9 sampled variants, covering 320, 360, 390 and 430 px, English and Arabic, light and dark, 1.25×, 1.5× and 2× text, and landscape.
  - 265 jobs re-run on the earlier screens.
  - Results: 0 JavaScript errors, 0 non-GET requests, 0 page-level horizontal scroll, one `h1` per page.
  - The only elements wider than the screen are cells of the forecast and trend tables, which scroll inside their cards by design.
- **Desktop:**
  - Flag off and flag on with Desktop chosen, 36 jobs each against the original baseline `33070de`.
  - URL, text, API calls and errors are identical; no writes; Mobile code is never loaded.
  - Pixel differences are the logo anti-aliasing patch and today's date only. Both also appear between byte-identical builds, so they are rendering noise.
- **Two tabs:** 18 jobs, 0 requests with B's token while A was shown, 0 errors and 0 writes. A sign-out elsewhere goes to `/signin` on Desktop and `/m/signin` on Mobile.
- **PWA:**
  - Scope `/m/`; the cache holds only `/assets/*`; Desktop pages are not controlled.
  - The offline page and update-on-tap work.
  - With the retire worker, the worker and caches are gone after rollback. The control run without it keeps them.
- **Defects found and fixed in this pass:**
  - A centred standalone page lost its top when taller than the screen.
  - The password field was squeezed at 2× text on 320 px.
  - Choice labels broke mid-word.
  - An opened trend table widened the page.
  - Trend series showed raw field names.
- **Review package:** `F:\Projects\smartspend-mobile-review\smartspend-mobile-final-source-closure-review.zip`: 526 screenshots and `INDEX.txt`, fictional data only.

## Not verified

- **Backend:** no backend; no write is enabled.
- **Devices:** no physical device, screen reader, real microphone or camera.
- **Staging:** no staging host.
- **Coverage:** the browser matrix is sampled, not every combination.
