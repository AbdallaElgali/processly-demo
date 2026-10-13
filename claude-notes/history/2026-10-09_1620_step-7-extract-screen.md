# Step 7: Extract screen

## Goal
Two small fixes requested ahead of this step (NewProjectDialog reset-on-close, AM8 item B12), then plan-A §9 step 7: the Extract screen — `Dropzone`, documents table, `JobBanner`, `RunTimeline`, `CategoryCard`s from project data including End of Life with case-insensitive matching (AM9), warnings, Runs tab.

## Changes
**Pre-work**
- `components/projects/NewProjectDialog.tsx` — `handleClose` now calls `reset()` before `onClose()`, so Cancel, the backdrop and Escape all clear the form, not only a successful create (the gap step 6 found and left for later). Also fixed `reset()` itself, which never cleared `templateId`.
- `claude-notes/plans/plan-A-amendments.md` — AM8 gained **B12**: no route to delete a project or a user; confirmed by steps 4 and 6, each of which left a test record behind with no way to remove it.

**New — `components/extract/`**
- `RunTimeline.tsx` — RFC §3's six-step pipeline (Uploading → Analyzing → Routing → Extracting → Supervising → Done), derived entirely from the job's existing `phase`/`events` (no new phase values added to `lib/jobs/sse-types.ts`, which is already unit-tested and shared with the reducer). "Uploading" is always done by the time an extraction/correction job exists; "Analyzing" is the real window between the stream opening and its first byte (`phase === 'routing'` with zero events yet). Also renders the ITERATIVE/"Single parameter: KEY" badge and every warning status with an explanatory label (previously only `routing_truncated` had one; `no_frames_tagged`, `category_extraction_fallback` and `category_workers_failed` fell back to the raw status string).
- `CategoryCard.tsx` / `CategoryCards.tsx` — one card per category the project actually has parameters in (not every known category unconditionally — see Decisions), filling in live as `partial` events land, with a distinct failed state for `category_workers_failed`.
- `DocumentsTable.tsx` — `details.documents` plus rows for a queued/running upload's files, a status chip per row (Analyzed / Not yet analyzed / Uploading… / Queued), "View in Review", and a warning banner for any per-file upload failures.
- `RunsTab.tsx` — `DataTable` over the new `apiGetExtractionRuns`, with All/Blind/Iterative/Single-parameter filter chips.

**New — elsewhere**
- `components/ui/Dropzone.tsx` — the large dashed drop target (plan §2): H/F/K (Enter/Space opens the picker), drag-over, a "will be queued" hint at the cap instead of being disabled. Accepts `.pdf,.xlsx,.xlsm` only (the analyser handles PDF and Excel, CLAUDE.md §6.3); `.doc/.docx/.jpg/.png` were never offered.
- `lib/categories.ts` + `lib/categories.test.ts` — category resolution (D5/AM9) and `tallyByCategory`. Six tests: the three real spellings of End_Of_Life resolving to one entry, an unknown category humanised rather than dropped, null/empty as Other, the known→unknown→Other sort order, and `tallyByCategory`'s found/total counts including a field with no canonical match.
- `hooks/useCanonicalParameters.ts` — `GET /extraction-templates/parameters`, cached at module scope (one fetch per session).
- `api/projects.ts` — `apiGetExtractionRuns`.
- `app/projects/[projectId]/extract/page.tsx` — wires all of the above: Extract/Runs tabs, Dropzone → upload job, Analyze → blind or iterative extraction job (same flagged-parameter logic `review/page.tsx` used), `JobBanner`, `CategoryCards` while a job is running, `DocumentsTable`.

**Changed — job store** (to carry per-file upload warnings onto the job, which `DocumentsTable` needed and nothing before this step read)
- `lib/jobs/types.ts` — `Job.uploadWarnings?: string[]`; `complete` action takes an optional `warnings?: string[]`.
- `lib/jobs/reducer.ts` — `complete` copies `action.warnings` onto `uploadWarnings`.
- `lib/jobs/runtime.ts` — passes `outcome.warnings` through on the `complete` dispatch (it was computed by `runUpload` all along but silently dropped here).
- `lib/jobs/reducer.test.ts` — one new test for the above.

**Changed — `components/jobs/JobBanner.tsx`** (step 2b's note said this step would finish its §8.4 bar)
- The running state now renders `RunTimeline` for an extraction/correction job (an upload keeps the old plain phase line + progress bar, since it has no pipeline to show).
- Stop/Cancel/Run again/Dismiss are now a shared `BusyButton`: each disables and shows a spinner for the moment its own async call is in flight, so a second click cannot fire a second cancel while the first is still resolving.

**Changed — `app/projects/[projectId]/review/page.tsx`** (Upload and Analyze move to Extract, per CLAUDE.md §5's existing note)
- Removed the Upload button, `UploadModal`, `handleUpload`, the Analyze button, `handleAnalyze`, and the `useCanStart`/`uploadedFiles`-based gating. Everything else is unchanged: flag, flag-and-retry (still starts a correction job and still shows `JobBanner`/its `RunTimeline`), candidate switch, save, approve, export.
- `components/UploadModal.tsx` and `components/document-upload.tsx` deleted — nothing referenced either after the above.

**CLAUDE.md**
- §5 — new "Extract" subsection; the "only `review` is a real screen" line updated to name both; the known-gaps row for "only 5 SSE statuses handled" struck through as fixed.

## Decisions
- **CategoryCards show only categories the project has parameters in**, not every known category unconditionally the way the Review table's groupFields will in step 8. A progress card for a category with zero parameters would never fill in, which is confusing during a live run; CLAUDE.md §8.2's "empty known category still renders" rule is about the Review parameter table, not this progress view, and step 8 is where that table and its own tests land.
- **`RunTimeline` adds no new phase to `lib/jobs/sse-types.ts`.** That file (and the reducer) are already unit-tested from step 2a; inventing an "analyzing" SSE status would mean changing locked, risk-rated pure logic for a purely presentational need. Instead "Analyzing" vs "Routing" is read off `phase === 'routing'` combined with whether any event has arrived yet — a real signal (the stream opening vs. its first byte), not a fabricated one.
- **Upload warnings needed a small job-store change**, not just an Extract-screen one: `runUpload` already computed per-file failures, but `JobRuntime.execute` never attached them to the completed job, so they were unreachable by any UI. This is exactly the "Medium: Upload response errors … surfaced in the UI" item plan §7 scoped generically to "a UI step"; Extract's documents table is that UI.
- **Dropzone never disables at the cap.** `canStart` already allows uploads unconditionally (ordering.ts has no per-project upload rule) — the control only adds a text hint when the browser is already at `JOB_CAP` running jobs, matching CLAUDE.md §8.1's "queues rather than refuses."

## Gaps found
- **A brief "No documents yet" flash** between an upload job completing and the background `loadProjectDetails` refresh landing (confirmed in the manual run below, self-healed within ~1s). The in-flight row is removed as soon as the job leaves queued/running, and the real document row only appears once details refetch; there's a narrow gap where neither shows. Not fixed — it is sub-second and the alternative (keeping the in-flight row until details actually contain the new document) would need matching by filename, which is fragile. Noted for whoever next touches this table.
- **`hooks/DocumentManager.tsx`'s `handleDocumentUpload` remains unused** (pre-existing since before this step — `review/page.tsx` never called it, using `jobRuntime.enqueue` directly instead; removing Upload from Review didn't change this). Left alone since it predates this step's scope.
- Review's pre-existing `[PdfViewer] Loaded new PDF document string.` / stray `null` console logs are unrelated leftovers, not introduced here.

## Verification
`npm run lint` **exit 0** (0 errors, 36 warnings — down from 37), `npm test` **67/67** (7 new: 6 for `lib/categories.ts`, 1 for the reducer's `uploadWarnings`), `npm run build` **exit 0** (15 routes), `npm run check:contrast` **83/83**.

Checked in Chrome (`npm run dev`) against the live backend, console read after every step (CLAUDE.md 8.4):

- **New project → Extract, blind run on the smallest test document.** Created `Step7-Extract-Test`, uploaded `test-data/CFC/1/CF3_B1V2_Prototype_Datasheet_V2.pdf` (the README's designated "small, clean datasheet; the cheap run for regression checks"), clicked Analyze. `RunTimeline` walked Uploading → Analyzing → Routing → Extracting → Supervising → Done live, with the pulsing active-step dot; `CategoryCards` showed all five categories (this template's 27 parameters span all of them) filling in with real found/total counts as `partial` events arrived (e.g. Voltage 4/8 → the run's own final count, Current 0/4 → 4/4, End of life stayed 0/5 — nothing routed to it on this one-page datasheet, shown as a still-pending card rather than a false "done"). `JobBanner` cleared on completion since the project stayed on screen; no toast, no navigation (8.1).
- **Runs tab.** One real run: Run 1, Blind, 30 parameters, created at the run's timestamp. The Blind filter chip correctly left it showing; Iterative/Single parameter would have emptied it (not separately tested — no such run exists yet in this project).
- **Review, after the run.** Reopened `/review`: 27 parameters with the run's values present (Voltage 4/8, Current 4/4, Temperature 2/8, Capacity 2/2), Save/Approve/Export present, no Upload/Analyze button. Console clean.
- **Both modes.** Light mode: Dropzone, status chips, Analyze button all verified on palette tokens, no raw colour. (The running `RunTimeline`/`CategoryCards` were only visually checked in dark mode, since the run had already completed before the mode switch — a second real run would have cost a second set of tokens for a check already covered by code review: every colour in both new components is a `status.*`/`accent.*`/`text.*` token, none hex.)
- **Console.** Clean throughout — no errors, no `getSnapshot should be cached` warning, across project creation, upload, the full run, tab switches and both theme modes.

**Token spend: 1 OpenAI-backed extraction run** (`MAIN_MULTI_AGENT`/Blind, run 1, 30 parameters) on the single smallest test document, as CLAUDE.md §2 requires. No corrections or iterative re-runs were triggered.

**Test data left behind:** one project, `Step7-Extract-Test` (id `aeec4b4e-f070-42a8-9103-c7cbb4b882f7`), with one uploaded document and one completed run. No delete-project route (B12, added this step); harmless, same situation as every earlier step's leftover test records.

**§8 checks.** §8.1: Analyze disabled only for this project while its own extraction is queued/running (`useCanStart`), Dropzone never disabled, upload/extraction both ran without blocking navigation. §8.2: categories joined from `GET /extraction-templates/parameters` by key, End of Life included and matched case/separator-insensitively (AM9), confirmed live against the real backend values (`Voltage`, `Current`, …, `End_Of_Life`). §8.3: both modes on tokens only, document-independent (no document viewer on this screen). §8.4: Dropzone and RunTimeline steps are keyboard-focusable with tooltips, `BusyButton` covers loading/disabled on every JobBanner action, filter chips and table headers are keyboard-operable (inherited from `DataTable`), skeletons for the documents table's loading state and for CategoryCards before the canonical dictionary loads.

## Next
**Step 8** per plan §9: Review 1 (the table) — `ParameterTable`, `ParameterRow`, `ValueCell`, `QualifierTag`, `ConfidenceIndicator`, `FlagIndicator`, `ReasonCodeChip`, `CandidateList`, density, keyboard, "needs review first", Export (D8), `SCHEMA_GROUPS` deleted, `groupFields`/`rowState`/reason-code/qualifier tests (AM3/AM9/AM10). CLAUDE.md §2 standing rule: `test-data/` and its README were confirmed present before this step (not step 8 specifically, but the check is already done).
