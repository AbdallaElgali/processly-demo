# Step 3: app shell and URL-based project routes

## Goal
plan-A §9 step 3 and decision D4: a Projects list, `/projects/[projectId]/…` routes with a project shell (header, breadcrumb, rail with activity badges), placeholders for the screens later steps build, and retire `/bda` and `/review`. Per AM5 the shell components are built to the full §8.4 bar here and are **not** rebuilt in step 5.

## Changes
**New — shell (`components/shell/`, `components/jobs/`)**
- `AppHeader.tsx` — wordmark, breadcrumb slot, job tray, theme toggle, account menu (register, admin, sign out). Replaces `LayoutHeader` + `ProjectBar`.
- `ProjectRail.tsx` — the seven RFC §2 sections, per-project activity badge on Extract and Review, collapsible to icons, arrow/Home/End keyboard navigation, selection shown by an accent bar *and* a tint.
- `Breadcrumb.tsx` — `Projects › Customer › Project` (D6).
- `JobBadge.tsx` — one dot per project state with a priority order (failed > interrupted > running > queued > unseen); tooltip and `aria-label` carry the meaning, so it is never colour alone.
- `JobTray.tsx` — browser-wide running/queued/failed work, reachable from any screen.
- `ScreenPlaceholder.tsx` — names the step that will build a screen and the routes it will call.

**New — routes**
- `app/projects/page.tsx` — card grid, search over name/customer/status, empty and no-match states, New project.
- `app/projects/[projectId]/layout.tsx` — the shell; the URL is the source of truth for the open project.
- `app/projects/[projectId]/page.tsx` — redirects to Overview.
- `review/page.tsx` — the interim editor (below). `overview`, `extract`, `parameters`, `prompts`, `audit`, `settings` — placeholders.
- `components/projects/NewProjectDialog.tsx` — replaces the two near-identical create dialogs in `BDASideBar` and `NoProjectsScreen`.
- `hooks/useLocalStorageFlag.ts` — remembered boolean preferences over `useSyncExternalStore`.

**Changed**
- `app/page.tsx` — redirects to `/projects` or `/login`.
- `next.config.ts` — `/bda` and `/review` redirect to `/projects`.
- `app/admin/page.tsx` — uses `AppHeader`; labelled "no authentication" (A2).
- `api/projects.ts` — `ProjectCreateInput` reduced to the fields the schema declares; `customer_id` is nullable. `title` and `customer` were being sent on every create and silently dropped.
- `lib/project-data/store.ts` — snapshot caching, see Gaps.
- `CLAUDE.md` §5 — App entry, Routes, The shell, state management and the 2b paragraph brought up to date; the "before the redesign" caveat removed.

**Deleted** — `app/bda/`, `app/review/`, `components/Sidebar.tsx`, `components/ProjectsSideBar/BDASideBar.tsx`, `components/ProjectBar.tsx`, `components/Headers/`, `components/ActionToolbar.tsx`, `components/NoProjectsScreen.tsx`.

## Decisions
- **Review hosts the old editor as an interim.** Deleting `/bda` without it would have left the app unusable for several steps. Everything it did is intact — upload, analyze, flag, flag-and-retry, candidate switch, save, approve, export — with the 56px icon rail replaced by a labelled toolbar. Step 7 takes upload and analyze into Extract; steps 8–10 rebuild this as the split pane.
- **Kept `AdminSideBar` and `BaseSideBar`.** plan §9 says delete `components/ProjectsSideBar/*`, but `/admin` uses both and is not revisited until step 14. Deleting them would have broken a working screen for eleven steps.
- **No per-project counts on the cards.** They need `GET /projects/{id}` per card; the plan defers that lazy fetch to step 6. A made-up number would be worse than none.
- **The customer "full name" field is gone from the create dialog.** `CustomerCreate` has only `alias_name`, so the old field was collected and silently discarded.
- **Placeholders name their step and routes** rather than saying "coming soon", so an empty tab reads as planned work and reviewers can see what each screen will call.

## Gaps found
- **A latent crash from 2a-i, surfaced by this step's first reload:** `ProjectDataStore.get()` returned a **fresh** `emptyProjectState` object on every call for a project with no state yet. `useSyncExternalStore` compares snapshots by reference, so React threw *"The result of getSnapshot should be cached to avoid an infinite loop"* and the screen was replaced by the error overlay. This is the normal first-render path, so it would have hit any user opening a project before its details arrived; it had not fired earlier only because `/bda` always had state by the time it rendered. Fixed by caching one blank per `projectId`, with three regression tests (stable reference when absent, stable when unchanged, new object only when *that* project changed).
- `app/login/page.tsx` and `app/admin/*` still import the deprecated colours shim, as do `input-fields-list`/`input-field-item` and the viewers. In light mode the shell is light while the parameter list is still dark. Expected and visible; steps 8, 9 and 14 migrate them.
- The rail's badge is shown on Extract and Review only. Once Overview and Audit show run history they may want one too — a step 12/13 judgement call.

## Verification
`npm test` **60/60** (3 new), `npm run lint` **exit 0** (0 errors, 40 warnings — down from 53, the deleted screens took their warnings with them), `npm run build` **exit 0** (14 routes), `npm run check:contrast` **83/83**.

Checked in Chrome against the live backend:

- **Routing (D4).** `/projects` lists every project; opening one lands on `/projects/{id}/overview`; `/bda` returns **307** to `/projects`. All seven rail items render and `aria-current="page"` tracks the active one.
- **Breadcrumb (D6).** Rendered `Projects › Test › D11-A` — the customer came from the `GET /customers/` join, since the project payload's `customer` is null (Task B item B2). The fallback works rather than being theoretical.
- **§8.1 — badges.** `D11-B` showed an **interrupted** badge on its card, left over from the 2b test, and the job tray reflected it. Activity is visible per project without opening it.
- **§8.4 — rail keyboard.** `↓ ↓ ↑ End Home` moved focus Overview → Extract → Review → Extract → Settings → Overview. Real keyboard focus (click, then Tab) gave a computed outline of `2px solid rgb(95,211,222)` = `accent.focus` for dark, with `:focus-visible` true.
- **§8.3 — both modes and persistence.** Switched to light and collapsed the rail, then reloaded: **both preferences survived**, the shell rendered light, and the document surface stayed light in both. Console clean after the snapshot fix — no errors, no hydration warnings.
- **The interim Review screen** rendered 27 parameters with 12 filled values, the five toolbar actions, the flag markers from earlier tests, and the PDF in the viewer.

**Token spend: 0 OpenAI operations.** Everything above used projects and documents extracted in earlier steps; no run was started.

**§8 checks.** §8.1: per-project badges on cards and rail, job tray browser-wide, no app-wide blocking. §8.3: verified in both modes, with the known shim debt called out above. §8.4: rail keyboard operability, visible focus ring, `aria-current`/`aria-expanded`/`aria-label` on the shell controls, skeletons for the loading list, empty and no-match states each with a next action, and motion through `theme.transitions` so the reduced-motion reset applies. §8.2 does not apply — no category grouping in this step.

## Next
**Step 4** per plan §9: the remaining contract fixes from plan §7 (trailing slash on `PATCH /projects/project-parameter/{id}/`, `create_customer` sending only `alias_name`, `ExtractionTemplateBase.updated_at`, nullable template fields), user registration per D3 at `/register` with the three-value department enum, the login restyle, and deleting the dead modules (`api/chat.ts`, `api/admin/users.ts`, `components/Loading.tsx`, `components/DocumentViewer/DocumentViewer.tsx`, `components/source-modal.tsx`, `types/admin.ts`). Note `ProjectCreateInput` was already fixed here because the new dialog needed it.
