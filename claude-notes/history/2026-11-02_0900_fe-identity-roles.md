# fe/identity-roles

## Goal
Send `X-User-Id` on every backend request, handle 401/403, per-project permissions (auditor mode), role badges, read-only members list, so the frontend already works when the backend's `feat/roles-enforcement` is merged.

## Pre-checks
Clean tree on main (1ed1284); `../BDA/src/api_routes/identity.py` exists; branch `fe/identity-roles` created from main. Backend read only (`feat/roles-enforcement` note, "Frontend contract").

## Decisions
- One helper `lib/http/apiFetch.ts` (under `lib/` because vitest only collects `lib/**`). Identity comes from `setRequestUser` (set at sign-in/validate/sign-out, before `setUser`, so children's effects already carry the header), falling back to the stored `bda_user` id.
- 403 toast lives in the helper's handler (deduplicated within 2 s); `GET /projects/{id}/me` uses `quiet403` because a non-member answer is a state, not an error. `ToastHost` moved to `app/layout.tsx` (it was mounted per page, so `/projects` had none).
- Body identity fields were kept: every one is already the signed-in user's id (`useAuth().user.id`), and the backend accepts them when equal to the header. Not removed, to keep the diff small.
- Permissions: controls map to permissions in `lib/permissions/access.ts` (`controlState`); components never compare role names. Generic tooltip "Auditors can't change values"; members control says "Only authors can manage members". Loading and denied disable everything.
- `InputField.flaggerId` added (payload already had `flagger_id`) for the auditor-own-flag rule.
- Component tests: the repo has no jsdom (CLAUDE.md §3), so UI rules are tested as the pure functions the components call (`controlState`, `canUnflag`, `roleBadge`, `groupMembers`, `addMemberResult`); the wiring itself was NOT exercised in a browser in this session (no backend run).

## Browser-loaded backend URLs (requirement B)
Searched `src=/href=/data=` on the API base, `<iframe>/<object>/<embed>/<img>`, `window.open`, `EventSource`, `<a download>`: **none exist.** The only backend file load, `GET /documents/{doc_id}/file`, was already `fetch` -> blob -> `URL.createObjectURL` (revoked on release) in `lib/documents/fileStore.ts`; it now goes through `apiFetch` and so carries the header (test: `fetchDocumentFile` sends it). The `.battery` export builds a Blob locally (no backend URL). `lib/excel/cache.ts` fetches an object URL (not a backend URL; allowed in the scan). A scan test fails if an `EventSource`, `window.open` or element URL on the API base appears.

## Changes (summary)
New: `lib/http/{apiFetch,session}.ts`, `lib/permissions/access.ts`, `lib/members/members.ts`, `api/roles.ts`, `hooks/useProjectPermissions.ts`, `components/shell/ProjectAccessProvider.tsx`, `components/ui/{RoleBadge,RoleGate}.tsx`. Changed: all `api/*` + `lib/jobs/sse.ts` + `hooks/AdminData.tsx` + `contexts/AuthContext.tsx` use `apiFetch`; login page shows "Please log in again."; Workspace toolbar, `ParameterRow` (value/unit edit, Save value, Revert, candidate pick, Accept, Retry, correction Revert, Remove flag), `ProjectParameters` (add/define/edit/remove), `StatusCard`, `ProjectPromptSettings`, `Dropzone` gated; `MembersCard` rewritten; role badge in project header and `ProjectCard`; `addContributor/addAuditor` return the new result shape; CLAUDE.md §5 updated. Files were CRLF; line endings preserved.

## Gaps found
- Build is intermittently exit 1 with Next's `SecurityFatalError` ("version of Next.js is affected by a known security vulnerability", an advisory lookup over the network) after a successful compile and typecheck; it also failed on the unmodified baseline. Not touched (build configuration is out of scope). Exit 0 on other runs, including the final one.
- Lazy project-count fetches for cards still call `GET /projects/{id}` for each project; a non-member would get a 403 toast (cards come from the user's own list, so only after membership removal).
- Template/library/dictionary edits are not gated (not in the brief); the backend decides.

## Outcome
**What changes for the user:** Every request names the signed-in user; an expired or unknown user is sent to the login page with "Please log in again."; refusals show the backend's own sentence. In a project, an auditor sees the editing controls disabled with "Auditors can't change values" (value/unit, Save, candidates, Accept, Retry/Revert, Approve, Analyze, Retry flagged, upload and dropzone, Set status, Resolve all flags, parameter add/edit/remove, prompt pins), can still flag, and removes only flags they raised. Role badge in the project header and on cards. Settings lists members by role (creator tag, added date); the add forms appear only for authors and accept both backend answers ("already a member" is reported, role unchanged).
**Tests added (+64, 645 -> 709, 59 files, 0 failures):** `lib/http/apiFetch.test.ts` (header present/absent/login-register/streaming/upload/document file; 401 and 403 handling), `lib/http/noBypass.test.ts` (no direct `fetch(`; no browser-loaded backend URLs), `lib/http/session.test.ts`, `lib/permissions/access.test.ts` (loading, each role, 403 non-member, every control in E disabled for auditor / enabled for contributor and author, flag available, own-flag unflag, badges), `lib/members/members.test.ts` (grouping, dates, both add shapes). Each new file was run and seen failing (missing module / bypassing `fetch(`) before the implementation. "Forms only with manage_members" is covered by `controlState('manageMembers')`; the conditional render itself is not unit-tested.
**Gates:** `npm test` 709 passed, 0 failed; `npm run lint` clean; `npx tsc --noEmit` clean; `npm run build` compiles and typechecks (exit 0 on the final run, intermittent exit 1 as described above).

## Commit, merge and push
- `git diff --stat` (branch vs main): 51 files changed, 1047 insertions(+), 129 deletions(-).
- Commit on `fe/identity-roles`: `03db780`.
- Merged into main with `--no-ff`: merge commit `bf3dd8e`.
- Pushed (no force, nothing to origin/main): `origin/integration/2026-11-02` <- main (this note's commit follows the merge), `origin/fe/identity-roles` = `03db780`.
