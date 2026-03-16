# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Backend Dependency

All API calls target an external Python backend (FastAPI) at `http://localhost:8000` by default. Override with the `API_URL` environment variable. The backend must be running for upload, analysis, and chat features to work.

Key backend endpoints:
- `POST /files/upload-document/` — upload a file for a project
- `POST /specs/extract-specs/?project_id=<id>` — run AI spec extraction
- `POST /chat` — chat with a document by `file_id`

## Architecture

### App Entry
`app/page.tsx` simply re-exports `app/bda/page.tsx` as the root. The BDA (Battery Document Analysis) page is the entire application. `app/login/page.tsx` exists but is not wired into the routing.

### Three-Panel Layout (`app/bda/page.tsx`)
The main page composes three panels:
1. **Sidebar** — lists uploaded files; clicking switches the active document
2. **Parameter Panel** — upload controls, Analyze button, and the full list of battery parameters
3. **Document Viewer** — resizable panel showing the active PDF or Excel file with highlight support

A drag handle between the parameter panel and viewer calls `useResizer` to manage the viewer width.

### State Management (custom hooks, no Redux/Zustand)
- **`hooks/ParameterManager.tsx`** — manages the `fields: InputField[]` state. Fields are pre-populated from `SCHEMA_GROUPS` in `types/index.ts` with empty `specifications`. After analysis, `handlePopulateExtractedData` replaces specs and auto-selects the highest-confidence one per field.
- **`hooks/DocumentManager.tsx`** — manages uploaded files (stored as blob URLs in memory), the active file, and the `activeSource` highlight target. `resolveSource()` normalizes backend source coordinates to either `PDFSource` or `ExcelSource` based on file MIME type. `handleJumpToSource` switches the active file and sets the highlight.

### Data Model (`types/index.ts`)
- `InputField` — a single battery parameter (e.g. `U_MIN`), holds an array of `Specification` candidates and a `selectedSpecId` pointer to the active one.
- `Specification` — one extracted value with `confidence`, `unit`, `source` (with `pageNumber`/`boundingBox` for PDFs or `tableName`/`cellCoordinates` for Excel), plus validation flags (`rule_passed`, `rule_violations`, `requires_review`).
- `SCHEMA_GROUPS` — the canonical list of expected fields grouped as Voltage, Current, Temperature, and Capacity specs. This drives both the default field list and labels.

### Document Viewers (`components/DocumentViewer/`)
`DocumentRouter` inspects the MIME type string and delegates to:
- `PdfViewer` — uses `react-pdf`, renders pages, highlights bounding boxes
- `ExcelViewer` — uses `xlsx` to parse workbook, highlights cells by row/column or bounding box

### API Layer (`api/`)
Thin fetch wrappers — no SDK, no interceptors. All three files read `process.env.API_URL` with a fallback to `localhost:8000`.

### Styling
Dark-mode MUI v7 theme defined in `theme/theme.ts`. Color tokens live in `theme/colors.ts` and are imported directly throughout components rather than using MUI's `sx` theme palette tokens.

### Local DB (`lib/db.ts`)
Dexie (IndexedDB) database named `BatterySpecDB` with a `files` table. Defined but check usages — file blobs may be held in memory (React state) rather than persisted to DB in the current implementation.

### Project ID
A UUID is generated client-side via `uuidv4()` on mount in `app/bda/page.tsx` and passed to every API call to group documents under one project session.
