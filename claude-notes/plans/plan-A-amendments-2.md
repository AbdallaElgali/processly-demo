# Plan A amendments, part 2 (owner feedback after step 7, 2026-10-09)

- **Append these sections (AM11–AM18) to `claude-notes/plans/plan-A-amendments.md`**, then delete this file. Same precedence: amendments win over plan-A.md.
- Source: the owner's review of the running app after step 7, with two screenshots (light-mode Review, dark-mode Extract).

---

## AM11. Extract and Review become one screen: the Workspace

**Owner decision:** extraction and review happen on one screen, not two.

**Change to D4:** the project routes become `overview | workspace | parameters | prompts | audit | settings`. `extract` and `review` redirect to `workspace`. The rail shows one "Workspace" item where Extract and Review were. Update RFC §2's diagram and CLAUDE.md §5 in the same commit.

**Layout (desktop and laptop):**

```
┌ Header: breadcrumb · job tray · theme · account ─────────────────────────────────────┐
│Rail│ Toolbar: [+ Add documents] [Analyze] ‹compact run timeline›   Save  Approve  Export │
│    ├─────────────────────────────────┬──────────────────────────────────────────────┤
│    │ Parameters (grouped by category) │ [Doc 1][Doc 2][Doc 3][▾ all docs]             │
│    │ header: Voltage 4/8 · live state │ Viewer (PDF or Excel), full height            │
│    │ rows ...                         │                                              │
│    │ row detail: candidates, "Why"    │                                              │
│    └──── resizable split (SplitPane) ─┴──────────────────────────────────────────────┘
```

| Element | Rule |
|---|---|
| No documents yet | The whole workspace body is the large dropzone (the Mindee pattern). |
| Documents exist | "Add documents" in the toolbar, **and** dropping files anywhere on the workspace shows a full-area drop overlay. |
| Running job | The `RunTimeline` collapses into one compact line in the toolbar (expand on click for details and warnings). The project stays fully reviewable while it runs. |
| Category progress | **CategoryCards are removed from this screen.** Their live state (found/total, pending, running, failed) moves into the category headers of the parameter table, so the same information is not shown twice. |
| Runs history | Moves to Audit's Runs tab (already planned in step 13), plus a "Runs" link in the toolbar. |
| Document list | Replaced by the document tabs above the viewer (AM12). Upload warnings and "not yet analyzed" status appear on the tab. |

Reuse what steps 7 and earlier built (`Dropzone`, `RunTimeline`, `JobBanner`, `lib/categories.ts`, the job store); this is a re-composition, not a rewrite.

---

## AM12. Fast document switching: the viewer as a secondary workspace

**Owner requirement:** switching between documents must be quick and seamless; the viewer should feel like a second workspace for browsing documents.

- **Tabs above the viewer**, one per project document, with file-type icon and status. A "▾ all documents" menu with search when tabs overflow.
- **Per-document view state is kept**: page, zoom, scroll position, active sheet, selected cell. Store it in the project-data store keyed by `documentId`, so returning to a document lands exactly where the user left it.
- **Prefetch**: after the workspace opens, fetch all of the project's documents in the background (bounded concurrency, and a per-project size budget as one constant; above the budget, prefetch only the first few and fetch the rest on demand).
- **Keep recently viewed documents mounted** (e.g. the last 3, hidden when inactive) so switching back does not re-parse the file. One constant.
- **Jump to source** from a parameter switches to the right tab automatically and keeps the user's place in the tab they left.
- **Keyboard**: a shortcut for next/previous document. Choose keys that do not collide with browser or OS shortcuts (check Chrome, Edge and Firefox on Windows) and list them in the `?` shortcut sheet.
- **Deferred, ask before building:** popping the viewer out into a separate browser window for a second monitor, synced through the existing BroadcastChannel.

---

## AM13. Light mode must look finished on every screen it touches

**Problem (screenshot, light mode Review):** the category headers render as near-black bars, and the viewer chrome is black with an unreadable zoom label. Both come from components still on the deprecated `theme/colors.ts` shim.

**Acceptance criteria for steps 8 and 9:**

- No component on the Workspace imports the shim.
- Category headers use surface tokens (e.g. `surface.sunken` with `text.primary`), never a dark fill in light mode.
- The viewer toolbar, tabs and canvas surround follow the theme; only the page itself (`document.page`) stays white. The zoom percentage and all toolbar icons pass contrast in both modes.
- Labels such as "VOLTAGE SPECS" disappear with `SCHEMA_GROUPS`; headers use the category label map ("Voltage").
- Verification includes screenshots in **both** modes at **1280 and 1920 px wide**, described in the history note.

---

## AM14. Use the available space

**Problem (screenshot, dark mode Extract):** content is capped at about 1000 px, leaving the right half of a wide screen empty.

- **Working screens** (Workspace, Parameters, Audit tables) are **full-bleed**: they fill the viewport width minus the rail, with resizable panes where there are two.
- **Reading or form screens** (Overview, Settings, Prompts) may cap line length, but use multi-column grids to fill wide screens rather than one narrow centered column.
- No fixed max-width containers on working screens. Check every screen at 1280 and 1920 px.

---

## AM15. Show the model's reasoning ("Why this value"), and find out where it is lost

**Owner observation:** the extraction reasoning ("CoT") is not visible. This may be a frontend gap, a backend gap, or both.

**Implicit assumption to state in the UI:** the internal chain of thought of the reasoning models is not returned by the API. What can be shown is the **rationale the model writes into its output**: `extraction_logic`, `source_reason`, `calculation_logic` (when `is_calculated`), and the `source_text_snippet`.

**Step 8 starts with a read-only diagnosis (no OpenAI spend):**

1. For the most recent run in an existing test project, check in the database whether `ai_metric_candidates.extraction_logic` and `source_reason` are populated, empty, or generic.
2. Check whether `GET /projects/{id}` returns them on each candidate.
3. Check whether any frontend component renders them.

Record the result in the history note. **If the backend stores them empty or generic, do not work around it**: add **B13** to AM8 naming which pipeline stage loses them (worker output, supervisor dedupe/correction, or `merge_partial_specs`), for Task B.

**Frontend (steps 8 and 10):** a "Why this value" section in the row detail, showing the rationale, the source snippet and the source location, for the selected candidate and for each alternative candidate. Empty fields show "No reasoning recorded", never a blank.

---

## AM16. Excel viewer: make it look and behave like Excel

**Owner wish (bonus, but high value):** the Excel viewer feels bland and not Excel-like.

Requirements:

- Column letters (A, B, C…) and row numbers, with sticky headers when scrolling.
- Gridlines, column widths and row heights taken from the workbook where available.
- **Sheet tabs at the bottom**, like Excel.
- A **name box** (e.g. `C12`) and a **formula/value bar** showing the selected cell's displayed value (and the formula text if available).
- **Merged cells in both directions** (row and column spans); a highlight inside a merged region covers the whole region.
- Displayed values use the workbook's number formatting (formatted text), not raw numbers.
- Basic cell styling (bold, fills, alignment) where the parser exposes it; never at the cost of performance.
- **Virtualised rendering**, so large sheets (e.g. the operating-window `.xlsm`) scroll smoothly.
- `.xlsm` read as data only (no macros), as already required.
- Keyboard: arrow keys move the selected cell; the name box accepts a typed reference to jump.
- Light document surface in both modes (AM13); highlight tokens unchanged.

Library choice: evaluate building the grid on the existing parser (SheetJS) with a virtualised grid, versus an existing grid component. Constraints: permissive licence (MIT or similar, no commercial licence), read-only use, row **and** column spans, virtualisation. Record the comparison and the choice in the history note.

---

## AM17. Revised remaining steps

| Step | Scope | Model |
|---|---|---|
| **8** | AM15 diagnosis first. The Workspace (AM11, AM14) with the parameter table (original step 8 scope: row states AM1, categories AM9, reason codes AM6, rounding AM10, export AM7, tests AM3) and light-mode fixes (AM13) for the table. Viewer kept as is, but placed in the new layout. | **Opus** |
| **9** | Document tabs and fast switching (AM12); PDF viewer chrome on tokens (AM13); highlights, anchors, calibration (original step 9). | **Opus** |
| **9b** | Excel viewer rebuild (AM16). | **Opus** |
| **10** | HITL actions (original step 10) plus the "Why this value" detail (AM15). | **Opus** |
| 11 | Parameters screen and **templates** (unchanged; full-bleed per AM14). | Sonnet |
| 12 | Overview and Settings (AM14 grids). | Sonnet |
| 13 | Prompts (read-only) and Audit, including the Runs tab moved from Extract. | Sonnet |
| 14 | Cleanup, plus a full-app sweep at 1280 and 1920 px in both modes. | Sonnet |

---

## AM18. Standing rules added by this feedback

- Every UI step's history note includes a short **"How it looks"** section: what was checked visually, in which mode and at which widths.
- The owner reviews the Workspace visually after steps 8 and 9 before the next step starts.