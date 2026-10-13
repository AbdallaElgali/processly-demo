# Step 2b: per-browser cap, lock-based liveness, persisted queue

## Goal
Make the job cap per browser rather than per tab, replace AM2's rejected timer leases with Web Locks, persist the queue (with upload files in IndexedDB) across a refresh, and add the Interrupted state with "Run again".

## Changes
**New**
- `lib/jobs/locks.ts` — the three Web Locks operations the scheduler needs (`withLock`, `tryHold`, `heldNames`) behind a `LockManager` interface, so the cross-tab rules are unit-testable without a browser (AM3).
- `lib/jobs/persistence.ts` — the shared job record in `localStorage`, plus `prunePersistable` so the record cannot grow forever. Corrupt JSON degrades to an empty queue rather than bricking startup.
- `lib/jobs/scheduler.ts` — `planSchedulePass`, the pure cross-tab decision: which running jobs have lost their owner, and which queued jobs *this* tab should start.
- `lib/jobs/scheduler.test.ts` — 11 tests.

**Changed**
- `lib/db.ts` — Dexie v2. Adds `pendingUploads` (blob per queued upload file) and drops the unused v1 `files` table. Helpers to save, load, delete and sweep orphans.
- `lib/jobs/runtime.ts` — now cross-tab: holds a tab lock for its lifetime, claims each job's lock *before* marking it running, re-reads the shared record inside the scheduler lock, publishes changes, and listens on both `BroadcastChannel` and `storage`. Adds `runAgain` and `dismiss`. On `pagehide` it aborts and drops its locks so other tabs see the loss at once.
- `lib/jobs/types.ts` — `enqueuedByTabId`, so work starts in the tab that asked for it.
- `components/jobs/JobBanner.tsx` — Interrupted state with **Run again** / **Dismiss**.
- `lib/project-data/provider.tsx` — starts the runtime once.

## Decisions
- **Liveness is "is the per-job lock held", never a timestamp (AM2).** No `leaseExpiresAt`, no renewal timer. Verified below.
- **Claim before marking running.** The per-job lock is taken inside the scheduler lock and only then is the job marked `running`. This removes the start-up race where a job could look running to another tab's sweep before its lock existed — so the sweep needs no grace period, and the rule stays "no lock means the owner died".
- **A job is started by the tab that queued it**, so work appears where the user asked for it. If that tab is gone — its tab lock is not held — any surviving tab adopts the job, otherwise closing a tab would strand its queue.
- **Running jobs are never auto-restarted.** An interrupted run becomes a visible Interrupted banner with "Run again", which enqueues a *new* job. A re-run costs tokens and creates a new extraction run, so it stays the user's choice (CLAUDE.md 8.1).
- **Without Web Locks the cap degrades to per tab**, with one console warning, rather than risking two tabs running the same job.

## Gaps found
- **A real bug, found by reading the code during the wait:** the scheduler's `hydrate` replaced every job with the stored copy, discarding the live `events`, `phase`, `warnings` and `progress` of jobs *this tab is running* — those are only published at start, completion and failure, because writing localStorage on every SSE frame would wake every other tab. Any cross-tab nudge would therefore have reset a running job's timeline to whatever was last published. `mergeSharedRecord` now keeps the local copy for jobs whose lock this tab holds.
- **I invalidated my own first AM2 run** by editing `runtime.ts` while it was in flight; the hot reload wiped the page state. Re-run cleanly with no source edits during the window. Worth remembering: do not touch source during a live browser test.
- Upload files now survive a refresh, but **a queued upload created before this step does not** — there is no migration for jobs that predate `pendingUploads`. Such a job will fail with "No documents were accepted" and can be dismissed.
- `JobBanner` still has not been through the full §8.4 bar; step 7 rebuilds it as `RunTimeline` + `JobBanner` proper.

## Verification
`npm test` **57/57** (11 new), `npm run lint` **exit 0** (0 errors, 53 warnings), `npm run build` **exit 0**, `npm run check:contrast` **83/83**.

### Web Locks behave as the design assumes
Checked directly in Chrome before trusting them: `tryHold` acquires; a second `ifAvailable` request is **refused** while held; `query()` reports the lock; releasing clears it. All four as designed.

### AM2: a backgrounded tab is never wrongly interrupted
Tab 1 held a job lock and declared a running job, then was backgrounded by activating tab 2. Tab 2 — foreground, so **not** throttled — forced a scheduler pass every 15 s and recorded every status it saw.

- **451 s (7.5 minutes)**, over the 5-minute requirement.
- **30 sweeps**, exactly on schedule (451/15), confirming the watcher really was running.
- **`interruptedEver: []`** — the job was never marked Interrupted.
- The job lock and both tab locks were held in **every** sample; the status read `running` in every sample.

This is the case AM2 was written for: under Chrome's intensive throttling a backgrounded tab gets roughly one wake-up per minute, so a 10 s lease renewed every 4 s would have expired inside the first minute and another tab would have declared a healthy run dead — inviting a duplicate run that costs tokens.

### The cap is per browser, and the fourth job starts where it was queued
Two real tabs, each holding its own tab lock.

1. **Ownership.** Four jobs seeded, two stamped to each tab. Tab 1 ran exactly the two it had queued, tab 2 exactly its two — each tab's `ownerTabId` matched its own id.
2. **At the cap.** With three per-job locks held, a scheduler pass in the other tab started nothing: **3 job locks held, the fourth still `queued`**.
3. **Slot frees.** Releasing one lock and marking that job completed, then running a pass in **tab 1**: tab 1 did *not* adopt the fourth job. It was started by **tab 2, the tab that had queued it**, confirmed by its `ownerTabId`.

**How much was simulated.** The jobs in the cap test were seeded into the shared record and their "work" was either a fast backend rejection or a held lock, rather than four real extractions — four real runs would have cost four lots of OpenAI tokens for a result the scheduler cannot tell apart. Everything that *decides* was real: two real tabs, the real `navigator.locks` API, the real shared `localStorage` record, the real `BroadcastChannel`/`storage` path and the real `planSchedulePass`. The projects used (`CAP-1`…`CAP-4`) were created with no documents precisely so the backend would reject the run before any LLM call.

**Token spend this step: 0 OpenAI operations.** Four extraction attempts were made against document-less projects, which the backend rejects before any model call.

**§8 checks.** §8.1 is the step's rule: the cap is per browser and shared by all tabs (verified with two real tabs), opening projects is never gated, queued jobs survive a refresh (localStorage + IndexedDB), running jobs become Interrupted with an explicit "Run again" rather than restarting, and completion still refreshes in the background without navigating. §8.2–§8.4 do not apply; the banner's §8.4 pass is step 7's.

**Test data left behind:** projects `CAP-1`…`CAP-4` (no documents) alongside `D11-A`/`D11-B`. There is no delete-project route, so they stay until the database is reset.

## Next
**Step 3**: app shell and routes per D4 — `/projects` list, `/projects/[projectId]/…` with the project rail, breadcrumb (D6) and header, retiring `/bda` and `/review`. Per AM5 the shell components (`AppHeader`, `ProjectRail`, `Breadcrumb`, `ThemeToggle`, `JobBadge`) are built to the full §8.4 bar here and are *not* rebuilt in step 5.
