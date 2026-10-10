# Step 14: Admin restyle, cleanup, security, full sweep

## Goal
Pre-work (own commit `7a59c87`): B23 and B24 into AM8 and honest flag labels in the Audit lineage. Then step 14 per plan-A 9 and AM17: Admin on tokens, delete `theme/colors.ts`, security upgrade, polish from steps 12-13, a sweep of every screen in both modes at 1280 and 1920, final CLAUDE.md sections 5 and 6.

## Changes
**Pre-work (`7a59c87`)**
- `claude-notes/plans/plan-A-amendments.md`: B23 (flag type does not say who raised a flag; lineage has no flagger, no parent, only the newest flag per candidate) and B24 (feedback list has no id, dates or total, caps at 1000; `/audit/feedback/{project_id}` is a stub).
- `lib/audit/lineage.ts`: `flagTypeLabel` removed; `REVIEWER_FLAG_LABEL`, `CARRIED_OVER_LABEL`, `isCarriedOver` (a candidate's flag repeats the reason of the flag it resolved); `LineageRow.flagCarriedOver`. `components/audit/LineageView.tsx`: every stored flag is "Reviewer flag", with ", carried over after re-extraction" when detected; tooltip explains B23. Out-of-bounds stays from `rule_violations` (untouched). `lib/audit/audit.test.ts` updated (+2 tests).

**Step 14**
- Admin: `app/admin/page.tsx` (header reads "Admin · no authentication", lock chip), `GlobalOverview.tsx` (tokens; Recharts reads `theme.vars.palette.*`; tiles on status tokens; `initialDimension` so Recharts stops warning), `FeedbackArea.tsx`, `FeedbackItem.tsx`, `ProjectSummary.tsx` (parameter rows and a button link to `/projects/[id]/audit`; the lineage drill-down is gone), `components/ProjectsSideBar/{BaseSideBar,AdminSideBar}.tsx` (tokens; an Audit link beside every project row, outside the row's button).
- Deleted: `theme/colors.ts`, `app/admin/components/ParameterLineage.tsx`, `hooks/useParameterLineage.tsx` (held the last `console.log`), `components/FeedbackModal.tsx`, `components/shell/ScreenPlaceholder.tsx` (all unreferenced; found by an import scan).
- `eslint.config.mjs`: `no-restricted-imports` on `@/theme/colors` is an **error** (kept as a guard).
- `lib/jobs/reducer.test.ts`: `reduce<JobsState>`, which fixes the pre-existing `tsc` errors. `tsc --noEmit` is now clean.
- `package.json`/lock: `mui@0.0.1` removed; `next` and `eslint-config-next` 16.0.10 -> 16.4.0 (exact pins); `npm audit fix` (no force).
- Rule fixes the new `eslint-config-next` turned into errors: `contexts/AuthContext.tsx` (`logout` declared before use, `useCallback`, effect dependency fixed, which also cleared a warning), `components/ui/Toast.tsx` (`Date.now()` no longer called in render).
- Polish: `ParametersAudit.tsx` (stat tiles are an auto-fit grid and fill the row), `SlotTable.tsx` ("model default" repeated per cell becomes a dash with a tooltip and one footnote), Overview (last run and background work form a full-width row split in two, so 1920 has no half-empty row).
- `CLAUDE.md`: routes, new Admin section, colour bullet, Audit flag wording, Local DB, project ids, feature switches, dependencies and security, section 6 rewritten as the backend-item table.

## Decisions
- **"Carried over" is a heuristic from the data**: same non-empty reason as the flag the candidate resolved. The route carries no parent flag (B23), so this can mislabel two independent flags with identical reasons; the wording is a fact about the data, not a claim.
- **Admin drill-down replaced, not restyled.** The admin's own lineage view duplicated the Audit screen, so rows link to it instead of keeping two lineage UIs.
- **`next` to 16.4.0, not "latest 16.0.x patch"**: the 16 line had moved to 16.4.0 (released 2026-10-06, four days old); it is the same major and is what `npm audit` names as the fix for the critical advisory.
- Kept the `no-restricted-imports` rule although the file is gone, as a guard.
- The unused-file scan was by import name, so it can miss a file imported only dynamically by string; none seen.

## Security audit
| | Before | After `next` 16.4.0 and `npm audit fix` |
|---|---|---|
| Total | 23 (1 low, 6 moderate, 13 high, 3 critical) | 8 (0 low, 1 moderate, 5 high, 2 critical) |
| Fixed | `next` (critical), `postcss` and `sharp` (via next), `uuid`, `yaml`, `brace-expansion`, `browserslist`, `flatted`, `js-yaml`, `minimatch`, `picomatch`, `@babel/core`, `@humanfs/node`, `ajv`, `baseline-browser-mapping` | |
| **Left, would need a major upgrade (not done)** | | `vitest` 3.x -> 4.1.11 (clears `tinypool` critical RCE-gadget, `vitest` critical, `@vitest/mocker` moderate); `eslint-config-next` chain (`@next/eslint-plugin-next`, `fast-glob`, `micromatch`, `braces`, `eslint-config-next` itself): npm's only suggested fix is **14.2.35, a downgrade**, so there is no forward fix yet |
All remaining findings are dev tooling (tests and lint); none is in the browser bundle. Raw output kept in the session scratchpad only.

## Gaps found
- `next dev` 16.4 writes an untracked `AGENTS.md` at the repo root. Not ours; **not committed**. Decide whether to commit it or gitignore it.
- Admin's project list shows one project (it lists what `/audit/projects` returns, which is only projects with AI data).
- The projects list's first-visit guided tour (popover) overlaps one project card at 1280 until dismissed. By design, but worth a look.
- Not exercised in the browser: Admin with the Feedback view and with a project selected (restyled by token swap only; project selection reuses `useProjectSummary`); Admin at the User/date filters.

## Verification
`npm run lint` **0 errors, 0 warnings**, `npm test` **210/210** (17 files), `npm run build` exit 0, `npm run check:contrast` 90/90, `npx tsc --noEmit` **clean**.

**Sweep (headless Chrome via `playwright-core`, local backend, console read on every page).** Light and dark at 1280x800 and 1920x1080, project `Step8-Workspace` (PDF) and `Step9b-Excel-BHV` (workbook): login, register, projects, overview, workspace (PDF and Excel), parameters, prompts, audit, settings, admin, 44 + 16 screenshots. Result: **no console error or warning on any page, no horizontal page overflow**. The first pass found one real problem: Recharts' "width(-1) and height(-1)" warning on every admin load; fixed with `initialDimension` and re-run clean. No extraction was run, nothing uploaded: **no token spend**. `test-data/` untouched, no customer values quoted.

## How it looks (AM18)
Light and dark, 1280x800 and 1920x1080; screenshots viewed: admin (light 1280, dark 1920), audit (light 1920), prompts (dark 1920), overview (light 1920, after the fix), workspace PDF (dark 1920), workspace Excel (dark 1920), parameters (light 1280), projects (dark 1280), register (light 1920), settings (light 1920). The rest were produced and checked by the overflow and console probes.
- **Admin:** header reads "Admin · no authentication" with an amber lock chip and the Projects/Feedback toggle. Left, a project list with a small audit icon per row; right, "Global Overview" with two bordered charts (teal line, blue and amber bars in dark; the same roles in light) and three tinted tiles (blue, green, amber), tinted dark in dark mode. No more pastel cards or a black list in light mode.
- **Audit at 1920:** the six stat tiles now share the whole row.
- **Prompts at 1920:** unset effort and temperature show a dash; one grey footnote under the table explains it.
- **Overview at 1920:** row one Review progress (wide), Status, Documents; row two Last extraction run and Background work, each half the width.
- **Workspace (PDF and Excel):** unchanged from step 9b/10: black category bands in dark, document surface stays light, Excel with formula bar, grid and sheet tabs.
- **Dark mode:** same structure everywhere; status colours use the lighter dark shades.

## Next
Single final review by the owner. Open owner decisions: the `AGENTS.md` file, whether to take vitest 4 (clears the critical dev-tool advisories, a major bump) and a later `eslint-config-next` release.
