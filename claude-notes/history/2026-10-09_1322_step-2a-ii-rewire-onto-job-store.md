# Step 2a-ii: rewire the app onto the job store (D11 fixed in the running app)

## Goal
AM4's second half: move `/bda` and `/review` off `ProjectContext` and the page-owned analyze hooks onto the stores built in 2a-i, remove the full-screen spinner and the analyze-wide `readOnly`, and show job state inline. Plus the owner's three additions: correct CLAUDE.md §4's SSE list, run a live regression checklist, and do the D11 reproduction economically.

## Changes
**New**
- `lib/jobs/runtime.ts` — starts queued jobs when a slot frees, applies each outcome to **its own** project, refreshes that project in the background, never navigates. Also `createJob`.
- `lib/project-data/projects-index.ts` — the user's project list and the selected project (step 3 moves selection into the URL, D4).
- `lib/project-data/actions.ts` — the operations `ProjectContext` owned, each scoped to one project and one operation.
- `lib/project-data/provider.tsx` — replaces `ProjectProvider`; loads projects for the signed-in user and clears every cache on sign-out.
- `components/jobs/JobBanner.tsx` — per-project running/queued/failed/interrupted/new-results banner with cancel.

**Deleted** — `contexts/ProjectContext.tsx`, `hooks/useAnalyze.ts`, `hooks/useAnalyzeParameter.ts`, `api/analyze-document.ts`, `api/analyze-parameter.ts`.

**Rewritten/changed**
- `app/bda/page.tsx` — Upload and Analyze create jobs instead of awaiting promises. The early-return full-screen spinner is gone (skeleton rows in the content area instead). `readOnly` no longer includes `isAnalyzing`. Analyze is disabled only by *this* project's state.
- `app/review/page.tsx` — same store wiring; no longer hydrates parameters itself.
- `hooks/ParameterManager.tsx` — thin over `ProjectDataStore`; fields are per project.
- `components/ProjectsSideBar/BDASideBar.tsx`, `components/Sidebar.tsx` — store-backed; selecting a project sets it active.
- `app/layout.tsx` — `ProjectDataProvider`.
- `lib/review/flagging.ts` — rewritten; see Decisions.
- `CLAUDE.md` — §4 SSE list corrected, §5 updated.

## Decisions
- **The H1 "no-candidate fallback" was wrong and has been replaced.** plan-A §7 and my 2a-i note both said the batch parameter save "accepts inline flag/unflag", taken from the backend summary §7. The live test proved otherwise, and the source confirms why:
  - `save_project_parameters_batch_db` writes only `final_value`, `final_unit`, `is_human_modified`, `selected_candidate_id`, `review_action` — it accepts the `flag` fields in its request schema and **ignores them**;
  - `project_parameters` has **no `human_flagged` column**; the API field is derived from a LATERAL join on open flags;
  - `ai_parameter_flags` requires **`ai_metric_candidate_id uuid NOT NULL`** *and* **`extraction_run_id uuid NOT NULL`**.

  So a parameter that has never been extracted **cannot be flagged by any route the backend exposes**. The fallback silently did nothing — a different silent loss from the one H1 set out to fix. It now refuses visibly: *"This parameter has no extracted value yet, so there is nothing to flag. Run an analysis first, then flag the value it produces."* Verified on screen. Lifting the restriction is a backend change (new Task B item B9 below).
  **This corrects the 2a-i history note**, which claimed the fallback path worked; per §1 that note is left as written and corrected here.
- **Cancel is offered for running jobs** but worded "Stopped on this side. The server may have continued" (D9, §8.3) rather than implying the run was undone.
- **Analyze stays pressable during a correction.** `canStart` blocks only a second *extraction*; a correction plus an extraction on one project serialise through the per-project ordering rule instead, so the extraction queues rather than being refused (§8.1: at the cap, work queues).

## Gaps found
- **Categories are Title_Case, not UPPER_SNAKE.** `GET /extraction-templates/parameters` returns `Voltage`, `Current`, `Temperature`, `Capacity`, `End_Of_Life`. CLAUDE.md §8.2 and RFC §5b.2 both assume `VOLTAGE` … `END_OF_LIFE`. **Step 8's category map must normalise case**, or every category will fall into the "unknown" bucket. Not fixed here (no category UI in this step).
- **New Task B item B9:** allow flagging a parameter with no candidate — either make `ai_metric_candidate_id`/`extraction_run_id` nullable on `ai_parameter_flags`, or have the batch save honour the `flag` fields it already accepts.
- `POST /projects/{id}/approve` sets every parameter's `review_action` to `ACCEPTED` but leaves `projects.status` at `NEW`. Pre-existing; the Overview screen (step 12) will need to know which of the two it is showing.
- `final_value` comes back as a long float (`2.29999999999999982…`) because the backend serialises `Decimal`. The UI does not show it today — a non-human-modified row displays the candidate's own value — but step 8 must round for display rather than `String()` the raw number.
- Lint warnings 52 → 53 (one unused import left in `ParameterManager` after the flagging rewrite). 0 errors.
- The per-row "correcting" indicator was not visually confirmed: the single-parameter run finished in ~2 s and both samples landed after it. The banner *did* render `Correction: Extracting` from the same `activity.running` object the row indicator derives from, so the wiring is exercised; the indicator itself is unproven.

## Verification
`npm test` **46/46**, `npm run lint` **exit 0** (0 errors, 53 warnings), `npm run build` **exit 0**, `npm run check:contrast` **83/83**.

### D11 reproduction
Two projects, **D11-A** and **D11-B**, created through the API on the **same template** (`Voltavision Default Template`), so both carry the same 27 parameter keys — the condition under which the old code cross-contaminated. Document: **`CF3_B1V2_Prototype_Datasheet_V2.pdf`, 212,967 bytes**, the smallest real datasheet in the repo.

Method: uploaded the document to A only; recorded both projects at 0 filled values; pressed Analyze on A; switched to **B while the run was still streaming** and stayed there until it finished.

While A ran, on B: values stayed **0 filled**, fields stayed **editable** (no app-wide `readOnly`), and **no job banner** appeared. The app never navigated. Afterwards, at the database level:

| Project | parameters | with `final_value` | with candidates |
|---|---|---|---|
| A (ran) | 27 | 12 | **27** |
| B (on screen) | 27 | **0** | **0** |

B is untouched. Returning to A showed 12 filled values and a *New results are in.* banner. **The D11 bug is fixed in the running app.**

### Regression checklist (live backend)
| Item | Result |
|---|---|
| Upload (UI job path) | **Pass.** Banner `Upload: Uploading`; document appears in the sidebar; Analyze becomes enabled. |
| Analyze | **Pass.** Banner showed real phases (`Sections routed`); run recorded as `MAIN_MULTI_AGENT` run 1; 12 values extracted. |
| Partial results appearing | **Partial.** Phase progression and the final result were observed; a mid-run per-category snapshot was **not** captured (the sampling landed either side of it). The reducer's `partial` handling is unit-tested. |
| Candidate switch | **Pass.** `I_MAX_CHA_CONTINUOUS` 544.5 → 429 via the alternatives chips. |
| Flag, with a candidate | **Pass.** `U_MAX` on A: real `ai_parameter_flags` row, reason stored. |
| Flag, without a candidate (H1) | **Changed, see Decisions.** Now a visible refusal; previously a silent 422. |
| Flag + re-extract | **Pass.** `SINGLE_PARAM` run 2 (`gpt-5.6-sol`); `U_MIN` 2.5 → 2.3; flag chained to a new id. |
| Save | **Pass.** 429 and `selected_candidate_id` persisted. |
| Approve | **Pass.** All 27 parameters `ACCEPTED` (project `status` unchanged — see Gaps). |
| Export | **Pass.** 15,546-byte `.battery` XML, expected structure. |

**Behaviour differences from before**, as asked:
1. Flagging a never-extracted parameter now refuses visibly instead of appearing to succeed.
2. No full-screen spinner on project switch or save; the sidebar and viewer no longer unmount, and a skeleton replaces only the parameter list.
3. Editing is no longer blocked during an analysis.
4. Analyze/upload state is per project; another project's run no longer disables this one.
5. Completion shows a *New results* banner instead of silently swapping content.
6. Failures surface in a banner with the backend's message; previously they only reached the console.

**Token spend: 4 backend operations.** 2 uploads (Analyzer + Grouper: one per project) and 2 extractions (1 blind on A, 1 single-parameter correction on A). The D11 reproduction reused the single blind run rather than taking one of its own.

**§8 checks.** §8.1 is the step's rule and is covered above: work is project-scoped, nothing is app-wide, opening projects is never blocked, completion neither navigates nor interrupts, and failures stay local. §8.4 partially: skeletons replaced the spinner, and the banner's cancel/dismiss are keyboard-reachable MUI controls — but the new banner has **not** been through the full §8.4 bar (hover/focus/pressed/disabled states, reduced motion) because step 7 rebuilds it as `RunTimeline` + `JobBanner` proper. §8.2 and §8.3 do not apply.

**Test data left behind:** projects `D11-A` and `D11-B` in the dev database, with the uploaded datasheet. Delete them whenever you like; they are only there for inspection.

## Next
**Step 2b**: per-browser cap and queue shared across tabs via `navigator.locks` and `BroadcastChannel`, liveness from the per-job Web Lock rather than timer leases (AM2), queued jobs persisted with upload files in IndexedDB (`lib/db.ts` v2), and the Interrupted state with "Run again". Its verification must include starting a run, leaving the tab backgrounded for 5+ minutes, and confirming the job was never marked Interrupted.
