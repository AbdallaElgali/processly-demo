# Step 9b: the Excel viewer rebuild (AM16), and no custom shortcuts (AM19)

## Goal
Step 9b per AM17: rebuild the Excel viewer to look and behave like Excel (AM16), with view state through the step-9 per-document mechanism and cell-level highlight calibration on the BHV and the EB585/EB586 operating-window workbooks. Owner decision in the same brief: remove every custom keyboard shortcut and record it as AM19. Step 9 was approved.

**Browser tool:** Claude in Chrome was **not reachable** in this session (its tools were not available), which was said at the start. Every browser check below was produced by **headless Google Chrome driven by `playwright-core`** (installed in the session scratchpad, not the repo), against `npm run dev` unless marked "production build".

## Changes
**AM19: shortcuts removed**
- `components/workspace/ShortcutSheet.tsx`: deleted, with its toolbar button and the window key handler (`,` `.` `n` `N` `?`) in `app/projects/[projectId]/workspace/page.tsx`.
- `components/workspace/ParameterTable.tsx`: the `S` key removed; ↑/↓, Home/End, Enter/Space and Esc stay (standard list operation).
- `components/DocumentViewer/PdfViewer.tsx`: the `+` `−` `0` zoom keys on the page area removed (see Decisions); the zoom buttons stay, the area stays focusable so arrows scroll it.
- `components/workspace/SourceBar.tsx`, `ParameterRow.tsx`: tooltips no longer name keys.
- `hooks/useDocumentWorkspace.ts`: `step()` removed; `lib/documents/prefetch.ts`: `adjacentId` and its test removed (both only served the `,` `.` keys).
- `claude-notes/plans/plan-A-amendments.md`: **AM19** appended (Part 3).

**Excel viewer (AM16)**
- `lib/excel/` (new, pure, unit-tested): `address.ts` (A1 references), `workbook.ts` (data-only parse into a `WorkbookModel`, sizes, merges, hidden rows/columns/sheets, chart sheets, zip-signature check), `styles.ts` (fill, font, alignment per cell; theme and indexed colours), `highlight.ts` (sheet and region from a backend source, value matching, range label), `grid.ts` (axis offsets, visible range, merge-aware arrow movement, text spill), `cache.ts` (parsed workbooks by object URL), `config.ts`.
- `components/DocumentViewer/ExcelViewer.tsx`: rewritten. Loader (skeleton, error with Retry) and `WorkbookView` (view state, jumps, sheet switching, zoom, full screen, source status).
- `components/DocumentViewer/excel/` (new): `SheetGrid.tsx` (virtualised grid), `FormulaBar.tsx` (name box, value bar, formula text, full screen), `SheetBar.tsx` (sheet tabs at the bottom, source status, zoom).
- `components/DocumentViewer/DocumentRouter.tsx`, `types.ts`: the Excel viewer gets project and document ids and the highlight's `value`; `onReload`.
- `lib/review/anchors.ts`: each anchor carries its candidate's `value`; `hooks/useDocumentWorkspace.ts` puts it on the highlight.
- `lib/project-data/store.ts`: `DocumentViewState` gains `sheets` (per-sheet scroll and selected cell) and `handledNonce`; new `ExcelSheetView` type.
- `lib/documents/fileStore.ts`: `reload()` (fetch a loaded document again) and `isSpreadsheetDocument()`; `components/workspace/DocumentViewport.tsx` passes `onReload`.
- `components/workspace/ParameterRow.tsx`, `SourceBar.tsx`, workspace page: locations of workbook sources read "Sheet 3 · B10:D15" instead of "Page 3" (`locationLabel(source, spreadsheet)`, `isSpreadsheet` handler).
- `lib/project-data/provider.tsx`: sign-out also clears the parse cache.
- `theme/tokens.json`, `theme/tokens.ts`, `scripts/contrast-check.mjs`: five document tokens (`headerText`, `headerActive`, `selectionStroke`, `matchFill`, `hiddenMark`) with seven new contrast assertions.
- Tests: `lib/excel/excel.test.ts` (20), `lib/documents/documents.test.ts` +1 (`reload`), −1 (`adjacentId`).
- `CLAUDE.md` §3 (test scope) and §5 (Workspace, Document viewers: Excel viewer, SourceBar, no shortcuts).

## Library choice (AM16)
Constraints: permissive licence, read-only use, row **and** column spans, virtualisation.

| Option | Licence | Row + column spans | Virtualised | Verdict |
|---|---|---|---|---|
| **SheetJS CE (already a dependency) + own virtualised grid** | Apache-2.0 | Yes: merges are drawn as one absolutely positioned box per region | Yes: only the visible block of cells is rendered | **Chosen** |
| Handsontable | Commercial licence for non-personal use since v7 | Yes | Yes | Excluded (licence) |
| AG Grid Community | MIT | Column spans; row spans with layout caveats under virtualisation | Yes | A data grid, not a sheet: no per-cell fills or fonts, row-number column and letters to fake, ~1 MB. Rejected |
| Glide Data Grid | MIT | Column spans only | Yes (canvas) | Excluded (no row spans) |
| react-data-grid | MIT | Column spans only | Yes | Excluded (no row spans) |
| MUI X DataGrid (MIT tier) | MIT | Column spans; row spanning merges equal values, not arbitrary regions | Yes | Excluded (cannot express a workbook's merges) |
| x-spreadsheet / Fortune-sheet / Univer | MIT / MIT / Apache-2.0 | Yes | Yes (canvas) | Full editors with their own UI and import paths. x-spreadsheet is unmaintained since 2021; Univer is several MB. A canvas grid also cannot carry our DOM highlight and tokens. Rejected |

Why own grid on SheetJS: no new dependency, SheetJS already reads .xlsm without macros, it formats numbers with the workbook's own formats (`w`), and an absolutely positioned grid makes merges in both directions trivial under virtualisation. ExcelJS (MIT) would expose full styles but does not apply number formats and adds ~1 MB, so it was not taken. SheetJS CE drops each cell's style index, so `lib/excel/styles.ts` reads `s="N"` from the sheet XML (`bookFiles`) and maps it through `wb.Styles`. That costs a few lines and no dependency.

## Calibration (per workbook)
**What the backend sends for Excel** (read from `BDA/src/engine/traceability_hydrator.py`, `src/preprocessor/analyzer/analyzer.py` and Docling 2.80's `msexcel_backend.py`, then confirmed on the stored data): `pageNumber` is the sheet's 1-based position, hidden and chart sheets included. The bounding box is the **whole table** Docling found, as `[col, row, col + ncols, row + nrows]`, 0-based and end-exclusive. It is never a single cell. `cellCoordinates` is null for every candidate, because the hydrator's Excel branch sits behind `if True:`. So the viewer outlines the table, and finds the cell by matching the candidate's value inside it: sign ignored, no unit scaling. The bar states the result, e.g. "B10:D15 · 1 match".

**Test for the reading:** a correct region's first and last row and column all contain data, because Docling tables are connected blocks surrounded by empty cells. The 0-based end-exclusive reading fits **46 of 46** regions. The old viewer's arithmetic, a 1-based reading and an end-inclusive reading fit **0 of 46** each: each adds or loses an empty row or column at the edges. The old viewer was therefore off by one row above, one below and one column to the right.

| Workbook | Valued candidates | Sheet found | Region fits the data | Exactly 1 matching cell | Several | None | Notes |
|---|---|---|---|---|---|---|---|
| `test-data/BHV/BeglDok_Z65_4695-DtP_EVE_D1_v1.1_LD_VV.xlsx` | 18 | 18 | 18 | 14 | 4 | 0 | Median table 48 cells, largest 170. 8 matches sit inside merged cells and are highlighted as the whole merge (e.g. `U_MAX` → a merged value cell). Browser: `C_NOMINAL_AH` → C10, `U_MAX` → E21 (merged). |
| `test-data/EB585_0055/Operating Window Template … .xlsm` | 15 | 15 | 15 | 3 | 12 | 0 | Operating-window matrices: one value recurs across temperature × SoC, so up to 50 cells are marked ("50+" past the cap). Median table 192 cells, largest 736. Browser: `I_MAX_CHA_CONTINUOUS` → L45, 25 matches. |
| `test-data/EB586_0041/EB586_B2_OWmodule_240612_v3.xlsx` | 13 | 13 | 13 | 2 | 11 | 0 | Same matrix pattern; voltage limits repeat along a row (20 matches). Browser: `U_MAX` → E15. |

No source pointed into a hidden sheet. No candidate was calculated. The calibration ran from a temporary test file that printed addresses and counts only, and was deleted before the commit.

## Decisions
- **`+` `−` `0` PDF zoom keys removed too.** They are step-9 custom shortcuts like the listed ones, and the owner's rule is "no custom keyboard shortcuts". They were not in the list, so this is called out in AM19 and here. **Not removed:** the `/` key that focuses `SearchField` (step 5, projects list). It predates step 9 and is listed in AM19 as an open question.
- **Keyboard access to "show in document" without `S`:** the row's jump icon is pointer-only (`tabIndex=-1`, as before). From the keyboard: ↓ to the row, Enter opens the detail, Tab reaches each candidate's "Show this candidate in the document" button. Verified.
- **Page number before sheet name** for choosing the sheet. Plan-A §8 said "tableName if it names a sheet, else pageNumber". But the hydrator sets `pageNumber` from the anchor, while `tableName` is written by the model (and was null on all 46). `tableName` remains the fallback.
- **Value matching inside the table** is my addition, because the backend never names a cell. Matching ignores the sign (CLAUDE.md §7 stores discharge currents negative) and also matches the shown number (80 for "80 %"). It never converts units. The selected cell is the first match in reading order.
- **Hidden rows and columns are shown, with a marked header** (a bar in `document.hiddenMark` and a tooltip), not collapsed as Excel does. A source can point into them, and a highlight on an invisible row would read as broken. Hidden sheets are listed in the tabs (italic, eye-off icon); chart sheets get a tab and an empty state.
- **Gridlines are always drawn.** SheetJS CE does not parse the sheet's `showGridLines` view setting. Borders are not drawn either, because SheetJS CE does not parse them (styling is fills, fonts and alignment).
- **Column widths come from the file's character width** (Excel's own px formula, max digit width 7), not SheetJS's `wpx`, which was double on BHV. Row heights come from `hpt` (points), not `hpx`.
- **Text spills over empty neighbours** like Excel, filled cells included (the fill stays in the cell). Numbers and right-aligned text do not spill.
- **The grid has no ARIA grid role.** A virtualised grid of absolutely positioned cells has no row elements, so it is a focusable `region` with a polite live region that announces "C12 value" as the selection moves. The name box and value bar show the same.
- **The window is rendered in blocks** (16 rows × 8 columns), so most scroll frames reuse the memoised cell layer.
- **A file that is not a zip package is refused.** SheetJS otherwise reads any bytes as text and shows a damaged file as a one-cell sheet. The viewer's Retry re-fetches the file (`documentFiles.reload`) rather than re-parsing the same bytes.
- **The status at the bottom right is short** ("A11:X18 · 20 matches"), with the full sentence as tooltip and accessible name, so the sheet tabs keep their room at 1280.
- **Not added:** Home/End, Ctrl+arrows, Shift+arrow range selection and Tab-to-next-cell. The brief asks for arrow-key movement and no new shortcuts, and Tab stays focus navigation.

## Gaps found
- **SheetJS CE 0.18.5 has two high-severity advisories** (`npm audit`: GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS, both triggered by reading crafted files). Fixed releases exist only on SheetJS's own CDN (`cdn.sheetjs.com`), not on npm, so the fix means changing the dependency source. **Owner decision**; not changed here. The files read are the project's own uploads.
- **The backend never names a cell for Excel** (table-level boxes; `cellCoordinates` unused because of the hydrator's `if True:`). In operating-window matrices a value often recurs (up to 50+ matches), so the exact source cell is ambiguous. For Task B: have the analyzer anchor Excel values per cell, or let the model return the cell within the table. Candidate **B14**; not added to AM8 without the owner.
- **Styling limits of SheetJS CE:** no borders, no rotated text, no conditional formatting, no gridline visibility.
- **Excel view state is in memory only**, like the PDF's: a full reload starts at the first visible sheet.
- **Parse runs on the main thread:** 60–260 ms for the three test workbooks (Node). The xlsm grid first appeared about 1.3 s after opening the workspace (production build), including the workspace load and the file fetch. A Web Worker would move the parse off the main thread if larger workbooks appear.
- **Not verified on Windows browsers or with a real screen reader**; headless Chrome on macOS only.

## Verification
`npm run build` **exit 0**. `npm run lint` **0 errors, 25 warnings** (26 before; the Excel `exhaustive-deps` warning is gone and no new warnings; the rest are in pre-existing files). `npm test` **137/137** (9 files; 20 new in `lib/excel`, +1 −1 in `lib/documents`). `npm run check:contrast` **90/90** (7 new).

Browser checks (headless Chrome via Playwright; console read on every run, **no errors or warnings in any run** apart from the intended simulated failures):
- **Jumps** (BHV, EB585 xlsm, EB586): each switched to the source sheet, selected the first matching cell (C10, E21, L45, E15), centred the table when it fits and otherwise the cell, and the bar showed the region and match count.
- **Arrow keys:** C10 → ↓ ↓ → → D12. Merged cells are one stop (unit-tested).
- **Name box:** "A1" + Enter jumps there and returns focus to the grid; "zz" is refused with `aria-invalid`; Esc restores the box.
- **Sheet tabs:** hidden and chart sheets are listed and marked; a chart sheet shows an empty state with the formula bar disabled; "Source is on '…'" brings the user back to the source sheet (L45 again).
- **View state** (`Step9-Viewer`): sheet 2, M40 and scroll position (644, 737) survived switching to a PDF and back (still mounted) **and** going to Overview and back (remounted, restored from the store).
- **AM19:** pressing `.` `,` `n` `N` `?` `s` `S` with a table row focused changed nothing (same document, no dialog, no shortcut button).
- **Tab order** in the viewer: name box → value bar → full screen → grid (2 px focus ring) → active sheet tab → zoom.
- **Simulated corrupt workbook** (Playwright route serving non-zip bytes): "This spreadsheet could not be read" with Retry; after lifting the route, Retry re-fetched and the grid loaded.
- **PDF unaffected:** CFC `U_MAX` jump still lands, labelled "Page 2".
- **Scroll performance, production build** (`next start`; the dev server was stopped for this and restarted afterwards), 90 rAF-paced scroll steps on the xlsm's two largest sheets: p50 16.7 ms, p95 ≤ 23 ms, max ≤ 32 ms, **0 long tasks**. On the dev build the same test had p95 58 ms and 3 long tasks of up to 59 ms (React development mode), which is why the production number is the one recorded.

**Token spend:** 3 uploads (the upload route runs the LLM grouper per file) and **3 extraction runs** (`MAIN_MULTI_AGENT`, run 1 each), one per workbook, each workbook alone in its own project: `test-data/BHV/BeglDok_Z65_4695-DtP_EVE_D1_v1.1_LD_VV.xlsx`, `test-data/EB585_0055/Operating Window Template EB585 20220406 V9 MB_system.xlsm`, `test-data/EB586_0041/EB586_B2_OWmodule_240612_v3.xlsx`. None of the three had a run before (the EB586 copy in `Step9-Viewer` was uploaded after that project's run). **Plus 3 aborted starts:** my first attempt pressed Analyze through the dev UI, and editing source files triggered a Fast Refresh full reload 2–30 s into the streams. That cancelled all three (D9: nothing saved; no run rows appeared). They had passed routing, so some routing tokens were spent. The three successful runs were then started directly against the backend's `/specs/stream-specs` (same body as `runExtraction`), out of reach of HMR. Lesson: never edit code while a run depends on a dev-server tab.

**Test data left behind:** projects `Step9b-Excel-BHV` (`e8bad61d-5aa2-480f-8c24-a3a612e650fc`), `Step9b-Excel-EB585-OW` (`2e83c83f-7450-400e-a60c-91913ab42de0`), `Step9b-Excel-EB586-OW` (`b2fc8f7f-a848-4f1a-83aa-93dee7a0c4d6`), owner `step8-workspace-test`, one workbook and one run each. No delete route (B12).

## How it looks (AM18)
Screenshots by headless Chrome (Playwright), **light and dark** at **1920×1080 and 1280×800**, of the BHV, EB585 xlsm and EB586 workspaces after a jump, plus the hidden sheet, the chart sheet and the corrupt-file state.
- **Excel-like:** column letters and row numbers stay fixed while the cells scroll; the workbook's widths, heights, fills, bold headings, coloured text and alignment come through; merged titles span their columns, and the merged value cells in BHV's tables select and outline as one; long labels spill into empty cells as in Excel; sheet tabs sit at the bottom with the active tab raised and a top indicator, and the name box and `fx` value bar sit on top.
- **Highlight:** the source table has the teal outline and light fill (`document.highlight*`); matching cells get the stronger `matchFill` with a 1 px stroke; the selected cell has the dark `selectionStroke`, distinct from the teal; the headers of the table's rows and columns are tinted, and the selected cell's row and column headers are grey and bold. Over the workbook's own fills (yellow and green matrices) the teal tint mixes in but stays readable.
- **Dark mode:** the chrome (formula bar, tabs, status, zoom) is on dark surfaces; the grid stays white with the workbook's own colours (§8.3).
- **1280:** the viewer pane is about 460 px. The formula bar fits; the bottom bar keeps about one and a half sheet tabs visible with scroll arrows, beside "A11:X18 · 20 matches" and the zoom. Usable, but tight.
- **Polished during the step:** the status text truncated by the tabs (shortened); text in filled cells not spilling (fixed); "Page 3" for workbook sources (now "Sheet 3 · B10:D15"); the chart sheet showing a meaningless "A1" (the formula bar is now disabled there).
- **Worth the owner's eye:** in operating-window matrices, 20–50 marked cells are honest, but heavy. The source table outline plus the "N matches" count is the real information.

## Next
Owner review of 9b (this note, AM19, the SheetJS advisory question and candidate B14). Still open from step 8: the two export questions (discharge sign, entry names). Then **step 10** per AM17: HITL actions plus "Why this value" (AM15).
