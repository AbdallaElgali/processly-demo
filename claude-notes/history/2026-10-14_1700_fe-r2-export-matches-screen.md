# FE-R2: the .battery export matches the review screen

Branch: `fe/r2-export-matches-screen` (from main, which contains the FE-R merge `b86cfba`).

## Goal
Every value written to the `.battery` file is exactly what the review row shows. Nothing is written that the screen does not show.

## Diagnosis
The exporter decided its written values with a private `getFieldValue` (`field.selectedSpecId` match, else `specifications[0]`), while `missingExportKeys` and the review row use `selectedSpec()`. The two were written to agree, so the FE-R export test (which only called `missingExportKeys` and never parsed the XML from `generate()`) could not see any difference between them. **Honest finding:** with fields built through the real adapter (`dbParamToInputField`), the cleared row (a) and the legacy row (b) already exported the placeholder *before* this step, because the adapter gives a cleared row an explicit "no value" spec and sets `selectedSpecId` to it. So the reported "cleared row exports an AI value" is **not reproducible from API-shaped data in a unit test**; it can only happen if a field reaches the exporter with no `selectedSpecId` (or one that matches no spec) and the screen is not showing the same row, which the browser checklist below is there to settle. What the tests did expose as real divergences from the screen: (1) the safety voltages were derived (`U_MAX + 0.02`, `U_MIN - 0.02`) when their own row had no value; (2) a whitespace-only value was written as `0` (`Number('  ')`) while the row shows nothing; (3) no unit handling, so `3200 mAh` was written as `3200` in an `Ah` entry, and a `C`-rate or `Wh` value went into the wrong entry unchanged.

## Changes
- `static/battery-template.ts`: new `exportValue` (the one decision, from `selectedSpec()` + `hasValue`, no fallback), `scaleDecimal` (exact decimal-point shift on the string, so 3200 mAh is `3.2`), `exportReport` (`missing` + `unconvertible`), `missingExportKeys` now derived from `exportValue`. `getFieldValue` delegates to it. Safety-voltage derivation removed. Entry names, discharge-current sign and everything else untouched.
- `app/projects/[projectId]/workspace/page.tsx`: pre-export dialog uses `exportReport`; text lists "no value: ..." and "unit not convertible: KEY (unit)" per key; no mention of derived values.
- `lib/categories.ts` (`fieldHasValue`) and `lib/parameter-adapter.ts` (`inputFieldToParameterInput`): use `selectedSpec()`/`hasValue` instead of their own copy of the fallback.
- `lib/review/export-screen.test.ts` (new, 26 tests): through `FrontendBatteryFileExport().generate()` and the adapter, cases (a)-(j), unit table, whitespace, and the "every missing key is the placeholder, every other key is a real value" cross-check.
- `lib/review/export.test.ts`: its fixture gave every key the unit `A`, which the exporter now (correctly) rejects for a voltage; fixture unit set to empty.
- `CLAUDE.md` §5: export paragraph updated.

## Decisions
- `selectedSpec()` itself keeps its `?? specifications[0]` for a field whose `selectedSpecId` is unset or stale. That *is* the screen's rule (the row shows that candidate), and the export must equal the screen; removing it would change the review screen and several store paths, which this step was not asked to do. The adapter always sets `selectedSpecId`, so it only matters for hand-built or legacy fields.
- Units are compared lower-cased and trimmed, as specified. Consequence: `MV`/`MWh` (mega) are read as milli. Kept as specified; flagging it.
- `C` counts as degrees Celsius only for `T_*` keys; for `I_MAX_*` it is a C-rate and is reported "unit not convertible".
- `%` is the only accepted unit for `EOL_SOH_NOM`; empty unit is written as is for every key.
- Non-empty but non-numeric value (e.g. `n/a`) is reported under "no value", as before.
- Unrelated stray edits in the working tree (a typo in a comment in `app/admin/page.tsx`) were left alone and not committed. The stray comment in `static/battery-template.ts` was replaced by this change.

## Gaps found
Every `specifications[0]` found (non-test code):
- `static/battery-template.ts` `getFieldValue`: the bug site. **Removed.**
- `lib/review/rowState.ts` `selectedSpec`: the shared resolver; fallback for an unset/stale `selectedSpecId`. **Kept** (see Decisions).
- `lib/categories.ts` `fieldHasValue`: own copy of the same rule, decided a displayed count. **Replaced by `selectedSpec`.**
- `lib/parameter-adapter.ts:216` `inputFieldToParameterInput`: own copy, decided the saved value. **Replaced by `selectedSpec`.**
- `lib/parameter-adapter.ts:163` `dbParamToInputField`: load-time default when the server selected nothing (never reached for a human-modified row with no `final_value`, which returns earlier). **Kept**; this is where the selection is made, and the screen then shows it.
Other occurrences are in tests only.
Open: the owner's observed case could not be reproduced from API-shaped data; if it still happens in the browser after this step, the next thing to capture is the row's `selectedSpecId` and the API row (`final_value`, `is_human_modified`, `selected_candidate_id`) at export time.

## Verification
- Tests written first: 11 of the 26 new tests failed before the change (safety derivation, units, whitespace, report); (a), (b), (d), (e) passed before, see Diagnosis.
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm test` 32 files, **441 tests** pass (415 before + 26 new); `npm run check:contrast` 90/90; `npm run build` passes.
- Not exercised in a browser by me (see checklist).

## Browser checklist for the owner
1. Clear a parameter's value, Save, reload the page, Export: that parameter's entry is `99999999` (`-99999999` for `T_MIN_*`).
2. With U_MAX set, clear U_MAX_SAFETY, Export: U_MAX_SAFETY is the placeholder, not U_MAX + 0.02 (same for U_MIN_SAFETY).
3. A typed value and a selected AI candidate export exactly as shown in the row.
4. Open the pre-export dialog: it lists exactly the placeholder keys ("no value: ..." and "unit not convertible: KEY (unit)"), and no mention of a derived value. Count in the title equals the number of placeholder entries in the file.
5. A value shown as `3200 mAh` for C_NOMINAL_AH is written as `3.2`.
6. If a cleared row still exports an AI value, note the parameter and tell me: it means the reproduction is outside the adapter path.

## Next
Owner browser check, then the next planned step.

## Diff stat
8 files changed, 336 insertions(+), 37 deletions(-) (git diff --cached --stat before commit: CLAUDE.md, workspace page, this note, categories.ts, parameter-adapter.ts, export-screen.test.ts, export.test.ts, battery-template.ts)
