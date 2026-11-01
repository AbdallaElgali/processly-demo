# fe/analytics-contract-check

Branch: `fe/analytics-contract-check` (from main at `69c5167`).

## Goal
The analytics page (ddc4b5f) was built against the four-view contract before the backend had it. Verify it against the real backend (BDA 7ff979b, branch feat/metrics-views).

## Read
`BDA/src/db/project_metrics.py`, `BDA/src/api_routes/analytics.py`, `BDA/claude-notes/history/2026-11-01_2221_metrics-views.md` ("Frontend contract", help texts, two example responses).

## Outcome

### Differences found
**None in the data contract.** Every field, type, nullability and enum value of `api/types/analytics.ts` matches the backend: `ViewMetrics` (incl. `scored`, `avg_candidates` null for the `*_first` views), `Excluded` (`coverage_gap`, `never_asked`, `unranked`, `parameter_removed`), row fields (nulls for a not-approved project, as built by `project_metrics.py`), `summary` (`pooled`, `per_project_average` with only precision/recall/f1), the eight `Outcome` values (the backend's `excluded_removed` for `parameter_removed` included), `run_type` (`BLIND` / `ITERATIVE` / `SINGLE_PARAM`; other extraction types would pass through raw, and `matchedLabel` falls back to the raw text), `rank` nullable, 404 for an unknown project, 422 for a non-uuid. The earlier "types written from the brief" comment in `api/types/analytics.ts` is now out of date (the contract is merged); left as is, since editing it would only change a comment.

**Help text, one difference in meaning:** the backend says projects with no score are left out of the per-project average; the frontend did not. Also "Never asked" meant "no AI run covered it before the approval", the frontend said "never sent to the AI" (close, but the backend wording is more exact).

### Fixes made
`lib/analytics/views.ts`: `HELP.pooledVsAverage` now says projects with no score ("—") are left out of the average; `HELP.leftOut` says "not covered by any AI run before approval" and "runs too old to show the AI's pick". The shorter frontend wording elsewhere was kept (same meaning).

### Tests added
`lib/analytics/contract.test.ts` (7 tests) with the two backend example responses copied verbatim into `lib/analytics/fixtures/backend-projects.json` and `backend-project-detail.json`, cast to the API types (so a type drift also fails `tsc`). Through the overview code: headline tiles, view switch over all four views, chart points keyed by id, origin mix, table rows and sorting. Through the detail code: parameter rows with all four outcomes, outcome options and filters, matched-candidate text. They passed on the first run, as expected with no data difference; the help-text change has no test (wording).

### Gates
- `npx vitest run`: 54 files, 645 tests, 0 failures (was 53 / 638).
- `npm run lint`: clean. `npx tsc --noEmit`: clean. `npm run build`: exit 0.
- Not checked against a running backend or in the browser (no backend run in this session, by the brief).

### Other
No extraction runs, no OpenAI calls; BDA/, export and build configuration untouched.
