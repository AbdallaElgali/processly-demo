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
9. **Never edit source files while an extraction run depends on a dev-server tab.** An edit triggers Fast Refresh, which can reload the page and abort the stream: the run saves nothing (D9) but has already spent tokens (it happened in step 9b). Finish the code first, then start test runs, and do not touch source files until they have reached `complete`.

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
                        # Vitest's Vite needs Node >= 20.19; on 20.17 run it as
                        # NODE_OPTIONS=--experimental-require-module npm test
npm run check:contrast  # Assert the WCAG ratios of theme/tokens.json (must pass)
```

`npm test` covers the pure logic only — the job scheduler's cap/priority/FIFO
rules, the job reducer, the SSE-to-phase mapping, the per-project data
guarantee, the review rules, (step 9) PDF highlight geometry, source
anchors and the document prefetch store, (step 9b) workbook parsing,
Excel source regions and value matching, and the grid geometry, and (step 10)
review edits, the unsaved-edit merge, the Approve gate and "Why this value".

`npm run dev` and `npm run build` first copy the pdf.js worker, CMaps and fonts
into `public/pdfjs/` (`predev`/`prebuild`); the folder is gitignored. UI is verified in the browser and the dev gallery, not here.

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
| `/projects/[projectId]/{overview,workspace,parameters,prompts,audit,settings}` | The project tabs. `extract` and `review` redirect to `workspace` (AM11, `next.config.ts`) |
| `/admin` | Admin dashboard, outside the project nav, labelled "Admin · no authentication" (see Admin below) |
| `/dev/gallery` | Dev-only component gallery (tokens plus every `components/ui/` primitive, both modes); 404s in production. Absorbed `/dev/theme` in step 5. |

`/bda` and `/review` are retired and redirect to `/projects` (`next.config.ts`).

**All six project tabs are real screens** (Prompts and Audit since step 13). Their sub-tabs live in `?tab=` (`components/ui/SectionTabs.tsx`), so a link can open one: the Workspace's "Runs" button opens `audit?tab=runs`.

### Workspace (`app/projects/[projectId]/workspace/`, step 8, AM11/AM14)
Extract and Review are one screen. **Toolbar:** Add documents (file picker) · Analyze (blind, or iterative when rows are flagged; gated by `useCanStart`) · `JobStatusLine` (the project's job as one line; click opens the full `JobBanner` with `RunTimeline` in a popover) · Runs (→ Audit) · Save (only rows with unsaved edits, "Save (N)") · Approve (confirmation; disabled while a human flag is open, a parameter-writing job is queued or running, or nothing is pending; auto-flags only warn in the dialog) · Export .battery. **Body**, full-bleed: with no documents, the whole body is the `Dropzone`; otherwise a `SplitPane` (`components/ui/SplitPane.tsx`, ratio persisted, keyboard separator) with `ParameterTable` left and the viewer side right: `DocumentTabs`, `SourceBar` (when a source is shown) and `DocumentViewport` (see Document viewers below). Dropping files anywhere on the screen shows a full-area overlay and uploads. `components/workspace/` holds `ParameterTable`, `ParameterRow` (row + detail: candidates each with its own "Why", `WhyThisValue` for the selected one, value edit with Extracted/Revert, review actions; a busy row shows its own label and nothing else is disabled), `WhyThisValue` (AM15: the model's explanation, note on the source and calculation, labelled as the model's text, not a quote (B13); the source text and location as the evidence; "No reasoning recorded" when empty), `ValueCell`, `indicators.tsx` (`QualifierTags`, `ConfidenceIndicator`, `StateBadge`, `SecondaryFacts`), `JobStatusLine`, `DocumentTabs`, `DocumentViewport`, `SourceBar`, `RunTimeline`, `RunsTab`. **No custom keyboard shortcuts (AM19):** only standard keyboard operation (Tab, Enter/Space, Escape, arrow keys in lists, tabs, tables and the Excel grid). This holds app-wide since the step 10 brief removed `/` from the projects search.
- **Pure review logic** in `lib/review/` (unit-tested in `review.test.ts`, `export.test.ts`): `rowState.ts` (AM1 precedence, one primary state per row, secondary facts; `requires_review` is never "Bounds"), `reasonCodes.ts` (the four backend strings copied from `BDA/src/engine/reason_codes.py`, prefix match only, AM6), `format.ts` (display rounding to 6 significant digits, AM10; Save never sends the rounded value), `domain.ts` (qualifier tags from the key, C-rate vs absolute, discharge sign, unit-differs), `confidence.ts` (`CONFIDENCE_HIGH = 85` on the UI's 0-100 scale).
- **Review actions (step 10)** in `lib/review/actions.ts`: plain functions keyed by `projectId` (not hooks), so an action that is still posting when the user leaves lands in its own project. Flag (reason required), remove flag (DISMISSED), flag and re-extract, re-extract (a `correction` job), choose candidate (`select-correct-ai-candidate` when the row is flagged), edit/revert, Accept (resolves an open flag, then saves that row), Save, Save-and-approve. Pure parts are unit-tested in `hitl.test.ts`: `edits.ts` (edit keeps the candidate's `original`; Revert; choosing another candidate drops an edit; `mergeLocalEdits`), `approval.ts` (the Approve gate), `why.ts`. **What persists where:** flags through `/flagging/*` at once; value, unit and chosen candidate through `PUT /projects/{id}/parameters` on Save or Accept; `review_action` is stored per row (B15 fixed in the backend, F-B15): every save sends the row's real state (`lib/parameter-adapter.ts`: the server's value unless the person edited it -> MODIFIED, Accept -> ACCEPTED, Revert or choosing another candidate -> PENDING; `isHumanModified` is kept separately so an edited row that was accepted still reloads its edited value), `reviewer_id` goes on the batch save and the approve body, `user_id` on unflag, and an unknown reviewer is a 422 whose text is shown (never retried). `REVIEW_STATE_PERSISTED` (`approval.ts`) is `true`; Approve flips only PENDING rows, so the gate's "pending" counts those. The project is reloaded after every save, Approve and extraction/correction run, however it ended (`reloadAfterRun`), so a save never starts from a stale row. `newer.ts`: a human-touched row whose selected candidate is from an older `run_number` than another candidate in the payload shows "Newer AI candidate available". Resolving a flag is one call since backend step 3.2 (B16 fixed): `ai-unflag-parameter` with `resolved_by` (the chosen candidate), `status` `RESOLVED`, and the real `user_id`; an unknown user is a 422 whose text is shown.
- **Empty rows (FE-R):** three distinct states via `rowState().emptyKind`. *Reviewer-cleared* (`isReviewerCleared` in `rowState.ts`: human-modified and no value; the adapter selects a "no value" spec with `candidateId` null and keeps the AI candidates as alternatives, never `specifications[0]`) shows "No value (set by reviewer)"; *AI searched* shows "No value · <reason>"; *never extracted* shows "Not extracted yet". A human row with no value saves `final_value`, `final_unit` and `selected_candidate_id` as null. A source with no `documentId` (R2, unknown source) is never a jump target (`hasLocation` needs a document; the workspace no longer falls back to the open document) and "Why this value" shows its `source_reason` under "Source".
- `lib/categories.ts` — category resolution (AM9; each parameter's own `category` since backend step 3.5, which replaced the D5 join: case- and separator-insensitive matching against the known Voltage/Current/Temperature/Capacity/End_Of_Life set, unknown categories humanised and appended, `Other` last) and `groupFields(fields)` (reads `InputField.category`; every known category always returned, even empty; unknown and Other only when non-empty). Category live state during a run (extracting / updated / workers failed) is drawn in the table's category headers; the step-7 `CategoryCards` and `DocumentsTable` are gone.
- `static/battery-template.ts` — `.battery` export with its own `BATTERY_EXPORT_KEYS` map (D8) and `missingExportKeys` (the pre-export check). Writes discharge currents with their stored sign; it never negates them.
- `ToastHost` is mounted once in the project layout; screens and job runners post with `toast.show(...)`.
- `hooks/useCanonicalParameters.ts` — `GET /extraction-templates/parameters` (descriptions, expected units and the "Not in this project" list on the Parameters screen, and the rule picker; no longer category grouping), cached at module scope so every caller in the session shares one fetch.
- `job.uploadWarnings?: string[]` (`lib/jobs/types.ts`) carries an upload's per-file failures (`RunOutcome.warnings`) onto the completed job, read by `DocumentTabs` ("N not accepted"); the reducer's `complete` action takes an optional `warnings` field for this.

### Parameters (`app/projects/[projectId]/parameters/`, `components/parameters/`, step 11, AM14)
Full-bleed `SplitPane` (`bda.parameters.split`). **Left, `ProjectParameters`:** this project's parameters grouped by category (`groupFields`, every known category present), searchable (key, alias, both descriptions, AI instructions); each row shows alias, key, expected unit, the project's description or the dictionary default (italic, "Default: …"), and the AI instructions; **Edit** opens `ParameterEditDialog` (`FormDialog`: alias, description, AI instructions → `PATCH /projects/project-parameter/{id}/`), **Remove** (a `ConfirmDialog`, `DELETE …/remove`, paused while an extraction/correction is queued or running) is **hidden** behind `REMOVE_PARAMETER_AVAILABLE = false`, with a note on the screen, until the backend soft-deletes (B18). A "Not in this project" section lists the canonical dictionary parameters the project lacks (matched on `parameter_id`, never assumed unique per project; `InputField.parameterId`), each with an **Add** button: **"Add parameter"** calls `POST /projects/{id}/parameters` `{parameter_id, user_id}` (`addParameterToProject`, backend 3.10), runs the 201 row through `dbParamToInputField` and appends it in place (`ProjectDataStore.appendField`, no reload); 404, 409 and 422 show the backend's `detail`. The old `PUT …/project-parameter/{id}/add` is no longer used anywhere. **Right, `TemplatesPanel`** (`hooks/useTemplates.ts`; replaces the deleted `TemplatesManager` and `TemplatesHook`): list (`DataTable`), open one (back button) to see its rules, `RuleDialog` to add or edit a rule (`PUT …/rules`), create, delete, set as default (`user_settings.template_id`). **"Save this project as template"** works since backend step 3.3 (`SAVE_AS_TEMPLATE_AVAILABLE = true`, `POST …/from-project`; 404 unknown project and 422 no parameters or unknown user show the backend text). **The system default shows "Save a copy" instead of Delete and Add rule** (`templateAccess(...).copyable`; `lib/templates/copy.ts` creates the template, then upserts each rule); the backend answers 403 for changing it (step 3.4) and its text is shown if it ever reaches it. The pure parts are unit-tested: `lib/parameters/meta.ts` (the PATCH body, search, not-in-project), `lib/templates/rules.ts` (access, scope, rule validation, the upsert body), `lib/errors.ts` (`errorMessage` unwraps the backend's `{"detail"}`).
- **The PATCH uses `COALESCE`:** `null` means "leave as is", so a text the person emptied is sent as `''`, and unchanged fields as `null`.
- **The rule upsert overwrites every column** with what it is sent, so `buildRuleUpsert` always sends all of them (the old manager dropped `expected_unit_override` on every edit).
- **Template access is enforced by the UI only** (`templateAccess`): other people's templates are read-only here and the system default is copy-only; the backend refuses only the system default (403) and checks no ownership.
- `removeParameter` / `editParameterMetadata` in `lib/project-data/actions.ts` refresh the project in the background; removal also drops that row's unsaved edit.
- `components/workspace/UnsavedChangesGuard.tsx` (pre-step 11) is mounted by the project layout: `beforeunload` while any row has unsaved edits, and a confirmation before an in-app link leaves the Workspace (Back/Forward cannot be intercepted).

### Customers and prompts (S4)
`/library?tab=customers` (`components/library/Customers*`): list, create (no delete, B12), `?customer=<id>` opens `CustomerDetail`: default template (PUT/DELETE `/customers/{id}/default-template`) and one row per category slot returned by `GET /customers/{id}/settings` (choose a version, write one for this customer through `POST /prompts/slots/{slot}/versions` with `customer_id`, use global). Agent prompts and model settings are global only and never shown as customer or project settings. New project preselects the customer's default template (`projectTemplateOptions`) and shows `customerPromptSummary`. The project's Prompts page has a first tab "Prompts for this project" (`ProjectPromptSettings`): category slots from `prompt-resolution`, PUT/DELETE `/projects/{id}/prompt-pins/{slot}` while `pins_frozen` is false; **"can it still be changed" is `pins_frozen`, never `already_pinned`** (a customer project is pinned from creation). Parameter Edit is hidden by `is_builtin`. Pure parts: `lib/customers/settings.ts`, `lib/prompts/scoped.ts`.

### Overview and Settings (`app/projects/[projectId]/{overview,settings}/`, `components/overview/`, `components/settings/`, step 12, AM14)
Reading and form screens: a CSS grid of cards (`repeat(auto-fit, minmax(…, 1fr))`, stretching rows), so wide screens fill with columns and 1280 px gets two. Shared `components/overview/Card.tsx` (`Card`, `Fact`).
- **Overview:** header (name, status chip, description, Open Workspace, Parameters); `ReviewProgressCard` (reviewed / pending / flagged / empty from `lib/overview/progress.ts`, one bucket per parameter, a bar plus a legend with an icon per bucket; out-of-bounds is a warning line, not a bucket; **pending is `isPendingReview` from `lib/review/approval.ts`, the rule Approve uses: only PENDING rows are pending, ACCEPTED, MODIFIED and REJECTED are reviewed**; since F0c a PENDING row counts as pending even with no value, so "empty" is only an empty row someone already decided); `StatusCard`; `DocumentsCard`; `LastRunCard` (`hooks/useExtractionRuns.ts`, refetched when a job of the project completes); `JobStateCard` (the same `JobBanner`, `padded={false}`); the last two sit in a full-width row split in two, so a wide screen has no half-empty row. **Review progress is deliberately separate from the status** because Approve does not change `projects.status` (B10).
- **Status change** (`changeProjectStatus` in `lib/project-data/actions.ts`): `POST /projects/update-project-status`, **form-encoded** (`apiUpdateProjectStatus`, `lib/overview/status.ts`). **The route returns the stored `status`** (backend step 3.1, B22 fixed), which `changeProjectStatus` puts into the project list; the project is refreshed in the background, a 404 or 422 shows the backend's `detail` text, and `StatusNotAppliedError` covers a returned status that differs from the request. `STATUS_CHANGE_AVAILABLE = true` (`lib/overview/status.ts`).
- **Settings:** `AppearanceCard` (Light / Dark / System via `useThemePreference`: applied at once, saved to `user_settings.theme`), `ReviewPreferencesCard` (density and "needs review first", the same `localStorage` keys as the Workspace, now in `lib/review/preferences.ts`), `ProjectDetailsCard` (read-only; template name through `getUserTemplates`), `MembersCard` (add contributor and add auditor, 404 → "User not found" via `UserNotFoundError`; **the member list is a labelled placeholder**, B8).
- `REMOVE_PARAMETER_AVAILABLE` (`lib/parameters/meta.ts`) is `false`: the Parameters screen hides "Remove parameter" with a note, because the backend delete is hard (B18). The code stays; flip the switch when the backend soft-deletes.

### Prompts & Models and Audit (`app/projects/[projectId]/{prompts,audit}/`, `components/prompts/`, `components/audit/`, step 13)
- **Prompts (read-only, reading screen, capped at 1800 px):** tabs *Pinned for this project* (`GET /projects/{id}/prompt-pins`: version, model, reasoning effort, temperature, scope; `is_lazy` is shown as "Pinned during a correction"; the prompt text expands; a value the slot leaves unset is a dash, explained once in a footnote under the table, and `n/a` on category slots), *Next run (resolution)* (`prompt-resolution`, with the `already_pinned` banner and each slot's scope) and *Registry* (`GET /prompts/slots`, versions on expand). `api/prompts.ts` has hand-written types and GET calls only. Editing is off: `PROMPT_EDITING_AVAILABLE = false` (`lib/prompts/config.ts`) and the screen says "No authentication". Pure parts in `lib/prompts/view.ts` (scope spelling differs between routes: `GLOBAL` vs `global`; joining pins and resolution by slot).
- **Audit (working screen, full width):** tabs *Parameters* (`GET /audit/project/{id}` summary with totals, search and two filters; six stat tiles in a grid that fills the row; a row expands to the **lineage**: `components/audit/LineageView.tsx`), *Runs* (`RunsTab`), *Flags* (labelled placeholder, B8) and *Feedback* (`fetch_all_feedback`: every page, so the total is real). The lineage lists every candidate oldest first with its run (run numbers come from `/extraction-runs`, the lineage carries only the run id), what changed against the previous candidate, confidence, the flag (every stored flag is a "Reviewer flag", because the backend writes `AI_CORRETION` for all of them and means "flag on an AI value", B23; "carried over after re-extraction" when a candidate's flag repeats the reason of the flag it resolved; out-of-bounds warnings are never stored flags, they come from `rule_violations`) and the flag chain ("Resolved by candidate #2", "Resolved the flag on #1"), and the model's explanation per candidate. It is where earlier values live, because the Workspace shows only the newest run's candidates (B21). Pure parts in `lib/audit/` (`lineage.ts`, `feedback.ts`).
- `hooks/useResource.ts`: load one thing with an `AbortSignal` and `reload`; the loader must be a stable `useCallback`.

### Admin (`app/admin/`, `components/ProjectsSideBar/`, step 14)
Outside the project shell, on the shell's `AppHeader` with "Admin · no authentication" and a chip saying anyone can open it (A2). Projects view: `AdminSidebar` (search, user and date filters, expandable) beside `GlobalOverview` (two Recharts charts and three tiles on status tokens) or, once a project is picked, `ProjectSummary` (its parameters; every row and an "Open this project's Audit" button link to `/projects/[id]/audit`). Each sidebar row also has an Audit link. Feedback view: `FeedbackArea`. The admin's own parameter-lineage drill-down is deleted: the project Audit's `LineageView` is the one lineage screen. Data from `hooks/AdminData.tsx` (`/audit/projects`, all feedback pages).

### The shell (`components/shell/, built to the §8.4 bar per AM5 — step 5 does not rebuild it)
`app/projects/[projectId]/layout.tsx` mounts it once for every tab: `AppHeader` (wordmark, breadcrumb slot, `JobTray`, `ThemeToggle`, account menu) above `ProjectRail` (six nav items since AM11, per-project activity badges, collapsible to icons, arrow/Home/End keyboard navigation) beside the screen. `Breadcrumb` renders `Projects › Customer › Project`; the customer is the payload's `customer` (step 3.5), no `GET /customers/` join (that hook now serves only the New project dialog). The URL is the source of truth for which project is open; the layout tells `projectsIndex` so badges and the job tray agree with the address bar.

### Shared component library (`components/ui/`, step 5)
Generic primitives used across screens, as opposed to `components/shell` (navigation chrome) and `components/jobs` (job-store-aware), both already built: `SearchField` (debounced by the caller, `Esc` clears; no key focuses it, AM19; `aria-label` goes on the `<input>`), `StatusChip` (the 4 project statuses), `ProjectCard` (extracted from the step-3 projects list), `EmptyState`/`ErrorState`, `Skeletons` (`SkeletonCardGrid`, `SkeletonRows`), `DataTable` (sortable header, skeleton/error/empty body — used by the Runs/Pins/Templates/Members tables from step 7 on), `Toast`/`ToastHost` (one bottom-left queue; `toast.show(...)` is callable from anywhere, including non-component code like a job runner), `ConfirmDialog`/`FormDialog` (shared dialog shells; `ConfirmDialog`'s description may be inline content since step 10; existing dialogs built before this step, e.g. `NewProjectDialog`, keep their own markup and adopt these only if a later step touches them anyway), `DensityToggle` (controlled; the caller persists the choice), `GuidedTour` (anchored by CSS selector, so it has no coupling to the component it points at; steps 6+ pass real `steps`). All demoed in both modes in `/dev/gallery`.

### Background work and per-project data (`lib/jobs/`, `lib/project-data/`)
Added in step 2a-i and wired into the app in 2a-ii. **This replaced `ProjectContext`**, which is deleted, along with `useAnalyze`, `useAnalyzeParameter`, `api/analyze-document.ts` and `api/analyze-parameter.ts`.

- **`lib/project-data/store.ts`** — `ProjectState` keyed by `projectId` (details, fields, liveSpecs, per-operation loading, error). **This is the fix for the D11 bug**: results are applied to `store.get(job.projectId)`, so a run that outlives a project switch can no longer write one project's candidates into another's rows. Regression-tested.
- **`lib/jobs/`** — `types.ts` (Job, payloads, actions), `reducer.ts` (pure), `ordering.ts` (cap, correction-priority, FIFO, one parameter-writing job per project), `sse-types.ts` (hand-written SSE contract + phase mapping), `sse.ts` (reader with `AbortController`), `runners.ts`, `store.ts` (observable + abort registry), `hooks.ts` (`useSyncExternalStore` selectors), `config.ts` (`JOB_CAP = 3`).
- **`lib/jobs/runtime.ts`** — starts queued jobs when a slot frees and applies each outcome to its own project. In-tab for now.
- **`lib/project-data/`** — `projects-index.ts` (the user's project list plus the selected project; step 3 moves selection into the URL per D4), `actions.ts` (the operations ProjectContext used to own, each scoped to one project), `provider.tsx` (loads projects for the signed-in user, clears every cache on sign-out).
- **`lib/jobs/locks.ts`, `scheduler.ts`, `persistence.ts`** (step 2b) — the cap is **per browser**: every tab shares one queue in `localStorage`, serialises decisions on one Web Lock, and announces changes over `BroadcastChannel` with `storage` as a backstop. Liveness is "is the per-job lock held", never a timer (AM2), and a job's lock is claimed before it is marked running. A job starts in the tab that queued it; any surviving tab adopts it if that tab is gone. Queued uploads keep their files in IndexedDB (`lib/db.ts` v2).

**A flag requires an AI candidate.** `ai_parameter_flags` has `ai_metric_candidate_id uuid NOT NULL` and `extraction_run_id uuid NOT NULL`, `project_parameters` has no `human_flagged` column (the API field is derived from a join on open flags), and the batch parameter save ignores the `flag` fields its request schema accepts. A parameter that has never been extracted therefore cannot be flagged by any current route; the UI refuses with an explanation instead of failing silently.

### Auth and settings (`contexts/AuthContext.tsx`, `lib/auth/settings.ts`, F0)
`login` applies the stored `user_settings.theme` (only at login, so a local choice survives reloads). `updateUserSettings` sends exactly `{user_id, template_id, theme, lang}` (`settingsPayload`), starting from the latest settings held in a ref that is updated before the request goes out, so two quick changes (theme, then default template) do not overwrite each other.

### State management (custom hooks, no Redux/Zustand)
- **Parameter edits** go through `lib/review/actions.ts` (step 10; `hooks/ParameterManager.tsx` is deleted). `fields` live in `ProjectDataStore`, keyed by `projectId`, with `dirty` (unsaved rows) and `rowOps` (a backend call in flight per row). `updateField` changes one row on the current state; `setDetails` re-applies unsaved edits after every refresh (`mergeLocalEdits`), and `applySpecs` skips dirty rows, so a job finishing or a flag being raised never reverts another row's unsaved edit. `markSaved` clears only rows that did not change during the save. A correction's end posts a toast through `jobRuntime.onJobSettled`, injected by the provider.
- **`hooks/useDocumentWorkspace.ts`** (step 9, replaced `DocumentManager`): the open document (remembered per project), the last `KEEP_MOUNTED` viewed documents, one highlight per document (with a `nonce`, so a viewer scrolls once per jump), and the "source 1 of N" navigation built by `lib/review/anchors.ts` (distinct locations across a parameter's candidates, selected first). Jumping to a source in another document switches to it; the document left keeps its place.
- **`hooks/useHasMounted.ts`, `hooks/useLocalStorageFlag.ts`**: `useSyncExternalStore` helpers for post-hydration state and remembered boolean preferences, so neither needs `setState` inside an effect.

### Data model (`types/index.ts`)
- `InputField`: one battery parameter (e.g. `U_MIN`), with an array of `Specification` candidates and a `selectedSpecId`.
- `Specification`: one extracted value with `confidence`, `unit`, `source` (`pageNumber`/`boundingBox` for PDFs, `tableName`/`cellCoordinates` for Excel), plus validation flags (`rule_passed`, `rule_violations`, `requires_review`).
- `Specification` also carries `expectedUnit`, `extractionLogic` (the model's written rationale, or a reason code on a null candidate) and `calculationLogic`, mapped in `lib/parameter-adapter.ts`.
- There is no hardcoded parameter list any more (`SCHEMA_GROUPS` was deleted in step 8); labels come from `parameter_alias`, categories from `groupFields`.

### Document viewers (`components/DocumentViewer/`, `lib/documents/`, step 9)
- **Files, per document (D7):** `lib/documents/fileStore.ts` fetches `GET /documents/{doc_id}/file` (`api/documents.ts`) one document at a time. 404/410 → `unavailable` (`SourceUnavailable`: "Source unavailable, values preserved", with Check again); other failures → `error` with Retry. Opening a document fetches it at once; the rest are prefetched in tab order, `PREFETCH_CONCURRENCY` at a time, within `PREFETCH_BUDGET_BYTES` per project (the first `PREFETCH_MIN_DOCS` always). Only the last `MAX_CACHED_PROJECTS` projects keep their blobs; sign-out resets the store. All constants in `lib/documents/config.ts`.
- **Viewport (AM12):** `components/workspace/DocumentViewport.tsx` stacks the mounted viewers, hidden with `visibility: hidden` + `inert` (keeps size and scroll), **rendered in tab order** — reordering them by recency moved live pdf.js canvases and crashed react-pdf. Each viewer sits in a `ViewerErrorBoundary`.
- **View state:** `ProjectDataStore.getDocumentView/setDocumentView` (page, offset within the page, zoom, sheet) and `get/setActiveDocument`, keyed by project and document. Deliberately not reactive (written per scroll frame, read on mount). In memory only: a full page reload starts fresh.
- `DocumentRouter` delegates by MIME type to:
  - `PdfViewer`: `react-pdf`, chrome on tokens (AM13), virtualised pages (real sizes up front, canvases only near the viewport), page input and prev/next, zoom buttons, full screen. Highlights through `lib/documents/pdfGeometry.ts` (`bboxToPageRect`: OpenDataLoader's bottom-left-origin points, MediaBox offset, /Rotate; calibrated on the CFC and DAM test PDFs in step 9); a page with no usable box gets the labelled "Approximate location: page N" outline. Worker, CMaps and standard fonts are served from `public/pdfjs/` (gitignored, copied by `scripts/copy-pdf-assets.mjs` in `predev`/`prebuild`).
  - `ExcelViewer` (**rebuilt in step 9b, AM16**): SheetJS (`xlsx` **0.20.3, installed as a tarball from the official `cdn.sheetjs.com`**, because the fixed releases are not on npm; npm's 0.18.5 has two high-severity advisories) parses the workbook **as data only** (`lib/excel/workbook.ts` `READ_OPTIONS`: no VBA, no HTML, nothing recalculated; a file that is not a zip package is refused), into a `WorkbookModel` (`lib/excel/`): formatted text (`w`), formula text, merges, column widths (from the file's character width, not SheetJS's `wpx`), row heights (`hpt`), hidden rows/columns/sheets, chart sheets, and per-cell style (fill, font, alignment) read through `lib/excel/styles.ts`, because SheetJS CE drops each cell's style index. Parses are cached by object URL (`lib/excel/cache.ts`, cleared on sign-out). Layout, in `components/DocumentViewer/excel/`: `FormulaBar` (name box that accepts a typed reference, value bar, stored formula text, full screen), `SheetGrid` (virtualised: absolutely positioned cells for the visible block only, sticky column letters and row numbers, gridlines, merges as one box, text spill, arrow-key movement merge-aware), `SheetBar` (sheet tabs at the bottom, hidden and chart sheets listed and marked, source status, zoom). Hidden rows and columns are **shown** with a marked header, so a source inside them is never invisible. View state (sheet, per-sheet scroll and selected cell, zoom, last handled jump) goes through `ProjectDataStore.get/setDocumentView` like the PDF's page. **Excel sources:** the backend box is Docling's whole *table* (`[col, row, col+n, row+m]`, 0-based, end exclusive; `pageNumber` = sheet position), never one cell, so `lib/excel/highlight.ts` outlines the table and marks the cells inside it whose value matches the candidate (sign ignored, no unit scaling); calibrated in step 9b on BHV and the EB585/EB586 operating-window workbooks. With several matches, the current one is marked strongly and the rest with a light dashed outline; the viewer publishes the count to `lib/excel/matchNav.ts` and the source bar steps through them ("Cell N of M", buttons only), the index travelling on `ViewerHighlight.matchIndex`.
- `SourceBar` (above the viewer, both file types): parameter, location ("Page 4", or "Sheet 3 · B10:D15" for a workbook), the recorded source text, "N of M" with ‹ › buttons, and an "alternative" tag when the anchor is not the selected candidate's. For a workbook source with several matching cells, a second "Cell N of M" stepper.
- `documentFiles.reload` fetches a loaded document again; the Excel viewer's Retry uses it when the bytes cannot be read.

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
- `theme/colors.ts` is **deleted** (step 14). `no-restricted-imports` in `eslint.config.mjs` is an **error** on `@/theme/colors`, so a raw-colour shim cannot come back. No component names a colour literal: `app/` and `components/` (the pdf.js/spreadsheet document surfaces aside) hold no hex or `rgb()`. Charts (Recharts, `/admin`) read `theme.vars.palette.*`.
- Mode: default `system`, persisted by MUI to `localStorage` and mirrored to the backend's `user_settings.theme` by `hooks/useThemePreference.ts`. Quick toggle in `components/shell/ThemeToggle.tsx`; the full control belongs in Settings.
- `npm run check:contrast` asserts the WCAG ratios in `scripts/contrast-check.mjs` and must pass.

### Local DB (`lib/db.ts`)
Dexie (IndexedDB) database `BatterySpecDB` with one table, `pendingUploads` (v2): the files of queued uploads, deleted when the upload succeeds, is cancelled or dismissed (§8.1). The v1 `files` table was dropped.

### Project ids
Projects are created and listed through `/projects`; the id is the backend's UUID and comes from the URL (`/projects/[projectId]/...`). `uuid` is used only for client-side ids of unsaved candidates and toasts.

### Feature switches (constants, not env vars)
`STATUS_CHANGE_AVAILABLE` (`lib/overview/status.ts`, **`true` since F0**), `REMOVE_PARAMETER_AVAILABLE` (`lib/parameters/meta.ts`, B18), `SAVE_AS_TEMPLATE_AVAILABLE` (`lib/templates/rules.ts`, **`true` since batch A**), `PROMPT_EDITING_AVAILABLE` (`lib/prompts/config.ts`). The others are `false`; each hides a control whose backend route is a no-op or fails, with the reason on screen. Flip one only after the backend item is fixed (the status switch was, in F0).

### Dependencies and security (step 14)
Next.js **16.4.0** and `eslint-config-next` 16.4.0 (exact pins). `npm audit` was 23 findings (3 critical), then 8 (2 critical), and is **5 (high, none critical) since F0**, all in dev tooling. `vitest` is **4.x** (it needs `vite` as an explicit devDependency: with npm's hoisting `@vitest/mocker` could not resolve it otherwise). What is left is the `eslint-config-next` chain (`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`; npm's only offered "fix" is a downgrade to 14.2.35). None ships to the browser. `xlsx` comes from the SheetJS tarball (see Document viewers), not npm. Running `next dev` writes an `AGENTS.md` at the repo root (Next 16.4); it is not ours and is gitignored.

---

## 6. Known gaps between this frontend and the current backend

The frontend has no open gap of its own against the contract. What is left is **backend behaviour the UI cannot fix**, recorded as B1–B24 in `claude-notes/plans/plan-A-amendments.md` (AM8) for Task B. The UI shows each as a labelled placeholder or a hidden control and never works around it silently.

| Backend item | What the UI does about it |
|---|---|
| B1 Add parameter (fixed, backend 3.10) | Works: `POST /projects/{id}/parameters` |
| B2, B4 (fixed, backend 3.5) | `customer` and each parameter's `category` come from the payload; the D5/D6 joins are gone. `parameter_id` is not unique per project: key on `id` |
| B3, B5 out-of-bounds auto-flags not stored; no reason-code field | Read from `rule_violations`; reason codes matched by prefix (AM6) |
| B7 file route 404 for every missing case | 404 and 410 both show "Source unavailable, values preserved" |
| B8 no member list, no project-wide flag list | Placeholders in Settings and the Audit's Flags tab |
| B9 a never-extracted parameter cannot be flagged | The UI refuses with an explanation |
| B10 approve does not change the status | Review progress shown separately. (B22, the status route that wrote nothing, is fixed: `STATUS_CHANGE_AVAILABLE = true`.) |
| B11 `final_value` as a long float | Rounded for display only (AM10); Save never sends the rounded value |
| B12 no delete route for projects or users | Test data accumulates in the dev database |
| B13, B14 reasoning is narration; Excel sources name a table, not a cell | Labelled as the model's text; the table is outlined and matching cells marked |
| B15 fixed in the backend (R1), wired in F-B15 | Accept and the review state are stored; Approve flips PENDING rows only |
| B16 (fixed, backend 3.2) | Resolving a flag is one call |
| B17 (fixed, backend 3.3) | Save as template works |
| B18 parameter removal is a hard delete | Hidden (`REMOVE_PARAMETER_AVAILABLE`) |
| B19, B20 texts cannot be nulled; templates check no ownership (system default guarded, 403, step 3.4) | Empty text sent as `''`; ownership enforced in the UI only (`templateAccess`) |
| B21 a correction leaves only the newest run's candidates in the project payload | Older candidates are read from the Audit lineage |
| B23 flag type does not say who raised a flag | Every stored flag is labelled "Reviewer flag" |
| B24 feedback list has no id, date or total; one route is a stub | All pages are read for the total; no date shown |
| (A2) no real authentication | Admin and Prompts say so on screen; Prompts editing is off |

**Backend 3.6 / 3.13 (batch B):** values arrive in short form (`3.65`, string or number); `formatDisplayValue` and the adapter handle both (`lib/review/decimals.test.ts`). `customer_id` is mandatory on create: `NewProjectDialog` disables Create until a customer is chosen (`lib/projects/create.ts`), always sends it as a string and shows the 422 `detail` for a stale id; old projects may still have `customer: null` (lists and breadcrumb cope). **Closing the tab cancels a running analysis (backend X3):** `RunningJobGuard` (mounted in `app/layout.tsx`, `lib/jobs/closeGuard.ts`) sets `beforeunload` only while an extraction or correction is running, and the running-job indicators (`JobStatusLine`, `JobBanner`, `JobTray`) say "Keep this tab open until the analysis finishes". **Uploads are different (backend U1, step U2):** a fully sent upload keeps running on the server and is saved, and a document is listed only once fully processed. So an interrupted *upload* is never reported as "nothing was saved": `JobRuntime.recoverUpload` polls the project's documents (`lib/jobs/uploadRecovery.ts`, first check at once, then 5 waits of 12 s) against the job's file names (`documents.name`) and shows "Checking whether the server finished…", then "Saved while you were away" (job completed) or "Not saved. Upload again". "Run again" on an upload re-sends only the files the project lacks (and refuses to send anything if the project cannot be read, to avoid a duplicate). Upload errors show the backend's `detail`/`message` (`api/upload-error.ts`). The tab warning also covers a running upload, with its own text "Keep this tab open until the upload has been sent" (`keepOpenText`).

Frontend limits that remain by decision: no custom keyboard shortcuts (AM19), command palette deferred (§2), jobs run in the browser tab and the queue is per browser (§8.1), view state of a document is in memory only.

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
- Loading is shown **where the work is**: a per-project activity badge in the projects list/sidebar, and progress inside that project's Workspace. No full-screen spinners, no app-wide disabled states.
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
| D4 | Routing | URL-based project routes: `/projects` (list) and `/projects/[projectId]/(overview\|workspace\|parameters\|prompts\|audit\|settings)` (AM11 merged Extract and Review into `workspace`; the old paths redirect). `/bda` and `/review` are retired. `/admin` stays outside the project nav, labelled as unauthenticated. |
| D5 | Parameter categories (superseded by backend step 3.5: read `category` from the parameter) | Until the backend adds `category` to the project payload (Task B), group by joining project parameters to `GET /extraction-templates/parameters` (`CanonicalParameter.category`) on the parameter key. This uses a real backend field, so it is not inventing data. Unmatched parameters go to an "Other" group, never dropped. |
| D6 | Customer in breadcrumb (superseded by step 3.5: the payload's `customer`) | Use the customer from the project payload if present; otherwise join `GET /customers/` by `customer_id`. If neither resolves, show the project alone. |
| D7 | Source file for the viewer | Fetch only the active document, via `GET /documents/{doc_id}/file`. Treat 404 and 410 alike as "Source unavailable, values preserved". |
| D8 | `.battery` export | Keep it, as an Export action in the Workspace toolbar. It is a fixed downstream format, so it keeps its own **explicit key map** (independent of categories and of the removed `SCHEMA_GROUPS`), and it lists any required key that has no value before exporting. |
| D9 | Interrupted runs | Confirmed from the backend: results are saved only when the stream reaches `complete`. An interrupted run has saved nothing. |
| D10 | Response types | Most `openapi.json` responses are untyped. Hand-write response types for the routes Task A uses, each with a comment naming the route, and mark them for replacement by generated types in Task B. |
| D11 | Live data-corruption bug | A running analysis currently writes into whichever project is on screen (shared `fields[]`). The job-store step must key **data**, not just loading flags, by `projectId`, and its history note must state that this bug is fixed. |