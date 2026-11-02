# fe/members-management

## Goal
Authors manage project members in Settings: add with a role (one form), change a role, remove (with confirmation), against the merged backend contract (POST/PATCH/DELETE /projects/{id}/members). Non-authors keep the read-only list.

## Pre-checks
Clean tree on main (2561416 = origin/integration/2026-11-02); `chore/next-security-patch` is in `git branch --merged main`. Branch `fe/members-management` created from main. No extraction runs, no OpenAI calls, no edits in BDA/.

## Plan / decisions
- Tests first, seen failing: `lib/members/manage.test.ts` (HTTP through a stubbed `fetch` + `apiFetch`, refresh through spies; the repo has no jsdom, so UI rules are the pure functions and actions the components call).
- API calls in `api/roles.ts`; messages and last-author rule in `lib/members/manage.ts`; orchestration (call, then re-read members and `/me`) in `lib/members/actions.ts`.
- The old `/contributors` and `/auditors` calls (`apiAddContributor`, `apiAddAuditor`, `addContributor`, `addAuditor`, `UserNotFoundError`) are removed.

(Outcome section is appended below when the gates have run.)

## Outcome
**What changes for the user:** In Settings, authors get one "Add member" form (username + Author/Contributor/Auditor) instead of two. "Already a member" says "<name> is already a <role>; change the role in the list below." and an unknown name says "No user with that name." Each row has a role menu and Remove (with a confirmation naming the person). The only author's menu and Remove are disabled with "A project needs at least one author. Make someone else author first." as tooltip, and a 409 shows the same sentence. Removing yourself warns you will lose access and then goes to the projects list. After every change the members list and `GET /projects/{id}/me` are read again (new `useReloadAccess`), so a changed own role updates the controls at once. Contributors and auditors see the list only.

**Tests added (+20, 709 -> 729, 60 files, 0 failures):** `lib/members/manage.test.ts` (stubbed `fetch` through `apiFetch`): add with each role (body and `X-User-Id`), already-a-member text, 404/403 texts, role change (PATCH body, 404, 409), remove (DELETE/204, 409, confirmation text incl. self), re-read of members and permissions after add/change/remove, nothing re-read on failure, self-removal reports `selfRemoved` and skips the re-read, last-author disabled state with reason, controls only with `manage_members`. Run first and seen failing (missing modules); one assertion of mine was too strict and was fixed (self text must start with "You will lose access").

**Not covered by tests / not exercised:** the repo has no jsdom, so the card's rendering, the redirect call (`router.push('/projects')`) and the dialog wiring are tested only as the pure functions they call; no backend was running, so nothing was clicked in a browser.

**Removed:** `apiAddContributor`, `apiAddAuditor`, `addContributor`, `addAuditor`, `UserNotFoundError` (the `/contributors` and `/auditors` aliases are no longer called). CLAUDE.md §5 updated.

**Gates:** `npx vitest run` 729 passed, 0 failed; `npm run lint` clean; `npx tsc --noEmit` clean; `npm run build` exit 0.

**Git:** `git diff --stat` (branch vs main): 11 files changed, 464 insertions(+), 83 deletions(-). Commit on `fe/members-management`: `d7ae98d`. Merged into main with `--no-ff`: `275b631`. Pushed `main:refs/heads/integration/2026-11-02` (no force, nothing to origin/main): `2561416..275b631`; this note's commit follows and is pushed the same way.

## Next
Browser check of the Settings members card against a running backend (add each role, demote/remove the last author, remove yourself).
