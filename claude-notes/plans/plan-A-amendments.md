# Plan A amendments (architecture review, 2026-10-09)

- **Applies to:** `claude-notes/plans/plan-A.md`
- **Precedence:** where this file and plan-A.md disagree, **this file wins**. Everything not mentioned here stands as written.
- **Status of plan-A's "(plan decision)" items:** all accepted, including: no new state library (`useSyncExternalStore` stores), the per-project serialisation rule, the dev gallery, Approve disabled while any human flag is open, and the qualifier tag derived from the parameter key.

---

## AM1. Row-state precedence, and what `requires_review` means

**Problem.** Plan §6.4 maps the auto-flag "Bounds" state to `rule_violations?.length > 0 || requires_review`. But the backend's gap-fill pass sets `requires_review = True` on **every** empty reason-code row, and the Supervisor sets it on uncertain values that are not out of bounds. As written, every empty parameter would be labelled "Bounds", which is false and would train reviewers to ignore the flag.

**Change.**

| State | Rule |
|---|---|
| Auto-flag "Bounds" | `rule_violations?.length > 0` **only** |
| Needs review (not a flag) | `requires_review === true` on a candidate that has a value. Treated like low confidence: amber "Review" label, sorted with low confidence, **no flag icon** |
| Empty with reason | `ai_value === null` and `extraction_logic` matches a reason code (AM6). `requires_review` is ignored for these rows |

**Precedence when several apply** (each row shows exactly one primary state, RFC §4.1):

1. Human flag
2. Auto-flag "Bounds"
3. Empty with reason (or "No run yet")
4. Human-modified
5. Low confidence / Needs review
6. High confidence

Secondary facts (e.g. a human-modified row that also has low confidence) may appear as small secondary indicators, never as a second primary state. The precedence function lives in `lib/review/rowState.ts` and is unit-tested (AM3).

---

## AM2. Job liveness through Web Locks, not timer leases

**Problem.** Plan §3.5 keeps a running job alive with a 10 s lease renewed every 4 s by timer. Browsers throttle timers in background tabs (Chrome's intensive throttling drops a hidden tab to about one wake-up per minute). An extraction runs for minutes, often in a background tab, so a healthy job would miss renewals and be marked "Interrupted" by another tab **while it is still running**, and the user could then start a duplicate run that costs tokens.

**Change.**

- The owning tab holds a Web Lock named `bda-job-<jobId>` for the whole run (`navigator.locks.request(name, () => runPromise)`). The browser releases it automatically when the tab closes, crashes or reloads.
- A tab decides whether a "running" job is still alive with `navigator.locks.query()`: if no tab holds `bda-job-<jobId>`, the job is `interrupted`. No timers, no grace periods.
- `leaseExpiresAt` and the renewal timer are removed. `ownerTabId` stays for display and debugging.
- The scheduler lock (`bda-jobs-scheduler`) from plan §3.5 is kept as is.
- The fallback when `navigator.locks` is missing stays as planned (per-tab cap plus a one-time notice).
- Step 2b's verification must include: start a run, switch to another tab for at least 5 minutes, come back, and confirm the job was never marked Interrupted.

---

## AM3. Unit tests for the pure logic

**Problem.** The riskiest code in Task A is pure logic: the scheduler (cap, FIFO, correction priority, per-project rule), the job reducer, category grouping, row-state precedence, reason-code matching, qualifier and C-rate helpers. "Build + lint + manual check" is too weak for it, especially the cross-tab rules.

**Change.**

- Step 2a adds **Vitest** (unit tests only, no browser or e2e framework) with an `npm test` script, and updates CLAUDE.md §3 so every later step runs `build + lint + test`.
- Required tests, added in the step that creates the code:
  - 2a: job reducer; SSE event → phase mapping; correction-priority and per-project ordering; D11 regression (applying results for project A never changes project B's state).
  - 2b: scheduler under a simulated two-tab lock; Interrupted detection via a mocked `navigator.locks.query`.
  - 8: `groupFields` (known order, END_OF_LIFE, unknown category appended, Other, empty known category still present); `rowState` precedence (AM1); reason-code matching (AM6); qualifier and C-rate helpers.
- UI components are still verified manually and in the dev gallery.

---

## AM4. Split step 2a up front

Plan §9 says 2a may be split "if it proves too large". Split it from the start; it is the highest-risk step.

| Step | Scope |
|---|---|
| **2a-i** | `lib/jobs/*` (store, runners, sse, config), `lib/project-data/*`, `api/types/*` used by them, H1 lost-flag fix, H2 type, upload `errors` type, `AbortController`, Vitest setup and the 2a tests (AM3). **No UI rewiring.** |
| **2a-ii** | Rewire `/bda` onto the stores: retire `ProjectContext`, delete `useAnalyze*`, thin `ParameterManager`/`DocumentManager`, remove the early-return spinner and the analyze-wide `readOnly`, inline `JobBanner`. The history note states the D11 bug is fixed and how it was reproduced. |

---

## AM5. Shell components built in step 3 are final

Step 3 builds `AppHeader`, `ProjectRail`, `Breadcrumb`, `ThemeToggle` and `JobBadge` before the component library step (5). To avoid building them twice:

- Step 3 builds these into `components/shell/` and `components/jobs/` to the full §8.4 bar, using MUI components themed in step 1.
- Step 5 adds them to the gallery but **does not rebuild them**; it only covers the remaining primitives.

---

## AM6. Reason codes are matched against one constant module

- `lib/review/reasonCodes.ts` holds the four backend strings **copied exactly** from `BDA/src/engine/reason_codes.py`, with a comment naming that file, plus their short UI labels.
- Matching is a prefix match against these constants only, never ad-hoc substrings in components. Unit-tested (AM3).
- This is a stopgap until the backend returns an explicit reason-code field (Task B backlog, below).

---

## AM7. `.battery` export (step 8)

- Before step 8 starts, the **uncommitted change in `static/battery-template.ts`** (explore-A R9) must have been committed or discarded by the owner. Step 8 stops and asks if it is still uncommitted.
- The project backlog records a **possible double negation of discharge currents** in this exporter (`static/battery-template.ts`, around lines 169–170). Discharge currents are stored negative by design (CLAUDE.md §7). Step 8 must check whether the exporter negates them again, record the answer in its history note, and **not change the sign logic without asking**, because the correct sign depends on the downstream tool's format.

---

## AM9. Category matching is case- and separator-insensitive

**Problem.** plan-A §5 and CLAUDE.md §8.2 assumed the backend's categories were `VOLTAGE` … `END_OF_LIFE`. Step 2a-ii checked `GET /extraction-templates/parameters` against the running backend: the real values are **`Voltage`, `Current`, `Temperature`, `Capacity`, `End_Of_Life`**. Matching the raw string against the known-category map would put every one of them in the "unknown" bucket and append them in alphabetical order at the end — the opposite of the intended grouping.

**Change.**

- Normalise before matching: lower-case, and treat `_` and a space as the same character. `End_Of_Life`, `END_OF_LIFE` and `end of life` all resolve to the same entry.
- **Labels always come from the map**, never from the raw backend string, so display does not change if the backend's casing does.
- Display order comes from the map; genuinely unknown categories keep their humanised raw label and are appended at the end.
- **Unit-tested in step 8** (extends the `groupFields` tests AM3 already requires): each known category matched in all three spellings, an unknown category appended with a humanised label, a known-but-empty category still rendered.

---

## AM10. Numeric values are rounded for display only

**Problem.** `final_value` comes back serialised from a Postgres `Decimal`, so a stored 2.3 arrives as `2.29999999999999982…` (Task B item B11). Rendering it raw is unreadable; rounding it in the data would corrupt what the next Save writes back.

**Change.**

- Round **for display only**: at most **6 significant digits**, with trailing zeros stripped (`2.3`, not `2.300000`). Applies anywhere a number is shown — the parameter table, candidate chips, lineage, the Overview.
- **The value sent back on Save is never the rounded one.** Saving an untouched row must round-trip the original value unchanged; only a value the engineer actually edited changes.
- Unit-tested with the rounding helper in step 8.

---

## AM8. Items for Task B (record, do not work around)

Found by plan-A §11. Task A uses the placeholders and stopgaps already in the plan; these go to the backend in Task B:

| # | Backend item |
|---|---|
| B1 | `PUT /projects/project-parameter/{id}/add` passes the wrong arguments and fails. Needs a fix before "Add parameter" can ship. |
| B2 | `ProjectBase.customer` is never populated (`SELECT *` on a table without that column). Return the customer's alias with the project. |
| B3 | Auto-flags from `_flag_out_of_bounds` are not stored, so they disappear on reload unless `rule_violations` carries them. Persist them. |
| B4 | Add `category` to each project parameter in `GET /projects/{id}` (replaces the D5 join). |
| B5 | Add an explicit reason-code field on empty candidates (replaces AM6's string matching). |
| B6 | `review_action` enum has no `PENDING`; confirm how "not yet reviewed" should be represented. |
| B7 | `GET /documents/{doc_id}/file` returns 404 for both missing metadata and missing file; RFC §5 P1 proposes 410 for expired storage. |
| B8 | No route lists a project's members, and none lists open flags across a project (both are placeholders in Task A). |
| B9 | **A parameter with no AI candidate cannot be flagged at all.** `ai_parameter_flags` requires `ai_metric_candidate_id uuid NOT NULL` and `extraction_run_id uuid NOT NULL`; `project_parameters` has no `human_flagged` column (the API field is derived from a LATERAL join on open flags); and `save_project_parameters_batch_db` ignores the `flag` / `flag_reason` / `flagger_id` fields its own request schema accepts. Task A refuses the action with an explanation (found in step 2a-ii, which also corrects plan-A §7's claim that the batch save supports inline flag/unflag). Fix by making those two columns nullable, or by having the batch save honour the flag fields. |
| B10 | `POST /projects/{id}/approve` sets every parameter's `review_action` to `ACCEPTED` but leaves `projects.status` at `NEW`. Decide which of the two the Overview and the project list should show, and update the other. |
| B11 | `final_value` is serialised from a Postgres `Decimal` as a long float (`2.29999999999999982…`). AM10 rounds for display, but the backend should return a clean value. |
| B12 | No route to delete a project or a user; test data accumulates in the dev database. Confirmed by steps 4 and 6, each of which left behind a test user/project with no way to remove it. |
| B13 | **The stored reasoning is the model's narration, not grounded evidence** (found in step 8's AM15 diagnosis; added on the owner's instruction with the step 10 brief). `source_reason` comes from the Supervisor's structured output, and the Supervisor never sees the source text, only anchors and the worker's rationale (`_build_scoped_schema` uses the full `BatteryMetric`; the worker schema excludes `source`, and `traceability_hydrator.py` never sets `reason`). `extraction_logic` as stored is the Supervisor's rewrite of a worker rationale truncated to 300 characters (`supervisor.py` `_build_candidate_payload`); which stage wrote a given text cannot be told from the data. Task A labels it "the model's explanation, not a quote from the document" and shows the source snippet and location as the evidence. For Task B: keep the worker's untruncated rationale alongside the Supervisor's, record which stage wrote each, and stop asking the Supervisor for a `source.reason` it cannot ground. |
| B14 | **Excel sources never name a cell** (found in step 9b). `BDA/src/engine/traceability_hydrator.py`'s Excel branch sits behind `if True:`, so `source_cell_coordinates` is null for every Excel candidate, and the bounding box is the whole table Docling found (`[col, row, col + ncols, row + nrows]`, 0-based, end exclusive). In operating-window matrices one value recurs in 20–50+ cells, so the real source cell is ambiguous. Task A outlines the table, marks the matching cells (the current one strongly, the rest lightly) and steps through them with "Cell N of M" in the source bar. For Task B: anchor Excel values per cell in the analyzer, or have the model return the cell within the table, and remove the `if True:` branch. |
---

# Part 2 (owner feedback after step 7, 2026-10-09)

Appended from `plan-A-amendments-2.md` (now deleted). Same precedence: amendments win over plan-A.md.

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
---

# Part 3 (owner decision with the step 9b brief, 2026-10-10)

## AM19. No custom keyboard shortcuts

**Owner decision:** the app has no custom keyboard shortcuts. Standard keyboard accessibility stays (CLAUDE.md §8.4): Tab and Shift+Tab, Enter and Space, Escape closes overlays, arrow keys in lists, menus, tabs and tables, and arrow-key cell movement in the Excel grid. No new shortcuts are added.

**Removed in step 9b:**

| Removed | Was |
|---|---|
| `,` `.` | previous / next document (step 9, AM12) |
| `N` / `Shift+N` | next / previous source anchor (step 9) |
| `S` | show the focused row's value in the document (step 8, plan-A §6.4) |
| `?` and the `ShortcutSheet` dialog, with its toolbar button | step 9 |
| `+` `−` `0` on the focused PDF page area | step 9 zoom keys; not in the owner's list but the same kind, so removed with them. The zoom buttons stay. |

**Superseded:** the "Keyboard" bullet of AM12 (next/previous document keys and the `?` sheet); the shortcut column of plan-A §6.4's `ParameterTable` row (`f`, `a`, `s`, `[`/`]`, `?`) and the "shortcuts help `?`" in the Review header; RFC §5b.4's "keyboard-first review" now means standard keyboard operation, not shortcuts.

**What replaces them:** the same actions stay reachable without a pointer through normal focus order. Documents are tabs (arrow keys inside the tab list), source anchors have the ‹ › buttons in the source bar, and "show in document" is the candidate's button in the row detail (↓ to the row, Enter to open it, Tab to the button).

**Resolved with the step 10 brief:** the `/` key that focused `SearchField` (step 5, projects list) is removed too; AM19 applies everywhere. The search field is reached with Tab. No custom shortcut remains in the app.
