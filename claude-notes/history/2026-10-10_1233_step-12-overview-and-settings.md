# Step 12: Overview and Settings (plus the step 11 owner decisions)

## Goal
Apply the owner's step 11 decisions (add B17-B21 to AM8, keep "Save this project as template" disabled, hide "Remove parameter" behind a switch with a note), then build step 12 per plan-A 6.2 and 6.8 with multi-column grids that fill wide screens (AM14): the Overview (status, separate review progress, documents, last run, job state, status change) and Settings (appearance, review preferences, members, project details). No shortcuts (AM19); explicit button types in forms.

## Changes
**Step 11 follow-ups (own commit, `735b737`)**
- `claude-notes/plans/plan-A-amendments.md`: B17-B21 added to AM8 (B21 as worded by the owner).
- `lib/parameters/meta.ts`: `REMOVE_PARAMETER_AVAILABLE = false` and `REMOVE_PARAMETER_UNAVAILABLE` (the on-screen text).
- `components/parameters/ProjectParameters.tsx`: the Remove button is not rendered while the switch is off; a neutral note under the toolbar says why. The confirmation and `removeParameter` stay in the code. "Save this project as template" was already disabled behind `SAVE_AS_TEMPLATE_AVAILABLE`; unchanged.

**Pure logic (unit-tested, 12 new tests)**
- `lib/overview/progress.ts`: `reviewProgress` (flagged > empty > accepted > pending, one bucket per parameter, out-of-bounds counted on the side), `acceptedPercent`.
- `lib/overview/status.ts`: `PROJECT_STATUSES`, `isProjectStatus`, `statusFormBody` (the form body), `RUN_TYPE_LABEL` (moved out of `RunsTab`).
- `lib/review/preferences.ts`: `COMPACT_KEY`, `REVIEW_FIRST_KEY`, now shared by the Workspace and Settings (same values as before, so saved choices survive).
- Tests: `lib/overview/overview.test.ts`, `lib/overview/changeStatus.test.ts` (stubbed `fetch`).

**Data layer**
- `api/projects.ts`: `apiAddAuditor`, `apiUpdateProjectStatus` (form-encoded), `UserNotFoundError` (404 on both member routes); `apiAddContributor` shares the helper.
- `lib/project-data/actions.ts`: `addAuditor`, `changeProjectStatus` (reads the project back, see Decisions), `StatusNotAppliedError`.
- `lib/project-data/projects-index.ts`: `updateStatus`.
- `hooks/useExtractionRuns.ts` (new).
- `components/jobs/JobBanner.tsx`: optional `padded` prop (default unchanged) so the Overview can embed it in a card.
- `components/workspace/RunsTab.tsx`: uses the shared `RUN_TYPE_LABEL`.
- `app/projects/[projectId]/workspace/page.tsx`: imports the two preference keys from `lib/review/preferences.ts`.

**UI**
- `app/projects/[projectId]/overview/page.tsx`, `settings/page.tsx` replace the placeholders.
- `components/overview/`: `Card` (+ `Fact`), `ReviewProgressCard`, `StatusCard`, `ActivityCards` (`DocumentsCard`, `LastRunCard`, `JobStateCard`).
- `components/settings/`: `AppearanceCard`, `ReviewPreferencesCard`, `MembersCard`, `ProjectDetailsCard`.
- `CLAUDE.md` §5: routes sentence, Parameters paragraph (Remove hidden), new "Overview and Settings" section.

## Decisions
- **The status change reads the status back before saying it worked.** `POST /projects/update-project-status` answers `200 {"message":"Project status updated successfully"}` but its route body (`BDA/src/api_routes/projects.py`) never calls `update_project_status`, so nothing is written (found in the browser check: the request was correct and the project stayed `NEW`). Trusting the 200 would show a success that did not happen. `changeProjectStatus` reloads the project and throws `StatusNotAppliedError` when the status differs; the card shows it inline, the project list is only updated with a status the backend reports, and there is no success toast. **Not worked around**; proposed **B22** below. The button stays usable, so the day the backend is fixed it simply works.
- **Review progress is its own card, apart from the status** (B10: Approve leaves the status at `NEW`). Four buckets that add up to the total, in the order flagged, empty, accepted, pending. The card's text and each legend entry carry an icon and a word, so colour is not the only signal; out-of-bounds (auto-flag) is a warning line, not a bucket, as in the Approve gate.
- **Status change lives on the Overview only** (the brief); Settings shows the status read-only and points there. plan-A 6.8 also listed it in Settings; one place avoids two forms for one action.
- **Review preferences reuse the Workspace's localStorage keys**, so Settings is the main control and the Workspace toolbar toggles stay in step (checked both ways). The confidence threshold display from plan-A 6.8 is not shown beyond the sentence "fixed for now": the brief listed density and "needs review first" only.
- **Appearance** reuses `useThemePreference` (applied at once, saved to `user_settings.theme`), so the header toggle and Settings can never disagree.
- **Template used** is resolved through `getUserTemplates` (the project carries only the id). If the template is not in the user's list the card says so with a short id, rather than guessing.
- **Grids:** `repeat(auto-fit, minmax(min(100%, 340-380px), 1fr))` with stretching rows; the Overview's progress card spans two columns from `lg`. Content is capped at 1800 px, not narrower (AM14 allows capping reading screens).
- **Refresh of the last run:** refetched whenever a completed job of the project appears, so the card shows the run that just finished without a reload.

## Gaps found
- **B22 (proposed, not added to AM8 without the owner): `POST /projects/update-project-status` is a no-op.** The route returns 200 and never writes (`update_project_status` in `src/db/projects.py` exists and is correct, but is not called). Also takes any string for `new_status`; the UI only offers the four enum values.
- **B8 confirmed:** members cannot be listed; the Settings list is a labelled placeholder.
- A repeated "add contributor" for the same user returned success (no duplicate error), so the UI cannot tell "already a member" from "added".
- `useThemePreference` writes the theme through `updateUserSettings`, which sends the whole cached user object to `PUT /auth/update-user-settings` (pre-existing; the schema only takes `user_id`, `template_id`, `theme`, `lang`). Harmless today, left alone.
- Not exercised in the browser: the Overview job card **with** a running, queued or failed job (it needs an extraction, which costs tokens; it embeds the same `JobBanner` the Workspace uses), and the `unseenCompleted` state.

## Verification
`npm run lint` **0 errors** (12 warnings, none from step 12), `npm test` **191/191** (15 files; 12 new here), `npm run build` exit 0, `npm run check:contrast` 90/90, `tsc --noEmit` clean apart from the pre-existing `lib/jobs/reducer.test.ts` errors.

**Browser (headless Chrome via `playwright-core`, local backend, console read on every run).** Projects: `Step8-Workspace` (has data) for the screenshots, and the throwaway `Step11-Parameters` (no documents, no runs) for everything that writes.
- *Overview, empty project:* "No documents yet", "No extraction has run for this project yet" with an action, idle job card, progress "0 accepted ... 26 empty, of 26 parameters". *With data:* 11 accepted, 0 pending, 1 flagged, 15 empty, last run shown.
- *Status:* Update status disabled until a different status is picked; picking sends nothing; submitting sent `POST /projects/update-project-status` as `application/x-www-form-urlencoded` with `project_id` and `new_status`; the backend status stayed `NEW` and the card said so (B22), with no success toast and the header chip unchanged; Reset cleared the pick and the error. Reproduced with `curl`: 200, status unchanged.
- *Appearance:* Dark applied at once and `user_settings.theme` became `dark` on the backend; System and Light likewise; Light survived a reload; the pressed state follows. Left at System.
- *Review preferences:* switch and density write `bda.workspace.reviewFirst` / `bda.workspace.compact`; the Workspace then showed Compact selected; both put back.
- *Members:* Add is disabled while the field is empty; Enter submits the form; an unknown username shows "User not found" inline (contributor and auditor) and the message clears on typing; a known user was added ("added as contributor", field cleared).
- *Parameters (follow-up):* 0 Remove buttons, 26 Edit buttons, the note is visible, "Save this project as template" disabled.
- *Keyboard:* from the colour-mode group Tab goes Dark, System, the two density buttons, the switch, then the member fields; disabled buttons are skipped.
- *Console:* clean in every run except two `Failed to load resource ... 404` lines, which are the browser logging my two deliberate unknown-user requests.
- **No extraction was run for step 12: no token spend, no uploads.**

**Test data changed:** `Step11-Parameters` gained the test user `step8-workspace-test` as a contributor (no way to remove it, no route lists or deletes members, B8/B12); the test user's `user_settings.theme` went from null to `system`. Status of every project unchanged (the route does nothing). `Step8-Workspace` not modified.

## How it looks (AM18)
Screenshots in **light and dark at 1920x1080 and 1280x800** (plus 1440x900 for the error and empty states), Overview and Settings.
- **Overview:** the project name as a large heading with its status chip, a grey description line and the created date; "Open Workspace" (teal, with an arrow) and "Parameters" (outlined) at the right. Below, cards on the panel surface with a thin border and small uppercase titles with an icon. At 1920 the first row is Review progress (two columns wide), Project status and Documents; the second row Last extraction run and Background work. At 1280 two columns: Review progress on its own row, then pairs. The progress card has a big "40%", a segmented bar (green, red, grey; pending would be blue) and a legend of four icon-and-word counters. The status card holds the chip, a "Change status" select, "Update status" (greyed until a change) and Reset, and a grey sentence saying approving does not change the status.
- **Settings:** a heading, then four cards that fill the row at 1920 (Appearance, Review preferences, Project details, Members) and form a 2x2 at 1280. Appearance is a three-button segmented control with icons (Light, Dark, System). Members has two labelled inputs with their own buttons and a blue-outlined note "Member list unavailable (backend B8)".
- **Error and empty states:** the status error is red text under the select (the select outline turns red); the empty project shows "0%" with a full grey bar, "No documents yet" and an "Open Workspace to analyze" button.
- **Dark mode:** same structure; the legend colours switch to the lighter dark-mode status shades and stay readable; the "New" status chip is a soft grey pill.
- **Fixed during the step:** rows first sat ragged (`alignItems: start`) and Settings left a hole at 1280 where Members spanned two columns; now rows stretch and Members is a normal card with the two forms stacked. The member fields were first labelled "Add contributor" next to a button of the same name; they are now "Contributor username" / "Auditor username".
- **Worth the owner's eye:** at 1920 the second Overview row is half empty (two cards), and the progress card is quite tall for four numbers; the Next.js dev indicator overlaps the rail's bottom corner in development only.

## Next
Owner review of step 12, including whether B22 goes into AM8 (and the status change then stays as a visible failure until the backend is fixed). Then **step 13** per AM17: Prompts (read-only) and Audit, including the Runs tab.
