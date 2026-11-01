# FE: correction UX (optional flag reason, outcomes, revert, per-row actions)

Branch: `fe/correction-ux` (from main at `c47c007`; `fe/warnings-feedback` confirmed merged).

## Goal
Make correcting values simple for battery engineers against the new backend contract: optional flag reason, outcome badges and summary after a correction, Revert, per-row Edit / Retry / Pick alternative / Revert, a fuller "Why this value", and a clear batch button.

## What changed for the user
- **Flag reason optional (A).** "Hint for the AI (optional)". Flag and Retry work with an empty hint; the request carries `flag_reason: null`.
- **Outcomes (B).** When a correction ends, the project is read back from the server and each row shows what happened: "Corrected · was 4.3 V" (with Revert), "AI confirmed the same value", "No new value found", or the backend's message if that parameter failed. A banner under the toolbar sums up a batch ("3 corrected, 1 confirmed, 1 nothing new", plus "N failed"); it can be dismissed. One parameter failing no longer ends the batch or hides the others.
- **Revert (C).** Offered only when the latest correction is a new value, not reverted, and still the selected candidate. On success the project is reloaded; on 409 the message is "This value was changed after the correction, so it can't be reverted automatically."; 404, 5xx and other errors have plain messages.
- **Per-row actions (D).** In the expanded row: Edit (the value and unit fields get a "Save value" button that saves just that row), Retry (flags with the optional hint and runs the single-parameter correction), Pick alternative (clicking another candidate chooses and saves it at once), Revert. Actions that cannot work for the row are not shown.
- **Why this value (E).** Candidates stay in the backend's order. Each shows confidence ("77% after checks (92% before)" when both exist and differ), the rule checks in the backend's words with a Failed check / Warning / Note label, "Converted from 4200 mV" only when the extracted value or unit differs, and Selected / Replaced by the correction markers. When the AI wrote no explanation nothing is shown (the "No reasoning recorded" placeholder is gone).
- **Batch button (F).** "Retry flagged values (N)", disabled with a tooltip at 0.

## Changes
- `lib/review/corrections.ts` (new): Revert rule, badges, summary, available row actions, batch button, report type.
- `lib/review/why.ts`: `candidateFacts`; `NO_REASONING` removed.
- `lib/review/actions.ts`: `flagRow` without a reason, `retryRow`, `chooseAlternative`, `saveRow`, `revertCorrectionRow`.
- `lib/review/flagging.ts`, `api/parameters.ts`: optional reason, `revertCorrection` + `RevertCorrectionError` (keeps the HTTP status).
- `lib/jobs/runners.ts`, `sse-types.ts`, `runtime.ts`: `correction_outcomes`, per-parameter errors in a batch, report stored after the reload; the stream no longer applies `final_specs`/the flag chain itself.
- `lib/project-data/store.ts`: `correctionReport`, `setCorrectionReport`, `clearCorrectionErrors`; `RowOp` gains `save` and `revert`.
- `types/index.ts`, `api/types/projects.ts`, `api/projects.ts`, `lib/parameter-adapter.ts`: `latest_correction`, `rule_results`, `confidence_raw`, `original_value/unit`.
- UI: `components/workspace/ParameterRow.tsx`, `ParameterTable.tsx`, `WhyThisValue.tsx`, `app/projects/[projectId]/workspace/page.tsx`.
- `CLAUDE.md` section 5 (Corrections paragraph).

## Decisions
- **Analyze is now always a blind extraction**; the iterative batch is its own button. Before, Analyze silently became the batch when any row was flagged, which is what made its label confusing. Say so if you want the old behaviour back.
- Pick alternative saves immediately (so it is a one-click action); the toolbar Save still covers batched edits.
- The superseded candidate is the one in `latest_correction.previous_candidate_id` while the correction is unreverted; if the backend returns it, it shows in the list marked "Replaced by the correction".
- The row badge for confirmed / no new value stays until the next correction; a reverted correction shows no badge.
- Per-parameter errors live only in memory (`correctionReport.errors`) and clear when the next run on that parameter starts; they are not in the project payload.

## Tests added (written first, seen failing)
- `lib/review/corrections.test.ts` (25): Revert rule, badges, summary counts, hidden actions, superseded id, adapter mapping, candidate facts (converted-from only when different, confidence, rule words, markers, no invented reasoning), batch button.
- `lib/review/correctionActions.test.ts` (9, mocked fetch): flag with null reason, revert 200 reloads / 409 / other error / not offered, Retry sends one single-parameter correction with the hint, Pick alternative, Edit saves value + unit of that row only.
- `lib/jobs/correctionRun.test.ts` (5): outcomes read from `complete`, a per-parameter error does not end the batch or fail the timeline, an error without a parameter still fails, single-parameter outcome and terminal error.
- `lib/jobs/correctionReload.test.ts` (3): after complete the project is reloaded, the report and summary are right, one error does not hide the other outcomes, a blind run records no report.
- `lib/review/hitl.test.ts`: dropped the `NO_REASONING` assertion.

## Verification
- `npx vitest run`: 562 tests, **521 passed, 41 failed**. The 41 are the export failures already on `main` (see the previous note: `export*.test.ts`, `cleared.test.ts`); none of my 42 new tests fail.
- `npm run lint`: clean. `tsc --noEmit`: only the pre-existing export errors. `npm run build` still fails on `main` for the same export errors, so it was not usable as a gate. The export was not touched.
- Not done: browser check (no backend running, no extraction run allowed). The new row actions, badges, banner and button need a look in light and dark mode.

## Gaps found
- The per-parameter `error` message is shown as the backend wrote it ("Retry failed: ..."); I could not check that these texts are free of developer wording.
- Rows with unsaved edits keep them across the reload (`mergeLocalEdits`), so a correction badge can sit next to an unsaved local edit.

## Next
Browser-check the correction flow with a real backend; fix the export tests/build on `main`.
