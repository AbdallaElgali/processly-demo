# Plan frontend, Task A

## Goal
Write `claude-notes/plans/plan-A.md` from CLAUDE.md (§7–§9, decisions D1–D11), the RFC, the backend summary, the reference images and explore-A. No source code.

## Changes
- `claude-notes/plans/plan-A.md`: new. Sections 1–10 as requested, plus §11 (facts verified against the backend, the basis for D10 hand-written types and for every "placeholder").
- `claude-notes/history/2026-10-09_1023_plan-frontend-task-a.md`: this note.
- No source file touched. Nothing committed; the working tree still carries the pre-existing uncommitted changes noted in the explore note.

## Decisions (choices the decisions log left open; marked "plan decision" in the plan)
- Accent shades (D1): `#00AAB9` fills, `#00707A` for text/focus in light mode (computed ≈5.8:1 on white), `#5FD3DE` for text in dark mode. Step 1 must re-verify with a committed contrast script, not trust the plan's arithmetic.
- State mechanism: hand-rolled stores over `useSyncExternalStore` (job store + per-project data store), no new state library.
- Per-project serialisation: at most one running extraction-or-correction job per project; uploads independent. Corrections jump the browser-wide queue (CLAUDE.md §8.3).
- Approve is disabled while any human flag is open (veto-able).
- Qualifier tags (MIN/MAX/NOM/SAFETY/PULSE/CONTINUOUS/DYN) are derived from the parameter key because the backend has no qualifier field; the tag says so.
- H1 (lost human flags) is folded into step 2a, which rewrites the flag path anyway; the rest of the contract fixes are step 4.
- Dropzone accepts `.pdf,.xlsx,.xlsm` only (the analyser handles PDF and Excel).
- `/admin` is kept and only restyled; project-scoped audit lives in the Audit tab.

## Gaps found
- `PUT /projects/project-parameter/{id}/add` is broken server-side (wrong arity call into `add_project_parameter_db`) → "Add parameter" is a placeholder in Task A.
- `GET /projects/{id}` has no `category` and `customer` is always null (D5 join and D6 fallback both needed). The hand-written type must not declare `category`.
- `BatteryMetric` has no min/typ/max qualifier and no C-rate field (CLAUDE.md §7 rules are derived from key and unit; recorded for Task B).
- Auto-flag `is_flagged` from `_flag_out_of_bounds` is not a stored column; after reload only `rule_violations`/`requires_review` survive. Task B question.
- No routes for: project member list, project-level flag list, human-flag chain depth, document 410. All placeholders.
- `review_action` backend enum is `ACCEPTED|MODIFIED|REJECTED`; the frontend's `PENDING` default must be confirmed against the batch-save SQL in step 4.
- Upload `errors` are `{filename, error}` objects, not strings (explore-A missed it).
- Backend summary lives in the sibling repo (`BDA/claude-notes/audit/`), not in this repo's `claude-notes/context/` as CLAUDE.md §2 says.
- explore-A #15 was wrong: `NEXT_PUBLIC_API_URL` is correct; CLAUDE.md §4 is the stale side.

## Verification
- No build or lint (no code). Response shapes were taken from the backend's own Pydantic modules and route/SQL source, cited by file and line in plan §11. Contrast ratios computed by hand with the WCAG formula; flagged for script verification in step 1.
- All three reference PNGs re-read for §1 surface values and §4 layout.

## Next
Human review of plan-A.md. On approval: **A · Execute, step 1** (tokens + both modes + Tailwind removal), per plan §9.
