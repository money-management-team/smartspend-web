# Mobile — the HTTP 408 question: what must be proven, and how

**Status (2026-11-16): NOT SATISFIED. No evidence has been collected on any deployed stack.** Everything below is a plan and a record template. Nothing here may be quoted as "408 cannot happen" or "this safety requirement is satisfied". It is the shared release rule in [SECURITY-AND-FINANCIAL-GATES.md](SECURITY-AND-FINANCIAL-GATES.md) §3 ("proof that proxies and the app server never answer 408 after accepting the body, or that the write is idempotent anyway") and it is named by every per-feature "Before opening" list.

## 1. The risk, stated precisely

There are three different things that get called "a 408", and only one of them is dangerous.

| Case | What happened | Effect | Dangerous? |
|---|---|---|---|
| **A. 408 before the application ran** | A layer gave up waiting for the request headers or body (a slow client, a stalled upload, an idle connection) and answered 408 or closed the socket. The application never saw a complete request. | Nothing was recorded. A browser resend is the first and only copy. | No (only ambiguous for the person). |
| **B. 408, or a reset reused connection, after the application committed** | The request was fully read and processed, then a layer answered 408 or dropped the connection instead of passing the application's answer on. | The write **happened**; the client believes it did not. **A browser that automatically resends** (Chrome does, on HTTP/1.1, for a 408 and for a reused connection dropped after the body was read) delivers a **second copy of a processed request**. | **Yes.** This is what must be disproved. |
| **C. The client gives up or loses the answer after the application committed** | Mobile's own 20 s (or 90 s) timeout fires, the tab closes, or the network drops after the request was sent. | The write happened; the app reports an unknown outcome and **never resends by itself**. | Handled by the unknown-outcome rules and by server-side replay; not a 408 problem. |

What the earlier local evidence showed ([SECURITY-AND-FINANCIAL-GATES.md](SECURITY-AND-FINANCIAL-GATES.md) §2): with Chrome 156 over HTTP/1.1, the browser itself resent a POST or PATCH after a 408 and after a reused connection dropped once the body was read, the page saw one answer while the server saw two or three bodies, and over HTTP/2 every case arrived once. Two limits of that evidence:
- the count was unstable (2–3 in one run, 7 in an earlier one), so it must never be treated as a fixed number;
- the local servers counted arrivals **when the body was read**, not "after committing", so it shows that the browser resends, not that any real layer produces case B.

So the open questions are about the **real path**: does any layer between the browser and PHP produce case B, and over which protocol does the browser talk to it?

## 2. What decides it (and what does not)

- **The protocol on the browser's connection** matters most. The browser resend behaviour described above is HTTP/1.1 behaviour; over HTTP/2 it did not occur locally.
- **Proxy-side retries** are a separate mechanism: some proxies retry a request to the upstream by themselves. Whether one does, and for non-idempotent methods, is a question for the host.
- **The layers**, each of which can in principle answer 408 or reset: the browser's edge or CDN (if any), the web server (Apache, LiteSpeed or other), and the PHP handler. Which of them exist on the API path is **Unknown**: neither repository contains the configuration, and `public/.htaccess` has no timeout directive. Examples of settings that produce a 408 in some servers (a generic list, **hypotheses to ask about, not findings**): a request-header or request-body read timeout, and an idle keep-alive timeout.
- **Server-side deduplication** is what makes a duplicate harmless. Evidence about 408 does not replace it: a write whose duplicate has an effect (`duplicates`, `unique-index` creates, the unmerged-fix money writes) stays closed even if no 408 is ever seen.

A finite number of clean trials can **never prove that something cannot happen**. The most this plan can establish is: "on stack S, which we show is the same as production's, in N trials under conditions X, no case B occurred, and the host confirms configuration Y in writing". That statement, with its evidence, is the only form in which the requirement may be marked satisfied.

## 3. Preconditions

1. **A staging stack that is the same as production's**, shown by evidence and not by assumption: the same hosting plan type and web server, the same response header fingerprint (`server`, `via`, `alt-svc`, protocol), the same PHP handler and limits, confirmed in writing by the host. If staging is on a different plan, its result says nothing about production and the evidence is rejected.
2. Everything in [STAGING-READINESS.md](STAGING-READINESS.md) §3.1 (isolation) and §3.7 (logging).
3. The synthetic test accounts of §3.5, with `owner-a` having given AI consent (the probe below needs it).
4. **No production traffic of any kind.** Probing production is a separate decision for the owners and is not proposed here.

## 4. Instrumentation

The backend has **no request id** and logs none. The plan therefore uses three independent counters and compares them.

| Counter | What it counts | How |
|---|---|---|
| **Client clicks** | How many times the page called `fetch` | A page-level counter around `fetch`, plus the Chrome DevTools Protocol `Network.requestWillBeSent` count for the same request (it also shows `connectionReused` and the protocol) |
| **Origin arrivals** | How many requests the application actually processed | **Rows.** The probe endpoint creates one row per processed request, and the row carries the trial's unique title |
| **Edge log lines** | How many requests reached the web server, with status and duration | The host's raw access log, if the host can expose it |

### The probe endpoint: `POST /ai/conversations`

It is the right probe because it is **non-financial, harmless, not deduplicated by the backend** (a copy is another, empty conversation) and **accepts a `title`** (up to 191 characters, trimmed). Each trial sends a unique title such as `p408-<run>-<experiment>-<n>`, so after a run the number of processed arrivals for a click is exactly the number of conversations with that title (`GET /ai/conversations`, or a database count by title over SSH). Rows greater than clicks means a duplicate arrived and was processed. It is not behind the AI generation throttle (it makes no provider call), but it is behind the ordinary write throttle: pace the trials. Clean up at the end of the run by restoring the staging snapshot (or `DELETE /ai/data` for the test user).

Use the harmless non-keyed probe for the HTTP-layer experiments, and the keyed message write (section 5, E5) for the long-request experiment. Never use a financial endpoint.

### Time and artefacts

Record the clock offset between the tester's machine and the staging host (NTP), keep every raw artefact (CDP traces, access-log extracts, SQL output) in the evidence folder named in the record, and give each run an id used in every title.

## 5. The experiments (staging only)

Each is run with a **real browser** (headless Chrome driven over CDP, as in the earlier local runs) against the staging web origin and staging API, and again under a throttled mobile network profile, because these failures are timing-dependent. Sample sizes are minimums.

**E0. Stack fingerprint and protocol.**
- `curl -sv --http1.1 -o /dev/null https://<staging-api>/api/health-or-any-GET`, the same with `--http2`, and `curl -w '%{http_version} %{remote_ip}\n'`. Record `server`, `via`, `alt-svc`, the negotiated ALPN and the HTTP version.
- From the **real Mobile page** in Chrome, read `performance.getEntriesByType("resource")` and record `nextHopProtocol` (`h2` or `http/1.1`) for an API call.
- Get, **in writing from the host**: the web server and version, the edge-to-PHP protocol, request-header and request-body read timeouts, keep-alive timeout, maximum request time, PHP `max_execution_time`, and whether any proxy retries upstream requests.
- Pass criterion: all recorded, and the staging answers match what production is documented to run. If the browser leg is `http/1.1`, every later experiment is run and evaluated **with that in mind** (Chrome resends only there).

**E1. Control.** 30 normal clicks, one probe each, spaced to respect the write throttle. Pass: rows = 30 = clicks = access-log POSTs (if available), all 201.

**E2. Idle connection reuse.** After 5, 15, 30, 60, 120 and 300 s of idleness on the same connection (confirm `connectionReused` in CDP), send one probe; 10 trials per interval. Record every status and every resend (`requestWillBeSent` count above the click count). Pass: rows = clicks, and no 408 or resend.

**E3. Slow or stalled upload (a raw-socket client, because a browser cannot stall mid-body).** Send the headers, then the body slowly: complete after 5, 15, 30, 60 s; and **stalled** at half the body for 5, 15, 30, 60, 120 s. Record the first response line (408, 400, 413, nothing) and the time the socket closes, and whether a row was created. Pass: **a 408 or reset is only ever seen where rows = 0** (the application never ran), never where a row exists. A 408 with a row is case B: **fail**.

```js
// Slow-body probe (Node 22). Token and host come from the environment; nothing is printed except status lines and timings.
import tls from "node:tls";
const { HOST, TOKEN, RUN, TRIAL, BYTE_DELAY_MS = "250" } = process.env;
const body = JSON.stringify({ title: `p408-${RUN}-E3-${TRIAL}`, locale: "en" });
const s = tls.connect(443, HOST, { servername: HOST, ALPNProtocols: ["http/1.1"] }, async () => {
  s.write(`POST /api/ai/conversations HTTP/1.1\r\nHost: ${HOST}\r\nAuthorization: Bearer ${TOKEN}\r\nContent-Type: application/json\r\nAccept: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n`);
  const t0 = Date.now();
  for (const ch of body) { s.write(ch); await new Promise((r) => setTimeout(r, Number(BYTE_DELAY_MS))); }
  console.log("body sent after", Date.now() - t0, "ms");
});
let first = true;
s.on("data", (d) => { if (first) { console.log("first response line:", d.toString().split("\r\n")[0]); first = false; } });
s.on("close", () => console.log("closed"));
```

**E4. Full upload, then the client vanishes.** Send the whole body and close the socket at once, 30 trials. Expected: rows = 30. This documents that a client that gives up has **not** stopped the write, which is why Mobile reports an unknown outcome and never assumes failure.

**E5. A long request through the edge, with response loss (the decisive one).** Use `POST /ai/conversations/{id}/messages` (it stores the question and its reply **before** the provider call, so the origin's state is observable). The handler must run longer than the edge's timeouts: this needs a provider whose delay can be set to 30, 60, 90 and 120 s (see [AI-STAGING-TEST-PLAN.md](AI-STAGING-TEST-PLAN.md) §2, option B). For each delay: send with a unique `client_request_id`; record the status the client receives (2xx, 408, 502, 504, reset, none) and when; then **replay the same id** and record `replayed` and the provider-call counter. Pass criteria: the client never receives a 408 or a reset for a request the origin completed **without** the replay showing the stored pair; and the replay returns `replayed: true` with the provider called once. A 408 here, with a stored pair, is case B: **fail**. **If no delayable provider exists, E5 cannot be run and the requirement stays unsatisfied for long requests** (the 20 s default and 90 s AI client timeouts make this the most relevant case).

**E6. Browser abort after sending.** In the page, `fetch` the probe and `abort()` it 50 ms, 500 ms and 2 s after sending, 30 trials each. Expected: rows = trials (the server processed them), clicks = trials. Records that an aborted request still takes effect.

**E7. Same-id concurrency (shared with the AI plan).** Two simultaneous requests with the same `client_request_id`: one provider call, one stored pair, the second answers replayed. Confirms the origin's dedup under a race, which is the defence if case B ever occurs.

**Conditions.** Run each browser experiment in at least two sessions on different days or times of day, on a normal connection and on throttled "slow 4G" and "offline then online" profiles. Record the browser and version (Chrome's behaviour is version-specific; Safari and Firefox are **not covered** by Chrome results and need their own runs before iOS use).

## 6. Pass, fail and what the result allows

- **Fail** if in any experiment: rows exceed clicks; a 408 or reset occurs where a row exists; the browser resends a request the origin had already processed; the host's written answer reveals a proxy that retries non-idempotent requests or an HTTP/1.1 browser leg with a timeout that can fire after processing.
- **Pass** requires every experiment to meet its criterion **and** the E0 written answers to show no mechanism for case B.
- **A pass does not open anything.** It satisfies one input of a per-write approval (see [WRITE-APPROVAL-REGISTER.md](WRITE-APPROVAL-REGISTER.md)); each write still needs its own staging evidence and a named approver.
- **A fail** changes the plan: either the host fixes the layer and the experiments are re-run, or every write whose duplicate has an effect stays closed and only writes that are harmless to repeat may proceed, with that decision recorded by the owners.

The only sentence that may be written into an approval is of the form: *"On staging stack S (shown equal to production's by E0 and the host's written confirmation), experiments E0–E7 on <dates> in <N> trials under <conditions> produced no case where an application-processed request was answered 408 or reset, or resent by the browser. Configuration: <protocol and timeouts>. Evidence: <folder>."* Never: "408 cannot happen".

## 7. Evidence record (one per run; kept with the artefacts)

| Field | Value |
|---|---|
| Run id, date, tester, reviewer | |
| Staging frontend commit and backend commit; database engine and version | |
| Staging isolation verification attached (STAGING-READINESS.md §3.1) | yes / no |
| Stack equality with production shown by | headers / host's written statement / other |
| E0: browser leg protocol, edge-to-origin protocol, timeouts (host's answer attached) | |
| Browser and version; network profiles used | |
| E1 / E2 / E3 / E4 / E5 / E6 / E7: trials, clicks, rows, statuses, resends | one row each |
| Any 408, reset, or resend observed, with the row count at that moment | |
| E5 not runnable because: (if so) | |
| Deviations from this plan | |
| Conclusion (the allowed sentence, or "not satisfied" and why) | |
| Signed by (name, date) | |

## 8. What Mobile does today, regardless of this evidence

Mobile sends one request per submission, never resends by itself, reports a timeout or a 408 as an unknown outcome, keeps the key for the same request for 24 h, and a reload followed by the same entry reuses it. It cannot stop a browser's own resend, and it cannot make a server deduplicate. These are the reasons the gate exists and why no write is open.
