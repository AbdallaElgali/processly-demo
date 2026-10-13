# Step 9: document tabs, fast switching and the PDF viewer

## Goal
Step 9 as AM17 defines it: fast document switching (AM12: per-document view state, budgeted background prefetch, recent documents kept mounted, next/previous keys, overflow menu with search), the PDF viewer and its toolbar on tokens with no shim (AM13), highlights, anchor 1-of-N, coordinate calibration on the test documents, the pdf.js worker served locally, and per-document fetching via `GET /documents/{doc_id}/file` with a visible "Source unavailable" state. Excel gets token fixes only (rebuild is 9b). Export sign and naming logic untouched (open questions from step 8). The prompt's "Visual review feedback" field was left as the template placeholder, so I treated it as "none".

## Changes
**New**
- `api/documents.ts`: `fetchDocumentFile`. 404 and 410 → `unavailable`; anything else non-2xx throws (shown as a retryable error). `cache: 'no-store'`.
- `lib/documents/config.ts`: `PREFETCH_CONCURRENCY = 2`, `PREFETCH_BUDGET_BYTES = 40 MB`, `PREFETCH_MIN_DOCS = 3`, `KEEP_MOUNTED = 3`, `MAX_CACHED_PROJECTS = 2`, `HIGHLIGHT_PAD_PX = 6`.
- `lib/documents/fileStore.ts`: per-document file store (observable, `useSyncExternalStore`). Statuses: idle / loading / ready / unavailable / error. An opened document is fetched at once; the others are prefetched in tab order within the concurrency limit and budget. Only the last 2 projects keep their object URLs; `reset()` on sign-out. Replaces `DocumentManager.hydrateFiles`, where one 404 hid every document.
- `lib/documents/prefetch.ts` (`mayPrefetch`, `touchRecent`, `adjacentId`), `lib/documents/pdfGeometry.ts` (`bboxToPageRect`), `lib/documents/hooks.ts` (`useDocumentFiles`).
- `lib/review/anchors.ts`: `fieldAnchors`. The distinct locations across a parameter's candidates, selected candidate first.
- `hooks/useDocumentWorkspace.ts`: open document (remembered per project), mounted recents, one highlight per document with a jump nonce, source navigation. **Replaces `hooks/DocumentManager.tsx` (deleted).**
- `components/workspace/DocumentViewport.tsx` (stack of mounted viewers), `SourceBar.tsx` (parameter · location · N of M · source text · clear), `ShortcutSheet.tsx` (`?`).
- `components/DocumentViewer/SourceUnavailable.tsx`, `ViewerErrorBoundary.tsx`, `types.ts` (`ViewerHighlight`).
- `scripts/copy-pdf-assets.mjs`: copies `pdf.worker.min.mjs`, `cmaps/`, `standard_fonts/` from the pdfjs-dist that react-pdf resolves into `public/pdfjs/`.
- Tests: `lib/documents/documents.test.ts` (17: geometry incl. MediaBox offset, rotation 90/180/270, off-page and inverted boxes; prefetch budget; recents; next/previous wrap; file store: unavailable vs error isolation, concurrency cap, budget then on-demand, project eviction revokes URLs, reset; MIME routing; anchors). `lib/project-data/store.test.ts` +2 (view state).

**Changed**
- `components/DocumentViewer/PdfViewer.tsx`: rewritten in place on the same react-pdf base. Token chrome; page input and prev/next; zoom steps; fit width; full screen; `+ − 0` keys on the focused page area. Virtualised pages: every page is sized from pdf.js up front, but a canvas renders only within one viewport of the visible area. View state is saved per document and restored, also after a zoom or pane resize. Highlights go through `bboxToPageRect` in the `document.highlight*` tokens, with a 180 ms entrance that is disabled under reduced motion. A page with no usable box gets a labelled "Approximate location: page N" outline. Local worker, CMaps and fonts; `verbosity: 0`. All `console.log`s removed.
- `components/DocumentViewer/ExcelViewer.tsx`: **tokens only.** Toolbar and sheet tabs on `surface.*`/`border.*`/`text.*`; the grid on `document.page/gridLine/headerCell/text`; highlight on `document.highlight*` (previously `rgba(25,118,210,…)`). Skeleton and `ErrorState` replace the spinner and the red text. Its own snippet panel was removed because `SourceBar` now shows the snippet for both file types. Parsing, sheet choice and highlight logic are unchanged.
- `components/DocumentViewer/DocumentRouter.tsx`: tokens; routes on the store's MIME type; `MemoizedDocumentRouter` → `DocumentRouter` (memo).
- `components/workspace/DocumentTabs.tsx`: per-tab fetch state (spinner on the open tab while loading, cloud-off icon for unavailable, error icon), "N ▾" all-documents menu with search (↓ into the list, Enter opens the first match).
- `components/workspace/ParameterRow.tsx` / `ParameterTable.tsx`: `onJumpToSource(source, fieldId)`; the jump icon carries a count badge when a parameter has more than one source.
- `app/projects/[projectId]/workspace/page.tsx`: wired to the above; window keys `,` `.` `N` `Shift+N` `?`; keyboard button in the toolbar.
- `lib/project-data/store.ts`: `get/setDocumentView`, `get/setActiveDocument`. Not reactive (see Decisions); cleared by `reset()`. `provider.tsx` also resets `documentFiles` on sign-out.
- `package.json`: `predev` / `prebuild` run the copy script. `.gitignore`: `/public/pdfjs/`. `eslint.config.mjs`: ignore `public/pdfjs/**` (the minified worker was being linted).
- `CLAUDE.md`: §3 (test scope, pdf.js copy), §5 Workspace, State management, Document viewers rewritten.

## Calibration (plan-A §8, R5)
The boxes come from OpenDataLoader (`BDA/src/preprocessor/analyzer/analyzer.py`): `[x0, y0, x1, y1]` in PDF points with a bottom-left origin, the same convention the backend's debug drawer uses (`page_height - y1`). The box tool is the same whatever program produced the PDF, so a per-producer offset table turned out to be unnecessary. `bboxToPageRect` also accounts for a non-zero MediaBox origin and for /Rotate.

| Document | Boxes checked | Result |
|---|---|---|
| `test-data/CFC/CF3_B1V2_Prototype_Datasheet_V2.pdf` (step 8's run, no new spend) | `U_MAX`, `U_MIN`, `U_MAX_SAFETY`, `I_MAX_CHA_PULSE`, and all 3 anchors of `I_MAX_CHA_CONTINUOUS` | Offset 0. Each box lands on its source table row at 100 % and stays aligned at 1280 and 1920 widths, so the box scales with the page. |
| `test-data/EB585_0055/MSDS_Safety-Datasheet_EB585.pdf` (DAM) | `T_MAX_BODY_SAFETY`, `T_MIN_BODY_SAFETY`, `C_NOMINAL_AH` | Offset 0. Each box frames its source paragraph or table cell, including across pages (page 1 and page 4). |
| `test-data/BHV/…xlsx` | n/a | Excel only; cell highlights belong to 9b. |

- **Not covered by a real document:** rotated pages, offset MediaBoxes and scanned pages. No test PDF has these, and none of the 20 real boxes was page-only. Rotation and MediaBox offsets are covered by unit tests. The page-level fallback was checked by stripping the boxes from the project payload in the browser (Playwright route); the backend data was not changed.

## Decisions
- **Keys `,` / `.` for previous/next document and `N` / `Shift+N` for previous/next source, instead of plan-A §8's `[`/`]`.** On a German layout, `[`/`]` need AltGr+8/9, and the owner's team works in German. The chosen keys are unmodified and active only outside text fields, menus and dialogs. They avoid the bindings I know of in Chrome, Edge and Firefox on Windows (Alt+arrows for history, Ctrl+PageUp/PageDown and Ctrl+Tab for tabs, Alt+letter for Firefox menus). I did **not** test them in those browsers on Windows; see Gaps. All keys are listed in the new `?` sheet.
- **One `SourceBar` above the viewer** holds the "N of M" navigation and the source text, instead of putting them in the PDF toolbar. It works the same for Excel without touching Excel beyond tokens, and it is the reason Excel's own snippet panel was dropped (it would have shown the snippet twice).
- **Viewers in the stack render in tab order, not recency order.** With recency order, switching reordered live pdf.js canvases. A viewer then remounted mid-switch and react-pdf crashed the whole app ("Cannot read properties of null (reading 'sendWithPromise')", 3/3 in a stress run). With tab order: 0 crashes in 3 stress runs plus every later run. Each viewer also sits in a `ViewerErrorBoundary`, so a bad file can only break its own viewer.
- **The prefetch budget counts bytes actually downloaded.** File sizes are unknown in advance, and `openapi.json` has no size field or HEAD route, so the budget is checked before each further prefetch. The first 3 documents are always prefetched.
- **View state is stored as page + fraction of that page, plus zoom.** That survives a zoom change, a pane resize and an unmount. It lives in `ProjectDataStore` as AM12 asks, but in a non-reactive map: it is written on every scroll frame, and emitting each time would re-render every subscriber. It is in memory only, so a full page reload starts fresh.
- **Page virtualisation** is not in the plan. I added it because "fast switching" on a 30+-page specification otherwise renders every page as a canvas on open.
- **pdf.js `verbosity: 0`** (errors only) hides the font-hinting warnings that step 8 recorded ("TT: undefined function"). Those warnings describe the file, not the app.
- **`predev`/`prebuild` rather than `prepare`** for the asset copy: the Dockerfile's deps stage runs `npm ci` before `scripts/` is copied in, so `prepare` would fail there.
- **The "all documents" menu shows whenever there are 2 or more documents**, not only when the tabs overflow. Detecting overflow is fragile, and the menu's search is useful either way.

## Gaps found
- **Shortcut keys not verified in real Windows browsers.** The choice is based on the browsers' documented bindings; this machine is a Mac and only headless Chrome was driven. Worth a 1-minute check by someone on Windows (Chrome, Edge, Firefox).
- **View state is lost on a full page reload** (in memory by design, see Decisions). Client-side navigation keeps it (verified).
- **Excel:** view state is kept only while the viewer stays mounted (last 3). The pre-existing `react-hooks/exhaustive-deps` warning on its sheet-switch effect is still there. Both belong to 9b.
- **No PDF text layer** (`renderTextLayer={false}`, as before), so there is no text selection or in-document search yet. Not in step 9's scope; candidate for a later step.
- **B7 still stands:** the backend returns 404 for both missing metadata and a missing file. The UI treats 404 and 410 alike (D7).
- **Pop-out viewer** (AM12 "deferred, ask before building"): not built.
- **"Next.js inferred your workspace root"** warning in the dev/build log. It is pre-existing and unrelated to this step.
- Lint warnings 29 → 26, all in pre-existing files (admin, TemplatesManager, AuthContext, ParameterManager, TemplatesHook, and the Excel deps warning above).

## Verification
`npm run lint` **0 errors** (26 warnings). `npm test` **117/117** (8 files, 19 new). `npm run build` **exit 0**. `npm run check:contrast` **83/83**. `theme/colors` is no longer imported anywhere under `components/DocumentViewer/` or `components/workspace/`, so AM13's "no Workspace component imports the shim" now holds for the viewer too.

Browser checks: headless Chrome via `playwright-core` (in the session scratchpad, not the repo) against `npm run dev` and the local backend. The console was read on every run.
- **Prefetch:** opening the 3-document project fetched all 3 files once. Later switching, leaving and returning fetched nothing more.
- **Switching:** first visit to a PDF drew its first canvas in about 180–350 ms. Switching back to a recently viewed document showed its canvases within 50 ms, on the same page (kept mounted).
- **View state across unmount:** set MSDS to page 3, opened the workbook, went to Overview and back through the rail. The workbook was still the open document, and MSDS reopened on page 3.
- **Keys:** `.` and `,` move between documents and wrap; `N` / `Shift+N` cycle `I_MAX_CHA_CONTINUOUS`'s 3 anchors (the bar reads "2 of 3" with an "alternative" tag); `?` opens the sheet; `S` from a row jumps.
- **Menu:** typing "cf3" then Enter opened that document.
- **Jump to source across documents:** with CF3 open, jumping from a DAM-sourced row switched to MSDS at page 4 with the box drawn.
- **Simulated states** (Playwright route, browser only): 404 → tab icon plus "Source unavailable, values preserved" with Check again; 500 → error state, and Retry loads the workbook; no boxes → "Approximate location: page 4" outline.
- **Stress:** 40 rapid switches mixed with scrolling, 3 runs, no errors after the ordering fix.
- **Console:** no errors or warnings in any run, apart from the intended 404/500 resource lines in the simulated run.

**Token spend:** 3 uploads (the upload route runs the LLM grouper per file) and **1 extraction run** (`MAIN_MULTI_AGENT`, run 1) on `test-data/EB585_0055/MSDS_Safety-Datasheet_EB585.pdf`, the smallest DAM PDF. The extraction ran before the other two files were added, so it covered that one file only. The other two uploads were `test-data/CFC/CF3_B1V2_Prototype_Datasheet_V2.pdf` and `test-data/EB586_0041/EB586_B2_OWmodule_240612_v3.xlsx` (the smallest workbook), added for the tab tests. CFC calibration reused step 8's run.

**Test data left behind:** project `Step9-Viewer` (id `15ebe3a0-bd74-4fd9-8a60-36feba5ee472`, owner `step8-workspace-test`) with 3 documents and 1 run. No delete route (B12).

## How it looks (AM18)
Screenshots in **light and dark** at **1920×1080 and 1280×800**: the CFC project (1 document) and Step9-Viewer (3 documents), covering a highlighted value, 1-of-N cycling, the workbook, the all-documents menu, the shortcut sheet, Source unavailable, the error state and the approximate-location fallback.
- **Viewer chrome follows the theme in both modes.** Tabs, source bar and PDF toolbar are on panel/raised surfaces. The zoom percentage is `text.primary` at 600 weight, and the icons are `text.secondary`, readable in both modes. The black toolbar from the owner's light-mode screenshot is gone.
- **The document stays light:** the page is white on the light grey `document.canvas` in both modes, and the spreadsheet grid is white with grey header cells. The cyan highlight (`#00707A` stroke on an 18 % cyan fill) reads clearly on white in dark mode too.
- **At 1280:** the PDF toolbar (page input, zoom, fit, full screen) fits in the ~460 px viewer pane; the tabs scroll with arrows, and the "3 ▾" menu stays visible at the end.
- **At 1920:** the page fills the pane width at 100 %, and highlights are vertically centred on jump.
- **Polished during the step:** tab icons crowding their labels (gap added); shortcut-sheet columns misaligned between groups (fixed key column).
- **Worth the owner's eye:** the "Approximate location" label sits over the page's top-left corner and can cover a logo or heading there. It is a deliberate overlay, but a matter of taste.

## Next
Owner visual review of the Workspace (AM18), and the two export questions from step 8 (discharge sign, entry names) are still open. Then **step 9b** per AM17: the Excel viewer rebuild (AM16), including its view state and cell-level calibration on the BHV workbook.
