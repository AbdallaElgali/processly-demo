# Step 10: human-in-the-loop actions and "Why this value"

## Goal
Step 10 per AM17: the review actions on the Workspace (flag with reason, flag and re-extract as a correction job, re-extract, remove flag, choose candidate, accept, edit value/unit, Save, Approve with confirmation, toasts, row-level loading only) and the "Why this value" detail (AM15). The reasoning is labelled as the model's explanation, not a quote from the document (B13), with the source text and location as the evidence; empty texts read "No reasoning recorded". Approve is blocked while a human flag is open; auto-flags only warn. The 9b follow-ups were committed separately just before this (`dad4c02`, note `2026-10-10_1041`).

**Browser tool:** Claude in Chrome was **not reachable** in this session (its tools were not available), which was said at the start. Browser checks used headless Google Chrome driven by `playwright-core` from the session scratchpad (not the repo), against `npm run dev` and the local backend.

## Changes
**Pure logic (`lib/review/`, unit-tested in `hitl.test.ts`, 19 tests)**
- `edits.ts` (new): `editValue` (keeps the candidate's extracted value, unit and confidence as `original` on the first keystroke), `revertValue`, `canRevert`, `selectCandidate` (choosing another candidate drops an edit made on the previous one), `mergeLocalEdits` (re-applies unsaved edits on top of a fresh load, by candidate id).
- `approval.ts` (new): `approvalCheck` (open human flags, bounds, empty, needs review, unsaved, pending, job busy) and `approveBlockReason`.
- `why.ts` (new): `whyThisValue` (explanation, reason code on an empty candidate, source note, calculation when calculated, snippet), `NO_REASONING`, `NO_SOURCE_TEXT`.
- `rowState.ts`: `acceptedLocally` option (adds the existing `accepted` secondary fact).
- `flagging.ts`: `resolveHumanFlag` (see B16 below).

**Actions and store**
- `lib/review/actions.ts` (new): the review actions as plain functions keyed by `projectId`, each marking only its own row busy, with toasts. Replaces **`hooks/ParameterManager.tsx` (deleted)**.
- `lib/project-data/store.ts`: `ProjectState` gains `dirty`, `rowOps`, `accepted`; new `updateField`, `markSaved`, `dropDirty`, `setRowOp`, `setAccepted`; `setDetails` merges unsaved edits; `applySpecs` skips dirty rows.
- `lib/project-data/actions.ts`: `saveParameters` → `saveFields(projectId, fields, userId)` (marks the sent rows clean); `approveProject` returns the backend's `parameters_approved`.
- `lib/jobs/runtime.ts`: `onJobSettled` injection point; `lib/project-data/provider.tsx` uses it for the correction toast (the runtime still imports no UI).
- `types/index.ts` `Specification.original`; `lib/parameter-adapter.ts` sets it on a reloaded human-modified row.
- `api/projects.ts`: the `console.log` of every saved parameter removed. `api/types/projects.ts`: `ReviewActionValue` gains `PENDING`, and the comment that said the enum has none is corrected.

**UI**
- `components/workspace/WhyThisValue.tsx` (new).
- `components/workspace/ParameterRow.tsx`: row busy line ("Flagging…", "Queued for re-extraction", "Re-extracting · phase"), unsaved-change dot, detail rewritten: candidates with a per-candidate "Why" disclosure, "Why this value" for the selected candidate, value editor with "Extracted: … · Revert" and a not-a-number note, review actions (below).
- `components/workspace/ParameterTable.tsx`: `rowBusy` / `dirty` / `accepted` instead of one `correctingFieldId`; stale "S shows the source" removed from the table's accessible name (AM19 leftover).
- `components/workspace/indicators.tsx`: `SecondaryFacts` says when "accepted" is a session mark.
- `app/projects/[projectId]/workspace/page.tsx`: wired to the actions; Save (N) sends only unsaved rows; Approve with a confirmation (`ApproveSummary`); a confirmation before saving rows that were approved.
- `components/ui/ConfirmDialog.tsx`: `description` accepts inline content.
- `CLAUDE.md` §3, §5 (Workspace, Review actions, State management, component library), §6.

## How the actions behave
| Action | Backend | Row while waiting | Notes |
|---|---|---|---|
| Flag | `POST /flagging/ai-flag-parameter` | "Flagging…" | Reason required. Disabled with the reason when the row has no candidate (B9). |
| Flag and re-extract | flag, then a `correction` job (`POST /specs/stream-parameter`) | "Queued…" / "Re-extracting · phase" | Nothing is queued if the flag fails. |
| Re-extract (flagged row) | `correction` job | same | Optional hint; falls back to the flag reason. |
| Remove flag | `POST /flagging/ai-unflag-parameter` (DISMISSED) | "Removing flag…" | |
| Choose candidate | local, plus `POST /flagging/select-correct-ai-candidate` when flagged | "Recording choice…" | Undone if the call fails. |
| Edit value / unit, Revert | local until Save | unsaved dot | Revert restores the exact extracted value (AM10). |
| Accept | resolve the open flag (B16 path), then save this row | "Accepting…" | "Accepted" is a session mark (B15). |
| Save (N) | `PUT /projects/{id}/parameters`, unsaved rows only | toolbar button | Asks first when a row was approved (B15). |
| Approve | Save first if needed, then `POST /projects/{id}/approve` | toolbar button | Blocked by an open human flag, a queued/running extraction or correction, or nothing pending. Auto-flags are listed as a warning in the dialog. |

## Decisions
- **Accept = resolve the flag (if any) + save this row + a session mark.** plan-A said accept "sets review_action ACCEPTED locally; persisted by Save". That is not possible: `save_project_parameters_batch_db` ignores `review_action` and writes `PENDING` on every row it saves, and no route accepts one parameter. So Accept persists what it can (the flag's resolution and the row's value and choice) and says that acceptance itself is recorded by Approve. **Owner may prefer a different meaning**; the mark is easy to drop.
- **Save sends only rows with unsaved edits**, not every row as before. Fewer writes, and fewer approved rows silently returned to PENDING (B15). Rows a correction is about to replace are not saved.
- **No more "persist on flag".** The old flag handler ran a full batch save after every flag. The flag routes store the flag themselves and the batch save ignores flag fields (B9), so that save only wrote every other row's unsaved edits and reset their `review_action`. Removed.
- **Unsaved edits survive refreshes.** Every job completion and every save reloads the project; before this step that replaced all fields, so a correction finishing on one row reverted unsaved edits on all others. Now `setDetails` merges them back (`mergeLocalEdits`), and a run's live results skip dirty rows. A correction drops its own row's unsaved edit, because it replaces that value.
- **Choosing another candidate discards an edit on the previous one.** An edit belongs to the candidate it was made on; otherwise the save would write a person's number under an AI candidate's id with `is_human_modified` false.
- **Approve blocks while an extraction or correction for the project is queued or running**, in addition to the brief's open-human-flag rule: a correction opens a new chained flag after the approval, and a run rewrites values. Also disabled when nothing is pending.
- **The flag form is inline in the row detail, not a drawer** (plan-A's `FlagDrawer`): a drawer would cover the document viewer, the evidence the reviewer is checking.
- **"Why this value"** shows, per candidate: "Model's explanation" (`extraction_logic`), "Model's note on the source" (`source_reason`), "Calculation (computed, not read)" when `is_calculated`, each with an info tooltip saying it is the model's text, not a quote and not its internal reasoning; then "Evidence from the document": location, document name, "Show in document", and the recorded source text as a quote. An empty candidate shows its reason code ("Why there is no value") instead of an explanation. Model texts carry a sparkle icon in `status.info`, evidence a document icon in `accent.text`, so the two never rely on colour alone.
- **Correction completion toast** through an injected `jobRuntime.onJobSettled`, keeping the runtime free of UI imports as before. No "Open" action: navigating from a toast would need the router in non-component code, and the rail badge already marks the project.

## Gaps found
- **B16 (candidate, backend bug): `POST /flagging/ai-unflag-parameter` with a `resolved_by` always fails** with 500 `Failed to unflag AI parameter: 'id'`. Its second query selects `extraction_run_id` and the loop then reads `['id']` from that row (`BDA/src/db/ai_parameters.py`, `unflag_ai_parameter_db`), so the transaction rolls back and the flag stays OPEN. The old frontend only ever dismissed, so this branch was never exercised. Found by the browser check (the UI reported the error and kept the flag, as designed). **Workaround in `resolveHumanFlag`:** `select-correct-ai-candidate` records the resolving candidate, then `ai-unflag-parameter` without `resolved_by` sets RESOLVED. Verified on the backend: the flag reads `status RESOLVED` with `resolvedByCandidateId` set. Lost until fixed: `resolved_at_run_id`.
- **B15 (candidate): no per-parameter accept, and Save un-approves.** The batch save ignores `review_action` and writes `PENDING`; Approve flips only `PENDING` rows to `ACCEPTED`. So a Save after Approve returns the saved rows to pending (the UI asks first), and a row cannot be accepted on its own.
- **B6 answered:** `review_action_enum` does include `PENDING` (`DB/migrations/20260821000000_schema.sql`); it is the column default.
- **B10 confirmed again:** after Approve, all 27 parameters were `ACCEPTED` and the project status stayed `NEW`.
- B15 and B16 are **not added to AM8** without the owner, as with B14 in step 9b.
- **The real correction run did not complete** (see Verification). The frontend's completion path was verified against a browser-only mock of the stream, and the resolve/approve path against the real backend; the backend's own save-and-chain at `complete` was **not** observed in this step.
- **The toolbar job line says "Routing sections"** for a correction before its first event (`JobStatusLine` from step 7 shows the job's initial `routing` phase). The row itself now shows "Re-extracting…" until events arrive. Small; left for the job-line owner.
- Unsaved edits, session accept marks and row expansion are in memory: a full page reload drops unsaved edits without a warning. A `beforeunload` prompt was not added (not in the brief).

## Verification
`npm run lint` **0 errors** (19 warnings, down from 25: the deleted `ParameterManager` carried some; none new). `npm test` **158/158** (10 files; 19 new in `lib/review/hitl.test.ts`). `npm run build` **exit 0**. `npm run check:contrast` **90/90**. `tsc --noEmit` clean apart from the pre-existing `lib/jobs/reducer.test.ts` errors noted in step 8.

Browser checks (headless Chrome, project `Step8-Workspace`, CFC PDF; console read on every run, **no errors or warnings in any run**):
- **Why this value:** on `I_MAX_CHA_CONTINUOUS` (calculated) all four blocks render, with location "Page 2 · CF3_…pdf"; an alternative candidate's "Why" opens in place (`aria-expanded=true`). On the EB586 workbook the location reads "Sheet 2 · A11:X18 · EB586_…xlsx", and "Show in document" lands on "Cell 1 of 20".
- **Edit, Revert, choose, Save:** choosing an alternative → unsaved dot, "Save (1)"; editing `U_MAX` → "Extracted: … · Revert", "Save (2)"; Revert restores the extracted value; Save → "Saved 2 parameters.", button back to "Save".
- **Flag:** Flag disabled until a reason is typed; flagged → "Flagged" badge, Approve disabled with "1 open flag (U_MIN). Accept a value or remove the flag first."; Remove flag → "Flag removed from U_MIN."
- **Accept (unflagged):** "T_MAX_BODY accepted and saved.", green "Accepted" status and the secondary icon.
- **Approve with an auto-flag** (browser-only route adding a `rule_violation` to `U_MAX_SAFETY`; backend data untouched): Approve stays enabled; the dialog warns "1 value is out of bounds (auto-flag, raised by the backend): U_MAX_SAFETY", plus the rows still marked for review.
- **Correction, mocked stream** (browser-only route on `/specs/stream-parameter`, held 8 s, then `targeting` → `partial_correction` → `complete`; no request reached the backend): only the corrected row was busy; Approve was disabled ("Wait for…"); another row was edited during the run; leaving to Overview and back kept the job running; on completion the toast "I_MAX_CHA_PULSE re-extracted. Its flag stays open…" appeared and **the other row's unsaved edit survived the background refresh**.
- **Accept on the flagged row (real backend):** first attempt surfaced B16 as an error toast with the flag kept; after the workaround: "accepted: flag resolved and value saved.", Approve enabled.
- **Approve (real backend):** "Save and approve" → "Approved 27 parameters."; rows show "Approved"; editing an approved row and pressing Save asks "Saving returns approved parameters to pending… U_MAX" (cancelled, reverted). With everything approved, Approve is disabled with "Every parameter is already approved."; an unsaved edit re-enables it with "1 pending parameter becomes accepted".
- **Keyboard:** in an open detail, Tab goes candidate jump → the model-text info icons → Show in document → value → unit → Accept → (flag field) → out to the split handle; disabled buttons are skipped.
- **`/` on the projects list** (9b follow-up): no longer focuses the search.

**Token spend: one correction run started, none completed.** `Flag and re-extract` on `I_MAX_CHA_PULSE` in `Step8-Workspace`, document `test-data/CFC/CF3_B1V2_Prototype_Datasheet_V2.pdf` (the smallest test PDF, 2 pages). About 5 s into the extraction phase my **test script** crashed on an ambiguous link selector and closed the browser, which ended the stream. The backend saved nothing (still 1 run in `extraction-runs` more than a minute later, the parameter still had its single candidate), but the targeting step and part of one extraction call were spent. **I did not start a second run**, because the brief allowed at most one; the rest of the flow was verified with the mocked stream and the real flag/save/approve routes. No uploads. The flag raised before the run was then resolved through the UI.

**Test data changed:** `Step8-Workspace` (`5b6a7a5c-fedb-4909-9c8c-29d974fa3fa7`): `I_MAX_CHA_CONTINUOUS` now selects an alternative candidate (saved during the Save check); two flags in its audit trail (one DISMISSED on `U_MIN`, one RESOLVED on `I_MAX_CHA_PULSE`, both with test reasons written by me); all 27 parameters `ACCEPTED`. No delete route (B12).

## How it looks (AM18)
Screenshots in **light at 1920×1080 and 1280×800** and **dark at 1920×1080 and 1280×800**, covering an expanded row with "Why this value", an alternative's "Why", an edited row, a flagged row, the accepted state, the Approve dialog with and without the auto-flag warning, the running correction, the save confirmation and the Excel source.
- **Why this value** sits under the candidates in the left half of the detail; the actions sit on the right. The model's texts are plain paragraphs under small blue "Model's explanation / note on the source / Calculation" labels with an ⓘ; the evidence is a quoted block with a left rule on the canvas surface, under the location line and a "Show in document" button. The two kinds of text read as different things at a glance. At 1280 the detail stacks into one column (container query), Why above Value and Review.
- **Flagged row:** a red tinted note with the flag icon and the reason in quotes, "Accept value and resolve flag" as the primary button, "Remove flag" as a red text button, then the optional hint and "Re-extract this parameter".
- **Busy row:** the value cell is replaced by a small spinner and "Re-extracting…" in `status.info` (an hourglass and "Queued for re-extraction" when queued); the rest of the table is unchanged and interactive.
- **Unsaved edit:** a small violet dot after the value (the `status.modified` colour of the "Edited" chip), and "Save (N)" in the toolbar.
- **Dark mode:** same structure on dark surfaces. The evidence quote first used `surface.sunken` (a near-black band in dark mode) and was moved to `surface.canvas`, a gentle step from the panel in both modes.
- **Polished during the step:** Accept turned into a disabled grey "Accepted" button, which read as unavailable; it is now a green "Accepted" status line (or "Approved" for an approved row). The Approve dialog said "every pending parameter of the 27" when none were pending; it now counts the pending rows and Approve is disabled when there are none. The row read "Re-extracting · routing" before the correction's first event; it now reads "Re-extracting…".
- **Worth the owner's eye:** an expanded row is tall (Why + actions), so with two or three open the table scrolls a lot; and the Next.js dev indicator overlaps the bottom-left toast in development only.

## Next
Owner review of step 10: the meaning of Accept (session mark plus save), B15 and B16 for AM8, and whether to spend one more correction run to observe the backend's save-and-chain end to end. Then **step 11** per AM17: the Parameters screen and templates.
