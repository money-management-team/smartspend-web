# Mobile — implementation report (after the unblocked-feature pass)

**Verdict: IMPLEMENTATION PARTIAL — UNBLOCKED WORK STILL REMAINS.**

This pass built the large unblocked groups:
- forms and reviews for every documented change, all ending at a disabled send;
- the assistant, receipt and voice capture, WhatsApp, and profile and settings;
- search, the monthly review, quick entries, saved filters, Home periods and layout, hide amounts;
- the import preview and the export form;
- the PWA rollback from a flag-off build.

A short list of unblocked items is still open (FEATURE-COVERAGE-MATRIX.md, "Still open"). No backend was available, so **no write is enabled**, and nothing is backend-verified.

Branch: local `integration/mobile`. Nothing was pushed, merged or deployed.

| Pass | Range | Commits |
|---|---|---|
| Earlier sprints | `eff8fff` → `443d7d9` | `b21b760`, `9fe88c7`, `abe0ed9`, `2f00120`, `355ee62`, `a45799b`, `443d7d9` |
| This pass | `443d7d9` → final | `a577b8d` forms; `3ac2833` assistant, captures, WhatsApp, profile; `12c0e41` Home, tools, import preview; `7205aad` PWA retire worker, test-loader fix; `b1875a9` layout fixes and docs; the final layout and documentation commit |

## Completion levels

| Level | State |
|---|---|
| Implemented in source | Read-only screens; 30 write-disabled forms with reviews; local-only voice, receipt and import preview; device preferences; search; monthly review; PWA with rollback |
| Tested with fictional mocks | Yes: 1,569 / 1,569 tests (from either drive-letter spelling); browser matrix on the final build |
| Verified against an actual backend | **No** |
| Financially safe for real users | **No** write is enabled, so nothing financial can happen from Mobile |
| PWA locally tested | Yes, in headless Chrome, including rollback from a flag-off build |
| Verified on physical devices | **No** |
| Release-ready | **No** |
| Deployed | **No** |

## Evidence from this pass

**Write gate.** No file in `src/mobile/forms/` has request code; none of the 30 form operations is in the write gate. Every journey test runs against a fake backend that fails on any non-GET. The bypass attempts tested are listed in SECURITY-AND-FINANCIAL-GATES.md §1.

**Desktop, flag off.** The final flag-off build is **byte-identical** (150 files) to the build verified in the previous pass, whose stylesheet matched the original baseline. In the browser (36 jobs):
- URL, visible text, API calls and errors are identical to the baseline `33070de`;
- 0 writes; Mobile code is never requested.
- Pixel differences are the 24×28 px logo anti-aliasing patch and today's date on Financial operations. Both also appear between two byte-identical builds, so they are rendering noise, not code.

**Desktop, flag on with Desktop chosen.** The same 36 jobs on the final flag-on build:
- URL, visible text, API calls and errors are identical to the baseline `33070de`;
- 0 writes; Mobile code is never requested;
- pixel differences in 9 jobs, all the same logo patch and today's date.

**Two-tab identity (final flag-on build, 18 jobs, Desktop and Mobile).**
- 0 requests with B's token while A was on screen.
- A sign-out elsewhere goes to `/signin`.
- A workspace switch and an unrelated key keep A.
- A slow A request in flight never reappears.
- 0 errors, 0 writes.

**Mobile.** 53 screens and states, each in 5 variants (265 jobs, on the final build: 0 JavaScript errors, 0 non-GET requests, 0 page-level horizontal scroll, one `h1` per page):
- 390 px English light and Arabic dark;
- 320 px English at 2× text;
- 430 px Arabic at 1.5× text;
- 360 px English dark at 1.25× text.

Defects found and fixed in this pass:
- **The long-standing 1–4 px overhang at 2× text on 320 px:** `.sm-root`'s implicit grid column grew to the compact bar's content.
- **A long list of choices overflowed:** fieldsets are as wide as their widest content by default.
- **Values didn't wrap:** an email address, for one.
- **The forecast card grew with its table.**
- **Action rows covered content:** sticky action rows covered the error summary at 2× text.
- **A preview could crash the page:** an object URL the browser couldn't create (now "no preview").
- **The import preview treated equal amounts as different:** 12.50 and 12.5 (now compared without trailing zeros).

The forecast's day-by-day table scrolls inside its card by design; its off-screen cells are the only ones the checker reports as clipped.

**Review package:** `F:\Projects\smartspend-mobile-review\smartspend-mobile-unblocked-feature-review.zip` (outside the repository): 355 screenshots and `INDEX.txt`; fictional data only, no source, credentials, environment files or fonts.

**PWA rollback.** Verified in Chrome on the final source:
- staging PWA build → flag-off build with `SMARTSPEND_MOBILE_PWA_RETIRE=true`: worker and cache gone on the first Mobile visit;
- control run without it: the worker stays.

**Intermittent test failures.** The cause is reproduced and fixed. From a working directory spelled `f:\`, Node loaded the same React file under two URLs (`file:///f:/…` and `file:///F:/…`). The result was two copies of React and 5 of 6 `experienceRendering` tests failing. `tests/helpers/loader.mjs` now gives every resolved file URL one drive-letter spelling. The full suite passes from `f:\` and from `F:\`.

## Outstanding

- **Unblocked, not done:** FEATURE-COVERAGE-MATRIX.md, "Still open":
  - Smart Savings plan options and installment reviews;
  - AI feedback and conversation-delete reviews;
  - report trend charts;
  - Mobile PDF;
  - a disabled mark-as-read control;
  - a Mobile-specific sign-in presentation.
- **External blockers:**
  - backend source or an isolated backend (the checklist in BACKEND-CONTRACT-GAPS.md);
  - physical iOS and Android devices with VoiceOver and TalkBack, real microphones and cameras;
  - a staging origin for hosting headers and the PWA;
  - product-owner wording for WhatsApp consent;
  - a release approval.
