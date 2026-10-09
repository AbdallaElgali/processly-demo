# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository (`processly-demo`, the frontend of VV-BDA, Battery Document Analysis).

---

## 0. Operating rules (read first, always apply)

1. **Read before you change.** At the start of every session, read this file, `claude-notes/context/fe_rfc.md`, and the most recent 3 notes in `claude-notes/history/`.
2. **Work in reviewable steps.** One step = one coherent change (one screen, one component group, one wiring feature). After each step: `npm run build` and `npm run lint` must pass, then commit, then write a history note, then **stop and summarize** for human review. Never chain several steps without stopping unless the human says so.
3. **Explore and Plan sessions are read-only for source code.** They may only write their output file under `claude-notes/`.
4. **Never invent API fields.** The backend contract is `claude-notes/context/openapi.json`. If a screen needs data that is not in it, render a clearly labelled placeholder and record the gap in the history note.
5. **Never expose `DELETE /system/reset-database`** in the UI, a generated client function, or a dev menu.
6. **Never print, log, or commit secrets** (API keys, `DATABASE_URL`, `.env` contents).
7. **Keep this file current.** If a step changes the architecture described below, update the relevant section of this file in the same commit.
8. **Ask, don't guess,** when the RFC, the plan, and the code disagree on something that is expensive to undo.

---

## 1. Session history protocol

Every session that changes anything (code, plan, or docs) writes one note to `claude-notes/history/`.

- **Filename:** `YYYY-MM-DD_HHMM_short-kebab-description.md` (local time, 24h), e.g. `2026-10-09_1015_explore-frontend-task-a.md`.
- **One note per step**, append-only. Never edit or delete an earlier note; correct it in a new note instead.
- **Contents:**
  - **Goal**: what this step was meant to do (1–2 lines)
  - **Changes**: files touched, with one line each
  - **Decisions**: anything chosen that the plan did not fix, and why
  - **Gaps found**: missing backend data, broken assumptions, deferred work
  - **Verification**: build/lint results and what was checked manually
  - **Next**: the next step per the plan

---

## 2. Context files (`claude-notes/context/`)

| File | What it is |
|---|---|
| `fe_rfc.md` | RFC-FE-01, the target design: information architecture, run-timeline state machine, Review screen rules, backend contract gaps, delivery plan. **The source of truth for what we are building.** |
| `openapi.json` | Snapshot of the FastAPI backend's OpenAPI schema. **The source of truth for the API contract.** SSE event payloads are NOT in it; take them from the RFC §3 and the SSE table in the backend summary. Ignore `/system/reset-database`. |
| `Backend_summary_9-10-2026.md` | Full description of the backend as of 2026-10-09: pipeline, SSE contract table, reason codes, flagging mechanisms, data model. Use it where `openapi.json` is untyped. |
| `test-data/` (repo root, **gitignored**) | Real customer documents for manual testing, with `README.txt` mapping files to the edge cases they cover. **Confidential.** See the rules below. |
| `*.png` | Mindee reference screenshots, dark mode and light mode. Visual **inspiration only**: take layout, density, navigation structure, the dropzone, the split-pane review pattern, the guided-tour idea, and how each mode handles surfaces and contrast. **Do not** copy Mindee's logo, branding, red accent color, or exact styling. |

### Rules for `test-data/` — these are real customer documents

1. **Never commit them.** `test-data/` is in `.gitignore`; do not add it with `git add -A` or `git add .`, which is how it got committed once already (step 2b, amended out). Stage files explicitly.
2. **Never quote their contents.** History notes, commit messages and chat may name a **file** and a **parameter key** (`U_MIN`, `I_MAX_DCH_PULSE`) and nothing else — no extracted values, no snippets, no table contents, no customer identifiers beyond the file name.
3. **Never send them anywhere except the local backend** on `localhost:8000`. No third-party service, no upload, no paste into an external tool.
4. **Use the smallest file that exercises the case** for any run that costs OpenAI tokens, and record in the history note which file was used and how many runs were made.
5. **Before starting step 8, check that `test-data/` exists and contains its README.** Step 8 rebuilds the parameter table and depends on the real edge cases the README maps (merged headers, tables spanning pages, scanned pages, macro-enabled workbooks, German labels). If either is missing, **stop and ask for the test documents** rather than starting step 8 against invented data.

**Deferred (do not build yet):** command palette / global keyboard launcher.

Plans and exploration findings go to `claude-notes/plans/`. When a `<plan>-amendments.md` file exists next to a plan, **it takes precedence over the plan** where they disagree.

---

## 3. Commands

```bash
npm run dev             # Start dev server at http://localhost:3000
npm run build           # Production build (must pass after every step)
npm run lint            # Run ESLint (must pass after every step)
npm test                # Vitest unit tests (must pass after every step, from 2a-i on)
npm run check:contrast  # Assert the WCAG ratios of theme/tokens.json (must pass)
```

`npm test` covers the pure logic only — the job scheduler's cap/priority/FIFO
rules, the job reducer, the SSE-to-phase mapping, and the per-project data
guarantee. UI is verified in the browser and the dev gallery, not here.

"Verification" means build + lint + test, plus a manual check described in the history note. The unit tests cover pure logic only, so a step that changes behaviour still has to be exercised in the browser and the result recorded.

---

## 4. Backend dependency

All API calls target the FastAPI backend (sibling repo `BDA/`) at `http://localhost:8000` by default. Override with **`NEXT_PUBLIC_API_URL`** — it is read in the browser, so only a `NEXT_PUBLIC_*` variable reaches it, and that is what the Dockerfile passes as a build arg. (Earlier revisions of this file said `API_URL`; the code was always right.) The backend must be running for upload, extraction, and review features to work.

The contract is `claude-notes/context/openapi.json`. Key routes in the current backend:

| Route | Purpose |
|---|---|
| `POST /files/upload-documents/` | Batch upload into a project (Stage 1 analysis + Stage 2 grouping) |
| `POST /specs/stream-specs` | Blind extraction (SSE). With `previous_specs` in the body it becomes an ITERATIVE correction. |
| `POST /specs/stream-parameter` | Re-extract one parameter (SSE, SINGLE_PARAM correction) |
| `GET /documents/{doc_id}/file` | Original uploaded file for the viewer (may 404 if storage was cleaned) |
| `/projects/...` | Project lifecycle, parameters, approve, contributors |
| `/flagging/...` | Human flag, unflag, select-correct-candidate |
| `/audit/...` | Lineage, audit views |
| `/extraction-templates/...` | Templates and the canonical parameter dictionary |
| Prompt registry routes | Slots, versions, assignments, `/projects/{id}/prompt-pins`, `/prompt-resolution`, `/extraction-runs` |

**SSE statuses the backend can emit.** The authoritative list is `lib/jobs/sse-types.ts`, which was read off the backend's own emitters (`BDA/src/engine/orchestrator.py`, `src/api_routes/extract_specs.py`); keep the two in step.

- Blind extraction and iterative correction (`POST /specs/stream-specs`): `error`, `routing_truncated`, `routing_complete`, `no_frames_tagged`, `category_extraction_fallback`, `workers_complete`, `category_workers_failed`, `partial`, `complete`, plus `partial_correction` on the iterative path.
- Single-parameter correction (`POST /specs/stream-parameter`): additionally `targeting` and `ready_to_save`.

Only `error` and `complete` are terminal. `routing_truncated`, `no_frames_tagged`, `category_extraction_fallback` and `category_workers_failed` are **warnings**: non-terminal, and they must never be rendered as failures.

There is **no `refining` status** — an earlier version of this list claimed one, and the old `api/analyze-document.ts` had a branch for it, but nothing in the current backend emits it. Unknown statuses are forwarded and ignored rather than throwing, so a status added later degrades to "no visible phase change".

**There is no real authentication.** `/auth` identifies users by a caller-supplied username. Do not build UI that implies permissions are enforced.

---

## 5. Current architecture

> The code as it is today. Update this section in the same commit as any step that changes it (§0.7).

### App entry
`app/layout.tsx` mounts the whole app's providers, in this order: `AppRouterCacheProvider` (Emotion SSR; without it the server and client disagree on where MUI's global styles go and React reports a hydration mismatch) → `ThemeRegistry` (the single `ThemeProvider` + `CssBaseline`) → `AuthProvider` → `ProjectDataProvider`. `InitColorSchemeScript` runs before them to set the colour scheme pre-paint. Inter is loaded here with `next/font` and exposed as `--font-inter`.

### Routes (decision D4, built in step 3)
| Route | Screen |
|---|---|
| `/` | Redirects to `/projects`, or `/login` when signed out |
| `/login` | Sign in by username (A2: no password, no token) |
| `/projects` | Projects list: card grid, search, New project dialog |
| `/projects/[projectId]` | Redirects to that project's Overview |
| `/projects/[projectId]/{overview,extract,review,parameters,prompts,audit,settings}` | The project tabs |
| `/admin` | Audit dashboard, outside the project nav and labelled unauthenticated |
| `/dev/gallery` | Dev-only component gallery (tokens plus every `components/ui/` primitive, both modes); 404s in production. Absorbed `/dev/theme` in step 5. |

`/bda` and `/review` are retired and redirect to `/projects` (`next.config.ts`).

**`review` and `extract` are real screens; the other five are still `ScreenPlaceholder`s** naming the step that builds them and the routes they will call. Upload and Analyze moved to Extract in step 7 (Review's toolbar no longer has them); steps 8-10 rebuild Review as the split pane.

### Extract (`app/projects/[projectId]/extract/`, step 7)
Tabs: **Extract** (`Dropzone` → an upload job; Analyze → a blind or iterative-correction extraction job, gated by `useCanStart`; `JobBanner`, which renders `RunTimeline` — RFC §3's six-step pipeline, derived purely from the job's own `phase`/`events`, no new phase values — for a running extraction/correction, or a plain phase line for an upload; `CategoryCards` while one of those is running; `DocumentsTable` combining `details.documents` with rows for a queued/running upload's files) and **Runs** (`RunsTab`, `DataTable` over `GET /projects/{id}/extraction-runs`, filter chips by `extraction_type`). `components/extract/` holds all of these plus `CategoryCard`.
- `lib/categories.ts` — category resolution (D5/AM9: case- and separator-insensitive matching against the known Voltage/Current/Temperature/Capacity/End_Of_Life set, unknown categories humanised and appended, `Other` last) and `tallyByCategory` (per-category found/total for `CategoryCards`, joining the project's own fields against the canonical dictionary). Unit-tested. The full parameter-row grouping (`groupFields`, the Review table's empty-known-category rule) is step 8's; this only backs the Extract screen's progress cards, which show a category solely when the project has parameters in it.
- `hooks/useCanonicalParameters.ts` — `GET /extraction-templates/parameters`, cached at module scope so every caller in the session shares one fetch.
- `job.uploadWarnings?: string[]` (`lib/jobs/types.ts`) carries an upload's per-file failures (`RunOutcome.warnings`) onto the completed job, read by `DocumentsTable`; the reducer's `complete` action takes an optional `warnings` field for this.

### The shell (`components/shell/`, built to the §8.4 bar per AM5 — step 5 does not rebuild it)
`app/projects/[projectId]/layout.tsx` mounts it once for every tab: `AppHeader` (wordmark, breadcrumb slot, `JobTray`, `ThemeToggle`, account menu) above `ProjectRail` (seven nav items, per-project activity badges, collapsible to icons, arrow/Home/End keyboard navigation) beside the screen. `Breadcrumb` renders `Projects › Customer › Project` per D6. The URL is the source of truth for which project is open; the layout tells `projectsIndex` so badges and the job tray agree with the address bar.

### Shared component library (`components/ui/`, step 5)
Generic primitives used across screens, as opposed to `components/shell` (navigation chrome) and `components/jobs` (job-store-aware), both already built: `SearchField` (debounced by the caller, `/` focuses it, `Esc` clears), `StatusChip` (the 4 project statuses), `ProjectCard` (extracted from the step-3 projects list), `EmptyState`/`ErrorState`, `Skeletons` (`SkeletonCardGrid`, `SkeletonRows`), `DataTable` (sortable header, skeleton/error/empty body — used by the Runs/Pins/Templates/Members tables from step 7 on), `Toast`/`ToastHost` (one bottom-left queue; `toast.show(...)` is callable from anywhere, including non-component code like a job runner), `ConfirmDialog`/`FormDialog` (shared dialog shells; existing dialogs built before this step, e.g. `NewProjectDialog`, keep their own markup and adopt these only if a later step touches them anyway), `DensityToggle` (controlled; the caller persists the choice), `GuidedTour` (anchored by CSS selector, so it has no coupling to the component it points at; steps 6+ pass real `steps`). All demoed in both modes in `/dev/gallery`.

### Background work and per-project data (`lib/jobs/`, `lib/project-data/`)
Added in step 2a-i and wired into the app in 2a-ii. **This replaced `ProjectContext`**, which is deleted, along with `useAnalyze`, `useAnalyzeParameter`, `api/analyze-document.ts` and `api/analyze-parameter.ts`.

- **`lib/project-data/store.ts`** — `ProjectState` keyed by `projectId` (details, fields, liveSpecs, per-operation loading, error). **This is the fix for the D11 bug**: results are applied to `store.get(job.projectId)`, so a run that outlives a project switch can no longer write one project's candidates into another's rows. Regression-tested.
- **`lib/jobs/`** — `types.ts` (Job, payloads, actions), `reducer.ts` (pure), `ordering.ts` (cap, correction-priority, FIFO, one parameter-writing job per project), `sse-types.ts` (hand-written SSE contract + phase mapping), `sse.ts` (reader with `AbortController`), `runners.ts`, `store.ts` (observable + abort registry), `hooks.ts` (`useSyncExternalStore` selectors), `config.ts` (`JOB_CAP = 3`).
- **`lib/jobs/runtime.ts`** — starts queued jobs when a slot frees and applies each outcome to its own project. In-tab for now.
- **`lib/project-data/`** — `projects-index.ts` (the user's project list plus the selected project; step 3 moves selection into the URL per D4), `actions.ts` (the operations ProjectContext used to own, each scoped to one project), `provider.tsx` (loads projects for the signed-in user, clears every cache on sign-out).
- **`lib/jobs/locks.ts`, `scheduler.ts`, `persistence.ts`** (step 2b) — the cap is **per browser**: every tab shares one queue in `localStorage`, serialises decisions on one Web Lock, and announces changes over `BroadcastChannel` with `storage` as a backstop. Liveness is "is the per-job lock held", never a timer (AM2), and a job's lock is claimed before it is marked running. A job starts in the tab that queued it; any surviving tab adopts it if that tab is gone. Queued uploads keep their files in IndexedDB (`lib/db.ts` v2).

**A flag requires an AI candidate.** `ai_parameter_flags` has `ai_metric_candidate_id uuid NOT NULL` and `extraction_run_id uuid NOT NULL`, `project_parameters` has no `human_flagged` column (the API field is derived from a join on open flags), and the batch parameter save ignores the `flag` fields its request schema accepts. A parameter that has never been extracted therefore cannot be flagged by any current route; the UI refuses with an explanation instead of failing silently.

### State management (custom hooks, no Redux/Zustand)
- **`hooks/ParameterManager.tsx`**: a thin set of handlers over `ProjectDataStore`. `fields` live in the store, keyed by `projectId`; the hook does not own them. Merging a run's results into a project's fields is `ProjectDataStore.applySpecs`.
- **`hooks/DocumentManager.tsx`**: uploaded files as blob URLs in memory, the active file, and the `activeSource` highlight target. `handleJumpToSource` switches the active file and sets the highlight. Documents come from the project's cached details; step 9 makes the fetch lazy per D7.
- **`hooks/useHasMounted.ts`, `hooks/useLocalStorageFlag.ts`**: `useSyncExternalStore` helpers for post-hydration state and remembered boolean preferences, so neither needs `setState` inside an effect.

### Data model (`types/index.ts`)
- `InputField`: one battery parameter (e.g. `U_MIN`), with an array of `Specification` candidates and a `selectedSpecId`.
- `Specification`: one extracted value with `confidence`, `unit`, `source` (`pageNumber`/`boundingBox` for PDFs, `tableName`/`cellCoordinates` for Excel), plus validation flags (`rule_passed`, `rule_violations`, `requires_review`).
- `SCHEMA_GROUPS`: hardcoded field list grouped as Voltage, Current, Temperature, Capacity.

### Document viewers (`components/DocumentViewer/`)
`DocumentRouter` delegates by MIME type to:
- `PdfViewer`: `react-pdf`, renders pages, highlights bounding boxes
- `ExcelViewer`: `xlsx`, parses the workbook, highlights cells by row/column or bounding box

These are the most valuable existing components. Reuse and extend them rather than rewriting.

### API layer (`api/`)
Thin fetch wrappers, no SDK, no interceptors. Every module reads the base URL from `api/config.ts`, which resolves `NEXT_PUBLIC_API_URL` with a `localhost:8000` fallback.

Hand-written response types live in `api/types/` (decision D10), each naming the backend module it was read from, because almost every response in `openapi.json` is declared as `{}`. `api/auth.ts` additionally owns the `DepartmentEnum` values, which are the only three a registration may send.

### Styling
MUI v7 with CSS theme variables and **both colour schemes** (step 1). No Tailwind (D2).

- `theme/tokens.json` — the single source of truth for every colour, as `light` / `dark` / `document` groups. `document` is deliberately mode-invariant: a PDF page and a spreadsheet grid *are* the document, so they stay light in dark mode (§8.3).
- `theme/tokens.ts` — typed view over that JSON, plus `radius`, `motion` (capped at 200 ms) and `shadow`.
- `theme/theme.ts` — `createTheme` with `cssVariables.colorSchemeSelector: 'data-mui-color-scheme'` and both schemes. Semantic tokens are added to the palette by module augmentation, so components write `sx={{ bgcolor: 'surface.panel' }}` or `theme.vars.palette.*` and **never a raw colour**. Also owns the global focus ring, the `prefers-reduced-motion` reset, and a `MuiButtonBase` focus-visible override (ButtonBase resets `outline: 0`, which otherwise beats the global rule on source order).
- `theme/layout.ts` — header/rail/split-pane constants, previously duplicated as magic numbers per page.
- `theme/colors.ts` — **deprecated shim** holding the dark values so pre-redesign screens keep rendering. It is plain hex, not CSS variables, because call sites pass it through `alpha()` and string-concatenate alpha suffixes, both of which break on a `var()`. ESLint warns on importing it; the warning becomes an error when the last screen is migrated and the file is deleted.
- Mode: default `system`, persisted by MUI to `localStorage` and mirrored to the backend's `user_settings.theme` by `hooks/useThemePreference.ts`. Quick toggle in `components/shell/ThemeToggle.tsx`; the full control belongs in Settings.
- `npm run check:contrast` asserts the WCAG ratios in `scripts/contrast-check.mjs` and must pass.

### Local DB (`lib/db.ts`)
Dexie (IndexedDB) database `BatterySpecDB` with a `files` table. Defined, but file blobs may be held in React state instead; check usages before relying on it.

### Project ID
A UUID is generated client-side via `uuidv4()` on mount and passed to every API call.

---

## 6. Known gaps between this frontend and the current backend

| Gap | Impact |
|---|---|
| Endpoints in `api/` are outdated (`/files/upload-document/`, `/specs/extract-specs/`, `/chat`) | The backend now uses `/files/upload-documents/`, `/specs/stream-specs`, `/specs/stream-parameter`. `/chat` is not in the current backend. |
| Client-generated project UUID | The backend has a real `projects` table with customers, templates, and parameters. Projects must be created and listed through `/projects`, not invented client-side. |
| `SCHEMA_GROUPS` is hardcoded with 4 categories (no End of Life) | The backend schema is dynamic per project and has a 5th category, `END_OF_LIFE`. Parameter lists and categories must come from the project, not a constant. See §8.2. |
| Loading state is global | Pressing Analyze or uploading blocks the whole app, so the user cannot switch projects. See §8.1. |
| ~~Dark mode only~~ | **Tokens and both schemes landed in step 1.** Remaining: the pre-redesign screens still import the deprecated `theme/colors.ts` shim, so they render dark in light mode until their own step migrates them to palette tokens. See §8.3. |
| ~~Only 5 SSE statuses handled~~ | **Fixed in step 7.** `RunTimeline` draws all of the pipeline (routing/extracting/supervising) and `JobBanner` labels every warning status (routing_truncated, no_frames_tagged, category_extraction_fallback, category_workers_failed) in place rather than ignoring it. |
| Flags, reason codes, prompt pins, lineage not surfaced | See RFC §4–§5. |
| No test suite | Verification is build + lint + manual until a plan step adds tests. |

---

## 7. Battery-domain display rules (apply to any UI showing values)

- Always show the **original unit as extracted** next to any normalised value (e.g. mAh beside Ah). Never silently convert.
- **Discharge currents (`I_MAX_DCH_*`) are negative by design.** Show the sign, with a tooltip explaining the convention. Never "fix" it.
- **C-rate and absolute current are different things.** Show them with distinct visuals; never show a converted current without its C-rate basis.
- Show the **min/typ/max qualifier** as a visible tag.
- **Auto-flags** (out-of-bounds, raised by the backend) and **human flags** (raised by a reviewer) must look different.
- A parameter with no value always has one of the backend's 4 reason codes; show it, never a blank.

---

## 8. Cross-cutting requirements (apply to every screen)

### 8.1 Work is scoped to a project, never to the app
- Long-running work (upload, analysis, extraction, correction) belongs to **one project**. It must never block navigation, other projects, or the rest of the UI.
- Job state lives in an **app-level store keyed by `projectId`** (and `runId` once the backend provides it), above the route tree. A job keeps running when the user navigates away from its project, because the component that started it is not its owner.
- Loading is shown **where the work is**: a per-project activity badge in the projects list/sidebar, and progress inside that project's Extract screen. No full-screen spinners, no app-wide disabled states.
- One project may not start a second extraction while one is running (disable that project's Analyze button only).
- **Concurrency cap: at most 3 active jobs app-wide** (uploads and extractions both count; make the number one config constant). Browsers allow only about 6 connections per origin, and the app still needs connections for normal navigation.
- **Opening projects is never capped.** At the cap, the user can still open, browse and review any project. Only *starting* new work is affected: the new job is **queued**, shown in that project as "Queued, position N" with a cancel action, and starts automatically when a slot frees up (first in, first out).
- **Completion never navigates.** When a job finishes, its results go into that project's data (the backend saves them on `complete`) and the project's cached data is refreshed in the background. The user stays where they are. The sidebar/project list shows a "new results" badge on that project, plus at most a small non-blocking notification with an optional "Open" action. The results are seen when the user returns to the project.
- Failures follow the same rule: an error badge on the project, details inside it, no interruption elsewhere.
- **The cap is per browser, not per tab.** All tabs share one cap and one queue. Coordinate through browser storage plus a cross-tab channel (e.g. BroadcastChannel or Web Locks); exactly one tab owns each running job.
- **The queue survives a page refresh.** Persist queued jobs locally. Queued *uploads* include their files, which cannot go in localStorage; store the blobs in IndexedDB (the existing Dexie setup in `lib/db.ts` is a candidate) and delete them once the upload succeeds or is cancelled.
- **Running jobs do not silently restart.** A job that was running when its tab closed or refreshed is shown as "Interrupted" with a "Run again" action. Re-running costs LLM tokens and creates a new extraction run, so it is always the user's choice.

### 8.2 Categories are data, not code
- Never hardcode the category list. Group parameters by each parameter's `category` from the project's parameter list.
- **The backend returns Title_Case**, confirmed against `GET /extraction-templates/parameters`: `Voltage`, `Current`, `Temperature`, `Capacity`, `End_Of_Life` — not the `UPPER_SNAKE` an earlier version of this section assumed.
- **Matching against the known-category map is case-insensitive and treats `_` and a space as the same character.** So `End_Of_Life`, `END_OF_LIFE` and `end of life` all resolve to the same entry. Matching on the raw string would drop every known category into the "unknown" bucket the moment the backend changed case.
- **Labels come from the map, never from the raw string**, so display is stable no matter which spelling the backend sends.
- Use the map for display order too, and **append any unknown category** at the end with a humanised label instead of dropping it.
- An empty category still renders (with its reason-code rows), so missing End of Life values are visible.

### 8.3 Dark and light mode
- Both modes are first-class. Every token has a dark and a light value; no component may import a raw color.
- Default to the OS preference. The **main control is in Settings** (Light / Dark / System); a **quick toggle** also sits in the shell header. Persist the choice to the backend's user settings (`theme`) when a user is known, otherwise locally.
- Document viewers: PDF pages and spreadsheet cells stay light (they are the document), so **highlight colors must meet contrast on a white page in both modes**.
- Status colors (confidence, auto-flag, human-flag, reason-code chips) must be distinguishable in both modes and never rely on color alone (add an icon or label).

- **Correction runs** (`/specs/stream-parameter`) count toward the cap but **jump the queue**: a queued correction starts before any queued upload or extraction.
- **Cancel** is only promised for *queued* jobs. A running stream may be aborted client-side, but the backend may keep working or save nothing, so the UI must not claim the run was undone.

### 8.4 Component quality bar
Every interactive component must have, before a step is considered done:
- Hover, focus-visible, pressed, disabled, and loading states
- Keyboard operability (Tab order, Enter/Space, Escape closes overlays, arrow keys in lists and tables)
- Skeletons for loading content instead of spinners where layout is known; meaningful empty and error states with a next action
- Motion that is short (≤ 200 ms), purposeful, and disabled under `prefers-reduced-motion`
- Verified in both light and dark mode at desktop and laptop widths
- Every step that adds or changes UI must open the affected screens in the browser and confirm the console has no errors or warnings. The `useSyncExternalStore` "getSnapshot should be cached" class of bug is invisible to build, lint and test; stores and hooks must return cached references for unchanged state.

---

## 9. Decisions log (Task A, 2026-10-09)

Settled after `claude-notes/plans/explore-A.md`. Follow these; do not re-open them without asking.

| # | Topic | Decision |
|---|---|---|
| D1 | Accent colour | Keep brand cyan `#00AAB9` as the accent hue, with **two shades**: the brand shade for fills and surfaces, and a darker cyan for text, links and focus rings in light mode so they pass WCAG AA contrast on white. Dark mode picks its own readable shade. One accent only; no purple secondary. |
| D2 | Styling system | **Remove Tailwind.** MUI v7 is the only styling system; one `ThemeProvider` in `app/layout.tsx`. |
| D3 | User registration | **In scope.** Rebuild it as a proper form: `username` plus a `department` dropdown with exactly `Zelle`, `Module`, `Pack`. Send only fields in `UserRegistration`. It is not "Settings"; Settings is the theme/contributors screen. |
| D4 | Routing | URL-based project routes: `/projects` (list) and `/projects/[projectId]/(overview\|extract\|review\|parameters\|prompts\|audit\|settings)`. `/bda` and `/review` are retired. `/admin` stays outside the project nav, labelled as unauthenticated. |
| D5 | Parameter categories | Until the backend adds `category` to the project payload (Task B), group by joining project parameters to `GET /extraction-templates/parameters` (`CanonicalParameter.category`) on the parameter key. This uses a real backend field, so it is not inventing data. Unmatched parameters go to an "Other" group, never dropped. |
| D6 | Customer in breadcrumb | Use the customer from the project payload if present; otherwise join `GET /customers/` by `customer_id`. If neither resolves, show the project alone. |
| D7 | Source file for the viewer | Fetch only the active document, via `GET /documents/{doc_id}/file`. Treat 404 and 410 alike as "Source unavailable, values preserved". |
| D8 | `.battery` export | Keep it, as an Export action in the Review header. It is a fixed downstream format, so it keeps its own **explicit key map** (independent of categories and of the removed `SCHEMA_GROUPS`), and it lists any required key that has no value before exporting. |
| D9 | Interrupted runs | Confirmed from the backend: results are saved only when the stream reaches `complete`. An interrupted run has saved nothing. |
| D10 | Response types | Most `openapi.json` responses are untyped. Hand-write response types for the routes Task A uses, each with a comment naming the route, and mark them for replacement by generated types in Task B. |
| D11 | Live data-corruption bug | A running analysis currently writes into whichever project is on screen (shared `fields[]`). The job-store step must key **data**, not just loading flags, by `projectId`, and its history note must state that this bug is fixed. |