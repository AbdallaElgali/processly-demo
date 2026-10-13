# Explore A: frontend state vs RFC-FE-01

- **Date:** 2026-10-09
- **Mode:** read-only for source code. No source file was touched.
- **Inputs read:** `CLAUDE.md` (§0, §1, §5–§8), `claude-notes/context/FE_RFC.md` (the file on disk is `FE_RFC.md`, CLAUDE.md says `fe_rfc.md`), `openapi.json`, the three screenshots (`Sidebar.png`, `main-dashboard-dark.png`, `main-dashboard-light.png`), and every file under `app/`, `components/`, `hooks/`, `contexts/`, `api/`, `lib/`, `types/`, `theme/`.
- **`claude-notes/history/` is empty**, so §0.1's "read the last 3 notes" had nothing to read. This session writes the first note.

## 0. Reading the Mindee references (what we borrow)

| Screenshot | Pattern to take | Do not take |
|---|---|---|
| `Sidebar.png` (dark) | Breadcrumb at the top of a narrow left rail (`home > Balance Sheet`), one nav item per RFC §2 screen with an icon, active item shown by a tinted row. Page header = title + one-line subtitle + underlined tabs (`Live Test`, `Documents History`). One large dashed dropzone card with a single primary button. Guided-tour tooltip anchored to the control it explains, with prev/next arrows. | Red accent, the red tooltip fill, the logo. |
| `main-dashboard-light/dark.png` | Same page in both modes: gradient-free surfaces, one border colour, cards with a 1px border and soft radius, chip rows with a "See N more" overflow chip, search field above a card grid, a theme toggle (moon/sun) top right. Dark mode is deep navy, not neutral grey; light mode is near-white with a faint blue tint. Both keep the same accent (blue). | Marketing hero, document photos, flag icon, brand blue. |

Take away for BDA: the Projects list is a card grid with search (the "model picker" screen), the project shell is a left rail plus tabs, and the quick theme toggle sits top right.

## 1. Screen and component inventory

Verdicts: **keep** (use as is), **extend** (same file, new behaviour), **replace** (new component, old one deleted).

### 1.1 Routes (`app/`)

| File | What it is today | Verdict | Reason |
|---|---|---|---|
| `app/page.tsx` | Auth redirect to `/bda` or `/login`. (CLAUDE.md §5 says it re-exports `bda/page`; that is stale.) | **replace** | Becomes the Projects list (RFC §2 `Home`). |
| `app/login/page.tsx` | Username-only login. **It is wired**: `page.tsx`, `bda/page.tsx` and `AuthContext.logout` all route to it. CLAUDE.md §5 says it is not wired; stale. | **extend** | Keep the flow (A2: no real auth), restyle with tokens. |
| `app/bda/page.tsx` (388 lines) | The whole editor: project loading, hydration, upload, analyze, save, approve, export, flag-and-retry, three panels, 6 modals/snackbars. | **replace** (split) | It is the root cause of §5 and holds all screens in one component. Its handlers (`handleSave`, `handleApprove`, `handleExport`, `handleFlagAndRetry`) move to the new screens. |
| `app/review/page.tsx` (247 lines) | Near copy of `bda/page.tsx` with `readOnly` and a flag counter. **Unreachable from the UI**: `ProjectBar` shows the link only when `reviewModeEnabled`, a `useState(false)` that nothing sets. | **replace** | RFC Review is the main screen, not a read-only copy. Reuse its viewer/list wiring. |
| `app/admin/page.tsx` + `components/*` (5 files) | Audit dashboard (projects, feedback, lineage, Recharts). Own layout and own `ThemeProvider`. | **extend** | Maps to RFC `Audit`. Keep `ParameterLineage`, `ProjectSummary`, `FeedbackArea`; re-skin; make project-scoped. Hardcoded pastel cards in `GlobalOverview` need tokens (§4). |
| `app/layout.tsx` | `AuthProvider` > `ProjectProvider`. No `ThemeProvider`, no job store. `<body>` is forced to `100vw/100vh`. | **extend** | This is the place for the theme provider and the job store (above the route tree). |
| `app/globals.css` | Tailwind v4 directives (`@tailwind base` is v3 syntax) plus forced `overflow: hidden` on `html, body`. | **extend** | Tailwind is installed but unused; MUI is the system. Decide in the plan whether to drop Tailwind. |

### 1.2 Components

| Component | Verdict | Reason |
|---|---|---|
| `DocumentViewer/DocumentRouter.tsx` | **keep / extend** | MIME routing and the `key={fileUrl}` reset are sound. Add "source unavailable" (410/404) state. |
| `DocumentViewer/PdfViewer.tsx` | **extend** | Highlight maths exists (normalised vs pixel, y-flip, page-only fallback, scroll-to). Needs: light/dark-safe highlight colours (currently `rgba(25,118,210,.2)` hardcoded plus `colors.primary`), "anchor 1 of 2" navigation (CFC), calibration check for the y-flip (RFC §4.3), remove `console.log(activeHighlight)`. Worker is loaded from `unpkg.com` at runtime (offline/CSP risk). |
| `DocumentViewer/ExcelViewer.tsx` | **extend** | Highlights by `cellCoordinates` or bbox and switches sheet. Gaps: no merged-cell handling (`sheet_to_json(header:1)` drops `!merges`), `XLSX.read` has no `cellDates`/data-only option for `.xlsm`, sheet switch treats `pageNumber` as a sheet identifier (guess), fetches the blob URL a second time, viewer surfaces use `colors.surface` (dark) although RFC §8.3 says documents stay light. |
| `DocumentViewer/DocumentViewer.tsx` (160 lines) | **delete** | Not imported anywhere. Older duplicate of `PdfViewer`. |
| `source-modal.tsx`, `types/admin.ts` | **delete** | Both are 0-byte files. |
| `Loading.tsx` | **delete** | Full-screen white overlay (`rgba(255,255,255,.8)`, `zIndex 9999`). Not imported anywhere. It is exactly the pattern §8.1 bans. |
| `ProjectsSideBar/BaseSideBar.tsx` | **replace** | A flat project list with expandable documents. Becomes the project rail with activity badges. |
| `ProjectsSideBar/BDASideBar.tsx` and `components/Sidebar.tsx` | **replace** | Two near-identical 320/480-line copies (editor vs review) mixing the project list, document list, 3 dialogs (create project, create customer, add contributor). Dialog logic moves to a "New project" flow on the Projects list. |
| `ProjectsSideBar/AdminSideBar.tsx` | **extend** | Audit project picker. Fold into the Audit screen. |
| `ActionToolbar.tsx` | **replace** | 56px icon-only rail with Upload, Analyze, Save, Approve, Export, Templates, Feedback, collapse. Actions move to their screens (Extract, Review header, Parameters). Spinners are per-button, so reusable idea is only the per-action loading overlay. |
| `ProjectBar.tsx` | **replace** | "Active Project: X" text, hidden Review link, logout. Becomes the breadcrumb (`Customer › Project`). |
| `Headers/LayoutHeader.tsx` | **replace** | Hardcodes the "Voltavision Processly Demo" wordmark and `colors.primary`. Becomes the shell header (breadcrumb slot, theme toggle, user menu). |
| `input-fields-list.tsx` | **replace** | Groups by `SCHEMA_GROUPS` and silently drops any field not in it (§6). |
| `input-field-item.tsx` (537 lines) | **replace** (reuse logic) | Row with value/unit inputs, confidence dot, candidate chips, flag drawer, inline alias/description/AI-instruction edit, `any` casts. Its states do not match RFC §4.1 (no auto-flag vs human-flag, no reason-code chip, no min/typ/max tag, no C-rate chip, no sign tooltip). Keep the behaviours (candidate switch, flag+retry, metadata edit), rebuild the markup. |
| `document-upload.tsx` + `UploadModal.tsx` | **replace** | Small horizontal dropzone in a modal. RFC wants the Mindee-style large dropzone as the Extract screen body. The drag/drop/file-input handling is reusable. |
| `NoProjectsScreen.tsx` (213 lines) | **replace** | First-run create-project form with its own `ThemeProvider`. Becomes the Projects list empty state plus guided tour. |
| `SettingsModal.tsx` | **replace** | Misnamed: it is "Register user" (calls `/auth/register-user` with `department` as free text and sends `email`, `password`, neither in the schema). Real Settings screen needs Light/Dark/System and contributors/auditors. |
| `FeedbackModal.tsx` | **keep / extend** | Posts to `/feedback/submit`. Restyle. |
| `TemplatesManager/index.tsx` (658 lines) | **extend** | Becomes the Parameters screen's template area. Bound to `/extraction-templates`. Needs field fixes in §3 and tokens (it already uses light-ish shadows, so it will show dark-mode bugs). |
| `hooks/Resizer.tsx` | **extend** | Resize logic is fine, but it hardcodes `SIDEBAR_WIDTH`, uses `window.innerWidth - clientX` (assumes viewer is flush right), mouse-only (no keyboard, no touch). Needed for the split-pane Review. |
| `hooks/DocumentManager.tsx` | **extend** | Per-page state of blob URLs. Hydration fetches `file_url` for every document of the project on switch. Make it per project and lazy (fetch only the active document, `GET /documents/{id}/file`). Handle 404/410. |
| `hooks/ParameterManager.tsx` | **extend** | Holds the single `fields[]` for "the current project". Good reducers (`handlePopulateExtractedData`, `applyFlagChain`). Must become keyed by project and fed by the job store. Leftover: unused `UnfoldLess` import, unused `isSyncing` consumer, `console.log`s. |
| `hooks/useAnalyze.ts`, `hooks/useAnalyzeParameter.ts` | **replace** (move into job store) | They own loading state at page level (§5). |
| `hooks/AdminData.tsx`, `Customers.tsx`, `TemplatesHook.tsx`, `useParameterLineage.tsx`, `useProjectSummary.ts` | **keep / extend** | Data hooks, no UI. `AdminData` duplicates `api/audit/project_metrics.ts` with its own `fetch`. |
| `contexts/AuthContext.tsx` | **keep / extend** | Session handling is fine. Add theme persistence (`theme` field exists in `UpdateUserSettingsInput`). It stores the whole user in `localStorage`. |
| `contexts/ProjectContext.tsx` | **replace** | One `isLoading`, one `currentProject`; see §5. Split into a project list/query cache and per-project data. |
| `lib/parameter-adapter.ts` | **keep / extend** | The best-factored file: DB↔UI conversion for candidates, bboxes, confidence scale. Needs `category`, reason codes, flag type. Remove the `SCHEMA_GROUPS` label maps (§6). |
| `lib/db.ts` | **extend** | Dexie `BatterySpecDB.files` is **unused** (grep finds no import of `db`). It is the natural home for queued upload blobs (CLAUDE.md §8.1); it needs a schema version 2. |
| `static/battery-template.ts` | **keep** | `.battery` export, keyed by fixed parameter keys (§6). Has uncommitted changes in the working tree (`git status`). |
| `theme/theme.ts`, `theme/colors.ts` | **replace** | See §4. |

## 2. Gaps against RFC §2 information architecture

| RFC node | Today | Gap |
|---|---|---|
| **Projects list** (`Home`) | No such screen. `/` redirects; `/bda` auto-opens `projects[0]` (`bda/page.tsx:211-215`). The list is a nested sidebar tree. | New screen needed: card grid + search + create project. |
| **Project shell** (breadcrumb `Customer › Project`, left nav) | No shell. No URL carries a project. The "current project" is in-memory context state, so projects cannot be deep-linked, bookmarked, or opened in two tabs. `Project` type has `customer?: string` but the openapi response is untyped (see §3), so the customer name source is unconfirmed. | Needs routes like `/projects/[projectId]/(overview\|extract\|review\|parameters\|prompts\|audit\|settings)`. |
| **Overview** (status, counts, last run) | None. Data partially available: `Project.status`, `created_at`, parameters, `GET /projects/{id}/extraction-runs`. | New screen. Response shape of `GET /projects/{id}` is untyped; confirm fields before building. |
| **Extract** (upload + run timeline) | Upload is a modal; Analyze is an icon with a tooltip status string. Only `partial`, `partial_correction`, `refining`, `complete`, `error` are read (`analyze-document.ts:64-98`); `routing_truncated`, `routing_complete`, `no_frames_tagged`, `category_extraction_fallback`, `workers_complete`, `category_workers_failed` are silently ignored. `targeting` is handled only in single-parameter. | New screen with timeline state machine (RFC §3). Upload is separate from analyze today and `successful_uploads`/`errors` partial failures are dropped (`DocumentManager` ignores `errors`). |
| **Review** (split pane + HITL) | `/review` is a read-only clone of the editor, unreachable. Flag, flag+retry and candidate switch exist only in the editor. | New screen. Missing pieces: row states (§4.1), keyboard-first navigation, auto-vs-human flag distinction, reason codes, anchor navigation, density toggle, approve. |
| **Parameters** (schema, templates) | `TemplatesManager` modal in the editor; per-row alias/description/AI-instruction edit. `GET /extraction-templates/parameters` (canonical dictionary) exists in `api/templates.ts`. `DELETE /projects/project-parameter/{id}/remove` and `PUT .../add` (add/remove a parameter from a project) are **not called anywhere**; `handleRemoveField` only filters local state. | Screen needed, and project parameter add/remove must use the two routes above. |
| **Prompts & Models** | Nothing. No call to `/prompts/*`, `/projects/{id}/prompt-pins`, `/prompt-resolution`. | New screen. Routes exist in openapi (listed in §3.2). Global Admin part behind a feature flag (RFC §5). |
| **Audit** (runs, lineage, flags) | `/admin` page (global, not project scoped), lineage component exists, `GET /projects/{id}/extraction-runs` never called. | Project-scoped Audit tab; re-home `ParameterLineage`. |
| **Settings** (contributors, auditors) | `addContributor` exists but its button is behind `addContributorEnabled` state that is never set to `true` (`BDASideBar.tsx:33`), so it is dead UI. `POST /projects/{id}/auditors` is never called. "SettingsModal" is a user-registration form. | New screen. Also hosts theme Light/Dark/System. |
| **Global Admin** | `/admin` is a mix of audit and feedback, no auth. | Keep out of the main nav; flagged (RFC §5). `DELETE /system/reset-database` is not in the snapshot and not in the code (grep clean). |
| Guided tour | None. | New, frontend only. |
| Theme toggle | None. Dark only. | See §4. |

## 3. `api/` vs `openapi.json`

The snapshot has 50 operations. Almost all 200 responses are **untyped** (`schema: {}`), so response shapes cannot be verified, only requests.

### 3.1 Mismatches (calls whose contract no longer matches)

| # | File / call | Problem | Severity |
|---|---|---|---|
| 1 | `api/chat.ts` `POST /chat` | Route is not in the backend. Dead code (no importer). | Delete. |
| 2 | `api/projects.ts` `apiUpdateProjectParameter`: `PATCH /projects/project-parameter/{id}` | Spec path has a **trailing slash** (`.../{id}/`). Without it FastAPI answers 307; a redirected PATCH with a JSON body can fail or lose the method under CORS. | Medium. |
| 3 | `api/flagging` `flagParameter` (`api/parameters.ts`) | `AIFlagRequest.ai_metric_candidate_id` is **required string**; the client types it `string \| null` and `handleFlag` passes `null` for human-entered values (no candidate). That produces a 422 and is swallowed by `catch` (flag silently lost). | **High** |
| 4 | `api/parameters.ts` `unFlagParameter` | OK on shape (`flag_id`, `resolved_by`, `status`). | OK |
| 5 | `api/parameters.ts` `updateResolvedBy` → `POST /flagging/select-correct-ai-candidate` | OK (`flag_id`, `resolved_by` both required; call guards with `activeFlagId && candidateId`). Note `handleSwitchSpecification` looks up the spec by `spec.candidateId === specId` but UI ids equal candidateId only for AI candidates; fine today. | OK |
| 6 | `ParameterInput` in `api/projects.ts` | Client sends an extra `parameter_key` (not in schema; ignored by Pydantic v2 default, but also not required). `final_value` is typed `number \| null`; schema is `number \| string \| null`, so non-numeric values (e.g. text values) are dropped to `null` by `inputFieldToParameterInput` (`isNaN`). Data loss for non-numeric parameters. | Medium |
| 7 | `ProjectCreateInput` in `api/projects.ts` | Client type adds `title`, `customer`; schema has `alias_id`, `description`, `customer_id`, `user_id`, `template_id` only. `createNewProject` callers pass `title` (`bda/page.tsx:249`), so it is sent and ignored. | Low |
| 8 | `api/customers.ts` `create_customer(alias_name, name)` | `CustomerCreate` has only `alias_name`; `name` is sent and ignored, so the "Full name" field in the dialog is cosmetic. `DELETE /customers/{alias_name}` unused. | Medium (UX lie) |
| 9 | `api/templates.ts` `CanonicalParameter` | Client: `{id, name, description?, expected_unit?}`. Schema: `{id, name, category, default_description, expected_unit}`. **`description` does not exist**, and **`category` is missing from the client type**, which is the field §6 needs. | **High** |
| 10 | `api/templates.ts` `TemplateRule` | Schema adds required `canonical_name`; client type omits it. | Medium |
| 11 | `api/templates.ts` `ExtractionTemplateBase` | Client has `updated_at`; schema has only `created_at`. `user_id`, `customer_id` are `string \| null` in schema, optional in client. | Low |
| 12 | `api/templates.ts` `TemplateRuleUpsert` | Optional fields typed `?: string`; schema allows `null`. Fine in practice. | Low |
| 13 | `api/admin/users.ts` | Declares `register_user` but never exports it. Uses `process.env.API_URL` (server-only, `undefined` in the browser). `SettingsModal` re-implements the call. | Dead code |
| 14 | `SettingsModal` `register_user` | Schema `UserRegistration` = `{username, department: DepartmentEnum('Zelle'\|'Module'\|'Pack')}`. UI has a free-text department, plus `email` and `password`. Free text fails validation for anything but those three values. | **High** (feature broken) |
| 15 | `api/config.ts` | Reads `NEXT_PUBLIC_API_URL`. CLAUDE.md §4 and the comments in other files say `API_URL`. Docs and Dockerfile may disagree; confirm. | Medium |
| 16 | `api/upload-doc.ts` `UploadResponse` | Matches the route name/body. Response is untyped; `errors: string[]` is never shown to the user. | Medium |
| 17 | `api/analyze-document.ts`, `api/analyze-parameter.ts` | Request bodies match (`current_user: {id}`, `previous_specs`; `parameter`, `previous_metrics`, `user_hint`). SSE payloads are not in the spec (as expected); see §7. They also never `abort()` the fetch (no `AbortController`), so a stream cannot be cancelled. | Medium |
| 18 | `api/audit/feedback.ts` | `total` is `data.feedbacks.length`, not a server total, so pagination (limit/offset) is wrong beyond one page. `AdminData` hardcodes `limit: 5`. | Low |
| 19 | `hooks/DocumentManager.tsx` | Fetches `${API}${doc.file_url}` rather than `GET /documents/{doc_id}/file`. Works only if the backend's `file_url` equals that route. Unverified (untyped response). Also fetches **all** documents per project switch. | Medium |
| 20 | `lib/parameter-adapter.ts` `formatBoundingBox` | Accepts `{x0,y0,x1,y1}`, `[x0,y0,x1,y1]`, `{x,y,width,height}`. The real shape of `source_bounding_box` / `source_cell_coordinates` is **not in openapi** (`Record<string, unknown>`). Explore B has to pin it. | Open |

### 3.2 Backend routes with no client code

`POST /projects/update-project-status`, `POST /projects/{id}/auditors`, `DELETE|PUT /projects/project-parameter/{id}/remove|add`, `GET /documents/{doc_id}/file` (not used directly, see 19), `GET /analytics/dashboard`, `GET /audit/feedback/{project_id}`, `DELETE /customers/{alias_name}`, all `/prompts/*` routes (slots, versions, assignment, model-assignment), `GET /projects/{id}/prompt-pins`, `GET /projects/{id}/prompt-resolution`, `GET /projects/{id}/extraction-runs`, `GET /extraction-templates/...` calls exist.

### 3.3 Typing and generated-client implication (RFC §5.1)

Only the extraction-templates, customers, prompts and analytics routes have typed responses. All of `/projects/*`, `/audit/*`, `/auth/*`, `/flagging/*`, `/specs/*` and `/files/*` return `{}`. Generating types from this snapshot would type requests but leave the data screens (`GET /projects/{id}`, the main payload) as `unknown`. That makes the RFC §5 P0 "typed contract" a backend task first.

## 4. Styling debt

| # | Finding | Evidence |
|---|---|---|
| 1 | **Dark only, hard.** `createTheme({palette:{mode:'dark'}})`, no `colorSchemes`, no `prefers-color-scheme`, no `useMediaQuery`. `theme.theme` is a field on the user (`AuthContext`) but nothing reads it. | `theme/theme.ts`, grep |
| 2 | **Raw colour import everywhere.** `@/theme/colors` is imported by 26 files; each uses `colors.surface`, `colors.border`, `colors.primary`, `colors.textSecondary` directly as a literal. Switching to light means touching every file, because the values are constants, not theme-reactive. | grep (26 files) |
| 3 | **Raw colour literals** (hex / `rgba()`) in 16 files: `GlobalOverview` (13), `Sidebar` (6), `TemplatesManager`, `BDASideBar`, `PdfViewer`, `ExcelViewer`, `DocumentViewer`, `input-field-item` (`#ef4444`, `#fff`), `review/page` (`#000`, `#f4f4f5`), `bda/page` (`#f4f4f5`), `NoProjectsScreen` (`#eee`), `FeedbackModal` (`|| '#fff'`). | grep |
| 4 | **Brand tint repeated as `rgba(0, 170, 185, x)`** (the cyan `#00AAB9`) in sidebars and dialogs instead of `alpha(theme.palette.primary.main, x)`. Also `rgba(255,255,255,.05)` hover that is invisible on white. | `Sidebar.tsx:171,191,252,348,394,443`, `BaseSideBar.tsx` |
| 5 | **White text forced** (`color: 'white'`, `input: {color:'white'}`, `label: {color: colors.textSecondary}`) in dialogs. Unreadable in light mode. | `BDASideBar`, `Sidebar`, `SettingsModal`, `document-upload` |
| 6 | **Four `ThemeProvider`/`CssBaseline` mounts**, one per page and one per early-return branch (`bda/page` ×2, `review/page` ×3, `admin`, `login`, `NoProjectsScreen`). The provider belongs in `layout.tsx`. Theme switching would remount trees. | grep |
| 7 | **Theme MUI overrides force dark:** `MuiPaper.root.backgroundColor: colors.surface` for every Paper, so `Paper` can never be light. | `theme.ts:27` |
| 8 | **Viewer surfaces use dark tokens** (`colors.surface`) around a light PDF/Excel. RFC §8.3 wants the document itself to stay light and the chrome to follow the theme. Highlight colour `rgba(25,118,210,.2)` is MUI blue, not the brand `primary`, and is repeated in 4 places; not checked for contrast on white. | `PdfViewer`, `ExcelViewer`, `DocumentViewer` |
| 9 | **Status colours** are `colors.success/warning/#ef4444` thresholds (≥95, ≥80) in `input-field-item`; the RFC says high confidence ≥ 0.85 (tunable). Conveyed by a dot colour only, no icon/label (fails §8.3 "never colour alone"). | `input-field-item.tsx:43-48` |
| 10 | **Two palettes disagree.** Brand `primary` `#00AAB9` (cyan) and `secondary` `#9c27b0` (purple) vs MUI default blue used by the viewers; `GlobalOverview` uses a third set (`#2196f3`, `#ff9800`, light pastel cards `#e3f2fd`, `#e8f5e9`, `#fff3e0` that look wrong in dark mode). Recharts fills hardcoded. | `GlobalOverview.tsx` |
| 11 | **Typography:** theme sets `"Inter","Roboto"` but `layout.tsx` loads **Geist/Geist Mono** via `next/font` and never applies it to MUI; Inter is never loaded. Effective font is whatever the OS has. | `layout.tsx`, `theme.ts` |
| 12 | **No spacing/radius/elevation/motion tokens.** Radii are ad hoc (`borderRadius: 2`, `1`), transitions ad hoc (`0.2s`, `0.3s`, `0.3s ease`). No `prefers-reduced-motion` handling anywhere. | grep |
| 13 | **Interaction states:** icon buttons have MUI defaults only; no `:focus-visible` styling, the resize handle (`<Box onMouseDown>`) is not focusable and has no `role="separator"`, rows are not keyboard-navigable, the sidebar collapse has no `aria-expanded`. | `bda/page.tsx:316`, `input-field-item` |
| 14 | **Layout CSS fights MUI:** `globals.css` forces `overflow: hidden` and `body { display: flex; flex-direction: column }`; `layout.tsx` inlines `100vw/100vh` on `<body>` (`100vw` creates horizontal scroll when a scrollbar is present). Fixed widths: sidebar 260, toolbar 56, viewer min 300 / main min 400 (sum > 1024 at laptop width, so the three-panel layout can overflow on a 1280 laptop with sidebar open). | `globals.css`, `layout.tsx`, `Resizer.tsx` |
| 15 | **Debug output left in:** `console.log` in `PdfViewer`, `ProjectContext`, `ParameterManager`, `upload-doc.ts`, `projects.ts` (`'Parameters to save'`), `fetch_feedback`. CLAUDE.md §0.6 (don't log secrets) is not violated today, but project and user data is logged. | grep |

## 5. Root cause of the app-wide loading lock (RFC §5b.1)

RFC's assumption ("loading state lives in the page component") is **right, but incomplete**. There are three separate mechanisms. Line numbers are `app/bda/page.tsx` unless stated.

### 5.1 Mechanism 1: one global `isLoading` replaces the whole screen

`contexts/ProjectContext.tsx` has a single `isLoading` boolean. It is set `true` by:

- `loadProjectDetails` (called on every project switch, after an upload, after create)
- `createNewProject`, `addContributor`, `approveDocument`, `saveParameters` (the manual Save button)
- `fetchUserProjects`

`bda/page.tsx:234` then does:

```tsx
if (authLoading || projectsLoading || !user) { return <full-screen spinner/> }
```

`projectsLoading` is that global flag. While any of the calls above is in flight, the page **returns a different tree**, so the sidebar, toolbar, parameter list and viewer unmount. Consequences:

- Switching projects blanks the whole app (click project B → `loadProjectDetails(B)` → spinner → remount).
- The sidebar's own state (`expandedProjectId`, open dialogs) is destroyed on every switch, because `Sidebar` is part of the replaced tree.
- `DocumentRouter` and PDF/Excel viewers remount and re-parse.
- The same flag disables the "Create" and "Add user" buttons (`isLoading` in the sidebars), so a background save elsewhere freezes unrelated dialogs.
- **Upload:** `handleDocumentUploadAndRefresh` (`:110`) awaits the upload, then `loadProjectDetails(activeProjectId)` → global spinner. Upload progress itself (`isDocLoading`, `DocumentManager.tsx:20`) is local to the page and is passed only to the modal (`:331`); the modal's dropzone ignores clicks while loading and offers no cancel.

### 5.2 Mechanism 2: analysis state is one flag owned by the page

`useAnalyze` (`hooks/useAnalyze.ts`) is instantiated inside `BDA` (`:93`). Its `isAnalyzing`/`analyzeStatus` are `useState` in that component. They are not keyed by project. Effects:

- `readOnly={isAnalyzing || ...}` (`:311`) makes the entire parameter list read-only, for **whichever project is on screen**.
- `isAnalyzeDisabled = uploadedFiles.length === 0 || isAnalyzing` (`:284`) disables Analyze for every project, not just the one running.
- Switching to project B does not stop A's stream (the `fetch` loop is a closure with A's `projectId`, no `AbortController`), but B's screen inherits A's `isAnalyzing = true`, so **B is locked too**.
- **Data corruption risk, worse than the lock:** A's `partial`/`complete` callbacks call `handlePopulateExtractedData`, which writes into the one shared `fields[]` (`ParameterManager.tsx`). After the switch that array holds **B's** fields. `handlePopulateExtractedData` matches by `parameter_key` (`f.id`), so if A and B share a template, **A's candidates are merged into B's rows**, and `applyFlagChain` then rewrites B's `activeFlagId`. Nothing in the code prevents this.
- If the user navigates to `/review` or `/admin` instead, `BDA` unmounts, the closure keeps running, `setState` hits an unmounted component, and the results never reach the UI (the backend still saves on `complete`, so they appear after a re-fetch). Nothing tells the user.

The correction path (`useAnalyzeParameter`) is better: it keys loading by `correctingFieldId` (comment: "never hoist this into a page-level flag"). But it is still page-owned and writes into the same shared `fields[]`.

### 5.3 Mechanism 3: all job state dies with the component

There is no job store: no `projectId → job` map, no queue, no cap, no abort, no "unseen result" flag. `UploadedFile.fileBlob` is held in React state; `lib/db.ts` (Dexie) is never used, so a refresh drops queued work, and a running stream cannot be reconnected (RFC A3).

### 5.4 What this implies for the plan

- The fix is not "move `isAnalyzing` up one level". The project's `fields[]`, `uploadedFiles[]` and `currentProject` are also singletons that are overwritten on switch (`:217-231` `clearFiles(); resetFields()`), so anything async that outlives a switch writes to the wrong project. The store must key **data, not just flags**, by `projectId`.
- Remove the early-return spinner; loading must render inside regions (skeletons).
- Replace the single `ProjectContext.isLoading` with per-operation, per-project state.
- Add `AbortController` to both stream functions (needed for cancel and for queue semantics).
- `useDocumentManager` clears blob URLs on switch (`clearFiles` revokes them); a running upload for A would still call `setUploadedFiles(prev => [...prev, ...newFiles])` on whatever is current.

## 6. Where categories are hardcoded

The backend sends `category` per canonical parameter (`CanonicalParameter.category`), but nothing in the frontend reads it.

| # | Location | What is hardcoded | Effect |
|---|---|---|---|
| 1 | `types/index.ts:36-90` `SCHEMA_GROUPS` | 4 groups ("Voltage Specs", "Current Specs", "Temperature Specs", "Capacity Specs") with 27 fixed parameter ids, labels (= id) and units. `EOL_*` params are listed under *Capacity*. No `END_OF_LIFE` group. | Source of truth for everything below. |
| 2 | `components/input-fields-list.tsx:37-52,66` | Builds groups by filtering `fields` against `SCHEMA_GROUPS`, then `if (groupFields.length === 0) return null`. | **Any parameter not in the 27 ids is dropped from the UI** (new canonical parameters, custom ones, End of Life). Empty groups are hidden, the opposite of §8.2 ("empty category still renders"). |
| 3 | `components/input-field-item.tsx:85` | Default unit looked up from `SCHEMA_GROUPS` when the spec has no unit. | New parameters get `''` instead of the backend's `expected_unit`. |
| 4 | `lib/parameter-adapter.ts:17-19` (`FIELD_LABEL_MAP`) | Label map from `SCHEMA_GROUPS`. **Dead**: defined, never used (the live one is #5). | Remove. |
| 5 | `lib/parameter-adapter.ts:209-211` (`schemaLabelMap`) | Label used by `specsStreamToInputFields` for streamed fields. Unknown ids fall back to the id. | Labels come from the constant, not from `parameter_alias`. Mostly harmless because `handlePopulateExtractedData` keeps `prev.label`. |
| 6 | `static/battery-template.ts` | `.battery` exporter reads fixed ids (`C_NOMINAL_AH`, `EOL_SOH_NOM`, `U_MIN`, `U_MIN_SAFETY`, `I_MAX_*`, `T_*`) and fixed units, with `uMin - 0.02` fallback for `U_MIN_SAFETY`. Its comment says "EXACT MAPPING TO SCHEMA_GROUPS IDs". | This is a **different concern**: the export format is fixed by the downstream tool. It should not follow the project schema, but it must not depend on `SCHEMA_GROUPS` once that constant is removed. Needs an explicit decision. |
| 7 | `hooks/ParameterManager.tsx` | No category logic, but `hydrateFieldsFromDB` builds fields only from `ProjectParameter`, which has **no `category` field** in the client type. | Category must be added to the `ProjectParameter` type, **but `GET /projects/{id}` is untyped in openapi**, so whether it returns `category` is unknown (open question Q1). |
| 8 | `api/analyze-document.ts:71,82` | Reads `data.category` only for the status string ("Extracting Voltage…"). Not hardcoded, but this is the place the Extract screen's category cards will key off. | OK. |
| 9 | `CLAUDE.md §5/§6/§7` and `README` | State "Voltage, Current, Temperature, Capacity". | Doc updates when the step lands (§0.7). |
| 10 | Rules in `CLAUDE.md §7` (`I_MAX_DCH_*` negative, `_PULSE`/`_CONTINUOUS`, min/typ/max) | Domain display rules keyed on parameter-key naming. | Not categories, but they will need a key-pattern helper, not a list. |

Not found: no other file lists categories (grep for `Voltage|Capacity|Temperature|VOLTAGE|END_OF_LIFE|EOL_` outside the above is empty).

## 7. Risks and open questions

### 7.1 Risks

| # | Risk | Notes |
|---|---|---|
| R1 | **Untyped responses block a typed client.** `/projects/*`, `/audit/*`, `/flagging/*`, `/specs/*`, `/files/*` all return `{}` in openapi. Generated types will not catch drift on the main screens. | RFC §5 P0. A hand-written type for `GET /projects/{id}` is a stopgap, and it is what `api/projects.ts` is today. |
| R2 | **Shared mutable `fields[]` corrupts data across projects** (§5.2). It is a live bug today, not only a UX limit. | Fix it in the job-store step, and say so in that step's history note. |
| R3 | **Per-browser job cap across tabs** (BroadcastChannel / Web Locks) is the hardest requirement in CLAUDE.md §8.1; the exact "one tab owns each running job" handover on tab crash needs a lease/heartbeat. | Budget its own step. |
| R4 | **Streams cannot be cancelled or resumed.** No `AbortController`, and (RFC A3) the backend likely stops on disconnect and saves only on `complete`. Cancelling a *running* job may therefore waste tokens or produce nothing. | Confirm in Explore B; Plan A should only promise cancel for *queued* jobs. |
| R5 | **Highlight correctness is unverified.** PDF y-flip assumes a bottom-left origin and `originalHeight`; the code has no calibration test (RFC §4.3). Excel has no merged-region support (RFC §4.4 BHV). Page numbers are used as sheet index/name for Excel with guesswork. | Test docs BHV, CFC, DAM, NoTP .xlsm, BeglDok_Z65 are named in the RFC but are not in this repo. |
| R6 | **Light mode and viewers.** Documents must stay light while chrome follows the theme; the viewers currently own dark surfaces and a hardcoded blue overlay. Contrast of the overlay on white must be checked in both modes. | §4.8 |
| R7 | **Big-bang risk in replacing `bda/page.tsx`.** Many behaviours are implicit (flag chain advancement order, persist-on-flag, autosave of flags via `saveParametersSilent`). The comments in `useAnalyze` show these were hard-won (`applyFlagChain` must run after populate). | Port them with their comments; add manual-check items to history notes. No test suite exists. |
| R8 | **Dead or misleading docs.** `CLAUDE.md §5` says `app/page.tsx` re-exports `bda/page`, login is unwired, and the sidebars list "files"; none is true now. The `memory/` and `claude-notes/notes/` folders describe older states. | Correct §5 in the first step that touches routing. |
| R9 | **Uncommitted work in the tree:** `static/battery-template.ts` is modified; `scripts/`, `_bundled_frontend_types.md`, `frontend_codebase_tree.txt` are untracked; `CLAUDE.md`, `FE_RFC.md`, `openapi.json` and the two new PNGs show as modified/untracked after the last commit `d68d644`. Step 1's commit must not sweep these in. | Ask the owner what to do with them. |
| R10 | **Performance:** `MemoizedInputFieldsList` is memoised but receives fresh arrow functions from `bda/page.tsx` (`handleUpdateMetadata`, `handleFlagAndRetry` on `fields`), and `handleSwitchSpecification` closes over `fields`; every stream partial re-renders all rows (120 ms throttle exists). Large projects will feel it. | Plan the store with selectors / per-row subscription. |
| R11 | **Unpinned CDN dependency:** `pdf.worker.min.mjs` from `unpkg.com`. Breaks offline/air-gapped deployments (battery customers). | Ship the worker from `public/` or the bundle. |
| R12 | **No real auth** (A2): `localStorage['bda_user']` holds the whole user object, and `/admin` has no guard besides login. The UI must not imply permissions. | Plan: label Global Admin as unauthenticated. |

### 7.2 Open questions (need an answer before Plan A)

| # | Question | Why it matters |
|---|---|---|
| Q1 | Does `GET /projects/{id}` return `category` (and `expected_unit`, reason code, flag type) on each parameter? openapi gives no schema. If not, is it acceptable to join on `GET /extraction-templates/parameters` (`CanonicalParameter.category`) by `parameter_key = name`? | Decides how §8.2 grouping is implemented without inventing fields (CLAUDE.md §0.4). |
| Q2 | Where does the customer name for the breadcrumb come from? `Project.customer` is typed as string, but `ProjectCreateInput` sends `customer_id`. Is there a customer in the project payload, or must we join `GET /customers/`? | RFC §2 breadcrumb. |
| Q3 | Routing: OK to introduce `/projects/[projectId]/…` URLs (replaces `/bda`, `/review`; `/admin` stays)? | Required for deep links, multi-tab, and "completion never navigates". |
| Q4 | Is `GET /documents/{doc_id}/file` identical to `Project.documents[].file_url`? Which status code for missing files today (404; RFC proposes 410)? | Viewer degrade path (RFC A4). |
| Q5 | Which job cap applies to *correction* runs (`stream-parameter`)? They are short and per-row; counting them could queue a row retry behind three long extractions. | CLAUDE.md §8.1 says "uploads and extractions both count". |
| Q6 | Accent colour: keep the brand cyan `#00AAB9` (it must also pass contrast on white for text and focus rings) or pick a new one? CLAUDE.md says "your own single accent". | Plan A §1 tokens. |
| Q7 | Is Tailwind meant to stay? It is installed and imported in `globals.css` but no component uses utility classes. | Removing it simplifies the CSS reset. |
| Q8 | `static/battery-template.ts` is currently modified in the working tree and ties to fixed keys: should the `.battery` export stay in the new UI, and under which screen (Review? Overview?) | §6 #6. |
| Q9 | The `Settings: User Management` dialog registers users with department free-text; the backend enum is `Zelle/Module/Pack`. Is user registration part of this app's scope, or a leftover? | §3.1 #14. |
| Q10 | Does the backend save `partial` category results as they stream or only on `complete`? (RFC §5b.1 risk.) It decides whether an interrupted job loses everything. | R4. |

## 8. What this exploration did not cover

- No code was executed (no `npm run build`/`lint`, no dev server), so there is no measured baseline for build or lint, and no visual check of the current UI.
- The Mindee screenshots were viewed; the three files in `claude-notes/context/` are the complete set.
- SSE payload shapes were taken from the existing parsers, not from the backend summary (`Backend_summary_9-10-2026.md` is not in this repo).
- `TemplatesManager/index.tsx` (658 lines), `FeedbackModal.tsx` and the admin components were skimmed for colours, categories and API use, not read line by line.
