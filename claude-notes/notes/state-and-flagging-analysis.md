# State & Flagging System Analysis

## 1. Project Parameters: State vs DB Divergence

### What gets stored on save

`handleSave` in `app/bda/page.tsx:109` maps `fields[]` to `ParameterInput[]`. For each field it takes only the **selected spec** and extracts:

```
final_value, final_unit, confidence, selected_candidate_id
```

The DB schema (`ProjectParameter` in `api/projects.ts:36`) has no candidates table — it stores one value per parameter. All other AI candidates are silently dropped on save.

### What gets loaded on reload

`hydrateFieldsFromDB` (`hooks/ParameterManager.tsx:18`) fires only when `currentProject.id` changes (the `isNewProject` guard in `app/bda/page.tsx:169`). It creates one `Specification` per field from DB scalars:

```typescript
id: dbParam.id || uuidv4(),   // ← ProjectParameter.id, NOT selected_candidate_id
value: dbParam.final_value.toString(),
confidence: dbParam.confidence,
source: {
  textSnippet: dbParam.source_text_snippet,
  pageNumber: dbParam.source_page_number,
  boundingBox: null,           // ← always null — never stored in DB
  documentId: null,
}
```

So on every re-open, the user gets exactly one candidate per field, with no bounding box and a `Specification.id` that is the **parameter's DB row ID**, not the AI candidate ID.

### What gets loaded after analysis (in-memory only)

`handlePopulateExtractedData` (`hooks/ParameterManager.tsx:104`) merges incoming `InputField[]` from the SSE stream. It replaces the `specifications` array and sets `selectedSpecId` to the highest-confidence candidate. These specs carry full bounding boxes, multiple candidates, and real AI-generated IDs.

This data lives only in React state. On refresh it is gone.

### The divergence

| State slot | After open (from DB) | After analyze (in-memory) | After save + re-open |
|---|---|---|---|
| Number of candidates | 1 | N (all AI results) | 1 again |
| Bounding box | null | populated | null again |
| `Specification.id` | `ProjectParameter.id` | AI-generated UUID | `ProjectParameter.id` |
| Alternative candidates | none | available for switching | none |

The comment at `app/bda/page.tsx:163` acknowledges this trade-off deliberately. But it means the user loses context every time they save and reload.

---

## 2. ai_metric_candidates: Not Fetched on Reload

There is no `AICandidates` table and no endpoint that returns candidate arrays for a project. `GET /projects/{id}` returns `parameters: ProjectParameter[]`, which has one selected candidate per row.

The field `selected_candidate_id` is stored in the DB, but the full candidate object (value, confidence, source, bounding box) is not retrievable post-save. There is also no "fetch alternatives for this parameter" API call anywhere in the frontend.

**Result**: after a save-and-reload cycle, `specifications[]` contains exactly one entry — a reconstructed object using the DB row ID as `Specification.id` — and the original AI candidates are unrecoverable from the frontend.

---

## 3. Flagging System: What It Actually Does

### The three moving parts

**a) Support ticket** — created immediately when the user submits a flag reason:

```
POST /flagging/ai-flag-parameter
{
  user_id, parameter_id, ai_metric_candidate_id, parent_flag_id, flag_reason
}
→ returns flag_id (support ticket ID)
```

**b) Local state update** — happens immediately after the API call resolves:

```typescript
setFields(prev => prev.map(f =>
  f.id === fieldId ? { ...f, isFlagged: true, flagReason: reason, activeFlagId: newFlagId } : f
));
```

**c) DB parameter update** — does NOT happen at flag time. `ProjectParameter.human_flagged`, `flag_reason`, `flagger_id`, `active_flag_id` are only written when the user clicks Save (or if an explicit silent-save is triggered elsewhere).

### The desync problem

If a user flags a parameter and refreshes without saving:
- The support ticket exists in the DB.
- `ProjectParameter.human_flagged` is still `false`.
- On reload, `hydrateFieldsFromDB` reads `human_flagged: false` → field loads as `isFlagged: false`.
- The ticket is orphaned and the frontend has no way to surface it again.

### The wrong candidate ID

When flagging a field that was loaded from the DB (not from a live analysis session), `candidateId = field.selectedSpecId` resolves to `ProjectParameter.id` — not the actual AI candidate UUID. So the backend receives:

```
ai_metric_candidate_id = "proj-param-db-uuid"
```

instead of the real AI metric candidate ID. This breaks any backend logic that tries to look up the original AI result by candidate ID.

### Re-triggering analysis

Flagging alone does **not** trigger re-analysis. The flow to use flagging for targeted correction is:

1. User flags one or more parameters (creates tickets, updates local state).
2. User clicks Analyze.
3. `handleAnalyze(fields)` detects `hasFlaggedFields = true`.
4. `mapFieldsToSpecs(currentFields)` builds `previousSpecs` with `is_flagged: true` for flagged entries.
5. `analyzeDocument(projectId, user, previousSpecs, ...)` sends the full spec map to the backend.
6. Backend uses `is_flagged` to run iterative correction on those parameters only.
7. New candidates stream back with `status: "partial_correction"`.
8. `handlePopulateExtractedData` merges the new candidates into state (replacing old specs for those fields).

The user then has to manually inspect the new candidate, accept it, unflag the field, and save.

### Retry tracking

There is no retry counter anywhere in the codebase. The `parent_flag_id` parameter in `flagParameter()` chains tickets (a second flag on the same field passes the previous `activeFlagId` as parent), but nothing counts how many times this has happened.

**Whether a correct value was found**: not tracked. Unflagging via `unFlagParameter()` always sends `status: "DISMISSED"` and `resolved_by: null`, regardless of outcome. There is no "RESOLVED" status path.

---

## 4. Concrete Issues Summary

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | AI candidates lost on save; only selected spec persisted | `handleSave` / DB schema | User cannot see alternatives after reload |
| 2 | Bounding boxes never stored in DB; always `null` on reload | `hydrateFieldsFromDB:39` | "Find in document" broken after reload |
| 3 | `Specification.id` set to `ProjectParameter.id` on hydration, not `selected_candidate_id` | `ParameterManager.tsx:34` | `ai_metric_candidate_id` in flag API call is wrong |
| 4 | Flagging does not persist `human_flagged` to DB | `handleFlag` — no silent save | Flag state lost on refresh |
| 5 | No `ai_metric_candidates` endpoint; cannot reload candidates | No `AICandidates` table | Candidates unrecoverable after save |
| 6 | No retry count field; no RESOLVED vs DISMISSED distinction | `flagParameter` / `unFlagParameter` | Cannot tell if re-analysis succeeded |
| 7 | `mapFieldsToSpecs` sends ALL specs, not just flagged ones | `analyze-document.ts:44` | Backend receives unchanged specs alongside flagged ones; fine today but confusing |

---

## 5. Recommended Fixes (by priority)

### Fix 3 (wrong candidate ID) — low effort, immediate correctness

In `hydrateFieldsFromDB`, use `dbParam.selected_candidate_id` as the spec ID, not the parameter row ID:

```typescript
id: dbParam.selected_candidate_id || dbParam.id || uuidv4(),
```

This ensures that when a user loads a project, flags a field, and re-analyzes, the backend receives the correct AI candidate ID for comparison.

### Fix 4 (flag not persisted) — add silent save after flagging

In `handleFlag` (`ParameterManager.tsx:124`), after updating local state, call `saveParametersSilent`. This requires passing `saveParametersSilent` and `activeProjectId` into `useParameterManager`, or lifting the save call to the `handleFlag` callback at `bda/page.tsx`.

### Fix 6 (retry tracking) — add `correction_count` to `ProjectParameter`

Add a `correction_count: number` field to `ProjectParameter` (incremented by the backend on each re-analysis of that parameter) and a `flag_resolved: boolean` or distinct `status: "DISMISSED" | "RESOLVED"` on the ticket. Surface both in the admin view.

### Fix 1 & 5 (AI candidates persistence) — schema change

Introduce an `AICandidates` table (`id, parameter_id, value, unit, confidence, source_json, created_at`) written by the backend during `stream-specs`. Expose a `GET /projects/{id}/candidates` endpoint. On reload, `hydrateFieldsFromDB` fetches this alongside parameters and populates `specifications[]` fully.

This is the largest change but the only one that makes bounding boxes and multi-candidate selection survive a save-reload cycle.
