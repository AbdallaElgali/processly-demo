# Final review of Task A

## Goal
Final review on Opus of Task A as a whole, with a detailed review of steps 11-14 (built on Sonnet, not yet reviewed): the diff against plan-A, the amendments and CLAUDE.md sections 0, 7 and 8; Task A against fe_rfc.md; all automated checks; a browser sweep of every screen in both modes at 1280 and 1920. Fix must-fix items that are small and local. No new features, no extraction runs.

## Changes
- `.gitignore`: `/AGENTS.md` (owner decision; written by `next dev` 16.4). Commit `a222263`. `CLAUDE.md` section 5 now says it is gitignored.
- `app/admin/components/ProjectSummary.tsx`: final values go through `formatDisplayValue` (AM10). Commit `53deffd`.
- `lib/audit/lineage.ts`: `emptyValueLabel` (the reason code's label for an empty candidate, else "no value"). `components/audit/LineageView.tsx` uses it for the value, the value trail and "Changed from". `lib/audit/audit.test.ts`: +2 tests. Commit `53deffd`.

## Findings

Read: CLAUDE.md, fe_rfc.md, plan-A.md, plan-A-amendments.md, the history notes from pre-step 11 to step 14, and the full diff `dc4dafc..cb920ff` (80 files). Checked against the rules: forms, raw colours, the colour shim, shortcuts, `console.*`, `reset-database`, max-width on working screens, every new or changed API wrapper and type against `openapi.json`, switch usage at every caller, End of Life labels, D11 and unsaved-edit handling in the new store actions, and the B15/B16 paths.

### Must-fix (both fixed)
| # | Finding | Fix |
|---|---|---|
| M1 | **Admin's project view showed `final_value` raw**, so B11's long floats reached the screen; AM10 says rounding applies anywhere a number is shown. Step 14 restyled this file but kept the raw value. | `formatDisplayValue`, tabular numerals; the "Unassigned" colour test no longer treats a value as missing by truthiness. |
| M2 | **The Audit lineage showed "no value" for an empty candidate**; its reason code was only inside the collapsed explanation. CLAUDE.md section 7: a parameter with no value shows its reason code. | `emptyValueLabel` (AM6 prefix match through `matchReasonCode`), unit-tested; verified in the browser on an End of Life parameter in both modes ("Not searched: no frame"). |

### Should-fix (not fixed: outside "small and local must-fix"; each is small)
| # | Finding | Where | Suggested fix |
|---|---|---|---|
| S1 | **The stored theme is never applied at sign-in.** plan-A 1.1: "on login applies `user.theme`". The app writes `user_settings.theme` but never reads it, so the persistence is write-only: a choice made in another browser never arrives. A step 1 gap, not recorded anywhere as deferred. | `contexts/AuthContext.tsx` `login` | After a successful login, `setMode(data.theme)` when it is light/dark/system. Only at login, not on every session check, so a local choice is not overridden on reload. |
| S2 | **`updateUserSettings` sends the whole cached user object** (`{user_id, ...user, ...settings}`: id, username, department, dates) to `PUT /auth/update-user-settings`, whose schema is `user_id, template_id, theme, lang`. FastAPI ignores the extras today, but every call rewrites all four columns from the cached copy, so a theme change and "Set as default" in quick succession can overwrite each other. Noted in step 12, left alone. | same file | Send exactly the four schema fields. |
| S3 | **Admin hides load failures.** `useAdminData` returns `error` ("Make sure your UI checks this!"), and nothing reads it: if `/audit/projects` fails, the sidebar says there are no projects. A failed feedback load only goes to `console.error`. CLAUDE.md 8.4 asks for an error state with a next action. | `app/admin/page.tsx`, `hooks/AdminData.tsx` | `ErrorState` with Retry. |
| S4 | **Admin project view:** a spinner instead of skeleton rows, an error line with no Retry (8.4); the review filter offers Accepted/Modified/Rejected but not **Pending**, the column default (B6) and the most common state, so pending rows cannot be filtered; labels "AI Won", "Extraction Stats", "cands" use different wording from the rest of the app. | `app/admin/components/ProjectSummary.tsx` | `SkeletonRows`, `ErrorState`, add Pending, align the wording with the Audit screen ("From AI", "Candidates"). |
| S5 | **Accepted counts differ between screens after a post-approval save.** Accept and Save write `PENDING` (B15), so the Overview's progress counts that row as pending while the Workspace shows it accepted for the session. Correct for the data; nothing on the Overview says why. | Overview `ReviewProgressCard` | One line under the bar naming B15, or nothing until B15 is fixed. Owner's call. |

### Nits
- N1 `api/feedback.ts` (`POST /feedback/submit`) has no caller since step 14 deleted `FeedbackModal`. Dead code.
- N2 `FeedbackItem` (`api/audit/feedback.ts`) keeps `id`, `created_at`, `updated_at` as optional fields although the backend never returns them (B24). Not used to render anything wrong; drop them, or keep them for when B24 lands.
- N3 Templates panel states B17 twice (the chip in the header and a caption under the list).
- N4 Prompts centres its 1800 px column (`mx: 'auto'`); Overview and Settings align left. Only visible on viewports wider than about 2040 px.
- N5 `next build` warns that Turbopack inferred the workspace root from `/Users/apple/package-lock.json` (a lockfile outside the repo). Set `turbopack.root` in `next.config.ts` or remove the stray lockfile.
- N6 `InputProps` (deprecated in MUI v7 in favour of `slotProps.input`) in `AdminSideBar` and `ProjectSummary`. No console warning today.
- N7 In dev, the network log shows `ERR_ABORTED` for every `useResource` fetch: React StrictMode mounts twice and the first request is aborted by design. Not in the console; every screen loaded its data (checked in screenshots).
- N8 `npm audit`: the 8 remaining findings are dev tooling (vitest 3, the `eslint-config-next` chain). Taking vitest 4 is still an open owner decision.

### Checked and in order (steps 11-14)
- **Forms:** every `<form>` (login, register, members, status, `FormDialog` and its four users) has explicit button types; `FormDialog` documents why.
- **Colours:** no hex or `rgb()` in `app/` or `components/` outside the document viewers; `theme/colors.ts` gone and its import an ESLint error.
- **No shortcuts (AM19):** the key handlers are arrow keys/Home/End in lists, tables and the grid, Enter/Space on rows, Escape in overlays and inputs. Nothing else.
- **No `console.log`/`debug`/`info`**; `reset-database` appears nowhere in code.
- **API contract:** every path the frontend calls exists in `openapi.json`; `api/prompts.ts` types match their six schemas field for field; `TemplateRuleUpsert`, `ProjectParameterUpdateInput` and the form-encoded status body match. No invented fields apart from N2.
- **Feature switches:** `SAVE_AS_TEMPLATE_AVAILABLE`, `REMOVE_PARAMETER_AVAILABLE`, `STATUS_CHANGE_AVAILABLE`, `PROMPT_EDITING_AVAILABLE` are all `false` and honoured at every caller (the only callers of `saveProjectAsTemplate`, `removeParameter` and `changeProjectStatus` sit behind them); each control has its reason on screen. "Add parameter" (B1) is a hard-disabled button with a chip, **not** a switch constant.
- **Full width (AM14):** Parameters and Audit are full-bleed; Overview, Settings and Prompts cap at 1800 px with auto-fit grids.
- **Pure logic is tested:** `lib/parameters`, `lib/templates`, `lib/overview` (progress and the status read-back), `lib/audit`, `lib/prompts`, `lib/jobs/label`, `lib/errors` (in `parameters.test.ts`).
- **AuthContext's 302-line diff in step 14** is whitespace apart from moving `logout` into a `useCallback` declared before the effect that uses it (`router` is stable, so the effect still runs once).

### Task A against fe_rfc.md
- **D11 per project:** every action added in steps 11-14 takes a `projectId` and writes through `projectDataStore`; regression tests "project A's results / flag chain do not touch project B" pass.
- **Job cap and queue across tabs:** unchanged since 2b; the scheduler tests cover three running in another tab, four across two tabs, start in the queuing tab, adoption of a closed tab's job, correction priority across tabs, lock-based interruption. Not re-run live (it needs real jobs).
- **Unsaved edits:** `mergeLocalEdits` keeps edits through a refresh, live results skip dirty rows, removal drops that row's edit, the guard catches reload and in-app links (not Back/Forward, documented). The Parameters screen marks rows with an unsaved value edit.
- **Review actions and workarounds:** Accept = resolve the open flag (B16: `select-correct-ai-candidate`, then unflag without `resolved_by`), save that row, session mark (B15); Approve is blocked by an open human flag or a running/queued extraction or correction, and only warns about auto-flags; flagging a never-extracted row is refused (B9). Consistent across Workspace, Overview (S5 aside) and Audit.
- **End of Life:** one label map (`lib/categories.ts`, "End of life") used by the Workspace and Parameters; an empty category still renders; empty End of Life rows now show their reason code in the lineage too (M2).
- **Light mode:** every screen walked in light and dark; the scheme attribute matched the requested mode on all 76 loads.
- **Planned and missing:** stored theme at login (S1). Superseded by amendments, so not missing: keyboard-first review (AM19), Auto/Human flag labels (B23), the separate Extract/Review screens (AM11).

## Deferred to Task B
**Backend items (AM8), what Task A does meanwhile, and what to change in the frontend when each lands:**

| Item | Task A today | Frontend change when fixed |
|---|---|---|
| B1 add parameter fails | Disabled button + chip, disabled Add in "Not in this project" | Wire the Add buttons (no switch exists; code change) |
| B2, B4 no customer alias / `category` on the project | Joined from `/customers/` and the dictionary (D5, D6) | Read the fields directly; drop the joins |
| B3, B5 auto-flags not stored; no reason-code field | `rule_violations`; prefix match (AM6) | Read the stored flag and the explicit code |
| B7 404 for every missing file | 404 and 410 both "Source unavailable" | Distinguish the structured 410 |
| B8 no member list, no project flag list | Placeholders in Settings and Audit Flags | Build both lists |
| B9 never-extracted rows cannot be flagged | `FlagNotSupportedError` | Allow the flag |
| B10, B22 approve/status do not change the status | Progress separate; **`STATUS_CHANGE_AVAILABLE = false`** | Flip the switch (the read-back stays) |
| B11 long floats | Display rounding (AM10) | Nothing required |
| B12 no delete for projects/users | Test data accumulates | Optional admin delete |
| B13, B14 reasoning is narration; Excel sources name a table | Labelled; table outlined, matches stepped | Show the stage; highlight the cell |
| B15 no per-parameter accept; save writes PENDING | Accept is a session mark | Persist Accept; drop the session mark (and S5) |
| B16 unflag with `resolved_by` fails | Two calls in `resolveHumanFlag` | One call; `resolved_at_run_id` comes back |
| B17 save-as-template fails | **`SAVE_AS_TEMPLATE_AVAILABLE = false`** | Flip the switch |
| B18 parameter removal is a hard delete | **`REMOVE_PARAMETER_AVAILABLE = false`** | Flip the switch once it soft-deletes |
| B19 texts cannot be nulled | Empty sent as `''` | Send `null` |
| B20 templates check no ownership | `templateAccess` in the UI | Keep the UI check; backend enforces |
| B21 payload keeps only the newest run's candidates | Earlier ones in the Audit lineage | Offer "back to the previous candidate" if kept |
| B23 flag type does not say who | Every stored flag is "Reviewer flag"; "carried over" heuristic | Show the real author and chain |
| B24 feedback list incomplete, one route a stub | All pages read; no date | Show dates, use the total |
| A2 no authentication | Admin and Prompts say so; **`PROMPT_EDITING_AVAILABLE = false`** | Build the prompt write forms, then flip |

**From the RFC (section 5) and plan-A 3.8:** `run_id` in the first SSE event plus a run-status route, so `JobBackend.resume` can re-attach a refreshed run instead of marking it Interrupted; generated TypeScript types from `openapi.json` to replace the hand-written `api/types/*` (D10); Pydantic models for SSE events.

## Verification
- `npm run lint` 0 errors, 0 warnings. `npx tsc --noEmit` clean. `npm run check:contrast` 90/90. `npm test` **212/212** (17 files; +2 for M2). `npm run build` exit 0 (with the N5 warning). Run before the fixes (210/210) and again after.
- Disk checked first: 14 GiB free (94% used); nothing large written; screenshots in the session scratchpad only.
- **Browser sweep** (headless Chrome via `playwright-core`, the running dev server, local backend): light and dark × 1280×800 and 1920×1080 × 19 views = 76 loads: login, register, projects, Overview (with data and empty), Workspace (PDF and Excel), Parameters, Prompts (three tabs), Audit (four tabs, with one flagged parameter's lineage open), Settings, Admin (overview, a project selected, Feedback). **No console error or warning, no page error, no horizontal overflow, colour scheme as requested on every load.** The only network-level failures were StrictMode's aborted first fetches (N7). A second targeted run opened an empty End of Life parameter's lineage in both modes after the fix: the reason code shows, console clean.
- Interactions were read-only: expanders, tabs, switches, admin project selection. **No extraction, no upload, no save, no token spend.** Projects used: `Step8-Workspace`, `Step9b-Excel-BHV`, `Step11-Parameters`. `test-data/` not opened; no document values are recorded here.

## How it looks (AM18)
Screenshots viewed: Audit light 1920 with an open lineage; Admin light 1280 with a project selected; Parameters dark 1280; Overview light 1920; Workspace Excel light 1280; Settings dark 1920; Prompts dark 1280; the lineage of an empty parameter in both modes. All match what the step notes describe. Admin now shows rounded values; its row wording and the spinner (S4) are the visible rough edges. Parameters at 1280 wraps "Add parameter" and its chip under the search field as intended, with the B17 message twice in the right pane (N3).

## Verdict
**Task A is complete and fit to hand over to Task B.** Steps 11-14 follow the plan, the amendments and CLAUDE.md sections 0, 7 and 8. The two must-fix rule violations found (M1, M2) are fixed and verified. Nothing found is "quietly broken": every broken backend route is a labelled placeholder or a switched-off control with its reason on screen. The open frontend items are S1-S5 (small; S1 and S2 touch auth/settings code and S3/S4 are Admin polish) and the nits; none blocks Task B.

## Next
Owner: decide which should-fix items to take before Task B (S1 and S2 are a few lines each in `AuthContext`), and whether to take vitest 4. Then Task B · Explore per fe_rfc.md section 6.
