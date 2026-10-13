# Step 4: remaining contract fixes, registration (D3), login restyle

## Goal
plan-A §9 step 4: the contract fixes left over from plan §7, user registration rebuilt per D3, the login screen on tokens, and the dead modules deleted. Retires R1 (narrowed) and R8.

## Changes
**Contract fixes**
- `api/projects.ts` — `PATCH /projects/project-parameter/{id}/` now sends the **trailing slash** the route is declared with. Without it FastAPI answers 307, and a redirected PATCH can lose its method or body under CORS.
- `api/customers.ts` — `create_customer(alias_name)` only. `CustomerCreate` declares nothing else; the `name` argument was being sent and ignored, which is why the old dialog's "full name" quietly vanished. `hooks/Customers.tsx` and `NewProjectDialog` updated.
- `api/templates.ts` — `ExtractionTemplateBase` matches the schema: `updated_at` removed (the backend never returns it, so anything reading it got `undefined`), and `user_id`/`customer_id` typed `string | null` rather than optional.

**Registration (D3)**
- `api/auth.ts` — **new.** Owns `DEPARTMENTS` (`Zelle`, `Module`, `Pack` — the whole `DepartmentEnum`), `registerUser` sending only the two fields `UserRegistration` declares, a typed `UsernameTakenError` for the backend's 409, and the `UserWithSettings` response type for `GET /auth/user`.
- `app/register/page.tsx` — **new.** Username plus a department dropdown; no free text, and no email or credential fields. On success it hands the name to `/login?username=…`.
- `components/SettingsModal.tsx` — **deleted.** It was the old registration dialog: misnamed "Settings", took a free-text department, and sent two fields the schema has no place for. `app/admin/page.tsx` no longer opens it.

**Login**
- `app/login/page.tsx` — rebuilt on palette tokens, reads a prefilled `?username=`, redirects to `/projects` (not the retired `/bda`), and links to Register. Wrapped in `Suspense` because `useSearchParams` otherwise blocks prerendering.

**Deleted dead modules** — `api/chat.ts` (route not in the backend), `api/admin/users.ts` (declared a function it never exported, and read a server-only env var), `components/Loading.tsx` (a full-screen white overlay, exactly what §8.1 forbids), `components/DocumentViewer/DocumentViewer.tsx` (an older duplicate of `PdfViewer`), `components/source-modal.tsx` and `types/admin.ts` (both 0 bytes).

**Docs**
- `CLAUDE.md` §4 — the env var is **`NEXT_PUBLIC_API_URL`**, not `API_URL`. This closes explore-A's #15, which I had recorded the other way round: the code was always right and the doc was wrong (a browser bundle can only read `NEXT_PUBLIC_*`, and that is what the Dockerfile passes).
- `CLAUDE.md` §3 — removed "No test suite is configured yet"; verification is now build + lint + test plus a manual check.
- `CLAUDE.md` §5 — the API-layer paragraph describes `api/config.ts`, `api/types/` and `api/auth.ts`.
- `CLAUDE.md` §2 — **new standing rule 5**: before starting step 8, check `test-data/` exists with its README and stop to ask if it does not.

## Decisions
- **`ProjectCreateInput` and `final_value` were already fixed earlier** (step 3 and 2a-i), because the code written then needed them. Noted so the plan's step-4 list does not read as incomplete.
- **Registration is its own page, not a modal.** D3 calls it in scope and separate from Settings; a page is also linkable from the account menu and from the login screen, which a modal buried in `/admin` was not.
- **The register page states there is no password** rather than implying an account is protected (A2: anyone who knows a username can sign in as them).
- **Wrote the standing rule as "its README", not `README.md`.** The file on disk is `README.txt`; writing `.md` into the rule would make a later check stop for the wrong reason. Flagged to the owner.

## Gaps found
- **`test-data/README.txt`, not `README.md`** as the instruction assumed. Worth renaming one or the other so the rule and the repo agree.
- 15 files still import the deprecated colours shim (`app/admin/*`, `components/TemplatesManager`, `input-fields-list`, `input-field-item`, the three viewers, `UploadModal`, `document-upload`, `FeedbackModal`). Steps 8, 9, 11 and 14 own them. Lint warnings are down to 37 from 53 at the start of step 3.
- `api/feedback.ts`'s `total` (plan §7, "Low") is **not** fixed: it belongs with the Audit screen in step 13, where the pagination it affects is actually built.
- The register page cannot show a per-field validation error from the backend; `UserRegistration` failures come back as a FastAPI `detail` string, which is surfaced whole. Good enough for two fields.

## Verification
`npm test` **60/60**, `npm run lint` **exit 0** (0 errors, 37 warnings), `npm run build` **exit 0** (15 routes), `npm run check:contrast` **83/83**.

Checked in Chrome against the live backend:

- **Department enum.** The dropdown offers exactly `['Zelle','Module','Pack']` and nothing else, and the form has only two inputs — no email or credential field.
- **Submit gating.** Register stays disabled until both fields are set (§8.4 disabled state).
- **409 path.** Registering `test-user`, which exists, showed *"The username "test-user" is already taken."* and stayed on the page — previously a free-text department produced a 422 with no explanation at all.
- **Happy path.** Registering `step4-check` with `Zelle` succeeded; `GET /auth/user?username=step4-check` confirms `department: Zelle` in the database.
- **Hand-off.** It routes to `/login?username=step4-check`; from a signed-out browser the login form renders with the name **prefilled**, and signing in lands on `/projects` with `bda_user` set to that user. (The first attempt landed straight on `/projects` because the browser was still signed in — correct behaviour, re-tested signed out.)
- **§8.3 both modes.** Both new forms render correctly in light and dark.

**Token spend: 0 OpenAI operations.** No extraction or upload was run.

**§8 checks.** §8.3: both forms verified in both modes, every colour a palette token. §8.4: required fields marked, submit disabled until valid, loading state on submit, errors as inline `Alert`s with a next action, `autoFocus` on the first field, native form submit so Enter works, and the dropdown keyboard-operable (MUI Select). §8.1 and §8.2 do not apply — no background work and no categories in this step.

**Test data left behind:** user `step4-check` in the dev database. There is no delete-user route; it is harmless. The browser was signed back in as `test-user`.

## Next
**Step 5** per plan §9: the shared component library in `components/ui/` and the dev gallery at `app/dev/gallery`, absorbing the existing `/dev/theme` preview. Per AM5 the shell components built in step 3 are added to the gallery but **not** rebuilt. Note for step 8, which follows later: CLAUDE.md §2 rule 5 now requires checking `test-data/` and its README before that step starts.
