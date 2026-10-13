# Step 2a-i: job store, per-project data, contract fixes, Vitest

## Goal
AM4's first half of step 2a: build `lib/jobs/*` and `lib/project-data/*`, the response types they need, the H1/H2/upload-errors contract fixes, `AbortController` on the streams, and Vitest with the AM3 tests. **No UI rewiring** — that is 2a-ii.

## Changes
**New — job store**
- `lib/jobs/config.ts` — `JOB_CAP = 3` as the single constant, storage/channel/lock names, the 120 ms partial-flush interval carried over from `useAnalyze`, and a cap on retained events.
- `lib/jobs/sse-types.ts` — the **hand-written SSE contract**. Streaming responses are invisible to OpenAPI, so these were read off `BDA/src/engine/orchestrator.py` and `extract_specs.py`: all 10 blind/iterative statuses plus `targeting` and `ready_to_save` on the single-parameter path. Also `phaseForEvent` (RFC §3) and `WARNING_STATUSES`. Every field past `status` is optional and unknown statuses map to "no phase change", so a backend that adds a status degrades instead of breaking a run.
- `lib/jobs/types.ts` — `Job`, payload union, action union. `projectId` is on every job.
- `lib/jobs/reducer.ts` — pure. Lifecycle, event folding, warnings kept off the error path, category progress, run-id capture.
- `lib/jobs/ordering.ts` — pure scheduling: cap, corrections jump the queue, FIFO within a class, and one parameter-writing job per project. Plus `queuePosition` and `canStart`.
- `lib/jobs/sse.ts` — one stream reader replacing the two near-identical loops in `api/analyze-document.ts` and `api/analyze-parameter.ts`. Takes an `AbortSignal` and cancels the reader on abort; neither old loop could be stopped.
- `lib/jobs/runners.ts` — extraction, correction and upload. Every result is written to `job.projectId`.
- `lib/jobs/store.ts` — observable store plus the `AbortController` registry.
- `lib/jobs/hooks.ts` — `useSyncExternalStore` selectors (`useProjectActivity`, `useJobTray`, `useCanStart`, `useProjectData`).

**New — per-project data**
- `lib/project-data/store.ts` — `ProjectState` keyed by `projectId`. Carries over the two hard-won rules from `ParameterManager` with their reasoning: sort candidates by confidence; preserve the previous selection by `candidateId` (never `spec.id`, which is re-minted per response) and skip that preservation for a flagged field so a correction may re-pick. `applyFlagChain` keeps its "must run after applySpecs" comment.

**New — contract**
- `api/types/projects.ts` — hand-written response types per D10, each naming the backend module it was read from. Deliberately **no `category`** on `FullProjectParameter`: the SQL does not select it, so declaring one would invent a field (§0.4).
- `lib/review/flagging.ts` — `raiseHumanFlag` / `clearHumanFlag`, the H1 fix.

**New — tests**
- `vitest.config.ts`, and `lib/jobs/ordering.test.ts` (17), `lib/jobs/reducer.test.ts` (19), `lib/project-data/store.test.ts` (10).

**Changed**
- `api/templates.ts` — **H2**: `CanonicalParameter` now `{ id, name, category, default_description, expected_unit }`. It previously declared a `description` field that does not exist and omitted `category`, which made the D5 grouping join impossible. `TemplateRule` gained the required `canonical_name`.
- `api/upload-doc.ts` — `errors` is `{filename, error}[]`, not `string[]`; added an `AbortSignal`; dropped two `console.log`s that printed response bodies.
- `api/parameters.ts` — `flagParameter`'s `ai_metric_candidate_id` is now a non-null `string`, matching `AIFlagRequest`.
- `api/projects.ts` — `ParameterInput.final_value` widened to `number | string | null`.
- `lib/parameter-adapter.ts` — a non-numeric value is sent as the typed string instead of being coerced to `null`.
- `hooks/ParameterManager.tsx` — `handleFlag` routed through `raiseHumanFlag`/`clearHumanFlag`; takes `projectId`; exposes `flagError`/`clearFlagError`. Dropped the unused `UnfoldLess` import.
- `app/bda/page.tsx`, `app/review/page.tsx` — one argument each, passing `projectId` to the hook.
- `CLAUDE.md` — §3 gained `npm test` and what it does/does not cover; §5 gained a section on the two stores.

## Decisions
- **Pulled the `final_value` fix forward from step 4.** Not in 2a-i's list, but the H1 fallback path writes a `ParameterInput` row, and with the old `number | null` type `inputFieldToParameterInput` coerced any non-numeric value to `null`. Flagging a text-valued parameter would have silently wiped its value. Fixing the type was the only way to make the new path safe.
- **Touched `ParameterManager` and two page call sites, despite "no UI rewiring".** Making `ai_metric_candidate_id` non-null broke the build at exactly the buggy call site — which is the type doing its job. H1 is explicitly in 2a-i's scope, and the hook is the flag write path, not UI. The page edits are one argument each. The stores remain unwired, as AM4 requires.
- **No `refining` status.** The old `analyze-document.ts` handled one; it does not appear anywhere in the current orchestrator. Treated as dead from an older backend and left out — the tolerant unknown-status path covers it if it ever returns.
- **`canStart` returns allowed at the cap.** Being at the cap queues a job rather than refusing it (§8.1), so only the per-project rules refuse.
- **`JobStore` is a plain observable, not a React context or query library.** It must also own `AbortController`s and, from 2b, Web Locks and cross-tab messages — none of which are React state.

## Gaps found
- **The tests caught two real bugs in code I had just written**, both of which build and lint accepted:
  1. `selectStartable` accumulated chosen jobs into its `running` list, but `projectIsBusy` filtered that list with `isActive()` — false for a still-queued job. Two corrections for the same project could be selected in one pass, exactly the interleaved-write case the rule exists to prevent.
  2. `replace` in the reducer set `changed = true` on an id *match* rather than an actual change, so a declined update (interrupting an already-completed job) still allocated new state and would have caused spurious re-renders.
  This is the concrete argument for AM3.
- `app/bda/page.tsx` and `app/review/page.tsx` still call the **old** `api/analyze-document.ts` / `api/analyze-parameter.ts` via `useAnalyze`/`useAnalyzeParameter`. Both old modules and both hooks are still present and still have the D11 bug. They are deleted in 2a-ii; **the bug is not fixed in the running app yet**, only in the store that will replace them.
- `flagError` is exposed but nothing renders it yet (2a-ii).
- Lint warnings 50 → 49 (the `UnfoldLess` import went). `FIELD_LABEL_MAP` is still flagged as unused; it goes with `SCHEMA_GROUPS` in step 8.

## Verification
- `npm test` → **46/46 pass** across 3 files.
- `npm run lint` → **exit 0**, 0 errors / 49 warnings.
- `npm run build` → **exit 0**, 7 routes.
- `npm run check:contrast` → **83/83**.
- No manual browser check this step: nothing new is reachable in the UI by design. The existing screens were confirmed to still compile and build; their behaviour is unchanged because the old analyze path is untouched.

§8 checks for this step: **§8.1** is the one that applies, and it is covered by tests rather than by a click-through, since the store is not wired in yet — cap of 3 counting every kind, corrections jumping the queue, FIFO within a class, one parameter-writing job per project, `canStart` never refusing merely because the cap is full, and the D11 property that project A's specs and flag chain cannot touch project B. §8.2–§8.4 do not apply: no categories, no colour, no interactive component in this step.

## Next
**Step 2a-ii**: rewire `/bda` onto the stores — retire `ProjectContext`, delete `useAnalyze`/`useAnalyzeParameter` and the two old `api/analyze-*.ts` modules, thin `ParameterManager`/`DocumentManager`, remove the early-return spinner and the analyze-wide `readOnly`, and show `JobBanner` inline. Its history note must state that the D11 bug is fixed **in the running app** and how it was reproduced: start a run on project A, switch to B, confirm B's rows are untouched.
