# Step 13: Prompts & Models (read-only) and Audit

## Goal
Pre-work (own commit `0220ace`): add B22 to AM8 and hide the Overview status change behind a switch. Then step 13 per plan-A 6.6 and 6.7, full width (AM14): the read-only Prompts & Models screen and the Audit screen with Parameters (summary and lineage), Runs, Flags (placeholder) and Feedback tabs. No shortcuts (AM19), no extraction runs.

## Changes
**Pre-work (`0220ace`)**
- `claude-notes/plans/plan-A-amendments.md`: B22 (`update-project-status` answers 200 and never writes; accepts any string).
- `lib/overview/status.ts`: `STATUS_CHANGE_AVAILABLE = false` and the on-screen note. `components/overview/StatusCard.tsx`: the form is not rendered while it is off; the status stays visible. `ProjectDetailsCard.tsx` wording points at B22.

**Pure logic (unit-tested, 17 new tests in `lib/audit/audit.test.ts`, `lib/prompts/prompts.test.ts`)**
- `lib/audit/lineage.ts`: `flagTypeLabel`, `sameValue`, `buildLineage` (oldest first, run number and type joined from the runs list, change against the previous candidate, flag chain both ways), `summaryTotals`, `filterSummary`.
- `lib/audit/feedback.ts`: `collectAllPages` (reads every page), `feedbackTotals` (counts that add up).
- `lib/prompts/view.ts`: scope spelling (`GLOBAL` vs `global`), `joinSlots`, `groupByLevel`, the lazy label. `lib/prompts/config.ts`: `PROMPT_EDITING_AVAILABLE = false`.

**Data layer**
- `api/prompts.ts` (new): hand-written types from the openapi schemas, GET calls only.
- `api/audit/feedback.ts`: rewritten; `fetch_all_feedback`, undefined filters no longer sent as the string "undefined", no `console.log`, `id`/`created_at` optional (see Gaps). `api/audit/project_metrics.ts`: optional `AbortSignal`, ids URL-encoded.
- `hooks/useResource.ts` (new). `hooks/AdminData.tsx`: fetches all feedback instead of `limit: 5` (plan-A section 7). Two admin components tolerate a missing date/id.

**UI**
- `app/projects/[projectId]/prompts/page.tsx`, `components/prompts/{SlotTable,PromptsViews}.tsx`.
- `app/projects/[projectId]/audit/page.tsx`, `components/audit/{ParametersAudit,LineageView,FeedbackTab}.tsx`.
- `components/ui/SectionTabs.tsx`: tabs in `?tab=`. The Workspace's "Runs" button now opens `audit?tab=runs`.
- `CLAUDE.md` section 5: routes sentence, status-change switch, new Prompts and Audit section.

## Decisions
- **Tabs in the URL (`?tab=`)** so the Workspace's Runs button lands on Runs; only the active panel is mounted.
- **Prompts as three tabs, not three stacked tables**: with `already_pinned` the resolution repeats the pins, so stacking would show the same rows twice. The resolution tab says so in a banner.
- **Editing stays off** as a constant like the other switches, not an env var, and nothing is built behind it (no write forms), so the "No authentication" note is the whole of it.
- **Lineage in the table, inline on expand** (full width, below its row) with a value trail above it (`#1 Run 1: x -> #2 Run 2: y (current)`) and a "Changed from ..." column, so values across runs compare at a glance. The B21 note appears whenever a parameter has more than one run.
- **Flags are grouped under the candidate they were raised on**, not interleaved by time; each shows its own timestamp. The chain is read from `resolvedByCandidateId` and stated as facts ("Resolved by candidate #2", "Resolved the flag on #1"), not as an inferred parent.
- **"Auto" label as instructed, with the caveat in a tooltip** (see Gaps).
- Feedback entries are keyed by position, show a short user id and the document name when the project is loaded, and no date.
- Parameter keys, not aliases, in the Audit table: the summary route returns only the canonical key.

## Gaps found (backend, proposed, not added to AM8 without the owner)
- **B23 (proposed): flag type does not say who raised a flag.** `flag_type` is `AI_CORRETION` for every flag the backend writes (insert in `ai_parameters.py` and the column default); `HUMAN_REVIEW` is never written. A flag raised by a person in the Workspace (the real run's first flag) therefore shows as "Auto". The lineage also returns no flagger and no `parent_flag_id`, and only the newest flag per candidate (the summary said 3 flags for `I_MAX_CHA_PULSE`, the lineage shows 2).
- **B24 (proposed): `GET /audit/feedback-list` returns no total, no `id` and no dates** (`get_feedbacks_db` selects only `user_id, project_id, document_id, feedback_type, title, description, status, metadata`), and caps a page at 1000. The frontend reads every page for the total and shows no date. `GET /audit/feedback/{project_id}` (the plan's route) is a stub that returns `null`; the list route with `project_id` is used instead.
- The lineage response has no run number, source or expected unit; run numbers come from `/extraction-runs`.
- Pins say `GLOBAL`, the resolution says `global`; normalised in the UI. No project in the dev database has a lazy pin, so the "Pinned during a correction" chip is covered by logic only, not seen on screen.
- Not exercised: a parameter whose lineage returns `null` (alert text only), more than 1000 feedback rows (paging covered by unit tests).

## Verification
`npm run lint` **0 errors** (12 warnings, none new), `npm test` **208/208** (17 files; 17 new), `npm run build` exit 0, `npm run check:contrast` 90/90, `tsc --noEmit` clean apart from the pre-existing `reducer.test.ts` errors.

**Browser (headless Chrome via `playwright-core`, local backend, console read on every run).** Projects `Step8-Workspace` (read only) and the throwaway `Step11-Parameters`.
- *Prompts:* 14 pinned slots (8 agents, 6 category) with version, model, effort, temperature, scope; the supervisor's prompt expands; the resolution tab shows the "already pinned" banner and `Global` scope; the registry lists the slots and expands to the version history. The "No authentication" note is visible.
- *Audit:* 27 parameters with totals; `I_MAX_CHA_PULSE` expands to two candidates (Run 1, Run 2): the B21 note, the value trail, "Changed from ...", Auto + Resolved on #1 and Auto + Open on #2, "Resolved by candidate #2 (run 2)", the explanation row; "Only with flags" filters; `?tab=runs` opens Runs; Flags shows the placeholder; the Workspace's Runs button lands on `audit?tab=runs`.
- *Feedback:* 3 test entries (see below) show "3 entries", `new: 3`, `bug: 2`, `idea: 1`.
- *Keyboard:* focus an expand button, Enter opens it.
- *Console:* clean in every run.
- **No extraction was run: no token spend, no uploads.**

**Test data changed:** three feedback rows ("Step 13 test feedback 1-3") were added to `Step11-Parameters` by `POST /feedback/submit` (no delete route, B12). Nothing else was written; `Step8-Workspace` untouched. The disk filled up during the session (not traced to a cause); the user freed space and the work continued.

## How it looks (AM18)
Screenshots in **light and dark at 1920x1080 and 1280x800**: Prompts (pinned with an open prompt, resolution, registry with versions), Audit (summary, an open lineage, Feedback).
- **Prompts:** heading, a bordered amber "No authentication" strip with a lock, three tabs, then tables under small uppercase group titles ("Agents (call a model)", "Category prompts"). Rows show the slot key in monospace, `v1`, model, effort, temperature (unset values read "model default", or "n/a" on category slots), a scope chip and the pinned time. An expanded row shows the prompt in a scrollable monospace well.
- **Audit:** six small stat tiles (parameters, extracted again, with flags, flags in total, edited, value from an AI candidate), the search and two switches, then the table (key in monospace, final value, review chips, counts, flags in red when above 0). An open lineage shows a blue info strip, the value trail as chips with arrows (current one filled teal), then a table whose current row has a teal tint and a green "Current value" chip; changes are amber text; flags are an Auto chip plus a red Open or green Resolved chip with the reason in quotes.
- **Dark mode:** same structure; table headers are near-black bands as elsewhere; chips keep the lighter dark-mode status shades.
- **Fixed during the step:** the feedback cards first had uneven top margins (grid inside a `Stack`); now a plain grid.
- **Worth the owner's eye:** at 1920 the stat tiles leave the right half of their row empty; the pinned table repeats "model default" twice per row for most agents; "Auto" on a human-raised flag (B23).

## Next
Owner decisions: whether B23 and B24 go into AM8. Then **step 14** per AM17 (Admin restyle, cleanup: delete `theme/colors.ts`, ESLint rule to error, `console.log`s, full sweep at 1280 and 1920 in both modes), followed by the single final review.
