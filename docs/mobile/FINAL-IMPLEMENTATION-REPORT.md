# Mobile — implementation report (after the safe completion pass)

**Verdict: IMPLEMENTATION PARTIAL — UNBLOCKED WORK STILL REMAINS.**

- **Verification:** this pass completed the shared-auth gate, the Desktop and Mobile browser regression, the PWA, and the backend evidence checklist.
- **Not done:** the gated forms and several read-only feature groups were not built (FEATURE-COVERAGE-MATRIX.md lists them).
- **Backend:** none was available, so every write stays closed.

Branch: local `integration/mobile`.

| Sprint | Range | Commits |
|---|---|---|
| Earlier sprint | `eff8fff` → `2f00120` | `b21b760`, `9fe88c7`, `abe0ed9`, `2f00120` |
| This pass | `2f00120` → final | `355ee62`, `a45799b`, and the documentation commit |

No push, merge or deployment was made.

## Completion levels

| Level | State |
|---|---|
| Implemented in source | Read-only screens through P27/P33/P36, the write gate, the cross-tab auth fix, the PWA |
| Tested with fictional mocks | Yes: 1,508 / 1,508 tests; 114 Mobile and 36 × 4 Desktop browser jobs; the PWA lifecycle; the two-tab run |
| Verified against an actual backend | **No** |
| Financially safe for real users | **No:** no write is enabled |
| PWA locally tested | Yes, in headless Chrome on a local origin |
| Verified on physical devices | **No** |
| Release-ready | **No** |
| Deployed | **No** |

## Evidence from this pass

**Shared auth (two-tab, real browser).** On Desktop and Mobile:
- No request carried B's token while A was visible.
- No A-token request was sent after B's first.
- An in-flight A response never reappeared.
- Sign-out goes to `/signin`.
- The workspace-switch write-back bug was found and fixed (`355ee62`).

Details in SECURITY-AND-FINANCIAL-GATES.md §4.

**Desktop parity.** 36 jobs (18 pages × English light and Arabic dark) were run on four builds: the original baseline `33070de`, `eff8fff`, flag-off and flag-on in Desktop mode.
- URL, visible text, API calls, JavaScript errors (0) and the absence of the Mobile chunk were identical everywhere.
- Every pixel difference is the 377/388 px logo anti-aliasing patch. `eff8fff` shows the same patch against the baseline, without the auth change.
- One 129-px header variation appeared in 1 of 3 runs on the same flag-off build, and in 0 of 3 on the baseline. It is run-to-run noise: the same build differs from itself.
- One DOM difference on Reports (Arabic, dark) did not repeat in 3 further runs per build.
- **The final flag-off build is byte-identical to the build that was compared.** Its stylesheet is byte-identical to the original baseline.

**Mobile.** 114 jobs: every new screen plus Home, Accounts, Activity, Planning, Categories and More, in four states each:
- 390 px in English light and in Arabic dark;
- 320 px at 2× text;
- 430 px at 1.5× text in Arabic;
- plus empty and error states, 1.25× text and landscape.

Results:
- 0 JavaScript errors, 0 page overflow and 0 clipped amounts; every request a GET; one `h1` per page.
- Defects found and fixed: a card nested inside a card overflowing at 2× text, and the calendar month bar collapsing at 2× text. The second passed the geometric checks and was caught only by eye.
- Left as is: a 1-px overhang on Notifications at 2× / 320 px, with no scroll; small presentation radios (24 px) inside 44-px labels, as before.

**The intermittent `experienceRendering` failures.** Reproduced: 5 tests fail only when the working directory uses a lowercase drive letter (`f:`). Node then loads a second React instance, and `useContext` reads null. From `F:` the suite passes 1,508 of 1,508. Diagnostics are kept in the scratchpad (`full2-diagnostic.txt`).

**HTTP 408.** The earlier local evidence stands, unchanged (SECURITY-AND-FINANCIAL-GATES.md §2). It is not a claim about production.

**Visual review package:** `F:\Projects\smartspend-mobile-review\smartspend-mobile-safe-completion-review.zip` (outside the repository): 240 screenshots and `INDEX.txt`, with no source, credentials, environment files or fonts.

## Outstanding

- **Unblocked work not done:** see FEATURE-COVERAGE-MATRIX.md, "Still open, and could be built without the backend".
- **External blockers:**
  - backend source or an isolated backend (the 15 checklist items in BACKEND-CONTRACT-GAPS.md);
  - physical iOS and Android devices with VoiceOver and TalkBack;
  - a staging origin to verify hosting headers and the PWA;
  - product and legal decisions for WhatsApp;
  - a release approval.
