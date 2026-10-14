# FE-R: reviewer-cleared values and unknown sources
- **Branch:** fe/r-clear-and-source (from main 113b397)
- **Goal:** read a reviewer-cleared row as "No value (set by reviewer)" (never the first AI candidate), three distinct empty states, clear saved as nulls, export writes "no value", and a candidate with an unknown source document disables "Show in document" and shows `source_reason`.
- Contract read: BDA `*_r1-clear-value.md` ("Frontend contract" 1-7), `*_r2-source-document.md` ("Frontend impact"). No extraction runs, no backend edits.

## Plan
1. Tests first: adapter reader, `isReviewerCleared`/empty kinds, save body, export, unknown source.
2. Implement 1-6, then build/lint/tsc/test/contrast.

## Changes
(filled in below as work proceeds)
(Replaces the "(filled in below)" placeholder above.)

- `lib/parameter-adapter.ts`: reader returns a "no value" spec (candidateId null, value '') for a human row with no final value, AI candidates kept as alternatives; save sends final_value/final_unit/selected_candidate_id null for a human row with an empty value.
- `lib/review/rowState.ts`: `isReviewerCleared`, `EmptyKind`, `rowState().emptyKind`; cleared rows keep primary `empty`, no reason code, no duplicate "modified" fact.
- `lib/review/anchors.ts`: `hasLocation` now requires a `documentId`. `hooks/useDocumentWorkspace.ts`: no fallback to the open document for a null documentId.
- `lib/review/why.ts`, `components/workspace/WhyThisValue.tsx`: `sourceUnknown` (source_reason) shown under "Source" instead of the model-note/location.
- `components/workspace/ParameterRow.tsx`: "No value (set by reviewer)" in the row and candidate list; uses the shared `hasLocation` (jump buttons disabled/hidden for unknown sources). `indicators.tsx`: Edited/Cleared badge for a cleared row; "No run yet" label is now "Not extracted yet".
- `lib/review/cleared.test.ts` (new, written first): reader, empty kinds, overview, save body, edit/select/revert, export, unknown source. CLAUDE.md §5 updated.

## Decisions
- A cleared row keeps primary state `empty` (so the overview counts it as "empty, already decided" and Approve's empty warning still lists it); its badge is "Edited" (MODIFIED) or "Cleared" (after Accept, next to "Accepted").
- A local, unsaved clear of an AI value counts as cleared too, and saves as a clear.
- The "no value" candidate is not selectable once another candidate is chosen (as any empty candidate); clear again by deleting the value.
- Export needed no code change: it reads the selected spec, which is now the "no value" spec, so the placeholder is written (test added).
- `hasLocation` also drops page/bbox-only sources without a document (older rows no longer jump to whatever is open).

## Gaps found
- None new. Existing rows with a wrong source document are not repaired by the backend (R2) until re-extraction.

## Verification
- `npx tsc --noEmit`, `npm run lint`, `npm test` (31 files, 415 tests), `npm run check:contrast` (90/90), `npm run build`: all pass.
- No browser run and no extraction run by me (instructed: no extraction runs).

## Browser checklist (for you)
1. Open a project with a valued parameter; clear its value and unit; Save. Row shows "No value (set by reviewer)" with an Edited badge.
2. Reload the page: it stays "No value (set by reviewer)"; expand: AI candidates listed, no Revert, nothing shows the AI value as selected.
3. Accept it: stays empty, badge Cleared + Accepted.
4. Type a value again, Save, reload: the typed value stays.
5. Pick an AI candidate again, Save, reload: its value is back, state Pending.
6. Clear once more, then Export .battery: that parameter is listed as missing and written as the placeholder, not the AI value.
7. Row never extracted shows "Not extracted yet"; an AI-empty row still shows "No value · <reason>".
8. A candidate with an unknown source: no document name, "Show in document" absent, "Why this value" shows the "Source document unknown: …" text under "Source".

## Next
Browser check by the owner; then the next plan step.
