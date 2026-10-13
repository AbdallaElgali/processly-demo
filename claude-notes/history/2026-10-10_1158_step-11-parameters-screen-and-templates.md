# Step 11: the Parameters screen and templates

## Goal
Step 11 per plan-A 6.5 and AM14 (full-bleed): this project's parameters grouped by category with editing of alias, description and AI instructions; remove with confirmation; "Add parameter" as a labelled placeholder (backend B1); and the templates panel (list, create, edit rules, delete, save this project as a template) reusing `TemplatesManager`'s logic on the shared components. Every button inside a `FormDialog` has an explicit type; no shortcuts (AM19). The pre-work (unsaved-edit guard, correction job line, one real correction run, AM8 B15/B16) is in `2026-10-10_1143_pre-step-11-unsaved-guard-job-line-correction-run.md`.

## Changes
**Pure logic (unit-tested, 18 new tests)**
- `lib/parameters/meta.ts` (new): `metaOf`, `validateAlias` (50 chars), `buildParameterPatch` (the PATCH body), `matchesQuery`, `parametersNotInProject`.
- `lib/templates/rules.ts` (new): `templateAccess`, `templateScope`, `parametersWithoutRule`, `validateRuleAlias`, `draftFromRule`, `buildRuleUpsert`, and the `SAVE_AS_TEMPLATE_AVAILABLE` switch.
- `lib/errors.ts` (new): `errorMessage` unwraps the backend's `{"detail": ...}`.
- Tests: `lib/parameters/parameters.test.ts`, `lib/templates/templates.test.ts`.

**Data layer**
- `hooks/useTemplates.ts` (new): the old `useTemplateData` logic (list, open, create, delete, upsert a rule, set default) plus `saveProjectAsTemplate`; fixes below.
- `api/templates.ts`: errors now carry the backend's `detail` instead of `statusText`; `TemplateRuleUpsert`'s optional texts accept `null`.
- `api/projects.ts`: `apiRemoveProjectParameter`.
- `lib/project-data/actions.ts`: `editParameterMetadata`, `removeParameter` (both refresh the project in the background; removal drops that row's unsaved edit).

**UI**
- `app/projects/[projectId]/parameters/page.tsx`: the screen (a `SplitPane`, ratio persisted as `bda.parameters.split`).
- `components/parameters/ProjectParameters.tsx` (left), `ParameterEditDialog.tsx`, `TemplatesPanel.tsx` (right), `RuleDialog.tsx`, `NameDialog.tsx` (new).
- `components/ui/SearchField.tsx`: `aria-label` now reaches the `<input>` (it was landing on the wrapper div, so the field had no accessible name).
- **Deleted:** `components/TemplatesManager/index.tsx` and `hooks/TemplatesHook.tsx` (unused by any route, on the deprecated colour shim). Lint warnings 19 → 12 as a result.
- `CLAUDE.md` §5: routes sentence, new "Parameters" section, `SearchField` note.

## Decisions
- **"Save this project as template" is a disabled, labelled placeholder** like "Add parameter", because the backend route fails (see Gaps, proposed B17). It is wired end to end behind `SAVE_AS_TEMPLATE_AVAILABLE = false`; flip it when the backend is fixed. I verified the failure path once with it enabled: the dialog showed the backend's message inline and nothing was created. **Owner may prefer** a client-side workaround (create a template, then upsert one rule per parameter: ~27 sequential, non-atomic calls); I did not build one, in line with "record, do not work around" for backend bugs.
- **The canonical dictionary is listed under "Not in this project"**, collapsed, with a disabled Add per row and the B1 note, as plan-A 6.5 describes.
- **Removal is paused while an extraction or correction is queued or running** for the project (visible note, buttons disabled). A removed row would otherwise be pulled from under a save. Editing stays allowed.
- **Template permissions are enforced in the UI only.** The system default and templates of other people are read-only (no delete, no add/edit rule, with a visible note), because the backend checks nothing. "Set as default" stays available on any template.
- **Master/detail in one pane** for templates (list, then the open template with a back button): the right pane is narrow at 1280.
- **Inactive rules are hidden by default** with a "Show inactive" switch (as the old manager). Only active rules seed new projects (`projects.py` filters `is_active = true`).
- **The rule editor now sends `expected_unit_override`.** The upsert overwrites every column, and the old manager left that field out, so every rule edit silently erased the override. Blank texts are sent as `null`, not `''`.
- **Clearing a project parameter text sends `''`**, because the PATCH is `COALESCE($new, old)`: `null` leaves the column alone. Unchanged fields are sent as `null`.
- **A duplicate rule alias is caught before the request** (`(template_id, custom_alias)` is unique and a violation is a bare 500).
- **`useTemplates` does not fetch the dictionary**; `useCanonicalParameters` does, shared with the Workspace.
- **Delete-template wording:** projects made from a template keep their parameters; only `source_template_id` is cleared (`ON DELETE SET NULL`), as is a user's default.

## Gaps found (backend; proposed for AM8, not added without the owner)
- **B17 (proposed): `POST /extraction-templates/from-project` always fails.** `save_project_as_template` (`BDA/src/db/templates.py`) selects `custom_alias` from `project_parameters`, whose column is `parameter_alias`; Postgres rejects it, the transaction rolls back, nothing is created. Also, once fixed, it copies each parameter's `final_unit` (which a review overwrites with the reviewed unit) into the template's `expected_unit_override`; the UI copy says so.
- **B18 (proposed): removing a project parameter is a hard delete.** `DELETE …/remove` runs `DELETE FROM project_parameters`; `ai_metric_candidates` and `ai_parameter_flags` cascade, so the extracted candidates and the flag history for that parameter are gone from the audit trail. `actions.action_on` also references the row without a cascade, so a parameter with such a record would fail with a 500. The confirmation says what is lost.
- **B19 (proposed): project parameter texts cannot be set back to null** (the PATCH `COALESCE`); clearing leaves `''`. Harmless for display; it is why the test project's `U_MIN` now has an empty-string instruction.
- **B20 (proposed): the template routes check no ownership.** Anyone can delete the system default or another user's template, or upsert into it; there is no authentication either (CLAUDE.md §4). The UI refuses on its own.
- **B1 confirmed from the source:** `add_project_parameter_db(conn, project_id, template_id, parameter_id)` takes four arguments and the route passes one. Its SQL also uses `JOIN template_parameter_rules` (the comment says LEFT JOIN), so only parameters in the project's template could ever be added.
- **After a correction, `GET /projects/{id}` returns only the newest run's candidates** (from the pre-work run): not a Parameters issue, recorded in the pre-work note.
- **Not exercised in the browser:** the "removal paused" state (it needs a queued or running extraction, which costs tokens; the logic is a filter over `useProjectActivity`) and the "Unsaved value edit" chip on a row.

## Verification
`npm run lint` **0 errors** (12 warnings, down from 19; none from step 11), `npm test` **179/179** (13 files; 18 new), `npm run build` exit 0, `npm run check:contrast` 90/90, `tsc --noEmit` clean apart from the pre-existing `lib/jobs/reducer.test.ts` errors.

**Browser (headless Chrome via `playwright-core`, local backend, console read on every run).** On a **throwaway project** `Step11-Parameters` (`42a8aa68-f078-4beb-b540-cdeada6c8d16`, 27 parameters from the system default template, no documents), so the destructive checks never touched the shared `Step8-Workspace`:
- *Parameters:* grouped by Voltage / Current / Temperature / Capacity / End of life; editing and saving an AI instruction on `U_MIN` → "U_MIN updated.", stored on the backend, alias untouched; emptying it saved `''` (the PATCH rule above); Save disabled until something changed; an empty alias blocks Save; **Cancel sent no request** (watched the network) and Escape closes the dialog; search filters; "Add parameter" disabled with the visible "Unavailable (backend B1)" chip; the "Not in this project" section explains B1; **Remove**: the confirmation names what is lost, Cancel sends nothing, confirm removed `T_MAX_BODY` on the backend (27 → 26) and from the list.
- *Templates:* the system default opens read-only (Delete and Add rule disabled, no edit buttons, a visible lock note); create → personal template on the backend; add rule (alias pre-filled, unit override and instructions stored); a duplicate alias is blocked inline and the picker excludes parameters that already have a rule; **editing a rule kept the unit override and instructions** (the old manager would have erased the override); deactivating hides the rule and "Show inactive" brings it back; **Set as default** changed `user_settings.template_id` and was restored to the system default; delete removed the template on the backend.
- *Save as template:* with the switch on, the dialog showed the backend error inline and created nothing (B17); with it off, the button is disabled with the "Unavailable (backend B17)" chip.
- *Keyboard:* from the search field Tab goes straight to the first row's Edit, then Remove, then the next row (the disabled Add parameter is skipped; its reason is visible text, not only a tooltip). Dialogs trap focus and close on Escape.
- *Console:* clean in every run, after fixing one MUI warning the checks found (the Add-rule picker held a value that had just left its options when the saved rule reloaded).
- **No extraction was run for step 11: no token spend.** No uploads.

**Test data changed:** `Step11-Parameters` (new, as above; `T_MAX_BODY` removed, `U_MIN` instructions `''`); one extra user template was created and deleted again; the user's default template was changed and restored to the system default. `Step8-Workspace` was not touched in step 11. No delete route for projects (B12).

## How it looks (AM18)
Screenshots in **light and dark at 1920×1080 and 1280×800**: the screen with the template list, an open read-only template, the edit dialog, the remove confirmation, the rule dialog, and a template with an inactive rule.
- **Layout:** two full-bleed panes under the shell, no centred column. Left (≈58%): a toolbar with "THIS PROJECT 27 PARAMETERS", the search field, the disabled "Add parameter" and an amber "Unavailable (backend B1)" chip; then category headers on `surface.sunken` (Voltage 8, Current 4, …) with sticky headers and a row per parameter: alias in bold, key in monospace when it differs, a small outlined unit chip, the description in italics prefixed "Default:" when it comes from the dictionary, the AI instructions under it with a robot icon when set, and edit and delete icons at the right. Right: "TEMPLATES" with "Save this project as template" (disabled, amber chip) and a teal "New template"; a table of templates (name with a star for the default, scope chip). An open template has a back arrow, the name, scope and "Your default" chips, a grey lock note when read-only, and a table of its rules (alias, key, and the rule's own description or the italic default).
- **At 1280** the toolbar wraps ("Add parameter" and its chip move to a second line), descriptions wrap to two lines, and the right pane's header wraps "Your default" under the name; nothing overflows horizontally.
- **Dark mode:** same structure; the category and table headers are near-black bands, as in the Workspace (`surface.sunken`), amber chips and notes stay legible (`status.warning` on its tinted ground).
- **Dialogs:** a title, one grey line (key and "applies to the next extraction"), outlined fields with helper text, Cancel and a teal Save that is greyed until something changed.
- **Worth the owner's eye:** the near-black table header in dark mode on the templates table (the shared `DataTable` styling); the "Unavailable" chips make two disabled actions prominent; a long parameter list is one very long scroll (no virtualisation; fine at 27).

## Next
Owner review of step 11: the B17 decision (placeholder vs a client-side workaround) and whether B17–B20 go into AM8. Then **step 12** per AM17: Overview and Settings (AM14 grids).
