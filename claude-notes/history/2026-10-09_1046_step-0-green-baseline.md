# Step 0: green baseline (build + lint)

## Goal
Make `npm run build` and `npm run lint` pass before Task A execution starts, so CLAUDE.md §0.2's "build + lint must pass after every step" is a meaningful bar from step 1 on.

## Why this step exists
It is not in plan-A §9. The plan assumed a green starting point; `explore-A.md` §8 said plainly that it had run no build or lint, so nobody had measured it. The first command of this session found the repo **already red on `main`**:

- **Build failed:** `app/review/page.tsx:217` — `MemoizedInputFieldsList` requires `onUpdateMetadata`, the Review page never passed it. Nothing compiled.
- **Lint failed:** 16 errors (13 × `no-explicit-any`, 1 × `prefer-as-const`, 1 × `no-wrapper-object-types`, 1 × `react-hooks/set-state-in-effect`).

Asked the human how to treat the pre-existing failures; they chose **"fix everything now, as step 0"** over freezing a baseline. Done as its own commit so step 1's diff is only the theme work.

## Changes
- `app/review/page.tsx` — build fix: `onUpdateMetadata` made optional rather than passing a no-op (below); `hasMounted` now from `useHasMounted`.
- `components/input-fields-list.tsx`, `components/input-field-item.tsx` — `onUpdateMetadata` is now optional (`onUpdateMetadata?.(...)` at the call site). Review mode is read-only and every edit affordance in `InputFieldItem` is already gated behind `readOnly`, so no behaviour changes.
- `hooks/useHasMounted.ts` — **new.** `useSyncExternalStore(subscribe, () => true, () => false)`, the supported way to express "false on the server, true after hydration" without `setState` in an effect.
- `app/bda/page.tsx` — uses `useHasMounted`; `(file: any)` in the FeedbackModal document list replaced with the real `UploadedFile` element type. The dropped `file.filename || file.file_name || file.title` fallbacks were dead: `UploadedFile.name` is always populated by `useDocumentManager`.
- `types/index.ts` — `InputField` gains optional `parameter_alias`, `description_override`, `ai_instructions`. These are **not invented** (§0.4): they are columns on the backend `project_parameters` row, already declared on `ProjectParameter` in `api/projects.ts` and already populated by `dbParamToInputField`. Declaring them removes the `field as any` cast.
- `components/input-field-item.tsx` — reads those three fields directly instead of `const fAny = field as any`.
- `hooks/ParameterManager.tsx` — dropped the now-unneeded `as InputField` cast.
- `components/ProjectsSideBar/AdminSideBar.tsx` — `projects: any[]` → `ProjectMetrics[]`. See "Gaps found": this exposed a real bug.
- `components/TemplatesManager/index.tsx` — `existingRules: TemplateRule[]`, `initialData?: TemplateRule`, `handleParamChange(e: SelectChangeEvent<string>)`; imports `TemplateRule` and the event type.
- `contexts/ProjectContext.tsx` — `templates.find((t: any) => ...)` → inferred `ExtractionTemplateBase`.
- `components/FeedbackModal.tsx`, `components/SettingsModal.tsx`, `components/ProjectsSideBar/BDASideBar.tsx` (×2) — `catch (e: any)` → `catch (e: unknown)` with `e instanceof Error ? e.message : <fallback>`. Same user-visible message in every case.
- `components/NoProjectsScreen.tsx` — `'absolute' as 'absolute'` → `as const`; `(user as any).template_id` → `user?.template_id ?? null` (`User` already declares `template_id`, so the cast and the `'template_id' in user` guard were both redundant).
- `api/feedback.ts` — `Record<string, any>` → `Record<string, unknown>`.
- `api/user.ts` — `Promise<Boolean>` → `Promise<boolean>`.

Branch: `task-a/redesign` (cut from `main`; `main` is the default branch, so work does not land on it directly).

## Decisions
- **Optional prop over a no-op callback** for `onUpdateMetadata`. A no-op would have silently swallowed metadata edits if the Review screen ever became editable; an optional prop makes "this consumer cannot edit metadata" explicit in the type.
- **`useSyncExternalStore` over an eslint-disable** for the mount guard. The rule is pointing at a real cascading render, and the three-line hook is the documented fix. The hook survives into the new shell; `app/bda` and `app/review` are deleted in step 3.
- **Did not touch the 26 remaining lint *warnings*.** `npm run lint` exits 0. Most are dead code that named later steps delete anyway (`FIELD_LABEL_MAP` in step 8, `UnfoldLess` in 2a-ii, the unused `Divider`/`isLocked`/`flagReason` in step 8's rewrite). Clearing them now would mean editing files that are about to be rewritten.
- **Did not commit CLAUDE.md, FE_RFC.md, openapi.json, the two PNGs, or the earlier `claude-notes/plans` + `history` files.** They were already modified/untracked in the working tree before this session (explore-A R9 flagged exactly this). They are the human's to commit; sweeping them into a lint-cleanup commit would mix unrelated work.

## Gaps found
- **Real bug exposed by typing `AdminSidebar`:** it rendered `` `${p.user} | ${p.date}` `` but `ProjectMetrics` has no `user` field — it has `users: AuditUser[]`. Every row in the admin project list has been showing the literal string `"undefined | <date>"`. Now renders the joined usernames. This is a behaviour change, made deliberately because the field cannot be typed and left wrong; flagging it since `/admin` is not formally revisited until step 14.
- `react-hooks/set-state-in-effect` fired on `app/review/page.tsx` but **not** on the byte-identical `hasMounted` effect in `app/bda/page.tsx`. Both were converted anyway. The rule appears not to report every instance, so lint alone is not a reliable census of this pattern — worth remembering when the new shell is built.
- CLAUDE.md §5 was **not** updated: nothing architectural changed. The three new `InputField` fields mirror backend columns already described there, and §5's data-model bullet stays accurate. Step 1 is the first step that changes the architecture (the theme), and it will have to edit CLAUDE.md — which currently carries the human's own uncommitted §8/§9 edits, so that step must resolve how to commit it without sweeping those in.

## Verification
- `npm run lint` → **exit 0**, 0 errors, 26 warnings (was 16 errors, 26 warnings).
- `npm run build` → **exit 0**, all 6 routes prerendered (was: failed to compile).
- Manual: `npm run dev`, then `/login`, `/bda`, `/review`, `/admin` all returned **200**; `/login` served real content (`Voltavision`, `Processly` in the HTML). Dev log had **no** errors and **no** hydration-mismatch warnings, which is the specific risk of the `useSyncExternalStore` swap. Backend was not running, so this checks render and hydration only, not data flows.
- §8 checks: none apply. Step 0 adds no UI and no cross-cutting behaviour; the §8.3/§8.4 bar starts with step 1.

## Next
**Step 1** per plan-A §9: design tokens for both modes on MUI v7 `colorSchemes`, single `ThemeProvider` + `InitColorSchemeScript` in `app/layout.tsx`, Inter actually loaded and applied, `theme/layout.ts`, Tailwind removed, `theme/colors.ts` reduced to a deprecated shim, `scripts/contrast-check.mjs` run and its output pasted into that note, `ThemeToggle` + `useThemePreference`, per-page `ThemeProvider`s and the `MuiPaper` dark override removed. Checks to demonstrate: §8.3 (both modes on the old screens, OS default, persistence) and §8.4 (motion ≤200 ms + `prefers-reduced-motion`, visible focus ring).
