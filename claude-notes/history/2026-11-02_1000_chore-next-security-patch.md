# chore/next-security-patch

## Goal
Stop `npm run build` failing intermittently with Next's `SecurityFatalError` by moving next and eslint-config-next to the lowest patched version within major 16. No application code change unless a gate requires it.

## Pre-checks
Clean tree on main (eedaa2e), equal to origin/integration/2026-11-02. Branch `chore/next-security-patch` created. No extraction runs, no OpenAI calls, no BDA/ edits.

## Versions before
next 16.4.0, react 19.2.1, react-dom 19.2.1, eslint-config-next 16.4.0.

## Advisories (npm audit, range >=16.0.0 <=16.4.0 for all three)
- GHSA-2464-fhr4-w9xw (critical): unauthenticated RCE in the Image Optimization API when SVG files are used.
- GHSA-p3m5-59mp-jv5r (high): denial of service in the App Router using Server Actions.
- GHSA-673q-mjm6-r5xr (critical): unauthenticated RCE in `use cache` functions returning typed arrays.
All three end at 16.4.0, so 16.4.1 is the lowest version outside every range.

## Decisions
Command used: `npm install --save-exact next@16.4.1 eslint-config-next@16.4.1` (npm only; no `next upgrade`). react and react-dom unchanged (19.2.1). Same major (16).

## Outcome
**Versions after:** next 16.4.1, eslint-config-next 16.4.1, react 19.2.1, react-dom 19.2.1.
**Advisories fixed:** GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr (the `next` audit entry is gone; critical findings 1 -> 0).
**Remaining `npm audit`:** 19 total, 0 critical, 1 high, 18 moderate, none in next. High: `zod` GHSA-mrhx-c7xc-m3w5 (memory exhaustion on oversized constrained collections). Moderate: `@vitest/mocker`/vitest (GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp; fix via `npm audit fix`), `minimatch` (GHSA-g3hv-75wg-m249) and the eslint chain that depends on it (npm's offered fix is a breaking eslint downgrade). Not touched: out of scope.
**Code change:** none.
**Gates:** `npx vitest run` 709 passed, 0 failed (59 files); `npm run lint` clean; `npx tsc --noEmit` clean; `npm run build` three times in a row: exit 0, 0, 0, no SecurityFatalError text in any log.
**Files:** package.json (2 lines), package-lock.json.
**Commit, merge, push:** see the final lines appended below.

- Commit on `chore/next-security-patch`: `0f1f841`.
- Merged into main with `--no-ff`: `72e0f8b`.
- Pushed (no force, nothing to origin/main) to `origin/integration/2026-11-02`; this note was appended after the merge and committed on top.
