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
| `*.png` | Mindee reference screenshots. Visual **inspiration only**: take layout, density, navigation structure, the dropzone, the split-pane review pattern, and the guided-tour idea. **Do not** copy Mindee's logo, branding, red accent color, or exact styling. |

Plans and exploration findings go to `claude-notes/plans/`.

---

## 3. Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build (must pass after every step)
npm run lint     # Run ESLint (must pass after every step)
```

No test suite is configured yet. Until one exists, "verification" means build + lint + a manual check described in the history note.

---

## 4. Backend dependency

All API calls target the FastAPI backend (sibling repo `BDA/`) at `http://localhost:8000` by default. Override with the `API_URL` environment variable. The backend must be running for upload, extraction, and review features to work.

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

**SSE statuses the backend can emit:** `error`, `routing_truncated`, `routing_complete`, `no_frames_tagged`, `category_extraction_fallback`, `workers_complete`, `category_workers_failed`, `partial`, `complete` (plus `partial_correction` / `refining` on correction paths). Only `error` and `complete` are terminal.

**There is no real authentication.** `/auth` identifies users by a caller-supplied username. Do not build UI that implies permissions are enforced.

---

## 5. Current architecture (as of 2026-10-09, before the redesign)

> This section describes the code as it is today. The redesign (RFC §6) will change most of it; update this section as each step lands.

### App entry
`app/page.tsx` re-exports `app/bda/page.tsx` as the root. The BDA page is the entire application. `app/login/page.tsx` exists but is not wired into routing.

### Three-panel layout (`app/bda/page.tsx`)
1. **Sidebar**: lists uploaded files; clicking switches the active document
2. **Parameter Panel**: upload controls, Analyze button, and the list of battery parameters
3. **Document Viewer**: resizable panel showing the active PDF or Excel file with highlight support

A drag handle between the parameter panel and viewer calls `useResizer` to manage the viewer width.

### State management (custom hooks, no Redux/Zustand)
- **`hooks/ParameterManager.tsx`**: manages `fields: InputField[]`. Fields are pre-populated from `SCHEMA_GROUPS` in `types/index.ts`. After analysis, `handlePopulateExtractedData` replaces specs and auto-selects the highest-confidence one per field.
- **`hooks/DocumentManager.tsx`**: manages uploaded files (blob URLs in memory), the active file, and the `activeSource` highlight target. `resolveSource()` normalizes backend source coordinates to `PDFSource` or `ExcelSource` by MIME type. `handleJumpToSource` switches the active file and sets the highlight.

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
Thin fetch wrappers, no SDK, no interceptors. All read `process.env.API_URL` with a fallback to `localhost:8000`.

### Styling
Dark-mode MUI v7 theme in `theme/theme.ts`. Color tokens in `theme/colors.ts` are imported directly into components instead of using MUI palette tokens.

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
| `SCHEMA_GROUPS` is hardcoded with 4 categories | The backend schema is dynamic per project and has a 5th category, `END_OF_LIFE`. Parameter lists must come from the project, not a constant. |
| Only 5 SSE statuses handled | The new pipeline statuses (routing, fallback, workers, category failures) are silently ignored. |
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