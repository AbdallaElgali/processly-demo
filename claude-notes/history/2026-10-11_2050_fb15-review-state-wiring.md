# F-B15: wire the B15 + R1 backend change (stored review state, reviewer ids)

## Goal
The backend now stores `review_action`, keeps human-touched rows through re-extraction and logs review events (`BDA/claude-notes/history/2026-10-11_1940_b15-review-preservation.md`). Make every frontend save send the row's real state, send the actor ids, reload so nothing stale is saved back, and drop the B15 workarounds. Branch `fe/b15-review-state`, from `task-a/redesign` (not yet merged into `main`). No extraction runs, no backend edits, no server started.

## openapi diff (step 1)
Copied `BDA/claude-notes/context/openapi.json` over `claude-notes/context/openapi.json`. Compared: no path added or removed in the frontend's copy, except `/system/reset-database`, which the frontend copy lacked and which stays unused in the UI (CLAUDE.md §0.5). Changed:
- `POST /projects/{project_id}/approve`: optional body `ApproveInput` (new schema, `reviewer_id: uuid | null`).
- `BatchParameterSaveInput`: + `reviewer_id: uuid | null`.
- `ParameterInput.review_action`: now an enum (unknown value is a 422).
- `AIUnflagRequest`: + `user_id: string | null`.

## Audit: what each save path sent before this step (step 2)
The backend ignored `review_action` until now, so none of this was visible. Against the new backend:

| Path | `review_action` sent | Could it send PENDING for a row that is ACCEPTED/MODIFIED on the server? |
|---|---|---|
| `inputFieldToParameterInput` (`lib/parameter-adapter.ts`) | `f.reviewAction`; `is_human_modified` = `reviewAction === 'MODIFIED'` | Not by itself: an untouched row is sent as loaded. **But** `is_human_modified` was derived from the action, so an ACCEPTED row that holds a person's edited value would be sent `false`, and the next reload (the adapter shows `final_value` only when `is_human_modified`) would show the candidate's value instead. Also `REJECTED` was not in the `ReviewAction` type. |
| `acceptRow` | **Bug.** It saved `current`, whose `reviewAction` is PENDING (or MODIFIED), so Accept sent PENDING and never stored the acceptance; it only set a session mark. | Yes, always: it would also RESET an ACCEPTED row (the backend logs a RESET). |
| `saveFields` / `saveChanges` (toolbar Save) | The dirty rows' `reviewAction`: MODIFIED after an edit, PENDING after Revert or choosing a candidate, else as loaded | Only through Revert / choosing a candidate (a deliberate touch). Stale case: a dirty row whose server state changed meanwhile keeps the local value (see item 5). |
| `saveAndApprove` | `saveChanges`, then approve | Same as Save. The old Approve gate counted unsaved rows as pending "because the save writes them back as PENDING", and the Save dialog warned "saving returns approved parameters to pending". Both are false now. |
| `reextractRow` / flag routes | Do not save through the batch route | No. |

Also: `edits.ts` `selectCandidate` returns PENDING (a deliberate reset when the person picks another AI candidate; the backend labels it SELECT_CANDIDATE). `revertValue` returns PENDING.

## Changes
- `types/index.ts`: `ReviewAction` + `REJECTED`; `InputField.isHumanModified`; `Specification.runNumber`.
- `lib/parameter-adapter.ts`: reads `is_human_modified` and `run_number`; sends `is_human_modified` from `isHumanModified` (fallback: action is MODIFIED) and the row's real `review_action`.
- `lib/review/edits.ts`: `acceptField`; edit / revert / select set `isHumanModified`; `mergeLocalEdits` keeps it.
- `api/projects.ts`: `apiSaveProjectParameters(…, reviewerId)` sends `reviewer_id`; `apiApproveProjectParameters(…, reviewerId)` sends `{reviewer_id}`. `api/parameters.ts` `unFlagParameter(…, user_id)`.
- `lib/review/flagging.ts`: `clearHumanFlag` / `resolveHumanFlag` take and send the user id.
- `lib/project-data/actions.ts`: `saveFields` passes the user as reviewer; `approveProject(projectId, userId)`; new `reloadAfterRun`.
- `lib/jobs/runtime.ts`: reloads the project after an extraction or correction run ends as complete, **failed or cancelled** (a stream aborted part-way has already put unsaved partial candidates into the rows in memory, D9).
- `lib/review/actions.ts`: `acceptRow` marks the row ACCEPTED (dirty), saves it, and puts the row back as it was if the save fails; `removeFlag` / Accept send the user id; `saveAndApprove` passes the user; errors go through `errorMessage` (a 422 shows the backend's text; nothing retries).
- `lib/review/approval.ts`: `REVIEW_STATE_PERSISTED = true`; `pending` counts PENDING rows only; the `dirty` option is gone; message "Nothing is pending: …".
- Workaround removal: the session `accepted` mark is deleted (`ProjectState.accepted`, `setAccepted`, `rowState`'s `acceptedLocally`, `SecondaryFacts`' `acceptedLocally`, `ParameterRow`/`ParameterTable` props, the Workspace page); the "Saving returns approved parameters to pending" confirm is deleted; the Accept tooltip and the "Approved" caption now say what is true; B15 comments in `approval.ts`, `actions.ts`, `store.ts`, `api/types/projects.ts`, `flagging.ts` rewritten.
- `lib/review/newer.ts` + `rowState`/`indicators`/`ParameterRow`: "Newer AI candidate available" (secondary fact icon with tooltip, plus a note in the row's Review section).
- `CLAUDE.md` §5 (review actions, store) and §6 (B15 row); `plan-A-amendments.md` B15 marked fixed in the backend.
- Tests: `lib/review/persistence.test.ts` (new, 21); `lib/review/hitl.test.ts` adjusted for the removed session mark and the new gate.

## Decisions
- **`isHumanModified` is a separate field**, not derived from `reviewAction`: an edited row that was then accepted is ACCEPTED and still human-modified. Without it, Accept on an edited row would have stored `is_human_modified = false` and lost the edit on the next load.
- **Approve's "pending" = PENDING rows only.** The backend flips only PENDING; an edited (MODIFIED) or REJECTED row stays as it is. The old count included unsaved rows. **Owner: confirm** that a MODIFIED row should not need Approve, and that the Overview should keep counting MODIFIED as "pending" (it does: `reviewProgress` buckets only ACCEPTED as accepted). That is a product call; I left the Overview alone.
- **Choosing another candidate or Revert on an ACCEPTED row resets it to PENDING** (a new decision; the backend logs SELECT_CANDIDATE / RESET). Kept. The brief says "never downgrade a row the user did not touch"; these are touches.
- **"Newer AI candidate available" needs no new backend field.** `GET /projects/{id}` returns the latest run's candidates plus the currently selected candidate, each with `run_number` (`BDA/src/db/projects.py`, `target_candidates`). A human-touched row (action not PENDING, or `is_human_modified`) whose selected candidate has a lower `run_number` than another candidate of the row gets the hint. When a run number is missing, or the selected value is a typed one with no candidate, it says nothing. Nothing added to AM8.
- Reload also on failed and cancelled extraction/correction runs, beyond the brief's "completes": partial results are applied to memory before anything is saved.
- S5 (screens disagreeing on accepted counts after a post-approval save) is closed by removing the session mark: the Workspace and the Overview now read the same stored `review_action`.

## Gaps found
- **Not tested at the action level:** `acceptRow` itself (it needs the toast, job runtime and store mocked); the pure transform `acceptField` and the exact request body are tested instead, and `saveFields` / `approveProject` / `reloadAfterRun` are tested against a stubbed `fetch`. The runtime hook that calls `reloadAfterRun` after a run is not unit-tested (no test harness for `JobRuntime`).
- **Cutover:** the migration is not applied to dev. Against the old backend the new bodies are harmless (extra fields ignored), but Accept will not persist until the owner runs `npm run db:up` (R1 cutover, plan 2.5).
- An unknown `reviewer_id` is a 422; the signed-in user comes from the login, which has no real authentication (A2), so a stale local user could trigger it. The text is shown in the toast.
- `.next/types` and `.next/dev/types` were stale (referencing the removed `extract` and `review` pages) and made `tsc` and `next build` fail before my changes; I deleted those two generated folders (gitignored) so the checks run.
- Count semantics on the backend (rows sent, changed or not) are the backend note's open question, not ours.

## Verification
- `npm test`: **233/233** (18 files; +21 new, 0 skipped). Written first: before the implementation the new file failed to load (`./newer`, `acceptField`, `REVIEW_STATE_PERSISTED`, `reloadAfterRun` missing).
- `npm run lint`: 0 errors, 0 warnings. `npx tsc --noEmit`: clean. `npm run build`: exit 0.
- **Browser: not exercised.** No dev server or backend was running, and I may not start the backend on port 8000. The UI changes (secondary-fact icon, the new row note, the simplified Accepted caption) are unverified in light/dark and the console is unchecked. Do this before merging: open a project with an ACCEPTED row after the migration is applied, check Accept → reload keeps it, and that no console error appears.
- No extraction run, no upload, no tokens spent; `test-data/` untouched.

## Next
Owner: apply the migration to dev, then browser-check Accept, Save after Approve (the row must stay accepted), Approve, and a re-extraction over a human-touched row (the "Newer AI candidate available" hint). Then Task B per the plan.
