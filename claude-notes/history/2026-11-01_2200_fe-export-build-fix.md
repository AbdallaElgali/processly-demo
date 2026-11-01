# FE: export tests and build fix

Branch: `fe/export-build-fix` (from main at `41ea147`).

## Goal
Bring tests, tsc, lint and build back to green after the export rewrite (d51a5aa), pinning the owner's export rule: the file holds exactly what the review screen holds (alias or key as name, selected value and unit as shown, placeholder for cleared, no forced sign, no fixed `_DB` names).

(Outcome section is added at the end of the session.)

## Outcome

### Export code
No change to `static/battery-template.ts`: every failing test was either pinning a dropped rule or using a stale API; none showed the export breaking the rule. Only `app/projects/[projectId]/workspace/page.tsx` changed: the pre-export dialog no longer reads the removed `ExportReport.unconvertible`; it lists `missing` (no value) and `conflicting` (name clashes with a bench entry, which the current report has and the dialog did not show), with the generic title "Check the export".

### Tests (41 failing before)
Shared cause: the export no longer has `BATTERY_EXPORT_KEYS`, and `FrontendBatteryFileExport` needs a constructor argument (`null`). Entries are looked up by alias, else key.
- `cleared.test.ts`: 1 test fixed (import, name lookup by alias "U max"). Still-valid assertion kept: a cleared row is the placeholder, never the AI candidate.
- `export.test.ts` (3): "lists every mapped key" -> lists project parameters without a value, in project order (old rule: fixed key map); "discharge sign as stored" kept; "falls back to explicit export name" -> an absent parameter writes no entry (old rule: fixed `_DB` names written even for an empty project).
- `export-names-sign.test.ts` (11): the 3 name tests -> alias, else canonical key, no `_DB`, once each, empty project writes none. The 8 sign tests pinned "discharge currents always negative" (dropped) -> positive stays positive, negative stays negative, zero stays zero, charge currents as stored, cleared = the same positive placeholder for every parameter (`T_MIN` no longer `-99999999`).
- `export-screen.test.ts` (26): (a)-(g) kept, only the name lookup changed. (h) derived safety voltages -> none derived, cleared one is the placeholder, absent one is not written. (i) mAh->Ah and the 13-case unit table -> unit shown, value not converted (old rule: exact unit conversion). (j) unconvertible units -> deleted (concept and `unconvertible` field gone; folded into the table: K, C-rate written as shown). "sign" and "whitespace" kept. Last big test (every mapped key) -> "the report lists exactly the placeholder parameters".
- New: "export equals the review screen state" with six cases: negative value, positive discharge current, unit not converted (mAh), alias, missing alias (canonical key), cleared value. Each compares `rowState` (value and unit shown) with the written name, value, unit and the missing list.

### Gates
- `npx vitest run`: 48 files, 608 tests, 0 failures.
- `npm run lint`: clean (exit 0). `npx tsc --noEmit`: clean. `npm run build`: succeeds (exit 0).

### Notes
No extraction runs, no OpenAI calls, BDA/ and config untouched. Line endings of `page.tsx` kept as CRLF.
