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
