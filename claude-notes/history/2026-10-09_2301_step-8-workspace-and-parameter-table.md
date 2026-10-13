# Step 8: the Workspace and the new parameter table

## Goal
Step 8 as AM17 defines it: the AM15 reasoning diagnosis first, then the Workspace screen (AM11, AM14) replacing Extract and Review, the new parameter table (AM1 row states, AM9 categories, AM6 reason codes, AM10 rounding, CLAUDE.md §7 display rules, AM13 light mode), export per D8/AM7 with the discharge-sign comparison, and the AM3 tests. The existing viewer is kept, placed in the new layout; step 9 rebuilds it. Pre-work: AM11–AM18 merged into `plan-A-amendments.md`.

## Changes
**Plans / docs**
- `claude-notes/plans/plan-A-amendments.md` — AM11–AM18 appended under "Part 2"; `plan-A-amendments-2.md` deleted (`git rm`).
- `CLAUDE.md` — §3 Node note for `npm test`; §5 routes, a new "Workspace" section replacing "Extract", data-model lines (no `SCHEMA_GROUPS`, new `Specification` fields), six rail items; §6 `SCHEMA_GROUPS` gap struck through; §8.1 and D4/D8 wording follows the Workspace.
- `claude-notes/context/fe_rfc.md` — §2 diagram: Extract + Review → one Workspace node, with a one-line AM11 note.

**Routes and shell**
- `app/projects/[projectId]/workspace/page.tsx` — new. Toolbar (Add documents, Analyze, `JobStatusLine`, Runs, Save, Approve, Export .battery); body is the full Dropzone when there are no documents, otherwise `SplitPane` → `ParameterTable` | `DocumentTabs` + existing `DocumentRouter`; drop-anywhere overlay; export pre-check dialog. Full-bleed (AM14).
- Deleted: `app/projects/[projectId]/extract/page.tsx`, `review/page.tsx`, `components/input-fields-list.tsx`, `components/input-field-item.tsx` (both on the shim and `SCHEMA_GROUPS`), `hooks/Resizer.tsx`, `components/extract/CategoryCard(s).tsx`, `components/extract/DocumentsTable.tsx`.
- Moved: `components/extract/RunTimeline.tsx`, `RunsTab.tsx` → `components/workspace/`.
- `next.config.ts` — `/projects/:id/extract` and `/projects/:id/review` redirect to `/workspace`.
- `components/shell/ProjectRail.tsx` — one "Workspace" item where Extract and Review were; the job badge moved to it.
- Links updated: `app/projects/page.tsx` (new project lands on Workspace), `components/jobs/JobTray.tsx`, Overview and Parameters placeholders.
- `app/projects/[projectId]/audit/page.tsx` — the live Runs table (`RunsTab`) above the step-13 placeholder; the toolbar's "Runs" link goes here (AM11).
- `app/projects/[projectId]/layout.tsx` — mounts `ToastHost` once for every project screen (it was only mounted in the gallery, so `toast.show` reached nothing in the app).

**New components**
- `components/ui/SplitPane.tsx` — ratio-based, persisted per key, pointer drag, keyboard separator (←/→ 16 px, Home/End, double-click resets).
- `components/workspace/ParameterTable.tsx` — `groupFields` groups with sticky category headers (`surface.sunken`, label from the map, found/total, live run state), "Needs review first" (default on, persisted), density (persisted), keyboard: ↑/↓, Home/End, Enter/Space, Esc, S.
- `components/workspace/ParameterRow.tsx` — scannable row + detail (candidates with location and jump, source text, value/unit edit, flag / flag and re-extract / remove flag).
- `components/workspace/ValueCell.tsx`, `indicators.tsx` (`QualifierTags`, `ConfidenceIndicator`, `StateBadge`, `SecondaryFacts`), `JobStatusLine.tsx` (one-line job, popover with the full `JobBanner`), `DocumentTabs.tsx` (basic tabs; "not analyzed", in-flight uploads, "N not accepted").
- `components/ui/Dropzone.tsx` — optional `sx` so it can fill the empty Workspace.

**Pure logic (`lib/`)**
- `lib/review/rowState.ts`, `reasonCodes.ts`, `format.ts`, `domain.ts`, `confidence.ts` — see CLAUDE.md §5.
- `lib/categories.ts` — `groupFields` added; `tallyByCategory` removed with its only consumer (`CategoryCards`).
- `types/index.ts` — `SCHEMA_GROUPS` and `SchemaField` deleted; `Specification` gains optional `expectedUnit`, `extractionLogic`, `calculationLogic`.
- `lib/parameter-adapter.ts` — maps those three fields from both the stream and the persisted shape; no `SCHEMA_GROUPS` label maps. `source.reason` mapping unchanged (it feeds `previous_specs`).
- `static/battery-template.ts` — `BATTERY_EXPORT_KEYS` (the 19 key → export-name pairs it already used, now explicit) and `missingExportKeys`. XML output is byte-identical to HEAD (checked with a temporary test comparing old and new on three fixtures, then deleted).

**Tests** — `lib/review/review.test.ts` (25), `lib/review/export.test.ts` (3), `lib/categories.test.ts` (groupFields block replaces tallyByCategory).

## AM15 diagnosis: where the reasoning goes
Read-only, no OpenAI spend for the diagnosis itself.

1. **Database.** The direct DB query was not possible: the permission system blocked reading `DATABASE_URL` from `BDA/.env`, and I did not work around it. The dev DB had also been reset (no projects, runs or customers), so there was no existing run to inspect. Instead, after this step's single verification run (below), `GET /projects/{id}` was tallied. That route returns `to_jsonb(c.*)` of `ai_metric_candidates` (`BDA/src/db/projects.py`, `target_candidates`/`grouped_candidates`), so it shows exactly what is stored. On that run, all 17 candidates with a value have `extraction_logic` and `source_reason` set, non-empty and almost all distinct (17/17 and 15/17 distinct), so neither empty nor generic. `calculation_logic` is set on 7 of 17, which matches the 7 `is_calculated` candidates. All 15 null candidates carry the `not searched: no document frame` reason code.
2. **API.** Returns all three fields on every candidate (verbatim columns, see above). Not a loss point.
3. **Frontend.** This was the loss point. No component rendered any of them, and `lib/parameter-adapter.ts` dropped `extraction_logic` entirely (and with it the reason codes). It folded `source_reason || calculation_logic` into `source.reason`, which nothing displayed. Step 8 now carries `extractionLogic` and `calculationLogic` on every `Specification` and uses the reason codes. Rendering "Why this value" is step 10's (AM17).

**B13 not added.** AM15 adds B13 only if the backend stores the fields empty or generic, and it does not. Two provenance observations from the code, for Task B to judge:
- The model never writes `source.reason` in the worker pass. `create_ai_extraction_model` excludes `source` (`BDA/src/schemas/ai_model_builder.py`), and `traceability_hydrator.py` never sets `reason`. The stored `source_reason` comes from the **Supervisor's** structured output (`_build_scoped_schema` uses the full `BatteryMetric`), and that output never saw any source text, only anchors and the worker rationale. So it is the Supervisor's narration, not a grounded quote.
- The Supervisor receives each worker's `extraction_logic` truncated to 300 characters (`supervisor.py` `_build_candidate_payload`). The stored rationale is what the Supervisor outputs (it is only told to preserve `id` and `source_anchor`), so it is a rewrite of a truncated worker rationale. Which stage authored a given stored text cannot be told from the data.

## Export (D8, AM7)
- AM7's precondition held: no uncommitted change in `static/battery-template.ts` (tree was clean).
- **No double negation.** The exporter writes `I_MAX_DCH_PULSE` / `I_MAX_DCH_CONTINUOUS` exactly as stored (the `// *` lines near the old 169–170 only carry a comment). A unit test now pins this.
- **The known-good files disagree with each other on the sign** (sign only; no values recorded). `test-data/CFC/battery_files/CFC_B-Muster_165Ah_Std.battery.xml` (the README's key) has `I_MAX_DCH_CONTINUOUS_DB` and `I_MAX_DCH_PULSE_10s_DB` **negative**. `test-data/EB585_0055/DAM_EB585_141p3Ah.battery.xml` and `test-data/EB586_0041/DAM_EB586.battery.xml` have `I_MAX_DCH_CONTINUOUS_DB` **positive**. `test-data/BHV/battery_files/BHV_LD_Z65_DTP_EVE_D1.battery.xml` has no `I_MAX_DCH_*` entry. With values stored negative (CLAUDE.md §7), today's export matches CFC and not DAM. **Sign logic not changed; question for the owner.**
- **Entry names also differ from the keys.** When the project has the parameter, the exporter writes the parameter's *label* (its editable alias), not a fixed name. The keys use `_DB` names (`U_MAX_DB`, `I_MAX_DCH_CONTINUOUS_DB`). Its fallback names also don't match every key (e.g. `I_MAX_DCH_30S_DB` vs CFC's `I_MAX_DCH_PULSE_10s_DB`), and each key file has entries the exporter cannot produce (e.g. `U_MIN_PULSE_DB`, `U_MAX_DYN_DB`, `T_MAX_CELL_DB`). Behaviour kept byte-identical; recorded as a second question.

## Decisions
- **Basic `DocumentTabs` now, not step 9's version.** AM11 removes the documents table, so something had to show the documents, "not analyzed" and rejected files. Overflow search, per-document view state, prefetch and next/previous keys stay in step 9 (AM12).
- **`SplitPane` built in step 8** (plan-A put it in step 9) because AM11's layout is a resizable split; the old mouse-only `useResizer` is deleted.
- **Runs table placed on Audit now** rather than left unreachable until step 13: AM11 moves it there, and the Extract screen it lived on is gone.
- **The collapsed row is read-only; editing is in the row detail.** Fast scanning and arrow-key navigation, and AM10 is easy to honour: the input shows the rounded value and only a keystroke writes, so an untouched row saves back exactly what was loaded (unit-tested with a value rounding visibly changes).
- **The step-7 flag form is ported into the row detail unchanged in behaviour** (flag, flag and re-extract, remove). Step 10 replaces it with the FlagDrawer. "Flag and re-extract" no longer enqueues a correction if the flag itself failed (before, it re-extracted with no flag behind it).
- **Alias / description / AI-instruction editing is not on the Workspace.** It was in the old row component; it belongs to the Parameters screen (plan-A 6.5, step 11), which is still a placeholder, so it is unavailable until step 11. Flagged as a gap below.
- **Empty rows whose text is not one of the four codes** show "No value · reason not recorded" with the raw text in the tooltip, never a blank (CLAUDE.md §7). The iterative-correction null in `orchestrator.py:583` is such a case.
- **"Needs review first" order** (flag, Bounds, review, empty, no run, edited, OK) is separate from display precedence (AM1), so an empty row reads as empty but sorts after doubtful values.
- **Category live state** uses "Extracting… / Updated this run / Workers failed" in the header, from the job's own `progress` and `phase` (AM11).
- **Qualifier tags:** MIN/MAX/NOM/TYP plus SAFETY/PULSE/CONTINUOUS/DYN, matched on whole `_`-separated words of the key, tooltip "derived from the parameter key".

## Gaps found
- **Viewer chrome is still on the shim:** black toolbar and an unreadable zoom label in light mode (AM13's screenshot problem), and pdf.js `TT: undefined function: 32` font warnings on this PDF. Both are in `components/DocumentViewer/*`, which AM17 assigns to step 9. So AM13's "no Workspace component imports the shim" holds for everything step 8 built, but not yet for the viewer.
- **Metadata editing (alias, description override, AI instructions) is unavailable until step 11**, see Decisions.
- **`DocumentManager.hydrateFiles` still fetches every document eagerly and fails all-or-nothing** (one 404 → no documents shown). Step 9 (D7/AM12).
- **`toast` was never visible in the app before this step** (ToastHost only in the gallery). Fixed by mounting it in the project layout.
- **Local tooling:** `node_modules` predated step 2a (no vitest), and this machine has Node 20.17 while Vitest's Vite needs ≥ 20.19. Ran `npm install` (lockfile unchanged) and `NODE_OPTIONS=--experimental-require-module npm test`; noted in CLAUDE.md §3. `lib/jobs/reducer.test.ts` has pre-existing `tsc` type errors (Vitest does not type-check, so it passes); untouched.
- The dark-mode category header (`surface.sunken`, #0A0A0A) reads as a near-black band. That is the token, and acceptable in dark mode, but worth a look in the owner's visual review.

## Verification
`npm run lint` **0 errors** (29 warnings, down from 36, all in pre-existing files: admin, viewers, TemplatesManager, AuthContext, ParameterManager, TemplatesHook), `npm test` **98/98** (7 files), `npm run build` **exit 0** (14 routes, `/workspace` replaces `/extract` and `/review`), `npm run check:contrast` **83/83**. `/projects/{id}/extract` and `/review` → 307 to `/workspace`.

Browser checks: headless Google Chrome via `playwright-core` (installed in the session scratchpad, not the repo) against `npm run dev` and the local backend. Console read on every run.
- **Empty project:** the whole body is the dropzone; Analyze disabled with a reason.
- **Upload:** in-flight file shown beside the tabs, then a document tab; viewer loads.
- **Before any run:** 27 rows, every one "No run yet"; all five known categories render, End of life included (0/5).
- **After the run:** reason chips on every empty row ("Not searched: no frame"), OK / Review states, confidence percent + word, qualifier tags, `abs` mark on currents, the sign note on both `I_MAX_DCH_*` rows, rounded display (B11 visible on one value), "needs review first" ordering.
- **Row detail:** candidate with page and jump, source text, value/unit edit, flag form.
- **Keyboard:** ↓ moved focus to the next row (focus ring visible), Enter opened it, S jumped the viewer to its source and drew the highlight.
- **Also checked:** drop overlay; export pre-check dialog listing the 7 mapped keys without value (cancelled, nothing downloaded).
- **Console:** no errors, and no React or `getSnapshot` warnings. The only warnings are pdf.js font warnings from the viewer (above).

**Token spend: 1 OpenAI-backed extraction run** (`MAIN_MULTI_AGENT`, run 1) and 1 upload, on `test-data/CFC/CF3_B1V2_Prototype_Datasheet_V2.pdf`, the smallest test PDF. No corrections, iterative runs or re-runs. The AM15 diagnosis itself spent nothing; its data part reused this verification run.

**Test data left behind:** user `step8-workspace-test` (department Zelle) and project `Step8-Workspace` (id `5b6a7a5c-fedb-4909-9c8c-29d974fa3fa7`) with one document and one run. No delete routes (B12).

## How it looks (AM18)
Checked by screenshot in **light and dark** at **1280×800 and 1920×1080**: table, expanded row, keyboard-opened row with source highlight, End of life block, drop overlay, export dialog.
- **Light, both widths:** category headers are light grey bars (`surface.sunken`) with dark text, not the black bars from the owner's screenshot. Labels read "Voltage", "End of life", with no "VOLTAGE SPECS". Chips are tinted (amber Review, grey reason codes, green-outlined OK) with icon + label.
- **Dark, both widths:** same layout on dark surfaces; category headers are a near-black band (see Gaps); chips keep icon + label.
- **1280:** the table pane (~570 px) hides the confidence column through a container query and puts the row detail in one column. Names are no longer truncated now that qualifier tags sit under the name (an early 1280 pass truncated `U_MAX_SAFETY`, `I_MAX_*`; fixed). The counts line ellipsises with a tooltip.
- **1920:** the confidence column shows; the viewer gets ~45%.
- **Full-bleed in both:** no max-width container (AM14).
- **Not yet right:** the viewer's toolbar is black in light mode with an unreadable zoom percentage (step 9).

## Next
Owner visual review of the Workspace (AM18), plus answers to the two export questions (discharge sign, entry names). Then **step 9** per AM17: document tabs and fast switching (AM12), PDF viewer chrome on tokens (AM13), highlights, anchors, calibration.
