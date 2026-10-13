# BDA Page Modularity Analysis & Refactor Plan
_Generated: 2026-04-12_

---

## Summary

`app/bda/page.tsx` is 355 lines. Logic is well-separated into hooks/contexts,
but the JSX layer still has significant inline structure that should be extracted
into dedicated components and a focused hook. The file has 5 distinct problems.

---

## What Is Already Modular (Do Not Touch)

- **Custom hooks**: `useParameterManager`, `useDocumentManager`, `useResizer` — logic is clean
- **Contexts**: `useAuth`, `useProject` — well-factored
- **Reusable components**: `MemoizedSidebar`, `MemoizedInputFieldsList`, `LayoutHeader`, `DocumentUpload`, `DocumentRouter` — already extracted
- **API layer**: `analyzeDocument` in its own file
- **Theme / colors**: separate modules

---

## Problems

### Problem 1 — Inline vertical toolbar (lines 260–317, ~57 lines of JSX)

The icon action strip (Upload, Analyze, Save, Export, Sidebar toggle) lives
entirely in the main component as raw JSX. It is a self-contained UI unit with
its own layout (`flexDirection: column`, `TOOLBAR_WIDTH = 56`).

**Fix:** Extract to `components/ActionToolbar.tsx`.

Props needed:
```ts
interface ActionToolbarProps {
  onUploadClick: () => void;
  onAnalyze: () => void;
  onSave: () => void;
  onExport: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  isAnalyzing: boolean;
  analyzeStatus: string;
  isSaving: boolean;
  isExporting: boolean;
  isAnalyzeDisabled: boolean; // uploadedFiles.length === 0 || isAnalyzing
  isExportDisabled: boolean;  // isExporting || !activeProjectId
}
```

---

### Problem 2 — Inline async `onClick` on Analyze button (lines 267–289)

A 22-line async arrow function is written directly as an `onClick` prop in JSX.
It references 6+ pieces of state/refs. This is difficult to test, trace, or
modify safely.

**Fix:** Extract it as a named `handleAnalyze` function in the component body
(before the render return), wiring the same state. This is a pre-requisite for
Problem 3 below.

---

### Problem 3 — Analyze state/logic scattered across the page component

The following all belong together but are spread across the component:
- `isAnalyzing` (line 59) — state
- `analyzeStatus` (line 62) — state
- `analyzeUiTickRef` (line 65) — ref
- `pendingPartialRef` (line 66) — ref
- `flushAnalyzePartial` (lines 183–188) — function
- `queueAnalyzePartial` (lines 190–194) — function
- The inline onClick handler (lines 267–289) — the trigger

**Fix:** Extract to `hooks/useAnalyze.ts`.

Signature:
```ts
function useAnalyze(
  activeProjectId: string | null,
  uploadedFiles: UploadedFile[],
  handlePopulateExtractedData: (fields: InputField[]) => void
): {
  isAnalyzing: boolean;
  analyzeStatus: string;
  handleAnalyze: () => Promise<void>;
}
```

The page reduces to one hook call and one prop passthrough.

---

### Problem 4 — Inline no-projects initialization screen (lines 209–247, ~38 lines)

When `projects.length === 0`, the component renders a full-screen project
creation form — a `Paper` with an icon, `Alert`, `TextField`, and `Button` —
inline as a render branch inside `BDA()`. This is an entire screen in ~38 lines
that has its own state (`newProjectAlias`, `createError`).

**Fix:** Extract to `components/NoProjectsScreen.tsx`.

Props needed:
```ts
interface NoProjectsScreenProps {
  onCreateProject: (alias: string) => Promise<void>;
}
```

The component manages `newProjectAlias` and `createError` locally. The page
only passes `createNewProject` down via the prop.

---

### Problem 5 — Inline upload modal (lines 340–348)

The `Modal` + `Paper` + `DocumentUpload` + back button is ~10 lines of
structure that should not be anonymous JSX at the page level.

**Fix:** Extract to `components/UploadModal.tsx`.

Props needed:
```ts
interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (...) => void;
  isUploaded: boolean;
  isLoading: boolean;
}
```

---

## Execution Plan (in recommended order)

| Step | Action | Files Touched |
|------|--------|---------------|
| 1 | Extract `handleAnalyze` from inline JSX onClick to a named function | `app/bda/page.tsx` only |
| 2 | Create `hooks/useAnalyze.ts`, move refs + state + functions into it | New file + `app/bda/page.tsx` |
| 3 | Create `components/ActionToolbar.tsx`, move the toolbar JSX | New file + `app/bda/page.tsx` |
| 4 | Create `components/NoProjectsScreen.tsx`, move the empty-state render | New file + `app/bda/page.tsx` |
| 5 | Create `components/UploadModal.tsx`, move the modal JSX | New file + `app/bda/page.tsx` |

After all 5 steps, `app/bda/page.tsx` should be under ~150 lines and contain
only orchestration: hook wiring, layout shell, and render-branch guards.

---

## What NOT to do

- Do not touch the existing working hooks (`useParameterManager`, `useDocumentManager`)
- Do not restructure the 3-panel layout or change `SIDEBAR_WIDTH` / `TOOLBAR_WIDTH` constants
- Do not change the `useEffect` dependency logic — those effects are already working correctly
- Do not convert `handleSave` or `handleExport` into hooks unless they grow further; they are fine as named functions in the page for now
- Do not change any API calls or backend contract during this refactor

---

## Cross-References to Prior Analyses

The typing issues in `typing-analysis.md` (especially `pendingPartialRef: any[]`,
`activeHighlight: any`) and the hooks issues in `contexts-hooks-analysis.md` are
separate work items. This refactor plan is **layout/structure only** — fix
modularity without touching types or bug fixes. Those should be separate PRs.
