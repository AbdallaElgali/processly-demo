# Step 5: shared component library and dev gallery

## Goal
plan-A §9 step 5: build the generic primitives from plan §2 into `components/ui/`, and the dev gallery at `app/dev/gallery` that demonstrates them in both colour modes, absorbing the existing `/dev/theme` token preview. Per AM5, the step-3 shell components (`AppHeader`, `ProjectRail`, `Breadcrumb`, `ThemeToggle`, `JobBadge`) are shown in the gallery, not rebuilt.

## Changes
**New — `components/ui/`**
- `SearchField.tsx` — debounced by the caller; `Esc` clears, global `/` focuses it.
- `StatusChip.tsx` — the four project lifecycle states, extracted from `app/projects/page.tsx`.
- `ProjectCard.tsx` — extracted from the same file; per-card subscription to `useProjectActivity` kept.
- `EmptyState.tsx` / `ErrorState.tsx` — icon, title, description, action(s); every empty state keeps a next action (§8.4).
- `Skeletons.tsx` — `SkeletonCardGrid`, `SkeletonRows`.
- `DataTable.tsx` — sortable header, skeleton/error/empty body; for the Runs/Pins/Templates/Members tables from step 7 on.
- `Toast.tsx` — `toast.show(...)` + `ToastHost`, one bottom-left queue, auto-hide 6s with hover-to-pause, callable from outside a component (e.g. a job runner), unlike the ad-hoc `Snackbar`s in `review/page.tsx` and `TemplatesManager`.
- `ConfirmDialog.tsx` / `FormDialog.tsx` — shared dialog shells with a loading submit button (MUI's `loading` prop, matching `NewProjectDialog`'s existing pattern).
- `DensityToggle.tsx` — comfortable/compact, controlled (the caller persists it).
- `GuidedTour.tsx` — anchored by CSS selector, so it has no coupling to the element it points at; "don't show again" via `useLocalStorageFlag`.

**New — `app/dev/gallery/page.tsx`.** Non-production only (`notFound()` in prod, same gate as the old page). Sections: Tokens (the old `/dev/theme` content, unchanged), Shell & navigation (live `AppHeader`/`ProjectRail`/`Breadcrumb`/`ThemeToggle`/`JobBadge`, plus a note on why `JobBanner`/`JobTray` are described rather than faked — see Decisions), Inputs & buttons, Feedback & empty states, Dialogs, DataTable. A `GuidedTour` runs on the gallery itself as a working example.

**Changed**
- `app/projects/page.tsx` — adopts `ProjectCard`, `StatusChip`, `SearchField`, `SkeletonCardGrid`, `EmptyState` in place of the inline versions step 3 wrote. No behaviour change; step 6 still owns lazy counts, filters and the guided tour.
- `CLAUDE.md` §5 — new "Shared component library" subsection; the routes table's `/dev/theme` row replaced with `/dev/gallery`.

**Deleted** — `app/dev/theme/page.tsx` (absorbed into the gallery's Tokens section).

## Decisions
- **`ProjectCard`/`StatusChip`/`SearchField` were extracted and wired into `app/projects/page.tsx` in this step, not left as gallery-only duplicates.** They already existed as inline code from step 3 with identical behaviour; keeping two copies (one in the library, one in the page) would have been exactly the kind of duplication CLAUDE.md asks to avoid, for a change that carries no risk — same markup, same props, same subscriptions.
- **`JobBanner` and `JobTray` are not exercised with fabricated states.** Both already exist (built in 2a-ii/step 3) and read live state from the real job store. Demonstrating their queued/running/interrupted/failed states would mean injecting fake `Job` records into production state from a dev page — the gallery instead shows every `JobBadge` kind (which has no side effects) and explains where the other two are visible for real. Recorded here rather than silently skipped.
- **`NewProjectDialog` was not rewired onto `FormDialog`.** It predates this step and works; adopting the shared shell now would touch a screen outside this step's scope for no behavioural gain. Left as a gap below for whichever step next touches that dialog.
- **`Skeletons.tsx` covers only the card-grid and generic-row shapes that already exist in the app.** Parameter-row and viewer-page skeletons (also listed under "Skeleton*" in plan §2) need layouts that don't exist yet; they belong with the components that define those layouts, in steps 8 and 9.
- **`DensityToggle` is controlled, with no built-in persistence.** Review (step 8) and any other screen that adopts it will have independent storage keys; baking in one `useLocalStorageFlag` call would hard-code a single key for every consumer.

## Gaps found
- **A `useSyncExternalStore` bug, caught by the gallery itself, not by lint/build/test.** `Toast.tsx`'s `getServerSnapshot` originally returned a fresh `[]` literal on every call — the exact bug step 3's history note already described for `ProjectDataStore.get()`. `npm run build` and `npm run lint` both passed with it in place; it only surfaced as a console error ("The result of getServerSnapshot should be cached to avoid an infinite loop") when the gallery was opened in Chrome. Fixed by hoisting one `const EMPTY: ToastItem[] = []`. Worth remembering: this class of bug is invisible to every automated check this project runs and only shows up in the browser.
- **`GuidedTour` originally set `anchorEl` state from inside a `useEffect`**, which `npm run lint` correctly flagged as `react-hooks/set-state-in-effect`. Rewritten to compute the anchor directly in render, gated by `useHasMounted()` (the same hydration-safe pattern `hooks/useHasMounted.ts` already documents) instead of mirroring a DOM query into state.
- **15 files still import the deprecated `theme/colors.ts` shim** (unchanged from step 4 — this step touched none of them). Lint warnings stayed at 37.
- **`Toast` is unused by any real screen yet.** `review/page.tsx` and `TemplatesManager` keep their own `Snackbar`s; adopting `ToastHost` is for whichever step next touches those files (9-11), not forced here.

## Verification
`npm run lint` **exit 0** (0 errors, 37 warnings — unchanged from step 4), `npm test` **60/60**, `npm run build` **exit 0** (15 routes, `/dev/gallery` replacing `/dev/theme`), `npm run check:contrast` **83/83**.

Checked in Chrome (`npm run dev`), both modes:
- **Gallery, dark then light.** Every token swatch, `AppHeader`/`ProjectRail`/`Breadcrumb` (live, reflecting the signed-in session), all five `JobBadge` kinds, buttons in every state including the native `loading` button, `SearchField`, `StatusChip` (all four), `DensityToggle`, all four `Toast` severities (stacked, auto-hid after 6s when left alone, action button dismisses on click), `EmptyState`/`ErrorState`/`Skeletons`, `ConfirmDialog` (destructive style, Cancel/Remove, busy state on confirm), `FormDialog` (autoFocus, submit disabled until valid, Enter-to-submit via the native form, busy state), `DataTable` (data/loading/error/empty toggles, column sort). Console clean after the `getServerSnapshot` fix.
- **`GuidedTour`**, run against two real elements on the gallery page itself (`data-tour="gallery-title"`, `data-tour="restart-tour"`): anchored correctly to each, Next/Back/Skip/Done all worked, "Restart tour" re-opened it after dismissal via `useLocalStorageFlag`.
- **`/projects` after the `ProjectCard`/`StatusChip`/`SearchField` swap**: identical rendering to before (11 cards, `D11-B`'s interrupted badge still showing from the step-2b/3 test runs), search filtered to `D11-A`/`D11-B` for "D11", `Esc` cleared it back to the full grid. Console clean.

**§8 checks.** §8.3: every new primitive verified in both modes with palette tokens only; `GuidedTour`'s `useHasMounted` gate avoids a hydration mismatch rather than fixing one after the fact. §8.4: hover/focus/pressed/disabled/loading on buttons and dialogs, `Esc` closes `SearchField`/dialogs/`GuidedTour`, `ConfirmDialog`/`FormDialog` keep MUI's focus trap and return-focus defaults, `DataTable` rows are keyboard-operable when clickable, skeletons stand in for every loading shape the library currently covers, every empty/error state carries a next action, motion stays under 200ms via `theme.transitions`. §8.1/§8.2 do not apply directly — no background work or category grouping introduced in this step, beyond the note above about `JobBanner`/`JobTray`.

**Token spend: 0 OpenAI operations.** No extraction or upload was run; the gallery and `/projects` checks used existing projects.

## Next
**Step 6** per plan §9: the Projects list, final — replace the (now-shared) `ProjectCard` usage with lazy per-project counts, status filters, the guided-tour first step (wiring real `data-tour` targets into this screen), and empty/error states wired to real fetch failures rather than the gallery's manual toggles.
