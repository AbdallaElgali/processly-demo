# Plan A: redesign of the VV-BDA frontend

- **Date:** 2026-10-09
- **Inputs:** `CLAUDE.md` (§7, §8, §9 decisions D1–D11), `claude-notes/context/FE_RFC.md`, `BDA/claude-notes/audit/Backend_summary_9-10-2026.md`, the three Mindee screenshots, `claude-notes/plans/explore-A.md`, `openapi.json`, and (for response shapes only, per D10) the backend's own `src/db/types/*.py`, `src/db/projects.py`, `src/api_routes/*.py`, `src/engine/orchestrator.py`, `src/schemas/specs.py`.
- **Mode:** plan only. No source code was written.
- **Decisions this plan does not reopen:** D1–D11. Where the plan had to choose something D1–D11 left open, the choice is marked **(plan decision)** so the reviewer can veto it.

Section map: §1 tokens · §2 component library · §3 job store · §4 shell and routes · §5 categories · §6 screens · §7 contract fixes · §8 viewers · §9 ordered steps · §10 disagreements with explore-A · §11 facts verified against the backend while planning.

---

## 1. Design tokens (both modes, MUI v7 `colorSchemes`)

### 1.1 Mechanism

- One `createTheme({ cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' }, colorSchemes: { light: {...}, dark: {...} } })` in `theme/theme.ts`. One `ThemeProvider` + `CssBaseline` in `app/layout.tsx`, plus `<InitColorSchemeScript>` before `<body>` content so there is no flash on reload. All per-page `ThemeProvider`s are deleted (explore-A §4.6).
- Custom tokens are added by **palette augmentation** (`declare module '@mui/material/styles'`), so components use `theme.palette.surface.panel` / `sx={{ bgcolor: 'surface.panel' }}` and never a literal. `theme/colors.ts` is reduced in step 1 to a deprecated shim re-exporting the dark values (so untouched old screens keep rendering), and deleted in the last step. An ESLint `no-restricted-imports` rule on `@/theme/colors` is added as a *warning* in step 1 and raised to *error* in step 14.
- Mode: `useColorScheme()` gives `mode: 'light' | 'dark' | 'system'`. Default is `'system'` (OS preference). MUI persists the choice in `localStorage` (`mui-mode`) on its own; a `useThemePreference()` hook additionally writes it to the backend with `PUT /auth/update-user-settings { user_id, theme }` when a user is logged in, and on login applies `user.theme` if it is one of the three values (any other stored string is ignored and treated as `'system'`). **Main control** in Settings (segmented Light / Dark / System); **quick toggle** in the header cycles light → dark → system with a tooltip stating the resulting mode.
- Tailwind is removed (D2): drop `tailwindcss`, `@tailwindcss/postcss`, delete `postcss.config.mjs`, strip the `@tailwind` directives from `app/globals.css`. `globals.css` keeps only the reduced-motion rule and the font variable; the forced `overflow: hidden`, `display: flex` on `body` and the inline `100vw/100vh` in `layout.tsx` are removed (explore-A §4.14).

### 1.2 Accent (D1)

| Token | Light | Dark | Use |
|---|---|---|---|
| `accent.fill` | `#00AAB9` (brand) | `#00AAB9` | Primary buttons, selected rail item bar, progress |
| `accent.fillHover` | `#0097A5` | `#19B8C6` | Hover on filled accent |
| `accent.text` | `#00707A` | `#5FD3DE` | Links, accent text, icons on surfaces |
| `accent.focus` | `#00707A` | `#5FD3DE` | 2px focus ring (`outline-offset: 2px`) |
| `accent.tint` | `rgba(0,170,185,0.10)` | `rgba(0,170,185,0.16)` | Selected rows, active nav background |
| `accent.onFill` | `#FFFFFF` | `#06181B` | Text on `accent.fill` |

Contrast, computed with the WCAG relative-luminance formula while planning: `#00AAB9` on white ≈ **2.8:1** (fails AA for text; allowed only for large fills with `accent.onFill`), `#00707A` on white ≈ **5.8:1** (AA for normal text, AAA for large), `#00AAB9` on `#0E141B` ≈ **6.5:1**, `#5FD3DE` on `#0E141B` ≈ **10:1**. **Step 1 must verify these with a script** (a 20-line Node contrast check committed under `scripts/contrast-check.mjs`, run by hand, results pasted into the history note) rather than trusting the plan's arithmetic. The MUI `primary` palette is set per scheme: `primary.main = accent.fill`, `primary.contrastText = accent.onFill`, and `primary.dark = accent.text` so `color="primary"` text/links automatically pick the readable shade. **No `secondary` colour** (the purple is deleted).

### 1.3 Surfaces, borders, text

Light mode follows the light Mindee reference (near-white with a faint blue tint, 1px borders, soft shadows); dark mode follows the dark reference (deep navy, not neutral grey, borders instead of shadows). Values are the plan's starting point and may be tuned in step 1 within the contrast rules.

| Token | Light | Dark |
|---|---|---|
| `surface.canvas` (page background) | `#F5F7FA` | `#0B1017` |
| `surface.panel` (rail, header, cards) | `#FFFFFF` | `#121923` |
| `surface.raised` (dialogs, menus, popovers) | `#FFFFFF` | `#182130` |
| `surface.sunken` (table headers, code, wells) | `#EEF1F5` | `#0E141B` |
| `surface.hover` | `rgba(16,24,40,0.04)` | `rgba(255,255,255,0.05)` |
| `border.subtle` | `#E3E8EF` | `#223042` |
| `border.strong` | `#C9D1DC` | `#34475F` |
| `text.primary` | `#101828` | `#E6EAF0` |
| `text.secondary` | `#475467` | `#A3AEBF` |
| `text.muted` | `#98A2B3` | `#6B7A90` |
| `text.inverse` | `#FFFFFF` | `#0B1017` |

MUI mapping: `background.default = surface.canvas`, `background.paper = surface.panel`, `divider = border.subtle`, `text.*` as above, `action.hover = surface.hover`. The `MuiPaper` override that forces a dark background (explore-A §4.7) is removed; `backgroundImage: 'none'` stays.

### 1.4 Status and domain colours (always paired with an icon or label, §8.3)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `status.success` / `.successBg` | `#15803D` / `#DCFCE7` | `#4ADE80` / `#132B1D` | Approved, high confidence tick |
| `status.warning` / `.warningBg` | `#B45309` / `#FEF3C7` | `#FBBF24` / `#332512` | Low confidence, **auto-flag (Bounds)**, run warnings |
| `status.danger` / `.dangerBg` | `#B91C1C` / `#FEE2E2` | `#F87171` / `#361616` | **Human flag**, failed job, errors |
| `status.info` / `.infoBg` | `#1D4ED8` / `#DBEAFE` | `#60A5FA` / `#14233D` | Running job, info banners |
| `status.neutral` / `.neutralBg` | `#475467` / `#EEF1F5` | `#A3AEBF` / `#1C2735` | Reason-code chips, queued, pending |
| `status.modified` | `#6D28D9` | `#C4B5FD` | Human-modified pencil |

Confidence thresholds live in one constant `CONFIDENCE_HIGH = 0.85` (RFC §4.1; on the backend 0–1 scale; the UI keeps the adapter's 0–100 conversion but the constant is defined once, in `lib/review/confidence.ts`). Auto-flag and human flag use different hue **and** different icon (warning-triangle "Bounds" vs flag "Flagged by <user>").

### 1.5 Document and highlight tokens (mode-invariant, §8.3)

The document is always light, so these tokens have **one value in both modes**: `document.canvas = #E4E7EC` (around pages/grid), `document.page = #FFFFFF`, `document.gridLine = #D0D5DD`, `document.headerCell = #F2F4F7`, `highlight.stroke = #00707A` (5.8:1 on white, passes the 3:1 non-text minimum with margin), `highlight.fill = rgba(0,170,185,0.18)`, `highlight.dim = rgba(16,24,40,0.08)` (the "everything else" veil; replaces today's `0 0 0 9999px` shadow), `highlight.pageOutline = #00707A`. Excel highlighted cell text keeps `#101828` on the fill (contrast ≈ 11:1). Verified by the same step-1 script.

### 1.6 Typography

One font: **Inter**, loaded with `next/font/google` in `layout.tsx` (`variable: '--font-inter'`, subsets latin + latin-ext for German umlauts) and applied by `typography.fontFamily = 'var(--font-inter), system-ui, sans-serif'`. Geist and Geist Mono are removed. Numeric values use `fontVariantNumeric: 'tabular-nums'` (a `ValueText` style, not a second font). Scale: `h4 24/32 600`, `h5 20/28 600`, `h6 16/24 600`, `subtitle2 13/20 600 uppercase tracking .04em` (section labels), `body1 15/22`, `body2 13/20`, `caption 12/16`. `button.textTransform = 'none'`.

### 1.7 Spacing, radius, elevation, motion

- Spacing: MUI `spacing(1) = 8px`; half steps allowed. Layout constants in one `theme/layout.ts`: header 56, rail 240 (collapsed 64), review split default 55/45, min pane 360.
- Radius: `shape.borderRadius = 8`; tokens `radius.sm 4`, `radius.md 8`, `radius.lg 12`, chips pill.
- Elevation: light mode `shadow.sm 0 1px 2px rgba(16,24,40,.06)`, `shadow.md 0 4px 12px rgba(16,24,40,.08)`, `shadow.lg 0 12px 32px rgba(16,24,40,.12)`; dark mode shadows are `none` and elevation is expressed with `surface.raised` + `border.subtle`. Dialog paper uses `surface.raised`.
- Motion: `motion.fast 120ms`, `motion.base 160ms`, `motion.slow 200ms` (the ceiling), easing `cubic-bezier(.2,.0,.0,1)`. A single `CssBaseline` override implements `@media (prefers-reduced-motion: reduce)` → all transitions/animations `0.01ms`; `theme.transitions.create` is wrapped by `motion()` helper that returns `'none'` under the same media query for JS-driven cases (`Collapse`, skeleton shimmer).
- Focus: a global `:focus-visible { outline: 2px solid accent.focus; outline-offset: 2px }` via `CssBaseline`, and MUI `focusRipple` kept.

---

## 2. Component library

Every component lists its states against §8.4 (**H**over, **F**ocus-visible, **P**ressed, **D**isabled, **L**oading, **K**eyboard) and what makes it better than the reference (RFC §5b.4). Location: `components/ui/` (primitives), `components/shell/`, `components/jobs/`, `components/review/`, `components/viewer/`. A dev-only gallery route `app/dev/gallery/page.tsx` (returns 404 unless `NODE_ENV !== 'production'`) renders every primitive in every state in both modes; this is how step 5 is verified.

| Component | Purpose | States | Better than the reference because |
|---|---|---|---|
| `AppHeader` | Logo wordmark (text "Voltavision · BDA", our brand), breadcrumb slot, job tray, theme toggle, user menu | H/F/K on all controls | Shows browser-wide job count with a tray popover; Mindee's header is static |
| `ProjectRail` | Project switcher + 7 nav items with icon, label, badge slot; collapsible to icons | H/F/P/K (arrow keys move, Enter opens, `[` toggles collapse), active item has a 3px accent bar + `accent.tint` | Per-item badges (running / unseen / failed) make background work visible without leaving the screen |
| `Breadcrumb` | `Projects › Customer › Project` (D6) | H/F/K; truncates middle with tooltip | Same as reference; adds a copy-link action |
| `ThemeToggle` | Cycles light/dark/system | H/F/P/K; announces new mode via `aria-live` | Reference has light/dark only; ours has System |
| `ProjectCard` | Alias, customer, status chip, counts, last activity, job badge | H (lift via `shadow.md`/border in dark), F, P, K (Enter opens), skeleton variant | Card carries live job state and "new results" dot |
| `SearchField` | Debounced filter | F, clear button, `Esc` clears | Keyboard `/` focuses it |
| `Dropzone` | Large dashed card, drag-over state, file-type hint, multi-file | H/F/K (Enter/Space opens picker), drag-over, D (at cap shows "will be queued" not disabled), L per file | Never disabled by other projects' work; shows queue position inline |
| `JobBanner` | Inside a project: queued (position N + cancel), running (phase + progress), interrupted (Run again / Dismiss), failed (details + retry), completed-unseen (Review results) | All states; cancel/retry buttons H/F/P/D | The reference has no job model at all |
| `JobBadge` | Dot/chip for rail, cards, tray | running (pulsing, motion-safe), queued, unseen, failed | — |
| `RunTimeline` | RFC §3 state machine as horizontal steps: Uploading → Analyzing → Routing → Extracting → Supervising → Done, with warning sub-states as inline banners | step states: pending / active (L) / done / warning / failed; K focus on each step shows its event detail | Makes every SSE status visible instead of 5 of 11 |
| `CategoryCard` | One per category during a run; fills in on `partial` with count of parameters found / total | pending (skeleton), filled (160 ms fade+rise), failed (`category_workers_failed`) | The "cards filling in" motion the RFC asks for |
| `ParameterTable` | Grouped rows (§5), sticky category headers with filled/total, density toggle | row H/F/P/selected, K: ↑/↓ move, Enter opens candidates, `f` flag, `a` accept, `s` jump to source, `[`/`]` prev/next anchor, `Esc` closes drawer; `?` opens shortcut sheet | Keyboard-first review (RFC §5b.4); comfortable/compact density |
| `ParameterRow` | Key/alias, value cell, unit, qualifier tag, confidence, flags, actions | see table; read-only variant while that row corrects (L) | Row-level loading only, never table-level |
| `ValueCell` | Value with tabular numerals, original unit beside normalised when `unit ≠ expected_unit`, sign tooltip for `I_MAX_DCH_*`, C-rate vs A chip | editable (F), invalid (danger text + message), D | Implements CLAUDE.md §7 rules the reference cannot |
| `QualifierTag` | MIN / MAX / NOM / SAFETY / PULSE / CONTINUOUS / DYN derived from the parameter key (§6 Review for the rule) | static | Visible qualifier (RFC §4.2) |
| `ConfidenceIndicator` | Ring + percent + label "High/Low", threshold constant | high / low / none ("—", human value) | Icon+label, not colour alone |
| `FlagIndicator` | `auto` (triangle, "Bounds", warning) vs `human` (flag, danger, "Flagged" + reason tooltip); `chained` suffix when known | H/F (tooltip), K | Distinguishes the two flag mechanisms (RFC §4.1) |
| `ReasonCodeChip` | One of the 4 backend reason codes, short label + full text tooltip | static; "No run yet" variant (frontend-derived, labelled as such) | Never a blank cell |
| `CandidateList` | All candidates for a row: value, unit, confidence, source link, select | item H/F/P/selected, K (↑/↓, Enter selects), L while `select-correct-ai-candidate` posts | — |
| `FlagDrawer` | Reason textarea, "Flag", "Flag and re-extract", "Clear flag" | F, D (no reason), L (posting), error inline | Retry starts a correction job in the store, never blocks |
| `SplitPane` | Resizable two-pane with keyboard-resizable separator (`role="separator"`, ←/→ by 16px, Home/End) and persisted ratio | H/F on handle, drag | Keyboard and touch (pointer events) resize; today is mouse-only |
| `DocumentFrame` | Themed chrome (toolbar, sheet tabs, snippet panel, anchor nav) around a light document surface | L (skeleton page), error, `SourceUnavailable` | Light document in dark UI, anchor N of M |
| `SourceUnavailable` | 404/410 state: "Source unavailable, values preserved" + snippet | static | Degrades instead of blank |
| `StatusChip` | Project status `NEW / PENDING_REVIEW / IN_REVIEW / APPROVED` | static | — |
| `DataTable` | Runs, pins, templates, members: sortable header, skeleton rows, empty state | H/F row, K | — |
| `EmptyState` / `ErrorState` | Icon, title, one sentence, primary action | action H/F/P | Every empty/error state has a next action (§8.4) |
| `Skeleton*` | Card, table rows, parameter rows, viewer page | shimmer (motion-safe) | Skeletons instead of spinners |
| `Toast` | Single bottom-left non-blocking notification queue with optional action | auto-hide 6 s, pause on hover, F | "Open" action on job completion, never navigates by itself |
| `ConfirmDialog` / `FormDialog` | Shared dialog shells: `Esc` closes, focus trap, primary button L | — | — |
| `GuidedTour` | Anchored step tooltips (our accent, not red), prev/next, skip, "don't show again" in localStorage | F/K (←/→, Esc) | — |
| `DensityToggle` | comfortable / compact, persisted locally | F/K | — |

---

## 3. The project-scoped job store (§8.1, D11)

### 3.1 Where it lives

- `lib/jobs/` — `types.ts`, `store.ts` (state + reducer), `scheduler.ts` (cap, queue, leases, cross-tab), `runners/upload.ts`, `runners/extraction.ts`, `runners/correction.ts`, `persistence.ts` (localStorage + Dexie), `sse.ts` (reader + event typing), `hooks.ts` (selectors).
- `lib/project-data/` — `store.ts`: `Map<projectId, ProjectState>` where `ProjectState = { details: FullProjectDetails | null, fields: InputField[], documents, liveSpecs (partials during a run), lastFetchedAt, loading: {details, save}, error }`. **This is the D11 fix:** `fields` is per project; a job's results are applied to `state.get(job.projectId)`, never to "whatever is on screen".
- Both stores are plain classes with `subscribe/getSnapshot` consumed through `useSyncExternalStore` with selectors (**plan decision:** no new state library; TanStack Query would not own SSE streams or cross-tab leases, and two mechanisms is worse than one small one). Providers: `JobStoreProvider` and `ProjectDataProvider` mounted in `app/layout.tsx` above the route tree.
- `contexts/ProjectContext.tsx` is retired; its `projects` list moves to `project-data` as `projectsIndex` (from `GET /projects/user/{user_id}`), its `isLoading` disappears (per-operation flags inside `ProjectState`).

### 3.2 Data model

```ts
type JobKind = 'upload' | 'extraction' | 'correction';
type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled';
interface Job {
  id: string; projectId: string; kind: JobKind; status: JobStatus;
  createdAt: number; startedAt?: number; endedAt?: number;
  ownerTabId?: string; leaseExpiresAt?: number;      // running jobs only
  phase?: TimelinePhase;                              // RFC §3 state, extraction/correction
  events: SseEvent[];                                 // typed; capped at 200, oldest dropped
  warnings: SseEvent[];                               // routing_truncated, no_frames_tagged, fallback, category_workers_failed
  progress?: { categoriesDone: string[]; categoriesFailed: string[]; categoriesTotal?: number };
  error?: string;
  seen: boolean;                                      // results viewed in the project
  runId?: string;                                     // Task B; from the first SSE event that carries it
  payload:
    | { kind: 'upload'; fileRefs: { idbId: string; name: string; type: string; size: number }[] }
    | { kind: 'extraction'; mode: 'BLIND' | 'ITERATIVE'; previousSpecs: Record<string, unknown> | null }
    | { kind: 'correction'; parameterKey: string; previousMetrics: unknown[]; userHint: string | null };
}
```

`TimelinePhase = 'uploading' | 'analyzing' | 'routing' | 'routed' | 'extracting' | 'supervising' | 'done' | 'failed'` with warnings as flags, not phases. SSE events are hand-typed in `lib/jobs/sse.ts` from the backend's orchestrator (verified while planning, §11): blind path `error, routing_truncated, routing_complete, no_frames_tagged, category_extraction_fallback, workers_complete, category_workers_failed, partial, complete`; iterative path adds `partial_correction`; single-parameter path emits `targeting, partial_correction, ready_to_save, complete (scope:'single_parameter'), error (with parameter)`. Only `error` and `complete` are terminal; `ready_to_save` is informational (it precedes the route's own DB save).

### 3.3 Persistence

- `localStorage['bda.jobs.v1']` holds every job record except in-memory-only fields (`events` are persisted truncated to the last 20; partial specs are not persisted).
- Upload blobs go to IndexedDB via `lib/db.ts` bumped to **version 2**: table `pendingUploads: 'id, jobId, projectId'` with `{ id, jobId, projectId, name, type, size, blob, createdAt }`. The old `files` table is dropped in the migration (it was never used). Blobs are deleted when the upload job reaches `completed`, `cancelled`, or when an `interrupted` upload is dismissed. A sweep on startup deletes blobs whose job no longer exists.
- On startup each tab: load records; any job with `status: 'running'` whose `leaseExpiresAt < now − LEASE_GRACE` is set to `interrupted` (§3.5). Queued jobs stay queued and the scheduler runs.

### 3.4 Cap, queue, priority (per browser)

- `JOB_CAP = 3` in `lib/jobs/config.ts` (one constant, §8.1). Uploads, extractions and corrections all count.
- Order when a slot frees: **corrections first** (FIFO among corrections), then uploads and extractions FIFO by `createdAt` (§8.3 bullet "correction runs jump the queue").
- **Per-project rule (plan decision):** a project has at most one running `extraction | correction` job; a queued correction for a project whose extraction is running waits behind it even if a slot is free (both would write the same parameters' candidates and the flag chain). Uploads are independent of that rule. The Analyze button is disabled only for the project with a running or queued extraction; per-row "re-extract" is disabled only for a row with a queued/running correction.
- Queue position shown inside the project is computed over the whole browser queue with the same priority rule, so it is what will actually happen.
- Cancel: queued → removed (and its blobs deleted). Running → `AbortController.abort()`, status `cancelled`, banner text "Stopped on this side. The server may have continued; nothing is saved unless the run completed." (§8.3 second bullet, D9). Cancel for running jobs is a secondary, confirm-guarded action.

### 3.5 Cross-tab coordination and leases

- Tab id: `crypto.randomUUID()` in `sessionStorage` (survives reload of the same tab, differs across tabs).
- Shared truth is `localStorage['bda.jobs.v1']`; change propagation is the `storage` event plus `BroadcastChannel('bda-jobs')` for same-tab-origin messages (`storage` does not fire in the writing tab).
- All scheduler mutations run under `navigator.locks.request('bda-jobs-scheduler', ...)` (Web Locks, supported by every browser this app targets; if `navigator.locks` is missing the app degrades to a per-tab cap and shows a one-time notice). Inside the lock: re-read storage, apply the rule in §3.4, claim at most the jobs this tab will start (set `ownerTabId`, `leaseExpiresAt = now + LEASE_MS`), write, release. Two tabs can therefore never start the same queued job.
- **Lease:** `LEASE_MS = 10 000`; the owner renews every 4 s while the job runs. Any tab's scheduler (on timer every 5 s and on every storage change) marks a running job with `leaseExpiresAt < now − 5 000` as `interrupted` with `error: 'The tab running this job was closed or refreshed.'`. On `pagehide`, the owner writes `interrupted` immediately for its running jobs (best effort) and aborts its controllers.
- "Seen": `seen` flips to true when any tab opens that project's Review or Extract screen after completion; it is part of the shared record, so the badge clears everywhere.

### 3.6 Runners and streams

- Each runner is `run(job, ctx: { signal: AbortSignal; emit(event); setPhase; setProgress; }) => Promise<Outcome>`. The SSE reader (`sse.ts`) is the current `analyze-document.ts` loop lifted out, with `AbortController` wired to `fetch` (explore-A §3.1 #17), UTF-8 decoding kept, and an `onEvent` callback instead of status strings.
- Extraction: `POST /specs/stream-specs?project_id=` with `{ current_user: { id }, previous_specs? }`. `partial` → `projectData.applyPartial(projectId, specs)` (throttled at 120 ms as today, but per project). `complete` → `applyFinal(projectId, final_specs)` **then** `applyFlagChain(projectId, flag_chain)` (order preserved from `useAnalyze`, with its comment). Then background `refetchDetails(projectId)`; no navigation; `seen = (project currently open in this tab)`; toast with "Open" otherwise.
- Correction: `POST /specs/stream-parameter?project_id=` with `{ current_user, parameter, previous_metrics, user_hint }`; `targeting` → phase `extracting` with "Re-checking N sections"; `complete` → same apply pair scoped to one key; failure shows in that row and in the project's job banner.
- Upload: reads blobs from IndexedDB, `POST /files/upload-documents/`; response `{ project_id, successful_uploads: {filename, document_id}[], errors: {filename, error}[] }` (shape verified, §11). Partial failures become a `failed` job *only* if nothing succeeded; otherwise `completed` with `warnings` listing the failed files (shown in the Extract documents table). Then `refetchDetails(projectId)`.
- Phase mapping from events (blind): start → `routing`; `routing_truncated` → warning; `routing_complete` → `routed`, then `extracting`; `no_frames_tagged` → warning, stays `extracting`; `category_extraction_fallback` → info warning; `workers_complete` → `supervising`; `partial` → progress; `category_workers_failed` → warning + `categoriesFailed`; `complete` → `done`; `error` → `failed`.

### 3.7 Selectors and badges

`useProjectJobs(projectId)`, `useProjectActivity(projectId) → { running?: Job, queued?: { job, position }, unseenCompleted: Job[], failed: Job[] }`, `useJobTray() → counts across the browser`, `useCanStart(projectId, kind) → { allowed, reason }`. Rail items, project cards and the header tray subscribe to these; no component reads job state from props drilled through pages.

### 3.8 Interface Task B plugs into

```ts
interface JobBackend {
  start(job: Job, ctx: RunContext): Promise<Outcome>;          // Task A: runners above
  resume?(job: Job): Promise<RunStatusSnapshot | null>;        // Task B: GET /extraction-runs/{runId}/status
  cancelRemote?(job: Job): Promise<void>;                      // Task B, if the backend adds it
}
```

The scheduler calls `resume` for a job that would otherwise become `interrupted` when `job.runId` is set and `backend.resume` exists; a non-null snapshot re-attaches the job as `running` in polling mode (`phase` from the snapshot), otherwise it falls back to `interrupted`. `runId` is captured generically from the first event containing `run_id` (Task B adds it), so no Task A code changes except providing `resume`. Partial results during polling come from `refetchDetails`, not from the stream.

---

## 4. App shell and routes (D4)

### 4.1 Routes (`app/`)

| Route | Screen | Notes |
|---|---|---|
| `/` | redirect → `/projects` (or `/login` if no user) | |
| `/login` | Login (username only, A2) | restyled with tokens |
| `/register` | User registration (D3) | linked from login and user menu |
| `/projects` | Projects list | |
| `/projects/[projectId]` | redirect → `.../overview` | |
| `/projects/[projectId]/layout.tsx` | Project shell: header, breadcrumb, rail, content | loads/subscribes `ProjectState`; never blocks on jobs |
| `.../overview` `.../extract` `.../review` `.../parameters` `.../prompts` `.../audit` `.../settings` | §6 | |
| `/admin` | existing audit dashboard, restyled late; label "Admin (no authentication)" | outside the project nav |
| `/dev/gallery` | component gallery, non-production only | |
| `/bda`, `/review` | `next.config.ts` redirects → `/projects` | retired |

A `middleware`-free auth guard: the `(app)` layout reads `useAuth()` and redirects to `/login` when there is no user; while `isLoading` it renders the shell with skeletons, not a spinner.

### 4.2 Shell layout

- Header 56 px: wordmark, breadcrumb (`Projects › {customer.alias_name} › {project.alias_id}`, D6: `details.customer ?? customersIndex.get(details.customer_id)?.alias_name`, else project alone), right side job tray, theme toggle, user menu (username + department, Register user, Admin link, Logout).
- Rail 240 px (collapsible to 64 px, state in localStorage): a project switcher at the top (current alias, dropdown of the user's projects with `JobBadge`s, "All projects" link), then Overview, Extract, Review, Parameters, Prompts & Models, Audit, Settings. Each item renders `useProjectActivity` badges where relevant (Extract: running/queued; Review: unseen results; any: failed).
- Content area scrolls on its own; Review uses full height for the split pane.
- Responsive: ≥1280 desktop rail open; 1024–1279 rail collapsed by default; below 1024 the rail becomes a drawer (laptop width is in scope, phone is not).

### 4.3 Projects list

- Header "Projects" + subtitle, `SearchField` (alias, customer, status), filter chips by status, sort by last activity. Grid of `ProjectCard`s (`GET /projects/user/{user_id}` for the list, `GET /customers/` once for names). Counts on cards that need `GET /projects/{id}` (documents, parameters) are **lazy**: shown as skeleton until that project's details are cached, fetched in the background at most 6 at a time; the list never waits for them.
- First card is "New project" (like the reference's "Custom document" card) → `FormDialog`: alias (required), customer select with inline "Create customer" (`POST /customers/ { alias_name }` only; the "full name" field is dropped because the schema has no `name`, explore-A §3.1 #8), template select (`GET /extraction-templates/user/{user_id}`, default = user's `template_id` or system default), description. `POST /projects/` with `{ alias_id, description, customer_id, user_id, template_id }` only. On success navigate to the new project's Extract (the only navigation-on-completion in the app, and it is a user action, not a job).
- Empty state: "No projects yet" + the same dialog, plus the guided tour's first step. Error state: retry.

---

## 5. Category grouping (D5, §8.2)

- `lib/categories.ts`: `KNOWN_CATEGORIES = [['VOLTAGE','Voltage'],['CURRENT','Current'],['TEMPERATURE','Temperature'],['CAPACITY','Capacity'],['END_OF_LIFE','End of life']]`; `humanizeCategory('SAFETY_LIMITS') → 'Safety limits'`; `OTHER = { key: '__OTHER__', label: 'Other' }`.
- `useCanonicalParameters()` loads `GET /extraction-templates/parameters` once per session into the data store (`CanonicalParameter[]`, typed in openapi: `id, name, category, default_description, expected_unit`). `groupFields(fields, canonical)`: for each field, `category = canonicalByName.get(field.id)?.category ?? null`; null → Other. Groups ordered: known in the fixed order, then unknown categories alphabetically, then Other. **Known categories always render**, even with zero parameters, showing an empty-state row "No parameters in this category · Add in Parameters". Unknown and Other render only when non-empty. Parameters with no value render with their `ReasonCodeChip` (never hidden).
- Until the canonical list has loaded, rows render under a single "Loading categories…" skeleton header; the table itself is already usable (the join only affects headers).
- `SCHEMA_GROUPS` and both label maps in `lib/parameter-adapter.ts` are deleted; labels come from `parameter_alias` (fallback `parameter_key`); default units come from `expected_unit` of the canonical row (fallback: the selected candidate's `expected_unit`).
- The `.battery` exporter (D8) gets its own `BATTERY_EXPORT_KEYS` map inside `static/battery-template.ts` (the keys it already uses, listed explicitly) and a pre-export check listing required keys with no value; it no longer imports `SCHEMA_GROUPS`.

---

## 6. Screens

Conventions: **Routes** are exact `openapi.json` paths. **Types** are hand-written per D10 in `api/types/*.ts`, each with a header comment `// Hand-written from BDA src/db/types/<file>.py for <route>; replace with generated types in Task B.` "Placeholder" means a clearly labelled UI block with no backend call, and a line in that step's history note.

### 6.1 Projects (`/projects`) — see §4.3

Routes: `GET /projects/user/{user_id}`, `GET /customers/`, `GET /extraction-templates/user/{user_id}`, `POST /projects/`, `POST /customers/`. Types: `ProjectBase { id, alias_id, description, customer (always null today, §11), status: 'NEW'|'PENDING_REVIEW'|'IN_REVIEW'|'APPROVED', created_at, source_template_id, customer_id }`, `CustomerResponse` (typed), `ExtractionTemplateBase` (typed; fix the client to match, §7). States: skeleton grid; empty; error+retry; create dialog errors inline (400 text from the backend).

### 6.2 Overview (`.../overview`)

- Cards: status (`StatusChip`), documents count + analysed count, parameters (with value / needing review = low confidence or any flag / empty with reason), last extraction run (type, run number, date, model), current job banner.
- Actions: "Upload & extract" → Extract; "Review" → Review; "Change status" (`POST /projects/update-project-status`, **form-encoded**, values from the enum).
- Routes: `GET /projects/{project_id}` (type `FullProjectDetails`, §11), `GET /projects/{project_id}/extraction-runs` (typed `ExtractionRun[]`). States: skeleton cards; error+retry; "no runs yet" empty card with the Extract action.

### 6.3 Extract (`.../extract`)

- Tabs: **Extract** and **Runs** (the reference's Live Test / Documents History).
- Extract tab: `Dropzone` (accept `.pdf,.xlsx,.xlsm`; `.doc/.docx/.jpg/.png` are removed from the accept list because the backend analyser handles PDF and Excel only, §11) → creates an upload job. Documents table from `details.documents` (name, type, analysed, "view in Review" link) plus rows for in-flight uploads with per-file status and the upload warnings. Analyze button → extraction job; shows "Correction (ITERATIVE)" badge and the list of flagged parameters when `fields.some(isFlagged)` (then `previous_specs` is sent, logic kept from `useAnalyze`/`mapFieldsToSpecs`). `JobBanner` for the project's queued/running/interrupted/failed job, `RunTimeline`, `CategoryCard`s (one per category from §5, filled by `partial.category`), warnings as banners (cap text: "Cap reached: {kept} of {total_tagged} assignments kept" → explains "not searched: cap reached").
- Runs tab: `DataTable` of `GET /projects/{project_id}/extraction-runs?extraction_type=` with filter chips `MAIN_MULTI_AGENT / ITERATIVE / SINGLE_PARAM`.
- Routes: `POST /files/upload-documents/`, `POST /specs/stream-specs`, `GET /projects/{project_id}/extraction-runs`, `GET /projects/{project_id}`. States: no documents (dropzone is the empty state); analyze disabled only when no documents, or this project has a queued/running extraction; stream failure → failed banner with the backend `message` and "Run again".

### 6.4 Review (`.../review`)

Layout: `SplitPane` — left `ParameterTable`, right `DocumentFrame`; header row with project status, counts (needs review / flagged / empty), density toggle, **Save** (explicit, `PUT /projects/{id}/parameters`), **Approve** (`POST /projects/{id}/approve`, confirm dialog, disabled when any open human flag — **plan decision**, veto if approve should not be gated), **Export .battery** (D8), shortcuts help `?`.

Row model and state mapping (verified against backend shapes, §11):

| RFC state | Source in the payload |
|---|---|
| High confidence | selected candidate `confidence ≥ 0.85` |
| Low confidence | `< 0.85`; sorted to the top within its category when "Needs review first" sort is on (default on) |
| Auto-flag "Bounds" | selected candidate `rule_violations?.length > 0 \|\| requires_review` (the stream's `is_flagged` from `_flag_out_of_bounds` is not a stored column; after reload only these two survive — recorded as a Task B question) |
| Human flag | `human_flagged && active_flag_id`; chain depth is **placeholder** ("chained" badge only when the lineage call has been opened for that row; depth itself is not in the project payload) |
| Empty with reason | a candidate with `ai_value === null` whose `extraction_logic` starts with one of the 4 reason strings (`not searched: no document frame`, `not searched: cap reached`, `searched, absent`, `category workers failed`) → `ReasonCodeChip`; no candidates at all → "No run yet" (frontend-derived, labelled) |
| Human-modified | `is_human_modified` → pencil; hover shows the selected candidate's `ai_value unit` |

Battery display rules (CLAUDE.md §7): original unit = candidate `unit`; when `expected_unit` differs, show "as extracted: {unit}" beside it and never convert; `I_MAX_DCH_*` keys get the sign tooltip and the value is shown with its sign; C-rate vs absolute: unit string `C` (or matching `/^\d*(\.\d+)?C$/` in the value) → "C-rate" chip, `A`/`mA` → "A" chip, else no chip; **qualifier tag is derived from the parameter key** (`_MIN`→MIN, `_MAX`→MAX, `NOMINAL`→NOM, plus `SAFETY`, `PULSE`, `CONTINUOUS`, `DYN` as secondary tags) because the backend has no qualifier field (§11) — the tag's tooltip says "from parameter key".

Actions (existing logic ported from `ParameterManager`/`useAnalyzeParameter` with their comments): select candidate (`POST /flagging/select-correct-ai-candidate` only when the row has an open flag and the candidate has an id, as today), edit value/unit (marks MODIFIED), flag / clear flag (§7 H1 for the no-candidate case), flag-and-re-extract → correction job, accept (sets `review_action` ACCEPTED locally; persisted by Save), jump to source. Flag changes still persist immediately via the batch save (behaviour kept: "persist-on-flag").

Viewer: active document = the selected row's `source.documentId`, else the first document; fetched lazily per document via `GET /documents/{doc_id}/file` as a blob URL cached in `ProjectState` (D7); 404/410 → `SourceUnavailable`. Anchor navigation per §8.

Routes: `GET /projects/{project_id}`, `GET /documents/{doc_id}/file`, `PUT /projects/{project_id}/parameters`, `POST /projects/{project_id}/approve`, `POST /flagging/ai-flag-parameter`, `POST /flagging/ai-unflag-parameter`, `POST /flagging/select-correct-ai-candidate`, `POST /specs/stream-parameter`, `GET /extraction-templates/parameters` (§5). States: skeleton rows + skeleton page; no parameters → empty state → Parameters; no documents → viewer empty state → Extract; save error inline in the header with retry; approve success toast.

### 6.5 Parameters (`.../parameters`)

- Left: the project's parameter list grouped per §5 with inline edit of `parameter_alias`, `description_override`, `ai_instructions` (`PATCH /projects/project-parameter/{project_parameter_id}/`, **with trailing slash**, §7), remove (`DELETE /projects/project-parameter/{project_parameter_id}/remove`, confirm). **Add parameter: placeholder.** The backend route `PUT /projects/project-parameter/{id}/add` passes one argument to a four-argument DB function and 500s (§11); the UI shows the canonical dictionary with an "Add (unavailable: backend route broken)" disabled action and records the gap.
- Right: templates. List `GET /extraction-templates/user/{user_id}`, detail `GET /extraction-templates/{template_id}` (rules with `canonical_name`), create `POST /extraction-templates/`, rule upsert `PUT /extraction-templates/{template_id}/rules`, delete `DELETE /extraction-templates/{template_id}`, **Save project as template** `POST /extraction-templates/from-project`. `TemplatesManager` is kept and split into these panels with tokens applied.
- States: skeleton list; empty templates → "Create your first template"; errors inline.

### 6.6 Prompts & Models (`.../prompts`)

- **Pinned prompts** table: `GET /projects/{project_id}/prompt-pins` (`PinDetail[]`, typed): slot key, level, version number, model/effort/temperature, `is_lazy` chip ("Pinned lazily during a correction" tooltip), pinned at, expandable content.
- **Resolution preview**: `GET /projects/{project_id}/prompt-resolution` (`ProjectPromptResolution`, typed): `already_pinned` banner, per-slot resolved scope chip (`GLOBAL / CUSTOMER / PROJECT`) and content.
- **Registry (read-only)**: `GET /prompts/slots` (`SlotSummary[]`), versions on expand `GET /prompts/slots/{slot_key}/versions`.
- Editing (create version, set assignment / model assignment at any scope) is behind `NEXT_PUBLIC_ENABLE_PROMPT_ADMIN=true` and shown with a persistent "No authentication: anyone can change this" banner (RFC §5 P1). Task A ships read-only; the write forms are a Task B step.
- States: no pins → "Pinned at the first extraction run" empty state linking to Extract; error+retry.

### 6.7 Audit (`.../audit`)

- Tabs: **Parameters** (`GET /audit/project/{project_id}` → `{ summary: ParameterSummary[] }`, typed from `src/db/types/audit.py`): table with candidates/flags/runs counts, row expands to **Lineage** (`GET /audit/project/{project_id}/parameter/{parameter_key}/lineage` → `{ lineage: ParameterLineageResponse }`, existing `ParameterLineage` component restyled, events show flag type `AI_CORRETION` (sic, backend spelling) as "Auto" and `HUMAN_REVIEW` as "Human"); **Runs** (shared `DataTable` from Extract); **Feedback** (`GET /audit/feedback/{project_id}`, existing `FeedbackArea`).
- **Flags list across the project: placeholder** (no project-level flags route; flags are visible per parameter in lineage).

### 6.8 Settings (`.../settings`)

- Appearance: Light / Dark / System segmented control (§1.1), persisted (backend `PUT /auth/update-user-settings` when logged in).
- Members: **Add contributor** (`POST /projects/{project_id}/contributors { username }`), **Add auditor** (`POST /projects/{project_id}/auditors { username }`), 404 → "User not found". **Member list: placeholder** (no GET route).
- Project: status change (`POST /projects/update-project-status`, form-encoded), description (read-only; no update route), template used (`source_template_id` → name via templates list).
- Review preferences (local): density, "needs review first", confidence threshold display (read-only in Task A; the RFC's open question 1).

### 6.9 User registration (`/register`, D3) and Login (`/login`)

- Register: `username` (required, ≤255), `department` select with exactly `Zelle`, `Module`, `Pack`; `POST /auth/register-user` with only those two fields; 409 → "Username already exists"; success → login prefilled. No email/password fields.
- Login: `GET /auth/user?username=`; response type `UserWithSettings { id, username, department, created_at, template_id, theme, lang, settings_last_updated_at }` (from `src/db/types/users.py`); 404 → "User does not exist · Register". `AuthContext` keeps storing the user locally (A2) but applies `theme`.

### 6.10 Admin (`/admin`)

Kept as is functionally; step 14 applies tokens to `GlobalOverview` (replacing the pastel cards and Recharts fills with status tokens), labels the page "Admin · no authentication", and links `ProjectSummary` rows to `/projects/[id]/audit`.

---

## 7. Contract fixes (from explore-A §3.1)

| Priority | Fix | Step |
|---|---|---|
| **High** H1 | **Lost human flags.** `AIFlagRequest.ai_metric_candidate_id` is required. New rule in the data store: if the row's selected spec has a `candidateId`, call `POST /flagging/ai-flag-parameter`; if it has none (human-entered value), persist the flag through `PUT /projects/{id}/parameters` with `flag: true, flag_reason, flagger_id` (the batch save supports inline flag/unflag, §11) and show the row as flagged without a ticket id. Every failure surfaces as a row error + toast; nothing is swallowed. | 2a |
| **High** H2 | `CanonicalParameter` client type → `{ id, name, category, default_description, expected_unit }`. | 2a (needed by §5) |
| **High** H3 | Registration per D3. | 4 |
| High | `final_value` data loss: `ParameterInput.final_value: number \| string \| null`; send the string when `Number()` is `NaN`. | 4 |
| Medium | `PATCH /projects/project-parameter/{id}/` trailing slash. | 4 |
| Medium | Upload response `errors: { filename: string; error: string }[]`, surfaced in the UI. | 2a |
| Medium | `ProjectCreateInput` → schema fields only; `create_customer(alias_name)` only. | 4 |
| Medium | `TemplateRule.canonical_name` added; `ExtractionTemplateBase.updated_at` removed; nullable fields typed `\| null`. | 4 |
| Medium | `AbortController` on both streams. | 2a |
| Low | Delete `api/chat.ts`, `api/admin/users.ts`, `components/source-modal.tsx`, `types/admin.ts`, `components/Loading.tsx`, `components/DocumentViewer/DocumentViewer.tsx`. | 4 |
| Low | `api/audit/feedback.ts` `total`: use `data.total` if present else `feedbacks.length`, and stop hardcoding `limit: 5`. | 13 |
| Doc | `api/config.ts` reads `NEXT_PUBLIC_API_URL`, which is correct for a browser bundle and matches the Dockerfile; **CLAUDE.md §4 is wrong** and is corrected in step 4 (explore-A #15 was a doc bug, not a code bug). | 4 |
| Doc | `ParameterInput.parameter_key` (extra, ignored) is dropped. | 4 |

---

## 8. Viewers: extend, don't rewrite

- **`DocumentFrame`** wraps both viewers: themed toolbar (zoom, reset, fullscreen, anchor nav "Source 1 of 2 · Page 4" with ‹ ›), sheet tabs for Excel, snippet panel. The inner surface uses the mode-invariant `document.*` tokens (§1.5): the PDF canvas and the spreadsheet grid are light in both modes; chrome follows the theme.
- **Highlight colours** use `highlight.stroke/fill/dim/pageOutline` (§1.5), replacing the four hardcoded `rgba(25,118,210,…)` and the `9999px` box-shadow. Checked on white by the step-1 script; checked visually on BHV/CFC/DAM in step 9 in both modes.
- **PDF worker served locally (R11):** add `"prepare": "node scripts/copy-pdf-worker.mjs"` copying `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/pdf.worker.min.mjs` (gitignored), and `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`. The Dockerfile already copies `public/`.
- **Coordinate calibration (R5):** the backend's PDF bboxes are `[l, t, r, b]` in PDF points with a **bottom-left origin** (its own debug drawer does `page_height − y1`, §11), so the current y-flip in `PdfViewer.getHighlightStyle` is right in principle; the normalised-vs-pixel guess (`x <= 1`) is removed (values are always points). Step 9 does one visual calibration per producer (BHV/CFC/DAM) and records offsets. The padding constants become theme-independent `HIGHLIGHT_PAD = 6` px, not 20.
- **Anchor 1 of N (CFC):** `anchors(field) = distinct (documentId, pageNumber, bbox|cell)` across the field's candidates, selected candidate first; ‹ › and `[`/`]` cycle; the table row shows "2 sources". A single candidate has one anchor (the data model has one source per candidate, §11), so "two pages for one parameter" appears as two candidates.
- **Excel merged cells (BHV):** read `worksheet['!merges']`, build a `coveredBy` map, render anchors with `rowSpan/colSpan` and skip covered cells; a highlight whose `cellCoordinates` falls inside a merged region resolves to the region's anchor and spans the region. `.xlsm` is read with `XLSX.read(data, { type: 'array', bookVBA: false, cellFormula: false, cellHTML: false })` (data only). Sheet choice: `tableName` if it names a sheet, else today's `pageNumber` heuristic (kept, documented as a guess). Large sheets: render the used range only; virtualisation deferred (risk noted).
- **DAM fallback:** page-level outline + snippet (exists) kept; the `pageOnlyHighlight` branch becomes a labelled state "Approximate location: page N".
- **Scanned-page / `row: -1` cells:** the backend writes `{row: -1, column: -1}` when it cannot resolve a cell (§11); the viewer treats it as "sheet-level" and shows the snippet panel only.
- **Source unavailable:** `fetch` 404/410 → `SourceUnavailable` with the snippet; the row's "jump" button shows the same state inline.
- Removed: `console.log`s, the second `fetch` of the blob URL in `ExcelViewer` (the blob is already in memory; pass the `ArrayBuffer`), the unused `DocumentViewer.tsx`.
- `useResizer` → `SplitPane` (§2) with `role="separator"`, keyboard and pointer events; width stored as a ratio, so the sidebar width is no longer baked into the maths.

---

## 9. Ordered steps

Each step: build + lint pass, commit, history note, stop (§0.2). "Checks" names the §8 rules it must demonstrate in its note. "Retires" names explore-A risks R1–R12 it closes or narrows.

| # | Step | Scope and files | Retires | Checks |
|---|---|---|---|---|
| **1** | **Tokens + both modes + Tailwind removal** | `theme/theme.ts` (colorSchemes, augmentation), `theme/layout.ts`, `app/layout.tsx` (single provider, `InitColorSchemeScript`, Inter), `app/globals.css` reduced, delete `postcss.config.mjs`, package.json deps, `theme/colors.ts` → deprecated shim, ESLint warning rule, `scripts/contrast-check.mjs`, `ThemeToggle` + `useThemePreference` (backend persistence), remove per-page providers and the `MuiPaper` override. Old screens still render (shim). | R6 (narrowed: tokens exist; viewers done in 9), styling debt §4.1/.6/.7/.11/.12 | 8.3 (both modes visible on old screens, OS default, persistence), 8.4 motion + focus ring |
| **2a** | **Job store + per-project data (D11 fix) + H1/H2** | `lib/jobs/*` (store, runners, sse, config), `lib/project-data/*`, `api/types/*` for the routes used, `contexts/ProjectContext.tsx` retired, `hooks/useAnalyze*.ts` deleted, `hooks/ParameterManager.tsx`/`DocumentManager.tsx` rewritten as thin hooks over the stores, `app/bda/page.tsx` rewired: no early-return spinner, no `readOnly` on analyze, Analyze disabled only for its project, `JobBanner` shown inline. H1 lost-flag fix, H2 type, upload `errors` type, `AbortController`. In-tab cap and queue (cross-tab in 2b). **History note must state the D11 bug is fixed and how it was reproduced** (start a run on A, switch to B, confirm B's rows unchanged). | **R2**, R4 (abort exists; cancel semantics per §8.3), R10 (selectors), part of R7 (`applyFlagChain` ordering ported with comments) | 8.1 (switch projects during a run; results land in the right project; no app-wide disabled state) |
| **2b** | **Per-browser cap, leases, persistence** | `lib/jobs/scheduler.ts` (Web Locks, BroadcastChannel, leases), `lib/jobs/persistence.ts`, `lib/db.ts` v2 (`pendingUploads`), interrupted state + Run again, queue survives refresh, correction priority, per-project rule. | **R3** | 8.1 (two tabs: cap shared, queued job starts in the other tab when a slot frees, refresh → queued upload survives, running → Interrupted) |
| **3** | **App shell + routes (D4)** | `app/projects/page.tsx` (list, cards, search, New project dialog), `app/projects/[projectId]/layout.tsx` (header, breadcrumb D6, rail with badges), stub pages for the 7 tabs, `/review` route mounts the current editor body as the interim, `next.config.ts` redirects, delete `app/bda`, `app/review`, `components/ProjectsSideBar/*`, `components/Sidebar.tsx`, `ProjectBar`, `LayoutHeader`, `ActionToolbar`, `NoProjectsScreen`. CLAUDE.md §5 rewritten. | R8 (docs), R12 (labels) | 8.1 (badges in rail and cards), 8.3, 8.4 (rail keyboard) |
| **4** | **Contract fixes + registration (D3)** | `api/*.ts` fixes from §7, `/register` page, login restyle, delete dead files, CLAUDE.md §4 env-var correction. | R1 (narrowed: hand-written types with route comments), R8 | 8.3, 8.4 (forms) |
| **5** | **Component library + gallery** | `components/ui/*` primitives from §2 (not the screen-specific ones), `app/dev/gallery`. | — | 8.3 + 8.4 for every primitive (gallery screenshots in both modes noted) |
| **6** | **Projects list, final** | Replace step-3 cards with lazy counts, status filters, guided tour step 1, empty/error states. | — | 8.1 (lazy fetch cap), 8.4 |
| **7** | **Extract screen** | `Dropzone`, documents table, `JobBanner`, `RunTimeline`, `CategoryCard`s (§5 categories), warnings, Runs tab. | R4 (UI side), explore-A §2 Extract gap | 8.1, 8.2 (category cards from data incl. END_OF_LIFE), 8.3, 8.4 |
| **8** | **Review 1: table** | `ParameterTable`, `ParameterRow`, `ValueCell`, `QualifierTag`, `ConfidenceIndicator`, `FlagIndicator`, `ReasonCodeChip`, `CandidateList`, density, keyboard, "needs review first", Export (D8 with explicit key map and missing-keys check), `SCHEMA_GROUPS` deleted. CLAUDE.md §5 data-model section updated. | R7 (second half) | 8.2 (empty category renders; unknown category appended; Other), §7 display rules, 8.4 keyboard |
| **9** | **Review 2: viewers + split pane** | `DocumentFrame`, `SplitPane`, PDF worker local, highlight tokens, anchor N of M, merged cells, `.xlsm` data-only, `SourceUnavailable`, calibration on BHV/CFC/DAM recorded. | **R5**, **R6**, **R11** | 8.3 (light document in dark mode; highlight contrast), 8.4 (separator keyboard) |
| **10** | **Review 3: HITL actions** | `FlagDrawer`, flag/clear/retry (correction job), select candidate, accept, Save, Approve, toasts; row-level loading only. | R7 closed | 8.1 (correction never blocks other rows/projects), 8.4 |
| **11** | **Parameters screen** | Project parameter edit/remove, add placeholder, templates panels (`TemplatesManager` restyled and split), save-as-template. | — | 8.2, 8.3, 8.4 |
| **12** | **Overview + Settings** | Overview cards, status change; Settings appearance control (main control per §8.3), members add forms + placeholder list, preferences. | — | 8.3 (Settings control + persistence), 8.4 |
| **13** | **Prompts & Models (read-only) + Audit** | Pins, resolution, registry read-only, feature-flag banner; Audit tabs with lineage/runs/feedback; feedback `total` fix. | explore-A §2 Prompts/Audit gaps | 8.3, 8.4 |
| **14** | **Admin restyle + cleanup** | `/admin` tokens and label, delete `theme/colors.ts`, ESLint rule → error, remove remaining `console.log`s, final both-mode sweep at 1280 and 1440, CLAUDE.md §5/§6 final. | styling debt closed, R8 | 8.3 full sweep |

Rough size: 1, 2b, 4, 6, 12 are small; 2a, 3, 5, 7, 8, 9, 10, 11, 13 are one-sitting-each but dense; 14 is small. If 2a proves too large in practice, split it at "stores + runners (no UI rewiring)" / "rewire `/bda`", keeping the H1 fix in the first half.

---

## 10. Where this plan disagrees with explore-A

1. **explore-A §3.1 #15 (env var):** called `NEXT_PUBLIC_API_URL` a mismatch. The code is right (browser bundles can only read `NEXT_PUBLIC_*`, and the Dockerfile sets exactly that); CLAUDE.md §4 is what is wrong. Plan fixes the doc, not the code.
2. **explore-A §3.1 #19 (`file_url`):** flagged as unverified. Verified: the backend injects `file_url = /documents/{id}/file`, identical to the route. Not a mismatch; D7 still applies (fetch lazily, handle 404/410).
3. **explore-A R5 (y-flip unverified):** the backend's own debug drawer flips with `page_height − y1`, so the bottom-left-origin assumption is correct. Calibration stays, but it is a check, not an open question. The "normalised 0–1" guess in the viewer is wrong and is removed.
4. **explore-A §6 #7 ("add `category` to `ProjectParameter`"):** D5 decided the join; the plan goes further: the hand-written `FullProjectParameter` type **must not** declare `category`, because the SQL does not select it (§11). Declaring it would be inventing a field.
5. **explore-A §1.2 Admin "extend":** the plan keeps `/admin` nearly untouched (restyle + label) because project-scoped audit moves into the Audit tab; investing in `/admin` would duplicate it.
6. **explore-A Q5 (cap for corrections):** answered by CLAUDE.md §8.3 bullets; the plan adds the per-project serialisation rule, which explore-A did not consider (two concurrent writers on one project's flag chain).
7. **explore-A §2 "Review: approve"**: explore-A did not note that `review_action` on the backend is an enum `ACCEPTED | MODIFIED | REJECTED` while the frontend uses `PENDING` as a default; the plan keeps `PENDING` client-side only and never sends it in `review_action` unless the backend accepts it — step 4 confirms by reading the batch-save SQL and records the answer.
8. **Things explore-A missed** (found while planning, now in §11): upload `errors` are objects; the single-parameter stream has `targeting` and `ready_to_save`; reason codes live in `extraction_logic` of a null-valued candidate; `BatteryMetric` has no qualifier or C-rate field; `ProjectBase.customer` is always null; the `add` project-parameter route is broken server-side.

---

## 11. Facts verified against the backend while planning (for D10 types and placeholders)

Read from `BDA/src/**` on 2026-10-09; each is the source for a hand-written type or a placeholder decision.

| Fact | Where |
|---|---|
| `GET /projects/{id}` returns `FullProjectDetailsOutput`: `ProjectBaseOutput` fields (`id, alias_id, description, customer, status, created_at, source_template_id, customer_id`) + `documents[] {id, name, path, type, analyzed, file_url}` + `parameters[]` (`FullProjectParameterOutput`: `id, parameter_key, parameter_alias, final_value (Decimal), final_unit, is_human_modified, selected_candidate_id, review_action, reviewed_at, human_flagged, active_flag_id, flag_reason, flagger_id, description_override, ai_instructions, confidence, source_text_snippet, source_page_number, candidates[]`). The SQL also returns `description` (COALESCE of override and default) which the Pydantic model drops. **No `category`.** `customer` is never populated (`SELECT *` on `projects`, which has no such column). Parameters are ordered by `p.category, p.name` server-side. | `src/db/types/projects.py`, `src/db/projects.py:256-375` |
| `AiMetricCandidateOutput`: `id, project_id, ai_value (Decimal), unit, expected_unit, confidence (0–1), is_calculated, calculation_logic, extraction_logic, requires_review, rule_violations[], source_document_id, source_text_snippet, source_reason, source_anchor, source_page_number, source_bounding_box {x0,y0,x1,y1}, source_table_name, source_cell_coordinates {row, column}, created_at, param_name, extraction_run_id, run_number`. | same; `src/db/ai_parameters.py:313-314` |
| Reason codes: gap-fill writes `BatteryMetric(value=None, confidence=0.0, extraction_logic=<reason string>, requires_review=True)`; the 4 strings are in `src/engine/reason_codes.py`. | `src/engine/unrouted_parameters.py:46-55` |
| `BatteryMetric` fields: `extraction_logic, source_anchor, value, unit, id, expected_unit, confidence, source {documentId, textSnippet, reason, pageNumber, boundingBox, tableName, cellCoordinates}, is_calculated, calculation_logic, requires_review, rule_violations, is_flagged, flag_reason, active_flag_id, custom_alias, project_parameter_id, extraction_run_id`. **No qualifier (min/typ/max) and no C-rate field.** | `src/schemas/specs.py` |
| PDF bbox: `[l, t, r, b]` points, bottom-left origin (debug drawer: `fitz_y0 = page_height − y1`). Cells: `{row, column}`, `{-1,-1}` when unresolved. | `src/preprocessor/analyzer/analyzer.py:175,307,430-443`; `src/engine/traceability_hydrator.py:61-92` |
| Upload response: `{ project_id, successful_uploads: [...], errors: [{filename, error}] }`; all-failed → 500 `{message, errors}`. | `src/api_routes/upload_files.py:56-114` |
| SSE statuses, blind: `error, routing_truncated{total_tagged,cap,kept}, routing_complete{assignments}, no_frames_tagged, category_extraction_fallback{planned_calls,limit}, workers_complete{worker_count,results_with_specs}, category_workers_failed{categories}, partial{category,specs}, complete{final_specs, flag_chain}`. Iterative adds `partial_correction{parameter,specs}`. Single-parameter: `targeting{parameter,category,frame_count}`, `partial_correction`, `ready_to_save{parameter,final_specs,model_name,…}`, `complete{scope:'single_parameter',parameter,final_specs,flag_chain}`, `error{parameter,message}`. | `src/engine/orchestrator.py`, `src/api_routes/extract_specs.py:134-222, 325-376` |
| `GET /auth/user` → `UserWithSettingsOutput {id, username, department, created_at, template_id, theme, lang, settings_last_updated_at}`; `POST /auth/register-user` → 201 or 409. | `src/db/types/users.py`, `src/api_routes/users.py` |
| Audit: `GET /audit/project/{id}` → `{summary: ParameterSummary[]}`; lineage → `{lineage: ParameterLineageResponse}` (matches the existing `types/audit.ts`). | `src/db/types/audit.py`, `src/api_routes/audit.py` |
| Enums: `project_status_enum = NEW, PENDING_REVIEW, IN_REVIEW, APPROVED`; `review_action_enum = ACCEPTED, MODIFIED, REJECTED`; `ai_parameter_flags.flag_type ∈ {AI_CORRETION, HUMAN_REVIEW}`; `department_enum = Zelle, Module, Pack`. | `DB/migrations/20260821000000_schema.sql` |
| `GET /documents/{doc_id}/file` → `FileResponse`; 404 both for missing metadata and missing file (no 410 yet, RFC §5 P1). | `src/api_routes/utils/documents.py` |
| `PUT /projects/project-parameter/{id}/add` is broken: route passes `(conn, project_parameter_id)` to a function requiring `(conn, project_id, template_id, parameter_id)`. | `src/api_routes/projects.py:211-222`, `src/db/projects.py:161` |
| Batch save `PUT /projects/{id}/parameters` accepts inline `flag/flag_reason/flagger_id` per parameter (basis for H1). | backend summary §7; `ParameterInput` schema |
| Analyser handles PDF (opendataloader + fitz) and Excel (Docling) only. | backend summary §3 |
