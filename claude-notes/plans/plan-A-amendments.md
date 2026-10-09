# Plan A amendments (architecture review, 2026-10-09)

- **Applies to:** `claude-notes/plans/plan-A.md`
- **Precedence:** where this file and plan-A.md disagree, **this file wins**. Everything not mentioned here stands as written.
- **Status of plan-A's "(plan decision)" items:** all accepted, including: no new state library (`useSyncExternalStore` stores), the per-project serialisation rule, the dev gallery, Approve disabled while any human flag is open, and the qualifier tag derived from the parameter key.

---

## AM1. Row-state precedence, and what `requires_review` means

**Problem.** Plan §6.4 maps the auto-flag "Bounds" state to `rule_violations?.length > 0 || requires_review`. But the backend's gap-fill pass sets `requires_review = True` on **every** empty reason-code row, and the Supervisor sets it on uncertain values that are not out of bounds. As written, every empty parameter would be labelled "Bounds", which is false and would train reviewers to ignore the flag.

**Change.**

| State | Rule |
|---|---|
| Auto-flag "Bounds" | `rule_violations?.length > 0` **only** |
| Needs review (not a flag) | `requires_review === true` on a candidate that has a value. Treated like low confidence: amber "Review" label, sorted with low confidence, **no flag icon** |
| Empty with reason | `ai_value === null` and `extraction_logic` matches a reason code (AM6). `requires_review` is ignored for these rows |

**Precedence when several apply** (each row shows exactly one primary state, RFC §4.1):

1. Human flag
2. Auto-flag "Bounds"
3. Empty with reason (or "No run yet")
4. Human-modified
5. Low confidence / Needs review
6. High confidence

Secondary facts (e.g. a human-modified row that also has low confidence) may appear as small secondary indicators, never as a second primary state. The precedence function lives in `lib/review/rowState.ts` and is unit-tested (AM3).

---

## AM2. Job liveness through Web Locks, not timer leases

**Problem.** Plan §3.5 keeps a running job alive with a 10 s lease renewed every 4 s by timer. Browsers throttle timers in background tabs (Chrome's intensive throttling drops a hidden tab to about one wake-up per minute). An extraction runs for minutes, often in a background tab, so a healthy job would miss renewals and be marked "Interrupted" by another tab **while it is still running**, and the user could then start a duplicate run that costs tokens.

**Change.**

- The owning tab holds a Web Lock named `bda-job-<jobId>` for the whole run (`navigator.locks.request(name, () => runPromise)`). The browser releases it automatically when the tab closes, crashes or reloads.
- A tab decides whether a "running" job is still alive with `navigator.locks.query()`: if no tab holds `bda-job-<jobId>`, the job is `interrupted`. No timers, no grace periods.
- `leaseExpiresAt` and the renewal timer are removed. `ownerTabId` stays for display and debugging.
- The scheduler lock (`bda-jobs-scheduler`) from plan §3.5 is kept as is.
- The fallback when `navigator.locks` is missing stays as planned (per-tab cap plus a one-time notice).
- Step 2b's verification must include: start a run, switch to another tab for at least 5 minutes, come back, and confirm the job was never marked Interrupted.

---

## AM3. Unit tests for the pure logic

**Problem.** The riskiest code in Task A is pure logic: the scheduler (cap, FIFO, correction priority, per-project rule), the job reducer, category grouping, row-state precedence, reason-code matching, qualifier and C-rate helpers. "Build + lint + manual check" is too weak for it, especially the cross-tab rules.

**Change.**

- Step 2a adds **Vitest** (unit tests only, no browser or e2e framework) with an `npm test` script, and updates CLAUDE.md §3 so every later step runs `build + lint + test`.
- Required tests, added in the step that creates the code:
  - 2a: job reducer; SSE event → phase mapping; correction-priority and per-project ordering; D11 regression (applying results for project A never changes project B's state).
  - 2b: scheduler under a simulated two-tab lock; Interrupted detection via a mocked `navigator.locks.query`.
  - 8: `groupFields` (known order, END_OF_LIFE, unknown category appended, Other, empty known category still present); `rowState` precedence (AM1); reason-code matching (AM6); qualifier and C-rate helpers.
- UI components are still verified manually and in the dev gallery.

---

## AM4. Split step 2a up front

Plan §9 says 2a may be split "if it proves too large". Split it from the start; it is the highest-risk step.

| Step | Scope |
|---|---|
| **2a-i** | `lib/jobs/*` (store, runners, sse, config), `lib/project-data/*`, `api/types/*` used by them, H1 lost-flag fix, H2 type, upload `errors` type, `AbortController`, Vitest setup and the 2a tests (AM3). **No UI rewiring.** |
| **2a-ii** | Rewire `/bda` onto the stores: retire `ProjectContext`, delete `useAnalyze*`, thin `ParameterManager`/`DocumentManager`, remove the early-return spinner and the analyze-wide `readOnly`, inline `JobBanner`. The history note states the D11 bug is fixed and how it was reproduced. |

---

## AM5. Shell components built in step 3 are final

Step 3 builds `AppHeader`, `ProjectRail`, `Breadcrumb`, `ThemeToggle` and `JobBadge` before the component library step (5). To avoid building them twice:

- Step 3 builds these into `components/shell/` and `components/jobs/` to the full §8.4 bar, using MUI components themed in step 1.
- Step 5 adds them to the gallery but **does not rebuild them**; it only covers the remaining primitives.

---

## AM6. Reason codes are matched against one constant module

- `lib/review/reasonCodes.ts` holds the four backend strings **copied exactly** from `BDA/src/engine/reason_codes.py`, with a comment naming that file, plus their short UI labels.
- Matching is a prefix match against these constants only, never ad-hoc substrings in components. Unit-tested (AM3).
- This is a stopgap until the backend returns an explicit reason-code field (Task B backlog, below).

---

## AM7. `.battery` export (step 8)

- Before step 8 starts, the **uncommitted change in `static/battery-template.ts`** (explore-A R9) must have been committed or discarded by the owner. Step 8 stops and asks if it is still uncommitted.
- The project backlog records a **possible double negation of discharge currents** in this exporter (`static/battery-template.ts`, around lines 169–170). Discharge currents are stored negative by design (CLAUDE.md §7). Step 8 must check whether the exporter negates them again, record the answer in its history note, and **not change the sign logic without asking**, because the correct sign depends on the downstream tool's format.

---

## AM8. Items for Task B (record, do not work around)

Found by plan-A §11. Task A uses the placeholders and stopgaps already in the plan; these go to the backend in Task B:

| # | Backend item |
|---|---|
| B1 | `PUT /projects/project-parameter/{id}/add` passes the wrong arguments and fails. Needs a fix before "Add parameter" can ship. |
| B2 | `ProjectBase.customer` is never populated (`SELECT *` on a table without that column). Return the customer's alias with the project. |
| B3 | Auto-flags from `_flag_out_of_bounds` are not stored, so they disappear on reload unless `rule_violations` carries them. Persist them. |
| B4 | Add `category` to each project parameter in `GET /projects/{id}` (replaces the D5 join). |
| B5 | Add an explicit reason-code field on empty candidates (replaces AM6's string matching). |
| B6 | `review_action` enum has no `PENDING`; confirm how "not yet reviewed" should be represented. |
| B7 | `GET /documents/{doc_id}/file` returns 404 for both missing metadata and missing file; RFC §5 P1 proposes 410 for expired storage. |
| B8 | No route lists a project's members, and none lists open flags across a project (both are placeholders in Task A). |