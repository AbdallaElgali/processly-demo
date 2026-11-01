# FE: false job warnings, feedback entry point

Branch: `fe/warnings-feedback` (from main at `f2cf038`).

## Goal
Part 1: stop warnings ("interrupted") that appear although the extraction or upload finished. Part 2: a way to send feedback from every page and from the parameter review.

## Start-of-session check
`git branch --no-merged main` lists only `admin-claude`. `fe/export-and-cleanup` and every FE-R branch are merged into main. `admin-claude` is not an export or FE-R1 follow-up, so work went ahead.

## Warning inventory

| # | Trigger (file before the change) | What the user sees | False positive? | Fixed how |
|---|---|---|---|---|
| 1 | `lib/jobs/runtime.ts` `execute`: `if (!this.userId) { releaseJobLock; return }`, reached because `onePass` claimed queued jobs before the user was known (reload with a queued or hydrated job; `start()` runs before the auth effect) | The job is marked running, loses its lock, and the next pass shows "interrupted; nothing was saved" for a job that never ran | **Yes** (reload) | `onePass` starts nothing until `userId` is set; `setUserId` triggers a pass. Test: "stays queued" |
| 2 | `runtime.ts` `onePass` + `scheduler.ts` (interrupted filter): another tab reads the record (running), then asks which locks are held. The owner released its job lock *before* publishing its result (end of `execute`) | A second tab marks a just-finished job interrupted and writes that over the owner's "completed" | **Yes** (second tab, fast finish) | Owner publishes before releasing the lock; the pass re-reads the record after the lock query and drops jobs no longer running there (`outcome.ts` `stillRunning`). Test: `outcome.test.ts` |
| 3 | `scheduler.ts` running job with no lock after reload/close, then `reducer.ts` `interrupt`: "The tab running this ... was closed or refreshed, so it saved nothing." (`JobBanner`, `JobStatusLine` "interrupted; nothing was saved", `JobTray` "interrupted") | The run may have reached `complete` and been saved just before the tab went (reload during `reloadAfterRun`, or a background tab) | **Yes**, and "saved nothing" could be wrong | `JobRuntime.settleLostRun` asks `GET /projects/{id}/extraction-runs` first. A run of the job's type created since the job started means finished ("Saved while you were away", no warning). None means interrupted (`runCheck: 'lost'`). Server unreachable means `runCheck: 'unknown'` and the text makes no claim. Tests: `warnings.test.ts` |
| 4 | `runtime.ts` `recoverUpload` -> `uploadCheck` missing after about 60 s (`uploadRecovery.ts` `NOT_SAVED_TEXT` "Not saved. Add the file again") | The backend lists a document only when fully processed, which can take longer than the check waits. A large upload still processing was called "not saved" | **Possible** | Text now says it stopped *or is still being processed*, names the file, and says to check the document list and add it again only if still missing. Test: `uploadRecovery.test.ts` |
| 5 | Upload jobs with no file names (`fileRefs: []`), so `recoverUpload` had nothing to match | "Could not check ..." for uploads that finished | Yes before; **already fixed on main**: `JobRuntime.enqueue` stamps `fileRefs` from the files (the workspace page passes `[]`). It had no test | Test added: "stamps the names and sizes of the files onto the job". Interrupted-upload text now names the files |
| 6 | `runtime.ts` `handlePageHide` -> `abortAll` -> `runStream` returns "Cancelled." -> `fail` | Only if the page is restored from the back/forward cache: jobs show failed "Cancelled." | Rare | **Not fixed** (a failure, not a warning; `pagehide` cannot know whether the page will return). Documented in CLAUDE.md |
| 7 | `runners.ts` `runUpload` warnings -> `uploadWarnings` ("N not accepted", `JobTray`) | Per-file rejections returned by the backend | No (real) | Unchanged |
| 8 | SSE warnings (`routing_truncated`, `no_frames_tagged`, ...) counted in `JobStatusLine` | Real backend conditions, non-terminal | No | Unchanged |
| 9 | Failure messages (`failedJobText`, `fail`) | The actual error | No | Unchanged, as required |
| 10 | `closeGuard` "Keep this tab open" notes | Shown only while a job runs | No (true, backend X3) | Unchanged |

Checks by scenario: reload (1, 3), second tab (2), navigation away and back inside the app (no `pagehide`, jobs live in the store: no warning), fast-finishing job (2, 3), job finished in a background tab (locks, not timers, so no warning; the owner now publishes before releasing, 2).

Also changed: warning text is plain ("The analysis stopped before it finished because this page was closed or reloaded. Nothing was saved. Run it again."; "The upload of X.pdf stopped before it finished, or the file is still being processed. Check the document list in a minute; if it is still missing, add it again with Add documents."). The job tray row now shows this text instead of "· interrupted".

## Changes
- `lib/jobs/outcome.ts` (new): `runSavedSince`, `stillRunning`, `interruptedRunText`.
- `lib/jobs/runtime.ts`: `settleLostRun`, `stillRunning` in `onePass`, no start without a user, publish before lock release, `setUserId` pumps.
- `lib/jobs/types.ts`, `reducer.ts`: `runCheck`, new interrupt error text.
- `lib/jobs/uploadRecovery.ts`: `notSavedText`, new unknown text, `NOT_SAVED_TEXT` removed.
- `components/jobs/JobBanner.tsx`, `JobTray.tsx`, `components/workspace/JobStatusLine.tsx`: the new texts.
- Part 2: `api/feedback.ts`, `lib/feedback/payload.ts`, `components/feedback/FeedbackDialog.tsx`, `SendFeedbackButton.tsx`, account menu item in `components/shell/AppHeader.tsx`, button in the parameter detail (`components/workspace/ParameterRow.tsx`).
- `CLAUDE.md` section 5 (jobs, feedback).

## Decisions
- The extraction match uses the run row: it is created in the same save as `complete` (BDA `save_ai_parameters_db`), so a run newer than the job's start proves it saved. 5 s of clock slack; the backend sends naive datetimes, read as UTC.
- The check happens on the first pass that sees the lock gone, outside the scheduler lock, one tab per job (`bda-settle-<id>` lock).
- The 60 s upload polling length is unchanged.

## Part 2: feedback findings
- Backend: `POST /feedback/submit` exists (`BDA/src/api_routes/feedback.py`, `UserFeedback`: user_id and project_id required; document_id, feedback_type, title, description, status, metadata optional). Listing exists via `/audit/feedback-list`.
- Frontend before: only viewing (Audit Feedback tab, Admin). **No submit form and no call to `/feedback/submit` existed**, so there was nothing to re-wire; the entry points and the form were built on the existing API.
- Reachable from the account menu on every page that has the header (projects, project screens, library, admin); on a project route the project comes from the address, elsewhere the person picks it. From the parameter detail it is pre-filled (title, `feedback_type: parameter`, `metadata.parameter_key`).

## Tests added
- `lib/jobs/outcome.test.ts` (run matching, stale-record guard, texts), `lib/jobs/warnings.test.ts` (settle: saved / lost / unreachable; no start without a user; upload file names), `lib/feedback/feedback.test.ts` (path to project, body shape, validation, POST to `/feedback/submit`, error text, button render). `uploadRecovery.test.ts` and `reducer.test.ts` updated for the new wording.

## Gaps found
- `main` already has 41 failing tests and a failing `npm run build` type check, all in the export code (`lib/review/export*.test.ts`, `cleared.test.ts`, `export-names-sign.test.ts`; `workspace/page.tsx` uses `ExportReport.unconvertible` and tests import `BATTERY_EXPORT_KEYS`, which the "export function now handles parameters dynamically" commit changed). Confirmed by stashing my changes. Export is out of scope; not touched.
- The feedback list has no id or date (B23/B24 unchanged).
- Case 6 above (back/forward cache) is not fixed.

## Verification
- Tests first, seen failing: `outcome.test.ts` and `feedback.test.ts` (module missing), `warnings.test.ts` (4 failing; "stays queued" got `interrupted`), upload text tests.
- `npx vitest run lib/jobs lib/feedback`: 145 passed. Full suite: 478 passed, 41 failed; the same 41 fail on main without my changes (453 passed / 41 failed before).
- `npm run lint`: clean. `tsc --noEmit`: only the pre-existing export errors.
- `npm run build`: fails on main already (export type errors), so it could not be used as a gate.
- Not done: browser check (no backend running in this session). The dialog and buttons have unit tests for payload, API call and button render only; they still need a look in light and dark mode.

## Next
Fix the export tests and build on main (export work); browser-check the feedback dialog.
