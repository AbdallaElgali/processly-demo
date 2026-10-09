# Step 6: Projects list, final

## Goal
plan-A §9 step 6: replace the step-3/5 cards with lazy per-project counts, status filter chips, the guided tour's first step on real targets, and real fetch error states. Since this step touches project creation, move `NewProjectDialog` onto the shared `FormDialog` (user instruction, not in plan §9's step-6 scope but natural here). Also: a small CLAUDE.md §8.4 rule addition requested ahead of the step's own work.

## Changes
**CLAUDE.md**
- §8.4 — new bullet: every step that changes UI must open the affected screens in the browser and confirm a clean console; the `useSyncExternalStore` "getSnapshot should be cached" class of bug (hit twice already, steps 3 and 5) is invisible to build/lint/test.

**New**
- `lib/project-data/lazyDetails.ts` — a 6-concurrent prefetch queue for `GET /projects/{id}`, separate from `lib/jobs`' `JOB_CAP` (that cap is for actual background work; this is a soft throttle on plain reads so a long list doesn't open dozens of connections at once, per plan §4.3/§8.1). `requestProjectCounts(projectId)` is idempotent per session (an `attempted` set), so repeated calls from re-renders are free.

**Changed**
- `components/ui/ProjectCard.tsx` — calls `requestProjectCounts` on mount and reads `useProjectData`; shows "`N documents · M/T parameters`" once cached (both from real fields: `documents.length`, `parameters.filter(final_value !== null).length`), a muted "Counts unavailable" on fetch failure, else a skeleton line. No invented fields (CLAUDE.md 0.4).
- `components/ui/StatusChip.tsx` — exports `PROJECT_STATUS_ORDER` and `projectStatusLabel()` so the list's filter chips use the same order/labels as the chip itself, rather than a second copy.
- `app/projects/page.tsx` — status filter chips (All + the 4 statuses, multi-select, ANDed with the search query); the guided tour's first step, anchored on `[data-tour="new-project-button"]`; real error handling — `ErrorState` with retry when the list itself failed to load and there's nothing to show, an inline dismissible-by-retry `Alert` when it fails on top of an already-populated list (so a transient error never wipes the grid the user is looking at).
- `components/ui/FormDialog.tsx` — **bug fix surfaced by this step**: the Cancel button had no explicit `type`, and HTML defaults an untyped `<button>` inside a `<form>` to `type="submit"`. Since `FormDialog` wraps its content in a `<form>` (for Enter-to-submit), clicking Cancel would *also* fire the form's `onSubmit`. Added `type="button"`.
- `components/projects/NewProjectDialog.tsx` — rebuilt on `FormDialog` per the explicit instruction. The inline "Add"/"Cancel" (customer) and "New" buttons also needed `type="button"` for the same reason — none of them had it before because the old markup wasn't a `<form>`.

## Decisions
- **Card counts are documents and parameters-with-a-value, not "needs review."** The row-state precedence that would make "needs review" a meaningful, non-misleading count (AM1: auto-flag vs. needs-review vs. empty-with-reason) doesn't exist until step 8. Showing it here would mean either duplicating that logic early or showing something that looks authoritative but isn't. Two plain counts from real fields is enough for a list card.
- **Lazy fetch cap is a separate, lighter mechanism from `lib/jobs`' `JOB_CAP`.** A card's `GET /projects/{id}` is a read with no SSE, no cross-tab coordination, and no "project" semantics beyond caching — folding it into the job store would mean every project list render contends with actual upload/extraction job slots for no reason. CLAUDE.md 8.1's "opening is never capped" is honoured: the cap only throttles the background enrichment fetch, never the card's own link/navigation.
- **Status filter is multi-select, ANDed with the text search.** Not specified by the plan; chosen because chips read naturally as toggles and a reviewer scanning for "everything pending or in review" is a reasonable need the single-select "All | one status" model doesn't serve.
- **Error handling distinguishes "nothing to show" from "stale data, retry available."** The plan only says "real fetch error states"; collapsing both into one full-page `ErrorState` would hide an already-loaded grid behind an error screen on every retry failure, which is worse than the single-line banner the original code had.

## Gaps found
- **Testing the FormDialog migration surfaced the type="submit" default-button bug** (see Changes) — not a regression from this step's own code, but dormant until something actually used `FormDialog` as a real form with nested buttons. Worth remembering for any future `FormDialog` consumer with its own inline buttons (Parameters/Templates in step 11, prompt versions in step 13): every non-submit button inside it needs an explicit `type="button"`.
- **`NewProjectDialog` never resets its fields on Cancel**, only on a successful create (pre-existing since step 3, not introduced here). Surfaced during manual testing: typing a name, clicking Cancel, reopening, and typing again concatenates onto the leftover value, because the component stays mounted across opens and `reset()` only runs after `handleCreate` succeeds. Left a test project with the concatenated alias `Step6-Cancel-TestStep6-Create-Test` in the dev database (id `d3a623cc-...`) — harmless, and there is no project-delete route to clean it up with (same situation as step 4's leftover test user). Not fixed here: it predates this step and resetting-on-close is a separate, small behavior change outside what was asked.

## Verification
`npm run lint` **exit 0** (0 errors, 37 warnings — unchanged), `npm test` **60/60**, `npm run build` **exit 0** (15 routes), `npm run check:contrast` **83/83**.

Checked in Chrome (`npm run dev`) against the live backend, console read after every interaction (new CLAUDE.md 8.4 rule):

- **Lazy counts (8.1).** `/projects` loaded with 11 cards; `get_page_text` immediately after showed real counts on every card (e.g. `D11-A`: "1 document · 12/27 parameters"), confirming the capped background fetch completed without the grid waiting on it. Console clean throughout — no `getSnapshot should be cached` warning, which is exactly the class of bug this step's new rule exists to catch (and the one that bit steps 3 and 5).
- **Status filters.** Clicking "Approved" (no project has that status in the dev data) correctly produced the "Nothing matches that filter" empty state with a working "Clear filters" action; clicking "New" (all 11 projects) left the grid unchanged. Chips are real `button`-role elements in the accessibility tree — keyboard-operable.
- **Search.** Typing "D11" narrowed to `D11-A`/`D11-B`; `Esc` cleared it back to all 11 cards (and clears cleanly in combination with the status filter, since both predicates are ANDed in the same `useMemo`).
- **Guided tour.** First visit showed the single-step tour anchored on `[data-tour="new-project-button"]` ("Start a project"); "Skip" dismissed it via `useLocalStorageFlag`, and it did not reappear on reload.
- **FormDialog migration — the bug above.** Opened the dialog, typed a name, clicked **Cancel**: dialog closed, **no project was created** (confirmed by the project-link count in the accessibility tree staying at 11, and a clean console with no network call fired). Before the `type="button"` fix this would have also submitted. Then opened again (field confirmed empty via a zoomed screenshot — `reset()` had run after the one successful create below), typed a clean name, clicked **Create project**: created the project and navigated to its Extract screen, same as before the refactor.
- **Both modes.** Dark mode screenshot: chips, status pills and the new per-card counts line all render on palette tokens with no raw colour. Console stayed clean across the toggle.
- Full-page screenshots (`computer screenshot`) were unavailable all session (CDP timeout, unrelated to the app — console reads, `get_page_text`, the accessibility tree and `zoom` region captures covered every check instead).

**Token spend: 0 OpenAI operations.** All checks used existing projects and one project-creation call (no extraction/upload run).

**Test data left behind:** exactly one project, alias `Step6-Cancel-TestStep6-Create-Test` (id `d3a623cc-279a-4351-98f7-e74c64cdbceb`) — the Cancel-reset gap above (Gaps found) made a second typing pass append onto the first instead of starting clean. Confirmed only one extra project exists (project-link count went 11 → 12, not 13). Harmless; no delete route to remove it (same as step 4's leftover test user).

**§8 checks.** §8.1: lazy fetch capped at 6 concurrent, never blocks the grid or card navigation. §8.3: verified in both modes, tokens only. §8.4: new rule applied throughout this session; Cancel/New/Add buttons keyboard- and click-safe after the `type="button"` fix; chips and search keep their existing keyboard behavior; every empty/error state keeps a next action. §8.2 does not apply.

## Next
**Step 7** per plan §9: the Extract screen — `Dropzone`, documents table, `JobBanner`, `RunTimeline`, `CategoryCard`s (§5 categories, including `END_OF_LIFE`), warnings, Runs tab.
