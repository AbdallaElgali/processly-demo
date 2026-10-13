# Explore frontend, Task A

## Goal
Read-only exploration of the frontend against RFC-FE-01 and `openapi.json`; write `claude-notes/plans/explore-A.md` (7 required sections).

## Changes
- `claude-notes/plans/explore-A.md`: new, the exploration report.
- `claude-notes/history/2026-10-09_1011_explore-frontend-task-a.md`: this note.
- No source code touched. Nothing committed (the working tree already had uncommitted changes from before this session; see Gaps).

## Decisions
- Treated `CLAUDE.md §5` as stale where the code disagrees (login is wired, `app/page.tsx` redirects, sidebars list projects, not files) and reported the code as truth.
- Read the RFC from `FE_RFC.md` (CLAUDE.md names it `fe_rfc.md`).
- Marked responses that openapi leaves as `{}` as "unverifiable" instead of guessing their shape (CLAUDE.md §0.4).

## Gaps found
- Loading lock has three causes, not one (explore-A §5): global `ProjectContext.isLoading` swaps the whole page for a spinner (`bda/page.tsx:234`); `isAnalyzing` is one page-level flag; `fields[]`/`uploadedFiles[]` are singletons, so a stream that outlives a project switch **writes A's candidates into B's rows**. That is a live data-corruption bug.
- Highest-impact API mismatches: `AIFlagRequest.ai_metric_candidate_id` is required but `null` is sent for human-entered values (flag silently fails); `CanonicalParameter.category` missing from the client type; user registration sends free-text `department` against a 3-value enum.
- Categories: `SCHEMA_GROUPS` drives `input-fields-list.tsx`, which drops any parameter outside its 27 ids and hides empty groups. Whether `GET /projects/{id}` returns `category` is unknown (untyped).
- `/review` is unreachable from the UI (`reviewModeEnabled` is never set); contributor button is dead (`addContributorEnabled` never set); `lib/db.ts`, `DocumentViewer.tsx`, `Loading.tsx`, `api/chat.ts`, `api/admin/users.ts` are unused.
- `claude-notes/history/` was empty, so there were no earlier notes to read.
- Working tree has uncommitted/untracked files unrelated to this session: `static/battery-template.ts` (modified), `CLAUDE.md`, `FE_RFC.md`, `openapi.json`, two PNGs, `scripts/`, `_bundled_frontend_types.md`, `frontend_codebase_tree.txt`.
- 10 open questions for the plan are listed in explore-A §7.2 (category source, breadcrumb customer, routing, cap for correction runs, accent colour, `.battery` export placement, etc.).

## Verification
- No build/lint run (no source changes). Not a baseline.
- Checked by grep: unused files, colour imports (26 files import `@/theme/colors`), hex/rgba literals (16 files), category hardcoding, calls vs the 50 openapi operations.
- Viewed all 3 reference PNGs. No UI was run.

## Next
Answer the open questions (especially Q1, Q3, Q6), then run **A · Plan** to produce `claude-notes/plans/plan-A.md`. Steps 1–3 per the RFC: tokens + both modes, job store, app shell.
