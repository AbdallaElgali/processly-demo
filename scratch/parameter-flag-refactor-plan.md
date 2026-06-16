# Parameters, AI Metrics & Flags — Divergence Analysis + Refactor Plan

_Generated: 2026-06-16. Supersedes the overlapping parts of `state-and-flagging-analysis.md` and `flagging-analysis.md` (the latter describes a pre-wiring version of the flag code and is now partly stale)._

---

## TL;DR

The frontend models a parameter as **N candidate `Specification`s with one selected**, but the DB models it as **one resolved row + a separate flag-ticket table**. The translation between these two models is done in **four different places** (`hydrateFieldsFromDB`, `mapSpecsToFields`, `handleSave`, `handleFlag`) with **inconsistent rules**, and flags are written to the DB through **two competing paths** that don't agree. The result is the "logic diverges from the DB" feeling you're describing.

The fix is not to patch each bug individually — it's to (1) define **one canonical domain model** and **one adapter module** for DB↔UI translation, (2) collapse flagging to a **single write path**, and (3) stop overloading `Specification.id` to mean three different things.

---

## Part 1 — The data shapes

### DB row (`ProjectParameter`, `api/projects.ts:36`)
One row per parameter key. Stores the *resolved* value plus denormalized fields from the selected candidate:
```
id, parameter_key, final_value, final_unit, confidence,
selected_candidate_id, source_text_snippet, source_page_number,
is_human_modified, review_action, reviewed_at,
human_flagged, active_flag_id, flag_reason, flagger_id
```
Note what is **not** here: bounding box, document id, alternative candidates, rule violations. The DB has no candidates table exposed to the frontend.

### UI model (`InputField` + `Specification`, `types/index.ts:19-42`)
```
InputField: id(=parameter_key), dbId(=row id), label,
            specifications: Specification[], selectedSpecId,
            isFlagged, flagReason, activeFlagId, prevFlagId, reviewAction
Specification: id, value, confidence, unit, source, calculated,
               rule_passed, rule_violations, requires_review
```
This carries the rich, multi-candidate, bounding-box-aware shape that only ever exists **in memory during an analyze session**.

The mismatch is the root cause of everything below.

---

## Part 2 — Concrete divergences & bugs

### A. `Specification.id` means three different things (the central problem)
| Origin | What `spec.id` actually is |
|---|---|
| `mapSpecsToFields` (after analyze) `analyze-document.ts:91` | real AI candidate UUID ✅ |
| `hydrateFieldsFromDB` (after reload) `ParameterManager.tsx:34` | **`dbParam.id` — the parameter ROW id, not `selected_candidate_id`** ❌ |
| `handleFieldChange` (manual entry) `ParameterManager.tsx:78` | random `uuidv4()` ❌ for backend purposes |

The comment at `ParameterManager.tsx:33` literally says *"Bind the spec ID to the actual AI candidate ID"* — but the code binds it to `dbParam.id`. `selected_candidate_id` is loaded into the `ProjectParameter` type and then **never used**.

**Downstream breakage:** `handleFlag` sends `ai_metric_candidate_id = field.selectedSpecId`. For any DB-hydrated field that is the *parameter row id*, not a candidate id → the `/flagging/ai-flag-parameter` ticket references a non-existent candidate. And `handleSave` writes `selected_candidate_id: activeSpec.id`, round-tripping the wrong id back into the DB.

### B. Flags have two competing write paths that don't agree
Flagging reaches the DB through **two unrelated mechanisms**:

1. **Ticket path** — `handleFlag` → `flagParameter`/`unFlagParameter` → `POST /flagging/...`. Fires immediately, returns a `flag_id`, stored only in React `activeFlagId`. Does **not** write `human_flagged`/`flag_reason` on the parameter row.
2. **Column path** — `handleSave` → `apiSaveProjectParameters` PUT, which includes `flag`, `flag_reason`, `flagger_id`. Does **not** touch the ticket table or `active_flag_id`.

Consequences:
- **Editor mode:** a flag is written twice (ticket on flag, columns on save) — and the two can disagree if you flag then don't save.
- **Review mode** (`app/review/page.tsx`): there is **no Save button at all**. Flags persist *only* as tickets; `human_flagged` is never written. On reload, `hydrateFieldsFromDB` reads `human_flagged: false` → the flag visually disappears even though the ticket exists. Orphaned tickets.
- `ParameterInput` has no `active_flag_id` field, so the save path can never reconcile the ticket id into the row.

### C. `activeFlagId` / `prevFlagId` chaining is fragile and likely wrong
`hydrateFieldsFromDB` loads `activeFlagId` but never sets `prevFlagId`. In `handleFlag` (`ParameterManager.tsx:152`):
```ts
activeFlagId: f.prevFlagId ? f.prevFlagId : newFlagId
```
When re-flagging, it **discards the `newFlagId` just returned by the backend** and keeps the old `prevFlagId` as the active id. The unflag branch sets `prevFlagId = activeFlagId, activeFlagId = null`. This hand-rolled parent-chain state machine lives entirely in volatile React state and resets on every reload — so re-flag lineage is unreliable across sessions.

### D. `is_human_modified` and `review_action` are computed from different sources and can contradict
- `handleSave:116`: `is_human_modified: activeSpec ? (activeSpec.confidence === null) : true` — infers "modified" from confidence being null.
- `handleFieldChange:72`: sets `reviewAction = 'MODIFIED'` but **keeps the existing confidence**.

So editing a DB-hydrated field (which has a non-null confidence) yields `review_action='MODIFIED'` **and** `is_human_modified=false` simultaneously. Two fields that are supposed to mean the same thing disagree. `is_human_modified` should simply be derived from `review_action`.

### E. `review_action` has no complete lifecycle on the client
Values are stringly-typed `'PENDING' | 'MODIFIED' | 'ACCEPTED'` (comment only, not an enum). `handleFieldChange` sets `'MODIFIED'`; nothing client-side ever sets `'ACCEPTED'` (approval is backend-only via `approveDocument`); `handleFlag` doesn't touch it at all. Easy to drift from whatever the backend expects.

### F. Confidence scale is inconsistent (probable display bug)
Canonical backend scale appears to be **0–1** (`mapSpecsToFields` multiplies by 100; `mapFieldsToSpecs` divides by 100). But `hydrateFieldsFromDB:36` reads `dbParam.confidence` with **no ×100**. If the DB stores 0–1, every reloaded field shows e.g. `0.95%` and the confidence color thresholds (`>=95`, `>=80` in `input-field-item.tsx:32`) all render red. Verify the DB scale and convert in exactly one place.

### G. Bounding box & document id are lost on every reload
DB stores only `source_text_snippet` + `source_page_number`. `hydrateFieldsFromDB` hard-codes `boundingBox: null, documentId: null`. So "Find in document" highlighting works only in the live analyze session and silently degrades to the text-snippet fallback after any save/reload. The guard at `bda/page.tsx:163` deliberately avoids re-hydrating to preserve in-memory boxes — a workaround that confirms the model mismatch.

### H. AI candidates (`ai_metrics`) are unrecoverable after save
The multi-candidate array exists only in memory. `handleSave` persists just the selected candidate's scalars. There is no candidates table exposed and no `GET candidates` endpoint, so after reload `specifications[]` always has length 1 and the "AI alternatives" chips disappear.

### I. You cannot actually flag an empty parameter, despite code that expects you can
`handleFlag:134` early-returns if `!candidateId` ("No AI metric candidate exists to flag"). For empty fields `selectedSpecId` is `undefined`, so the flag is blocked. Yet `mapFieldsToSpecs:61-76` has a whole branch to serialize *flagged-but-empty* fields for iterative extraction. These two contradict — the empty-flag branch is effectively dead because the flag can never be created.

### J. Duplicate / divergent metric types and env vars
`ProjectMetrics` + `User` are defined **twice** — `hooks/AdminData.tsx:4` and `api/audit/project_metrics.ts:3` — with differing `permission_type` nullability, and `AdminData` fetches via `NEXT_PUBLIC_API_URL` while `project_metrics.ts` uses `API_URL`. Meanwhile `config.ts` uses `NEXT_PUBLIC_API_URL` and several files hardcode the URL. (See `contexts-hooks-analysis.md §1`.)

### K. Three id concepts are easy to confuse
`field.id` (parameter key), `field.dbId` (row id), `spec.id` (candidate id). `handleFlag` correctly uses `dbId` for `parameter_id` but the wrong thing for `ai_metric_candidate_id` (see A). The naming doesn't make the distinction obvious.

---

## Part 3 — Recommended refactor

Goal: **one domain model, one adapter, one flag write-path, one confidence scale.** Do it in the order below; each step is independently shippable.

### Step 0 — Decide the candidate-persistence question (drives everything)
Pick one:
- **Option A — Persist candidates (richer UX, backend work).** Add an `ai_candidates` table written during `stream-specs`, plus `GET /projects/{id}/candidates`. Then reload restores all candidates + bounding boxes, and the in-memory/DB models converge. This is the only option that makes multi-candidate selection and box highlighting survive reload.
- **Option B — Accept single-value persistence (frontend-only, lighter).** Treat candidates as **transient session state** explicitly. Persisted parameters are single-valued by design; candidates live in a separate `analysisSession` slice that is clearly not expected to survive reload. The UI shows "alternatives" only during/after a live analyze.

**Recommendation:** Option B now (it matches what the DB can actually store and removes the false expectation that reload is lossless), with Option A as a later enhancement if alternatives-after-reload is a real product requirement. The rest of the plan assumes B but is compatible with A.

### Step 1 — Introduce explicit identity (fixes A, K) — low effort, high value
Add a dedicated `candidateId` to `Specification` instead of overloading `id`, OR (simpler) make `id` *always* the candidate id and add a separate `localKey` for React lists. Then:
- `hydrateFieldsFromDB`: `candidateId = dbParam.selected_candidate_id` (the field that's currently ignored).
- `handleFlag`: send `ai_metric_candidate_id = activeSpec.candidateId` (null-safe; allow null for empty-field flags per Step 4).
- `handleSave`: write `selected_candidate_id = activeSpec.candidateId`.

### Step 2 — Centralize all DB↔UI mapping in one adapter module
Create `lib/parameter-adapter.ts` exporting:
```ts
dbParamToInputField(p: ProjectParameter): InputField
inputFieldToParameterInput(f: InputField, userId): ParameterInput
specsStreamToInputFields(raw): InputField[]   // moved from analyze-document
```
Move the mapping logic out of `ParameterManager`, `analyze-document`, and `handleSave` so there is exactly one definition of each direction. This kills the "four places, four rules" problem and makes confidence-scale and id rules impossible to get inconsistent.

### Step 3 — Single confidence scale (fixes F)
Define canonical internal scale = **0–100** (what the UI wants). Convert **only** at the API boundary inside the adapter (`×100` on the way in for both stream and DB hydrate, `÷100` on the way out). Remove the ad-hoc conversions scattered today. Add a unit test or at least a comment pinning the contract.

### Step 4 — One flag write-path (fixes B, C, I) — the big reliability win
Make **the ticket the single source of truth** and have the backend keep the parameter row's flag columns in sync transactionally when a ticket is created/resolved:
- Frontend: `handleFlag` is the **only** flag mutator. It calls `flagParameter`/`unFlagParameter` and then, on success, persists the parameter row immediately (call `saveParametersSilent` for that one field, or have the flag endpoint return the updated `ProjectParameter` and merge it). No more "flag is only saved when you click Save."
- Remove `flag`/`flag_reason`/`flagger_id` from the bulk `handleSave` payload (or make the backend ignore them) so the column path can't contradict the ticket path.
- Add `active_flag_id` to `ParameterInput` only if the backend needs it; otherwise let the backend own it.
- Delete the `prevFlagId`/`activeFlagId` hand-rolled chaining from React state; let the backend manage parent-flag lineage and return `active_flag_id` on GET. Hydrate `isFlagged` from `human_flagged` and `activeFlagId` from `active_flag_id` (already loaded).
- Allow flagging empty fields: pass `ai_metric_candidate_id: null` when there's no candidate, and keep the `mapFieldsToSpecs` empty-flag branch — they'll finally be consistent. Remove the early-return at `handleFlag:134`.

This makes review-mode flagging durable (it currently isn't) without a Save button.

### Step 5 — Derive `is_human_modified`, formalize `review_action` (fixes D, E)
- Replace the `confidence === null` heuristic with `is_human_modified = (review_action === 'MODIFIED')` in the adapter.
- Turn `review_action` into a TS union/enum shared with the adapter and assert the backend's accepted values. Decide where (if anywhere) the client sets `'ACCEPTED'` vs leaving it backend-owned, and document it.

### Step 6 — Cleanup (fixes J + tidy)
- Delete the duplicate `ProjectMetrics`/`User` in `api/audit/project_metrics.ts`; import from `hooks/AdminData.tsx` (or better, a shared `types/audit.ts`).
- Route every API base URL through `config.api`. Fix `AdminData`'s `NEXT_PUBLIC_API_URL` vs everyone else (see `contexts-hooks-analysis.md`).
- Remove debug `console.log`s in `handleJumpToSource`, `handleSourceClick`, `useAnalyze` (`const x = 1; if (x == 1)` dead guard at `useAnalyze.ts:48`).

---

## Part 4 — Suggested execution order

| Step | Fixes | Effort | Backend change? |
|---|---|---|---|
| 1. Explicit candidate id | A, K | S | no |
| 2. Adapter module | structural | M | no |
| 3. One confidence scale | F | S | no |
| 4. One flag write-path | B, C, I | M | **yes** (sync columns on ticket; return updated row) |
| 5. Derive modified / enum review_action | D, E | S | maybe (confirm enum) |
| 6. Cleanup dup types / URLs / logs | J | S | no |
| 0/A. Persist candidates (optional) | G, H | L | **yes** (table + GET) |

Steps 1–3 and 6 are pure frontend and can land immediately. Step 4 is the one that actually resolves "the logic diverges from the DB," and it needs a small backend contract: **creating/resolving a flag ticket must update the parameter row's `human_flagged`/`active_flag_id`/`flag_reason` in the same transaction, and GET must return them.** Once that holds, the frontend stops trying to keep two representations in sync by hand.

---

## Open questions to confirm before coding
1. **Confidence scale in the DB** — is `ProjectParameter.confidence` stored 0–1 or 0–100? (Determines the Step 3 conversion and whether F is a live bug today.)
2. **Candidate persistence** — is "see AI alternatives after reload" a real requirement? (Picks Option A vs B in Step 0.)
3. **Flag column ownership** — can the backend own `human_flagged`/`active_flag_id` and keep them in sync with the ticket table on create/resolve? (Required for Step 4.)
4. **`review_action` values** — what is the authoritative set the backend accepts, and does the client ever set `ACCEPTED`?
