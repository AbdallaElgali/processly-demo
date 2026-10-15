# FE: export names and sign, prompts display, developer wording, job tray

Branch: `fe/export-and-cleanup` (from main at `3808685`, which is the one-line comment edit to `app/admin/page.tsx` that was sitting uncommitted; the owner said to commit it, so the tree was clean before this work started).

## Goal
Four parts, one commit each: (1) export entry names and discharge sign, (2) show only category prompts and no models, (3) remove developer-facing text, (4) job tray cleanup, no re-run for uploads, duplicate-file confirmation, second-extraction guard. Tests first in every part (seen failing before the implementation).

## Changes

### Part 1: export (commit `Export: key-file names and negative discharge sign`)
- `static/battery-template.ts`: every mapped key is always written under its `exportName` (`U_MAX_DB`, `EOL`, `I_MAX_DCH_30S_DB`, ...); `getFieldName` (which used the parameter's label) is gone, including for parameters the project added. `I_MAX_DCH_PULSE` and `I_MAX_DCH_CONTINUOUS` are written as `-abs(value)`; 0 stays 0, the placeholder `99999999` stays positive, charge currents are as stored. Header comment updated (decisions made, owner decision 2026-10-15). Pre-export dialog and `missingExportKeys` untouched.
- `lib/review/export-names-sign.test.ts` (new, 11 tests, all through `FrontendBatteryFileExport().generate()` and XML parsing): each mapped key exactly once under its exportName (even with custom labels), added parameter keeps the key-file name, empty project writes the key-file names, discharge positive -> negative, already negative not double-negated, 0 stays 0, charge unchanged, placeholders (discharge positive, `T_MIN_*` negative), cleared discharge row writes the positive placeholder.
- `lib/review/export.test.ts`, `export-screen.test.ts`, `cleared.test.ts`: their XML lookup helper now maps a mapped key to its exportName (the tests used the label, which equalled the key). No assertion about value, unit, derived safety voltage or placeholder was changed.
- `CLAUDE.md` section 5 (export paragraph).

### Part 2: only category prompts, no models (commit `UI: show only category prompts, hide models`)
Display only. The backend payload, pinning, `pins_frozen` and the "editable until the first run" rule are unchanged.
Screens changed:
1. Project > **Prompts** (`app/projects/[projectId]/prompts/page.tsx`): renamed from "Prompts & Models" (title, tab group label, rail label in `components/shell/ProjectRail.tsx`); tabs "Next run (resolution)" -> "Next run", "Registry" -> "Library".
2. Tabs *Pinned for this project*, *Next run*, *Library* (`components/prompts/PromptsViews.tsx`, `SlotTable.tsx`): only `CATEGORY` rows via `categoryRows`; the Agents group and its heading are gone (a level with no rows renders nothing); Model, Reasoning effort and Temperature columns and the "n/a / dash" footnote are gone; slot names shown as "Voltage", "End of life" instead of `category.voltage`.
3. Tab *Prompts for this project* (`ProjectPromptSettings.tsx`): removed the sentence about agent prompts.
4. Library > Customers > one customer (`components/library/CustomerDetail.tsx`): only `category.*` slots (`categorySlots`), the "Agent prompts are shared" note removed (`AGENT_PROMPTS_NOTE` deleted).
5. New project dialog summary (`customerPromptSummary`): only category slots are named.
6. Overview > last-run card (`ActivityCards.tsx`) and Audit > Runs / Workspace runs table (`RunsTab.tsx`): the "Model" column / fact removed.
7. `lib/prompts/config.ts` read-only note reworded (no "model settings"); `lib/prompts/view.ts` dropped `groupByLevel` and `modelSettings`.
- Tests: `lib/prompts/category-only.test.ts` (5 new); `prompts.test.ts` and `customers/settings.test.ts` lost their tests for the deleted helpers.
- Left alone on purpose: the Workspace "Why this value" panel says "the model's note" (it describes who wrote the text, it is not a model name or picker).
- `CLAUDE.md` section 5 (Prompts paragraph).

### Part 3: developer-facing text (commit `UI: remove developer-facing text`)
Guard: `lib/no-developer-text.test.ts` scans the text of string literals and plain JSX text in `app/`, `components/`, `lib/`, `hooks/`, `contexts/`, `static/`, `api/` (not comments, imports, console calls, test files, `app/dev/`) for: "backend", backend item codes (`(B8)`), decision codes (`AM11`), `CLAUDE.md`, "Task A/B", "API", "Web Locks", "SSE", TODO/FIXME, stub/mock, UUID, "endpoint / no route", "a slot".

| File | Old text | New text |
|---|---|---|
| `app/projects/[projectId]/audit/page.tsx` | No backend route lists the flags of a whole project (backend B8). Open a parameter ... | A list of all flags in the project is not available yet. Open a parameter ... |
| `app/projects/[projectId]/workspace/page.tsx` | (auto-flag, raised by the backend): | (flagged automatically): |
| `components/audit/FeedbackTab.tsx` | The backend does not return a date for feedback (backend B23), so none is shown. | Feedback has no date recorded, so none is shown. |
| `components/audit/LineageView.tsx` | tooltip: Every stored flag is raised by a reviewer. The backend's type (...) means a flag on an AI value, not one raised by the AI (B23). | Every stored flag was raised by a reviewer, on a value the AI proposed. The AI itself does not raise flags. |
| `components/audit/LineageView.tsx` | The backend has no history for {key} in this project. | There is no history for {key} in this project yet. |
| `components/settings/MembersCard.tsx` | Member list unavailable (backend B8) | Member list unavailable |
| `components/settings/MembersCard.tsx` | The backend has no route that lists a project's contributors or auditors ... The app has no real authentication, so membership is a record ... | The app cannot list a project's contributors or auditors ... There is no sign-in check, so membership is a record ... |
| `components/workspace/indicators.tsx` | ... yet. (Shown by the app; not a backend reason code.) | ... yet. |
| `components/workspace/ParameterRow.tsx` | choosing a candidate also tells the backend which one answers the flag. | choosing a candidate also records which one answers the flag. |
| `components/workspace/ParameterRow.tsx` | It starts when a slot is free; corrections go first. | It starts as soon as other work finishes; corrections go first. |
| `components/workspace/ParameterRow.tsx` | ... cannot be flagged yet (backend B9). Run Analyze first. | ... cannot be flagged yet. Run Analyze first. |
| `components/workspace/SourceBar.tsx` | The backend names the table, not the cell, so each is a possible source. | The source names the table, not the cell, so each is a possible source. |
| `components/workspace/WhyThisValue.tsx` | ... which the API does not return. | ... which is not available. |
| `components/workspace/WhyThisValue.tsx` | Recorded by the backend: "..." | Recorded with the result: "..." |
| `lib/jobs/runners.ts` | Unknown backend error | The analysis failed for an unknown reason. |
| `lib/parameters/meta.ts` | ... the backend deletes it for good, together with ... (backend item B18). | ... it would be deleted for good, together with ... |
| `lib/project-data/actions.ts` | The backend stored X instead of Y. Nothing was changed. | The status is X instead of Y. Nothing was changed. |
| `lib/prompts/view.ts` | This slot was not pinned ... | This prompt was not pinned ... |
| `lib/prompts/scoped.ts` | Every slot below repeats its pin; the scope says where each pinned value came from. | Every prompt below keeps the version it was frozen with; the scope says where each one came from. |
| `components/DocumentViewer/DocumentRouter.tsx` | The viewer shows PDF and Excel files; this one is {mime type}. | The viewer shows PDF and Excel files only. This file is neither. |
| `app/admin/components/FeedbackItem.tsx` | User ID: | User: |
| `api/templates.ts` | Failed to fetch parameters / create template / fetch user templates / fetch template details / upsert template rule / delete template / create template from project | Could not load the parameters / create the template / load your templates / load the template / save the rule / delete the template / save the project as a template |
| `api/user.ts` | Failed to update user settings: ... | Could not save your settings: ... |
| `api/customers.ts` | Failed to create customer: ... ; Request failed with status: 500 Server Error | Could not create the customer: ... ; The request failed (500 Server Error). |
| `lib/jobs/sse.ts` | Stream failed to start (500) | The analysis could not be started (error 500). |
| `app/admin/page.tsx` | (comment only) stray "Eper" typo from the committed edit | fixed in the comment |
| `components/audit/LineageView.tsx` | (code) `FlagTypeChip` took the raw backend flag type for the tooltip | no longer takes it |

Not changed, with the reason: console.log/error/warn calls (instructed); `app/dev/gallery` (404s in production, a developer page); the product name "Voltavision BDA"; "reason code", "dictionary", "pinned" (domain wording a battery engineer sees and CLAUDE.md section 7 requires); user-facing words "AI" and "model" in the explanations of a value.

### Part 4: background jobs (commit `Jobs: tray cleanup and no re-run for uploads`)

#### 4a Diagnosis: why the tray piled up
1. **Nothing ever left the tray except by hand, and the tray had no hand.** `JobTray` listed every job of every project in status running / queued / failed / interrupted. `prunePersistable` keeps failed and interrupted jobs forever, and the tray offered no dismiss. The only dismiss was in each project's banner, and it only showed `failed[0]` / `interrupted[0]` of that project, so a second failure in the same project was invisible until the first was closed. The badge counted failed jobs, so the number grew with no way to bring it down from where it was shown.
2. **A dismissed job came back.** `JobBanner` dismissed with `jobStore.dispatch(...)` only, never `publish()`. The shared record in `localStorage` still held the job, so the next `storage` / BroadcastChannel nudge from any tab (and every reload) merged it back in. Same for `markSeen`: the "New results" badge returned after a reload.
3. **Cancelled jobs stayed in memory for the whole session** (never removed; hidden by the tray filter only). Completed jobs with seen results stayed in memory too.
4. **Duplicates.** (a) `hydrate` replaced the list with the stored one without checking ids, so a record written twice by two tabs (race) could list one job twice. (b) Dropping the same file twice, or a file already in the project, simply started another upload, with another entry and another document (no guard).
5. **An upload job never said which files it carried.** It was created with `fileRefs: []` and the files travelled separately. So the in-flight file chips in the document tabs never rendered, the interrupted-upload check had no names to look for (it fell through to "could not check"), and a duplicate guard had nothing to compare. Found while diagnosing; fixed by writing the refs in `enqueue`.
6. **Polling restarts.** `recoverUpload` (the interrupted-upload check, 6 reads over about a minute) was started from `start()` on every page load and from every scheduler pass that interrupted an upload, and its only guard was per tab. With several tabs open each one polled the same job. (Today this was masked by 5, which made the check inert.) Now one tab polls per job, through a Web Lock `bda-recover-<jobId>`.
7. Extraction: `canStart` only disabled the button; `enqueue` accepted anything, so a double click or a second tab could queue a second extraction for the same project (the scheduler would then run them one after the other, costing tokens twice).

#### 4b-e Changes
- `lib/jobs/tray.ts` (new, pure): `trayEntries` (one entry per id, running then queued then failed then interrupted then completed, capped at `MAX_TRAY_ENTRIES` = 6, with a `more` count), `COMPLETED_VISIBLE_MS` = 8 s, `jobsToSweep`, `finishedJobIds`, `dedupeJobs`, `staysUntilDismissed`, `canRetry`.
- `lib/jobs/reducer.ts` / `types.ts`: `dismissMany` action; `hydrate` removes repeated ids.
- `lib/jobs/runtime.ts`: `enqueue` is now an async decision returning `{allowed}` or `{allowed:false, reason}`, taken under the scheduler lock against the shared record (`canEnqueue`); it writes `fileRefs` for an upload; new `dismissMany`, `clearFinished`, `markSeen`, `sweep` (timer every 4 s); `runAgain` does nothing unless `canRetry`; `runUploadAgain` removed; `recoverUpload` takes a per-job lock so one tab polls.
- `lib/jobs/ordering.ts`: `canEnqueue` (second extraction for a project refused while one is queued or running; uploads and corrections never blocked).
- `lib/jobs/uploadGuard.ts` (new): `findDuplicateUploads` (name + size against queued/running uploads of the project; name, and size when known, against the project's documents) and `fileRefsOf`.
- `lib/jobs/label.ts`: `failedJobText` (real error text) and `failedJobHint` ("Add the file again with Add documents." for an upload).
- `lib/jobs/uploadRecovery.ts`: texts now say "Add the file again with Add documents"; `resendNotice` removed.
- `components/jobs/JobTray.tsx`: rewritten: entries from `trayEntries`, a Dismiss button on every finished entry, "Clear all finished", "+N more", completed entries leave after 8 s, long error text clamped to two lines with the full text as tooltip.
- `components/jobs/JobBanner.tsx`: lists up to three failed jobs of the project (each with its error text, the upload hint and a dismiss) plus "+N more failed"; Run again only when `canRetry`; dismiss / mark seen through the runtime so they reach the shared record. `components/workspace/JobStatusLine.tsx`: a failed job shows its error text.
- `app/projects/[projectId]/workspace/page.tsx`: files that match a project document or a waiting upload open "This file is already in the project. Add it again?" (Add again / Don't add) and the rest start; Analyze shows the runtime's refusal as a toast; the existing disabled-with-reason Analyze button is unchanged.
- Tests: `tray.test.ts` (completed auto-clears, failed stays, no duplicate entry, cap, no retry for uploads, clear all finished), `uploadGuard.test.ts` (duplicate-file confirmation logic), `enqueueGuard.test.ts` and `runtimeEnqueue.test.ts` (second-extraction guard, in the pure rule and through `jobRuntime.enqueue`; runAgain does nothing for an upload), `label.test.ts`, `uploadRecovery.test.ts`.
- `CLAUDE.md` section 5 (jobs) and section 6 (upload paragraph).

## Decisions
- **Completed jobs and badges.** A completed job leaves the tray after 8 s and is dropped from the store once its results have been seen. A completed job whose project has not been opened yet stays in the store (not in the tray) so the project's "New results" badge survives; it is dropped after the project is opened and 8 s have passed. A completed upload that had rejected files stays until dismissed, since the tray and the document tabs are the only place the reasons are shown.
- **Duplicate check against project documents is by name, plus size when known.** The project payload has no file size; it is known only after the file has been opened in the viewer. So a never-opened project document matches by name alone (the safer direction: it asks), and an opened one must match the size too. Against queued/running uploads it is name and size.
- **Fresh files in a mixed drop start at once;** only the duplicates wait for the confirmation.
- **The interrupted-upload check stays** (it is a check, not a retry), now actually working because jobs carry their file names. It only reads the project's documents.
- **Run again stays for an interrupted extraction or correction** ("do not change how extraction jobs run").
- **Prompt screen renamed to "Prompts"** (rail label and title), since "Prompts & Models" would be false after hiding models.
- **Hidden, not deleted:** the API types for model fields in `api/prompts.ts` and the `model_name` field of the runs type are kept (they are the contract).

## Gaps found
- Project documents carry no file size in the payload (see Decisions); a size-exact duplicate check against documents needs the backend to return it. Not a backend edit here.
- The Audit "Flags" tab and the Members list are still placeholders (no backend route); only their wording changed.
- `lib/jobs/uploadRecovery.ts` still compares by file name only (the backend names the document by file name); two different files with one name in one upload are indistinguishable there.
- Not exercised in a browser by me: no extraction or upload against the backend was run (instructed: no extraction runs). The tray, banner and dialog were built and type-checked but are covered by the checklist below.

## Verification
Each part: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:contrast`, `npm run build`, all passing.
| After | Test files | Tests | Notes |
|---|---|---|---|
| baseline (FE-R2 note) | 32 | 441 | |
| Part 1 | 33 | 452 | 11 new; 9 of them failed against the old exporter before the change |
| Part 2 | 34 | 455 | 5 new in `category-only.test.ts` (all 5 failed before), tests of the deleted helpers removed |
| Part 3 | 35 | 456 | the source-scan test failed on the findings listed in the Part 3 table before the rewrites |
| Part 4 | 39 | 494 | new files failed with "module not found / not a function" before the implementation |
contrast 90/90 pairs in every part.

## Browser checklist for the owner
1. **Export:** export a project and open the `.battery` file. Entry names end in `_DB` (`C_NOMINAL_AH_DB`, `U_MAX_DB`, `I_MAX_CHA_30S_DB`, ...; `EOL` for the state of health). `I_MAX_DCH_30S_DB` and `I_MAX_DCH_CONTINUOUS_DB` are negative (a project value of 300 gives `-300`; one already `-300` stays `-300`). Charge currents are as shown. A cleared or empty value is `99999999` (`-99999999` for the `T_MIN_*_DB` entries). Rename a parameter's alias in the project: the entry name in the file does not change.
2. **Prompts:** open a project's Prompts page, a customer in Library > Customers, and New project with a customer chosen. Only category prompts (Voltage, Current, Temperature, Capacity, End of life, any other category) appear; no model names, no effort / temperature columns, no agent group, no empty box. Overview > last run and Audit > Runs show no model. Before the first extraction you can still change a project's category prompt; after it the lock chip shows.
3. **Wording:** click through Overview, Workspace, Parameters, Prompts, Audit (all four tabs), Settings, Library, Admin, and look for anything a battery engineer should not read: backend, B-numbers, AM-numbers, routes, ids. Open the Audit Flags tab, Settings members card, a source-less value's "Why this value" and the Excel source tooltip.
4. **Uploads:** add two files, one of them already in the project: the confirmation "This file is already in the project. Add it again?" appears for it, and the other starts. Choose "Don't add": nothing happens for it. Drop the same new file twice quickly: one upload starts, the second asks.
5. **Failed upload:** make one fail (stop the backend before adding a file, or add a file the backend refuses): the tray, the status line and the banner show the real error text and "Add the file again with Add documents."; there is no Run again anywhere for it; dismiss removes it (also after a reload); "Clear all finished" in the tray removes every finished entry and leaves running and queued ones.
6. **Tray:** a finished extraction disappears from the tray after a few seconds; with more than six entries the list ends with "+N more"; with two tabs open there is one entry per job.
7. **Extraction guard:** start an Analyze, then try to start another in the same project: the button is disabled with the reason as a tooltip; from a second tab on the same project a click is refused with a message.

## Diff stat
`git diff --stat main` on the branch at close (this note included):

```
 CLAUDE.md                                          |   9 +-
 api/customers.ts                                   |   4 +-
 api/templates.ts                                   |  14 +-
 api/user.ts                                        |   2 +-
 app/admin/components/FeedbackItem.tsx              |   2 +-
 app/admin/page.tsx                                 |   2 +-
 app/projects/[projectId]/audit/page.tsx            |   2 +-
 app/projects/[projectId]/prompts/page.tsx          |  14 +-
 app/projects/[projectId]/workspace/page.tsx        |  65 ++++-
 .../2026-10-15_2146_fe-export-and-cleanup.md       | 129 +++++++++
 components/DocumentViewer/DocumentRouter.tsx       |   2 +-
 components/audit/FeedbackTab.tsx                   |   2 +-
 components/audit/LineageView.tsx                   |  10 +-
 components/jobs/JobBanner.tsx                      |  32 ++-
 components/jobs/JobTray.tsx                        | 289 +++++++++++++--------
 components/library/CustomerDetail.tsx              |   6 +-
 components/overview/ActivityCards.tsx              |   1 -
 components/prompts/ProjectPromptSettings.tsx       |   4 +-
 components/prompts/PromptsViews.tsx                |  53 ++--
 components/prompts/SlotTable.tsx                   |  48 +---
 components/settings/MembersCard.tsx                |   6 +-
 components/shell/ProjectRail.tsx                   |   2 +-
 components/workspace/JobStatusLine.tsx             |   6 +-
 components/workspace/ParameterRow.tsx              |   6 +-
 components/workspace/RunsTab.tsx                   |   1 -
 components/workspace/SourceBar.tsx                 |   2 +-
 components/workspace/WhyThisValue.tsx              |   4 +-
 components/workspace/indicators.tsx                |   2 +-
 lib/customers/settings.test.ts                     |   6 +-
 lib/customers/settings.ts                          |   7 +-
 lib/jobs/enqueueGuard.test.ts                      |  42 +++
 lib/jobs/label.test.ts                             |  20 +-
 lib/jobs/label.ts                                  |  11 +
 lib/jobs/ordering.ts                               |  23 ++
 lib/jobs/reducer.ts                                |   8 +-
 lib/jobs/runners.ts                                |   2 +-
 lib/jobs/runtime.ts                                | 111 ++++----
 lib/jobs/runtimeEnqueue.test.ts                    |  44 ++++
 lib/jobs/sse.ts                                    |   2 +-
 lib/jobs/tray.test.ts                              | 118 +++++++++
 lib/jobs/tray.ts                                   | 114 ++++++++
 lib/jobs/types.ts                                  |   1 +
 lib/jobs/uploadGuard.test.ts                       |  74 ++++++
 lib/jobs/uploadGuard.ts                            |  55 ++++
 lib/jobs/uploadRecovery.test.ts                    |  19 +-
 lib/jobs/uploadRecovery.ts                         |  11 +-
 lib/no-developer-text.test.ts                      |  87 +++++++
 lib/parameters/meta.ts                             |   2 +-
 lib/project-data/actions.ts                        |   2 +-
 lib/prompts/category-only.test.ts                  |  37 +++
 lib/prompts/config.ts                              |   2 +-
 lib/prompts/prompts.test.ts                        |  12 +-
 lib/prompts/scoped.ts                              |   2 +-
 lib/prompts/view.ts                                |  22 +-
 lib/review/cleared.test.ts                         |   4 +-
 lib/review/export-names-sign.test.ts               |  76 ++++++
 lib/review/export-screen.test.ts                   |   2 +-
 lib/review/export.test.ts                          |   2 +-
 static/battery-template.ts                         |  72 ++---
 59 files changed, 1294 insertions(+), 415 deletions(-)
```

## Next
Owner browser check, then the next planned step.
