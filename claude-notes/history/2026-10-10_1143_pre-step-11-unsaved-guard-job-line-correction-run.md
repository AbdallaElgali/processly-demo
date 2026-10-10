# Pre-step 11: unsaved-edit guard, correction job line, one real correction run

## Goal
The three pre-work items from the owner's step 10 approval, each verified and committed separately before step 11: (1) warn before leaving or reloading with unsaved edits, (2) the toolbar job line reads "Re-extracting…" for a correction before its first event, (3) one real correction run end to end. Also AM8: B15 and B16 added, B6 marked answered (commit `15e9a35`).

## Changes
- `claude-notes/plans/plan-A-amendments.md`: B15, B16 added to AM8; B6 struck through with the answer.
- `components/workspace/UnsavedChangesGuard.tsx` (new), mounted in `app/projects/[projectId]/layout.tsx` (commit `222d37f`).
- `lib/jobs/label.ts` + `label.test.ts` (new), `components/workspace/JobStatusLine.tsx` uses them (commit `84e8ac7`).

## Decisions
- **The guard covers two things.** `beforeunload` while any row of the project has unsaved edits (browser's own prompt; the only case where edits are really lost, because a full load empties the in-memory store). And a click on any in-app link that leaves the Workspace asks first ("Stay and review" / "Leave"). Edits actually survive in-app navigation (step 10), but Save exists only on the Workspace, so they would sit unsaved out of sight; the dialog text says exactly that rather than claiming they would be lost. **Owner may prefer to narrow it** to leaving the project only.
- **Next's App Router has no route-blocking hook**, so in-app links are caught with a capture-phase click listener (modified clicks, new-tab links, downloads and same-path links pass through). Not covered: browser Back/Forward and `router.push` from code (`AuthContext` sign-out, the post-create push on the projects list). Back/Forward still gets the reload prompt only when it unloads the page.
- The job line text moved to `lib/jobs/label.ts` so it can be unit-tested. A correction in its initial `routing` (or `queued`) phase reads "Re-extracting KEY…"; later phases read "Re-extracting KEY: Extracting". Blind extraction still reads "Extraction: Routing sections".

## Gaps found
- **GET /projects/{id} returns only the newest run's candidates per parameter after a correction.** The parameter had 1 candidate before and 1 after: the old candidate is no longer in the project payload, and exists only in the lineage (`/audit/.../lineage`). So after a correction the row shows one candidate, not old + new. By design on the backend or not, the review UI cannot offer "go back to the previous candidate"; the Audit lineage (step 13) is where it is visible. Worth the owner's decision for Task B.
- The first job-line text of the real run ("Re-extracting I_MAX_CHA_PULSE…") was not observed live: the script's first poll came 5 s in, when the line already read "…: Extracting". That path is covered by the unit test, and by the step 10 mocked stream for the row.
- Token usage of the run is not exposed by any route; see Verification for what is known.

## Verification
`npm run lint` 0 errors (19 warnings, as before), `npm test` **161/161** (3 new in `label.test.ts`), `npm run build` exit 0.

**1. Guard (headless Chrome, project `Step8-Workspace`, 1280×800, console clean):** an edit made "Save (1)"; clicking the rail's Overview showed the dialog and the URL stayed on `workspace`; "Stay and review" kept the page; "Leave" went to Overview. A reload with an unsaved edit raised the `beforeunload` dialog; a reload with no edits raised none.

**2. Job line:** unit-tested (above).

**3. Real correction run, one only, no retry.** Project `Step8-Workspace`, parameter `I_MAX_CHA_PULSE`, "Flag and re-extract" in the UI with a harmless test reason, headless Chrome, nothing in the repo edited while it ran. The run finished about **13 s** after the click (job line "Re-extracting I_MAX_CHA_PULSE: Extracting" → gone), console clean. Before → after, read from the backend:
  - extraction runs: 1 → **2**; the new run is `SINGLE_PARAM`, run number 2, `parameters_count` 1, model `gpt-5.6-sol`.
  - **The new candidate was saved** (run 2, id `352a6722…`), is selected, and the parameter's `review_action` is now `PENDING` (it was `ACCEPTED`). No other parameter's `review_action` changed; still 27 parameters.
  - **The flag was chained:** lineage shows the original flag (`45de1488…`, created by my UI click) now **RESOLVED** with `resolvedByCandidateId` = the new candidate, and a new flag (`1ac2a688…`) **OPEN**, created 20 ms after the candidate, carrying the same reason. So Approve is blocked on that row until a reviewer accepts or removes the flag, as the correction toast says.
  - The backend saves at `complete` (D9) held: nothing was visible in the project before the end of the stream.
- **Spend: one correction run, one parameter, the documents the project already holds (the smallest test PDF is among them).** Token counts are not returned by any route and were not measured; no uploads, no other runs.
- No values, snippets or table contents are recorded in this note (CLAUDE.md test-data rule 2).

**Test data changed:** `Step8-Workspace` `I_MAX_CHA_PULSE` now has the run-2 candidate selected, one RESOLVED and one OPEN flag (test reasons written by me), `PENDING`. It blocks Approve in that project until resolved in the UI. No delete route (B12).

## Next
Step 11, the Parameters screen (recorded in its own note).
