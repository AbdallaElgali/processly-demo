# Internship Frontend Work Summary — Processly Demo
**Project:** Voltavision Processly Demo (Battery Document Analysis Tool)
**Role:** Frontend Developer (Intern)
**Tech Stack:** Next.js 16 · React 19 · TypeScript · Material UI v7 · react-pdf · xlsx · Dexie

---

## 1. Project Overview

Processly Demo is a web-based battery specification extraction tool built for Voltavision. Engineers upload PDF or Excel battery datasheets; an AI backend (FastAPI + LLM) extracts structured battery parameters (voltage limits, current ratings, temperature thresholds, capacity specs) from the documents. The frontend displays the extracted values alongside the source document, lets engineers review and correct them, flag items for quality assurance, and export results in a proprietary `.battery` XML format used downstream in simulation toolchains.

The application is a single-page Next.js app communicating with an external FastAPI backend at `http://localhost:8000`. There is no Redux or Zustand — state is managed through custom React hooks and Context API. The UI uses a dark MUI v7 theme with a custom cyan (`#00AAB9`) brand color.

---

## 2. Development Timeline & Key Milestones

| Milestone | Description |
|-----------|-------------|
| Initial scaffold | Project structure, layout skeleton, styling system |
| Layout & styling | Three-panel layout, MUI dark theme, color tokens |
| Core data model | `InputField`, `Specification`, `SCHEMA_GROUPS` type definitions |
| Multi-document upload | Drag-and-drop upload, document list, blob URL management |
| AI analysis pipeline | SSE streaming analysis, spec-to-field mapping, confidence scoring |
| Source highlighting | PDF bounding box overlay, Excel cell range highlight |
| Excel source fix | Corrected cell coordinate resolution for Excel highlights |
| Enhanced parameter UI | AI suggestions panel, source jump button, confidence badges |
| Export feature | Client-side `.battery` XML file generation |
| User cache fix | Backend re-verification on mount to prevent stale auth state |
| Parameter flagging | Flag/unflag fields with reason, API integration, Review page |
| Iterative re-analysis | Feedback loop: re-analyze only flagged fields with previous context |
| Docker setup | Multi-stage Dockerfile, standalone Next.js output |
| Auto-save | Silent auto-save on parameter changes without UI spinner |
| PDF fullscreen fix | Fixed fullscreen re-measurement and highlight positioning |
| Flag param fixes | Corrected flag API params, refactored default param loading from DB |

---

## 3. Application Architecture

### 3.1 Three-Panel Layout

The main view (`app/bda/page.tsx`) is organized as three panels separated by a draggable resize handle:

```
┌──────────┬──────────────────────────┬─────────────────────────┐
│ Sidebar  │    Parameter Panel       │    Document Viewer      │
│          │  ┌──────────────────┐   │  ┌───────────────────┐  │
│ Projects │  │ ActionToolbar    │   │  │ DocumentRouter    │  │
│ & Docs   │  │ (upload/analyze/ │   │  │  → PdfViewer      │  │
│          │  │  save/export)    │   │  │  → ExcelViewer    │  │
│          │  ├──────────────────┤   │  └───────────────────┘  │
│          │  │ InputFieldsList  │   │                          │
│          │  │ (grouped params) │   │   ← drag to resize →    │
└──────────┴──────────────────────────┴─────────────────────────┘
```

The sidebar is collapsible. The drag handle between the parameter panel and viewer is implemented via `useResizer`, which uses `requestAnimationFrame` debouncing to prevent layout thrashing during mouse movement.

### 3.2 Page Structure

| Page | Description |
|------|-------------|
| `app/page.tsx` | Root redirect — checks auth, sends to `/bda` or `/login` |
| `app/login/page.tsx` | Username login — calls `GET /auth/user`, stores session in localStorage |
| `app/bda/page.tsx` | Main application — uploads, analysis, parameter editing, save, export |
| `app/review/page.tsx` | Read-only review mode — shows only flagged parameters with source links |
| `app/layout.tsx` | Root layout — wraps `AuthProvider` + `ProjectProvider`, fonts, metadata |

### 3.3 Context Providers

**`AuthContext.tsx`** manages user session lifecycle:
- Login via `GET /auth/user?username=X` — validates user existence before accepting
- Session persisted to `localStorage` as `bda_user`
- On every app mount: re-verifies user with backend (prevents stale cached sessions)
- Logout clears localStorage and routes to `/login`

**`ProjectContext.tsx`** manages multi-project state:
- Fetches the user's project list from `GET /projects/user/{userId}`
- Loads full project details (documents, saved parameters) on project switch
- Exposes `createNewProject`, `addContributor`, `saveParameters`, and `saveParametersSilent` (for auto-save without triggering a loading state)

### 3.4 Custom State Management Hooks

Rather than a global store, each concern is encapsulated in a custom hook. The hooks compose together in `app/bda/page.tsx`.

**`useParameterManager`** — owns the `fields: InputField[]` state:
- Provides `handleFieldChange` (edit a value/unit), `handleSwitchSpecification` (switch active AI candidate), `handlePopulateExtractedData` (merge AI extraction results)
- Handles flagging by calling the flag/unflag API and updating local state
- `hydrateFieldsFromDB` loads saved parameters from the backend on project switch
- Auto-selects the highest-confidence specification per field after analysis

**`useDocumentManager`** — owns uploaded files and the active highlight:
- Stores files as blob URLs created from `URL.createObjectURL()`
- `handleJumpToSource` switches the active file and sets `activeSource` (the highlight target)
- `hydrateFiles` fetches documents from the backend and re-creates blob URLs, with `?t=Date.now()` cache-busting to prevent stale browser cache returning the previous user's files
- `clearFiles` revokes all blob URLs on project switch to prevent memory leaks

**`useAnalyze`** — drives the AI extraction pipeline (see Section 5.1)

**`useResizer`** — drag-to-resize panel widths with RAF debouncing and min/max enforcement

---

## 4. Data Model

All types are defined in `types/index.ts`.

### `InputField`
Represents one battery parameter (e.g., `U_MIN` — minimum voltage):
```
id             — parameter key (maps to backend schema)
dbId           — UUID for the DB row (used for flag API calls)
label          — display label
specifications — array of candidate Specification objects
selectedSpecId — pointer to the active spec
isFlagged      — boolean review flag
flagReason     — optional reviewer note
```

### `Specification`
One extracted value candidate:
```
id, value, unit, confidence (0–100)
source: SpecificationSource
rule_passed, rule_violations[], requires_review
```

### `SpecificationSource`
Where the value was found:
```
PDF:   pageNumber, boundingBox { x, y, width, height }
Excel: tableName, cellCoordinates { row, column }
Both:  textSnippet, reason
```

### `SCHEMA_GROUPS`
A hardcoded registry of all expected parameters, grouped into four categories:
- **Voltage** (8 params): U_MIN, U_MAX, U_MIN_DYN, U_MAX_DYN, U_MIN_PULSE, U_MAX_PULSE, U_MIN_SAFETY, U_MAX_SAFETY
- **Current** (4 params): I_MAX_CHA_CONTINUOUS, I_MAX_DCH_CONTINUOUS, I_MAX_CHA_PULSE, I_MAX_DCH_PULSE
- **Temperature** (8 params): body and terminal min/max, plus safety margins for each
- **Capacity** (7 params): C_NOMINAL_AH, E_NOMINAL_WH, EOL metrics

This drives both the default empty field list shown before analysis and the grouping/labels in the parameter panel.

---

## 5. Key Features Implemented

### 5.1 AI Extraction with Server-Sent Events (SSE)

The analysis pipeline (`hooks/useAnalyze.ts` + `api/analyze-document.ts`) uses SSE to stream extraction results progressively from the backend.

**Flow:**
1. `POST /specs/stream-specs?project_id=X` — optionally with `previousSpecs` for iterative mode
2. The backend emits JSON events with `status` field: `partial`, `partial_correction`, `refining`, `complete`, `error`
3. On `partial` / `partial_correction`: call `mapSpecsToFields()` and queue a debounced UI update (120 ms buffer via RAF, preventing React render thrashing)
4. On `complete`: call `handlePopulateExtractedData()` with the final result

**Status messages shown in the toolbar during analysis:**
- "AI Ready..." → "Extracting {parameter}..." → "Correcting {parameter}..." → "Running Final QA Pass..." → "Finalizing UI..."

**Bidirectional schema mapping:**
The backend uses `{x0, y0, x1, y1}` bounding boxes and confidence in `[0, 1]`. The UI uses `{x, y, width, height}` and confidence in `[0, 100]`. Two mapping functions (`mapSpecsToFields`, `mapFieldsToSpecs`) handle the conversion in both directions, including bounding box format and confidence scale.

**Iterative re-analysis (feedback loop):**
When the user has flagged fields for review, clicking Analyze again sends the current field values back to the backend (`mapFieldsToSpecs` + flagged-field detection). The backend can then focus extraction on the flagged parameters using the previous context as a hint. This was a significant feature addition that required careful handling of the bidirectional mapping to ensure flagged fields were always included in the payload even when they had no extracted value.

### 5.2 Document Viewers with Source Highlighting

#### PDF Viewer (`components/DocumentViewer/PdfViewer.tsx`)

Built on `react-pdf` (PDF.js under the hood). Key capabilities:
- **Bounding box highlight overlay**: A semi-transparent blue box is drawn over the exact location in the PDF where the AI found the value
- **Highlight algorithm**:
  1. Extract `{x0, y0, x1, y1}` from source (or `{x, y, width, height}` — both supported)
  2. Detect whether coordinates are normalized (0–1 range) or absolute pixels
  3. Convert normalized → absolute by multiplying by page dimensions
  4. Apply **Y-axis flip** (`flippedY = pageHeight - y - height`) because PDF coordinate space is bottom-up, while CSS is top-down
  5. Add 20 px padding for visual clarity
  6. Convert to CSS percentage-based positioning for overlay
- **Page outline fallback**: when a source has no bounding box, outlines the entire page with a blue border
- **Zoom**: +/−/reset buttons, scale range 0.5×–3×, updates tracked via RAF-debounced resize observer
- **Fullscreen**: `requestFullscreen()` / `exitFullscreen()` with re-measurement of base dimensions on enter/exit to keep overlays accurate
- **Text snippet**: shows matched text in a Paper banner below the viewer
- **Key-based reset**: `DocumentRouter` passes `key={fileUrl}`, forcing React to hard-unmount and re-mount `PdfViewer` on file change — prevents "ghost" PDF worker threads from lingering

#### Excel Viewer (`components/DocumentViewer/ExcelViewer.tsx`)

Built on the `xlsx` library. Parses workbook binary data and renders sheets as HTML tables:
- **Sheet tabs**: sticky tabs above the table for navigation; switches to the correct sheet automatically based on `activeHighlight.pageNumber` (sheet index or name)
- **Cell/range highlight**: resolves highlight bbox `{x0, y0, x1, y1}` → `{r1, c1, r2, c2}` cell indices, then applies highlight background and border to all cells in the 2D range
- **Sticky headers**: column headers (A, B, C…) and row numbers stay visible during scroll; highlighted when any cell in their row/column is selected
- **Zoom**: applied via CSS `zoom` property on the table container
- **Fullscreen**: same API as PDF viewer

### 5.3 Parameter Flagging & Review Workflow

Each parameter field has a flag button that expands an inline panel:
- User enters an optional reason text
- Clicking "Flag" calls `POST /projects/flag-parameter` with `user_id`, `parameter_id`, and `reason`
- The field's `isFlagged` state is set locally, the flag icon becomes solid red
- Flagged fields are highlighted in the parameter list so they stand out
- Clicking "Remove" calls `POST /projects/unflag-parameter` and clears local state

The **Review page** (`app/review/page.tsx`) provides a read-only mode showing only flagged parameters. It is accessible via the "Review Mode" link in the `ProjectBar`. There are no upload, analyze, save, or export controls — only the parameter list and document viewer with highlight support. This was designed for a QA reviewer role who should not be able to modify data.

### 5.4 Export to `.battery` XML

Implemented in `static/battery-template.ts` — fully client-side, no backend call needed.

The export:
1. Reads the `selectedSpec` value and unit for each `InputField`
2. Maps parameter IDs to the `.battery` XML schema
3. Constructs an XML string with default configuration (Musterstand, 1 cell, 2 sectors)
4. Creates a Blob and triggers a browser download
5. Filename format: `{ProjectName}_Battery_V2.01_{YYYYMMDD}.battery`

### 5.5 Auto-Save

After flagging or unflagging a parameter, or after switching a selected specification, the app silently saves the current state to the backend using `saveParametersSilent()`. This function performs the same `PUT /projects/{id}/parameters` call as the explicit Save button, but skips setting `isLoading` — the user sees no spinner or feedback. This ensures the backend is always up to date without disrupting the workflow.

### 5.6 Multi-Project & Multi-Document Management

The sidebar (`components/Sidebar.tsx`) manages:
- Expandable project folders, each listing their uploaded documents
- "Create Project" modal with alias input
- "Add Contributor" modal for sharing a project with another user by username
- Clicking a document in the sidebar switches the active file in the viewer

Each project session has a server-side persistent identity (UUID from the backend). Documents are stored server-side and re-fetched with `hydrateFiles` on project load, recreating blob URLs from the backend file paths.

### 5.7 Read-Only Mode During Long Operations

While analysis, save, or export is running, all parameter inputs and action buttons are set to read-only / disabled. This prevents race conditions where a user edits a field mid-analysis and the SSE partial update overwrites their change.

---

## 6. Technical Challenges & Solutions

### 6.1 PDF Coordinate System Mismatch
**Problem:** PDF bounding boxes use a bottom-up Y axis (Y=0 at page bottom), but CSS positions elements from the top. The backend returned coordinates that placed highlights visually upside-down.

**Solution:** Applied a Y-flip transformation in `PdfViewer.tsx`: `flippedY = pageHeight - y - height`. Also added detection for whether coordinates are normalized (0–1 range) vs absolute pixels, since different backend extraction runs produced different formats.

### 6.2 Ghost PDF Worker Threads on File Switch
**Problem:** When switching between documents, the `react-pdf` PDF worker thread from the previous document was not properly terminated, causing memory leaks and occasionally rendering artifacts from the old document.

**Solution:** Added `key={fileUrl}` to the `DocumentRouter` component. When the file URL changes, React unmounts and remounts the entire component tree (including `PdfViewer`), guaranteeing that the old worker is destroyed and a new one is created cleanly.

### 6.3 Stale User Cache Across Sessions
**Problem:** When a user logged out and a different user logged in (especially in shared/testing environments), the browser's localStorage still held the previous user's session. The second user would briefly see the first user's project data before auth caught up.

**Solution:** On every app mount, `AuthContext` re-verifies the cached username via `GET /auth/user?username=X`. If the backend returns 404, the session is immediately cleared and the user is sent to the login page. Additionally, blob URL creation in `DocumentManager` adds `?t=Date.now()` to file fetches to bypass the browser cache.

### 6.4 React Re-render Thrashing During SSE Streaming
**Problem:** The SSE analysis stream emits partial updates frequently (one per extracted parameter). Calling `setState` for each event caused many rapid re-renders, making the UI visibly sluggish during analysis on large documents.

**Solution:** Added a 120 ms `requestAnimationFrame`-based debounce buffer in `useAnalyze`. Partial updates are batched: the most recent partial result is held in a ref, and only committed to state once per animation frame. This reduced re-renders from ~40/s to ~8/s with no perceptible latency difference.

### 6.5 Iterative Re-Analysis with Flagged Fields
**Problem:** When only some fields are flagged for re-analysis, the backend needs the current values of all fields to provide context, but should focus on the flagged ones. The mapping from UI `InputField` format back to the backend `specs` schema was complex, especially preserving bounding boxes accurately.

**Solution:** `mapFieldsToSpecs()` in `api/analyze-document.ts` converts the full field list to the backend schema, including reversing the `{x,y,width,height}` → `{x0,y0,x1,y1}` conversion and rescaling confidence back to `[0,1]`. Flagged fields are always included even when their value is empty, so the backend knows which parameters to re-examine.

### 6.6 Project Hydration vs. In-Memory AI Specs
**Problem:** After saving, reloading project details from the backend replaces in-memory specs (which have full bounding box data) with DB-persisted specs (which only store text snippets, not bounding boxes). This meant source highlighting was lost after a save.

**Solution:** Used `prevProjectIdRef` in `app/bda/page.tsx` to track the previous project ID. `hydrateFieldsFromDB` is only called when the project ID genuinely changes (not when saving triggers a reload of the same project). This preserves the in-memory AI-extracted specs with their bounding boxes across save operations.

### 6.7 PDF Fullscreen Highlight Positioning
**Problem:** Entering fullscreen mode changes the page's rendered width. The bounding box overlay used absolute-pixel offsets calculated against the original width, so the highlight appeared in the wrong position after going fullscreen.

**Solution:** Added a `ResizeObserver` on the page container that re-measures the base width whenever the element's size changes. The overlay positions are re-computed in percentage terms relative to the current rendered width, so they remain accurate at any zoom level or fullscreen state.

---

## 7. Component Breakdown

### Layout & Navigation
| Component | Description |
|-----------|-------------|
| `LayoutHeader.tsx` | 60 px fixed app header with title and responsive hamburger menu |
| `ProjectBar.tsx` | Sub-header with active project, username, logout, and Editor/Review mode toggle |
| `Sidebar.tsx` | Collapsible project/document tree with create and contributor modals |
| `NoProjectsScreen.tsx` | Full-screen empty state with project creation form |

### Action Controls
| Component | Description |
|-----------|-------------|
| `ActionToolbar.tsx` | Vertical icon toolbar: upload, analyze (with spinner), save, export, sidebar toggle |
| `UploadModal.tsx` | Modal wrapper for the drag-and-drop upload component |
| `document-upload.tsx` | Drag-and-drop + click file input; accepts PDF, Excel, Word, images; shows upload status |

### Parameter Form
| Component | Description |
|-----------|-------------|
| `input-fields-list.tsx` | Renders all parameters grouped by `SCHEMA_GROUPS` category with group completion counters |
| `input-field-item.tsx` | Single parameter row: value/unit inputs, confidence badge, AI suggestions panel, flag panel, source jump |

### Document Viewers
| Component | Description |
|-----------|-------------|
| `DocumentRouter.tsx` | MIME type dispatcher: delegates to `PdfViewer` or `ExcelViewer`; enforces key-based remount |
| `PdfViewer.tsx` | react-pdf wrapper with zoom, fullscreen, bounding box overlay, text snippet display |
| `ExcelViewer.tsx` | xlsx table renderer with sheet tabs, cell highlighting, zoom, fullscreen |

---

## 8. API Layer

All API calls are thin `fetch` wrappers in `api/`. Base URL read from `process.env.API_URL` with fallback to `http://localhost:8000`.

| File | Methods | Endpoints |
|------|---------|-----------|
| `upload-doc.ts` | `uploadDocuments()` | `POST /files/upload-documents/` |
| `analyze-document.ts` | `analyzeDocument()`, `mapFieldsToSpecs()`, `mapSpecsToFields()` | `POST /specs/stream-specs` (SSE) |
| `parameters.ts` | `flagParameter()`, `unFlagParameter()` | `POST /projects/flag-parameter`, `POST /projects/unflag-parameter` |
| `projects.ts` | `apiCreateProject()`, `apiGetUserProjects()`, `apiGetProjectDetails()`, `apiAddContributor()`, `apiSaveProjectParameters()` | `/projects/*` |
| `chat.ts` | `sendMessage()` | `POST /chat` (not wired into main UI) |

---

## 9. Full Data Flow (Happy Path)

```
1. User logs in
   → AuthContext: GET /auth/user?username=X → store in localStorage

2. App loads /bda
   → ProjectContext: GET /projects/user/{userId}
   → First project auto-loaded

3. Project switch
   → DocumentManager.hydrateFiles: fetch docs from backend → blob URLs
   → ParameterManager.hydrateFieldsFromDB: load saved parameters

4. Upload documents
   → DocumentUpload: POST /files/upload-documents/ (multipart)
   → DocumentManager: create blob URLs, append to uploadedFiles

5. Analyze
   → useAnalyze: POST /specs/stream-specs?project_id=X (SSE)
   → Partial events → debounced field updates in ParameterManager
   → Complete event → handlePopulateExtractedData, auto-select highest confidence

6. Review parameters
   → User edits value/unit → handleFieldChange
   → User clicks confidence chip → handleSwitchSpecification
   → User clicks source icon → handleJumpToSource → DocumentViewer highlights

7. Flag a parameter
   → Flag panel opens → POST /projects/flag-parameter
   → Auto-save triggers (saveParametersSilent)
   → Flagged field visible in Review page

8. Re-analyze flagged fields
   → mapFieldsToSpecs sends previousSpecs + flagged marker
   → Backend targets flagged parameters; result merged back

9. Save
   → ProjectContext.saveParameters: PUT /projects/{id}/parameters
   → Snackbar confirmation

10. Export
    → battery-template.ts generates XML → browser download
```

---

## 10. Styling Architecture

**`theme/colors.ts`** defines a flat token object with all color values. Components import this object directly rather than using MUI theme palette tokens — this made color changes fast and predictable without needing to navigate the MUI theme override system.

Key tokens:
- `primary: '#00AAB9'` — Voltavision cyan, used for buttons, badges, active states
- `background: '#121212'` — main page background
- `surface: '#1E1E1E'` — sidebar, header, modals
- `surfaceHighlight: '#2D2D2D'` — hover states, input backgrounds
- `success / error / warning` — confidence color-coding (green > 95%, orange > 80%, red otherwise)

**`theme/theme.ts`** constructs the MUI dark theme using these tokens, setting Inter/Roboto as the font stack and disabling MUI Paper's default `backgroundImage` gradient (which conflicts with the flat dark surfaces).

---

## 11. Infrastructure

A multi-stage `Dockerfile` builds the app for production:
1. **deps** stage: install `node_modules` on Node 20 Alpine
2. **builder** stage: `next build` with `output: 'standalone'`
3. **runner** stage: minimal image with only the standalone output, runs on port 3000

`next.config.ts` sets `output: 'standalone'` for the Docker build. The API URL is injected at runtime via the `API_URL` environment variable.

---

## 12. Dependencies

| Package | Version | Role |
|---------|---------|------|
| next | 16.0.10 | Framework (App Router) |
| react / react-dom | 19.2.1 | UI library |
| @mui/material | 7.3.6 | Component library |
| @mui/icons-material | 7.3.6 | Icon set |
| react-pdf | 10.2.0 | PDF rendering via PDF.js |
| xlsx | 0.18.5 | Excel workbook parsing |
| dexie | 4.2.1 | IndexedDB wrapper |
| uuid | 13.0.0 | Client-side UUID generation |
| tailwindcss | 4 | CSS utility layer (minimal use) |
| typescript | 5 | Static typing |
