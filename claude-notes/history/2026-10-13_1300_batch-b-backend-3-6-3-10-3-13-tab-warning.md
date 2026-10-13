# Batch B: backend steps 3.6, 3.10, 3.13 and the "keep this tab open" warning

## Goal
Adopt customer-required create (3.13), POST add-parameter (3.10), short decimals (3.6), and warn before a tab with a running analysis is closed (backend X3).

## openapi.json changes (snapshot copied from ../BDA)
- New method `POST /projects/{project_id}/parameters` (201 -> FullProjectParameterOutput).
- New schemas: `AddParameterInput` {parameter_id uuid, user_id uuid|null}, `FullProjectParameterOutput`, `AiMetricCandidateOutput`.
- `ProjectCreateInput`: `customer_id` now required plain uuid.
- No paths removed. (Value shortening 3.6 changes no schema.)

## Changes
(filled in as the work proceeds)
- `claude-notes/context/openapi.json`: replaced by the backend snapshot (see above).
- `api/projects.ts`: `ProjectCreateInput.customer_id: string` (required); `ProjectParameter.final_value` widened to `number | string | null`; new `apiAddProjectParameter` + `AddParameterBody`.
- `types/index.ts`, `lib/parameter-adapter.ts`: `InputField.parameterId` from the payload's `parameter_id`.
- `lib/projects/create.ts` (new), `components/projects/NewProjectDialog.tsx`: customer mandatory, Create disabled until chosen, `customer_id` always sent, 422 detail shown via `errorMessage`, inline "New" customer kept.
- `lib/parameters/meta.ts`: `parametersNotInProject` matches on `parameter_id` (key fallback only for rows without one); `buildAddParameterBody`.
- `lib/project-data/store.ts` `appendField`, `lib/project-data/actions.ts` `addParameterToProject`: adapter on the 201 row, appended without reload.
- `components/parameters/ProjectParameters.tsx`: B1 placeholder removed; real Add buttons; "Add parameter" opens the "Not in this project" list; note that a running extraction will not fill a newly added parameter.
- `lib/jobs/closeGuard.ts`, `components/jobs/RunningJobGuard.tsx`, `app/layout.tsx`: `beforeunload` while an extraction/correction is running. Indicator line in `JobStatusLine`, `JobBanner`, `JobTray`.
- `CLAUDE.md`: Parameters section, B1 row, new batch-B paragraph.
- Tests: `lib/jobs/closeGuard.test.ts`, `lib/projects/create.test.ts`, `lib/parameters/add.test.ts`, `lib/review/decimals.test.ts`.

## Decisions
- The old `PUT /projects/project-parameter/{id}/add` route was never called by the frontend (grep: no references); nothing to remove. The backend deletes it later.
- Warning covers extraction and correction jobs only, not uploads (an upload request is not the analysis stream) and not queued jobs. It reads the shared job store, so a job running in another tab of this browser also triggers it in this tab (spec: "of this browser"); slightly over-cautious, never silent.
- The line is visible in the status pill (large screens), the job banner/popover, and the header job tray.
- Add is allowed while a run is going; a note says the run will not fill it (backend note).
- Decimals (3.6): tests only; format.ts and the adapter already handled string and number, no code change. Save sends `Number(raw)`, so "4.20" is sent as 4.2 (same number).
- Add parameter from an empty project: the "Not in this project" list sits below the parameters, so with zero parameters only the empty state shows (existing layout); not changed.

## Gaps found
- None new. Old projects with `customer: null` already handled (`?? undefined`/`?? null`).

## Verification
- `npm run build`, `npm run lint`, `npx tsc --noEmit`: clean. `npm test`: 24 files, 307 tests pass (was 284 + 23 new; the decimals tests passed before any code change, as expected: regression coverage). `npm run check:contrast`: 90/90.
- Tests first: closeGuard, create, add tests failed (missing modules / `appendField is not a function`) before the code.
- No extraction runs, no backend edits, port 8000 untouched. Browser not exercised by me (checklist below).

## Browser checklist (for you)
1. New project: Create stays disabled until a customer is picked; "New" creates a customer inline and selects it; Create works; with a customer id made stale you see the backend's "Unknown customer_id …" text.
2. An old project with no customer still shows in the list and breadcrumb.
3. Parameters tab: "Add parameter" expands "Not in this project"; Add a parameter: row appears in its category without a reload, toast shows; Add it again from a second tab/refresh state to see the 409 text; unsaved Workspace edits survive.
4. Workspace: parameter values show as 3.65 / -500 / 4.2, no long tails.
5. Start an analysis (your own run): reload/close tab asks for confirmation; header tray, status pill (wide screen) and the banner show "Keep this tab open until the analysis finishes". After it completes or with nothing running: no prompt, no line.
6. Console has no errors or warnings on Parameters, Workspace, Projects.

## Next
Per plan; batch B done pending your browser check.
