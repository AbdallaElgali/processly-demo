# FE: automatic status, versioned approvals, manual status override

Branch: `fe/status-approvals` (from main at `bd249bb`).

## Goal
The backend now moves the project status by itself and stores approvals as immutable versions. The frontend stops setting status, offers approve / re-approve with open-flag handling, resolve-all, approval history, a "Set status manually" menu, and a confirmation before a full Analyze.

## What changed for the user
- **Status in plain words (B).** Project cards, the Overview header, the Overview status card and Settings show New / Pending review / In review / Approved. An approved project reads "Approved · v2 · <user> · <date>"; one edited after approval reads "In review · changed since approval v2". A status set by hand gets a small "set manually" marker with a tooltip.
- **Manual override (C).** The old status dropdown is now a "Set status manually" menu with New, Pending review and In review only. It sends `user_id` and shows the backend's message on error (e.g. the 409 for Approved).
- **Approve (D).** The dialog has an optional note. Open human flags no longer disable the button; if the backend answers 409 a dialog lists each open flag (alias, who, reason or "no reason given", when) with "Approve and resolve N flags" or Cancel. Toasts: "Approved as version N" / "Nothing changed since version N — approval confirmed". Out-of-bounds auto-flags remain warnings in the dialog.
- **Re-approve (E).** When `changed_since_approval` is true a banner says "Values changed since approval vN. Re-approve to save the current state as version N+1." with a Re-approve button; the toolbar button reads "Re-approve" and is allowed even when no row is pending.
- **Resolve all flags (F).** "Resolve all flags (N)" appears in the toolbar only when `open_flag_count > 0`, with a confirmation; on success the project is re-read and a toast gives the count.
- **Approval history (G).** An Overview card lists versions (version, who, when, note, parameters, flags resolved). Each opens a read-only view (parameter, value + unit, origin "AI" / "AI correction" / "Entered by hand"; removed parameters marked "removed from project").
- **Analyze confirmation (H).** When the project has extracted or entered values, Analyze first asks "Run a full extraction again? Values you edited, accepted or rejected are kept; other AI values may change." "Retry flagged values" is not a full extraction and is not confirmed.
- **No status writes (A).** The only status write left is the explicit manual override. After save, select-with-flag, flag, unflag, correction, revert, approve, resolve-all, add/remove parameter and alias change the project is re-read; the re-read also updates the project list.

## Changes
- `api/approvals.ts`, `api/types/approvals.ts` (new): approve (409 → `OpenFlagsError`), resolve-all, approval list and version.
- `api/projects.ts`, `api/types/projects.ts`: `apiUpdateProjectStatus` takes `user_id` and returns the backend body; `apiApproveProjectParameters` is now `apiApprove`; `ProjectBase` gets the six new fields (optional).
- `lib/approvals/view.ts` (new, pure): status lines, override list, toasts, banner, flag texts, history rows, Analyze confirmation. `lib/approvals/history.ts` (new).
- `lib/project-data/actions.ts`: `approveProject` (options, returns result), `resolveAllFlags`, `changeProjectStatus` (user id, re-read instead of writing the list), re-read after Add parameter; `loadProjectDetails` merges into the list. `StatusNotAppliedError` removed.
- `lib/project-data/projects-index.ts`: `updateStatus` replaced by `mergeProject`.
- `lib/review/actions.ts`: re-read after flag, unflag, choose-with-flag; `saveAndApprove(projectId, userId, options)`.
- `lib/review/approval.ts`: open flags no longer block; re-approve allowed with nothing pending.
- `lib/overview/status.ts`: `STATUS_CHANGE_AVAILABLE` removed; `statusFormBody` takes `user_id`.
- UI: `components/ui/ProjectStatus.tsx` (new), `StatusChip` (label override), `ProjectCard`, `ProjectDetailsCard`, `overview/StatusCard.tsx` (rewritten), `overview/ApprovalHistoryCard.tsx` (new), `workspace/ApproveDialogs.tsx` (new), Overview and Workspace pages.
- `CLAUDE.md`: new "Status and approvals" section, workspace toolbar and status-change text updated.

## Decisions
- Existing tests that pinned the old contract were updated in the same commit: approve body (`hitl.test.ts`, `persistence.test.ts`), the Approve gate (open flag no longer blocks), `changeStatus.test.ts` (override instead of "stored status written to the list").
- The six new `ProjectBase` fields are optional in the type so an older backend or fixture still compiles; absent means null / false / 0.
- Approve with nothing pending is still blocked on the client, except when the project changed since approval or has an open flag (Approve resolves it; re-approval needs no pending row). The backend remains the judge of `created: false`.
- The approval history sits on the Overview (not Settings) beside the status card.
- "Newer AI candidate" and other unrelated behaviour untouched.

## Gaps found
- The backend's response to `resolve_open_flags` does not say which flags were resolved beyond the count; the toast shows only the count.
- The history shows `approved_by_username` only; a deleted user has no fallback in the contract.
- Not checked in a browser (no backend running, and no extraction run allowed): the new dialogs, banner, menu, history card and the long status chip on project cards need a look in light and dark mode at laptop width.

## Verification
Tests were written first and seen failing (new modules missing, old behaviour asserted); then implemented.
- Full suite: 607 tests, 566 passed, **41 failed**, exactly the known export failures on main: `export-screen.test.ts` 26, `export-names-sign.test.ts` 11, `export.test.ts` 3, `cleared.test.ts` 1. Nothing else fails.
- `npm run lint`: clean. `tsc --noEmit`: only the pre-existing export errors (the four test files above and two `ExportReport.unconvertible` errors in `workspace/page.tsx`). `npm run build` still fails on main for those same export errors, so it was not a usable gate. The export and the build/environment configuration were not touched. `BDA/` untouched. No extraction run, no OpenAI call.

## Tests added
- `lib/approvals/view.test.ts` (status labels, approved line, changed-since-approval line, "set manually" marker, override list without Approved, toast texts, re-approve banner only when changed, resolve-all hidden at 0, flag list texts, history rows incl. removed parameter, Analyze confirmation only with values).
- `lib/approvals/flow.test.ts` (mocked fetch: no status write and a re-read after save / flag / unflag / add parameter / approve / resolve-all; list follows the re-read project; override sends `user_id` form-encoded, backend errors shown; approve sends reviewer, note, `resolve_open_flags`; 409 throws the flag list and re-reads nothing; resend with resolve true; created true/false; Save-and-approve order; resolve-all request, re-read and count; history list, empty list, version with a removed parameter, 404 text).
- Updated: `lib/review/hitl.test.ts` (gate), `lib/review/persistence.test.ts` (approve body), `lib/overview/changeStatus.test.ts`.

## Next
Browser-check approve / re-approve / history against a real backend; fix the export tests and build on main.

## Outcome
- **Status:** done. Merged into main with `--no-ff`; browser check still open (no backend in this session).
- **What changed for the user:** see the list at the top (status in plain words, manual override menu, approve with note and open-flag dialog, re-approve banner, resolve-all, approval history, Analyze confirmation, no frontend status writes).
- **Tests added:** `lib/approvals/view.test.ts` and `lib/approvals/flow.test.ts` (new); `hitl.test.ts`, `persistence.test.ts`, `changeStatus.test.ts` updated to the new contract. All pass.
- **Full suite:** 607 tests, 566 passed, 41 failed in 4 files, all the known export failures on main: `export-screen.test.ts` 26, `export-names-sign.test.ts` 11, `export.test.ts` 3, `cleared.test.ts` 1. Nothing else fails. Lint clean; `tsc --noEmit` and `npm run build` fail only on the same export errors.
- **`git diff --stat bd249bb..db2b167`:** 27 files changed, 1346 insertions, 194 deletions (largest: `flow.test.ts` 276, `view.test.ts` 161, `workspace/page.tsx` 119, `ApprovalHistoryCard.tsx` 134, `view.ts` 127, `StatusCard.tsx` 94, `ApproveDialogs.tsx` 92).
- **Commit:** `db2b167` on `fe/status-approvals`. The merge commit into main is the `--no-ff` merge of this branch (this note edit is committed on the branch before the merge).
