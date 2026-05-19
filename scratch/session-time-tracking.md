# Session Time Tracking — Analysis & Design
_Generated: 2026-04-14_

---

## The Question

"How do I track time taken to extract parameters — manually vs with the AI feature?"

The answer requires defining what "start" and "end" mean, understanding what
precision is actually possible, and designing both a frontend hook and a backend
schema to capture it.

---

## What "Extraction Time" Actually Means

There are four distinct time spans worth measuring:

| Metric | Definition | Formula |
|--------|-----------|---------|
| **AI extraction time** | Pure machine time — how long the AI takes | `analyze_completed_at − analyze_started_at` |
| **Manual entry time** | Active typing/editing time (idle excluded) | Cumulative sum of inter-edit gaps < 30 min |
| **AI review time** | Time human spends reviewing AI output | `first_save_at − analyze_completed_at` |
| **Total session time** | Full workflow, first touch to save | `first_save_at − project_opened_at` (idle-trimmed) |

These should be reported separately, not collapsed into one number, because:
- "AI took 45s" is a system performance metric
- "Review took 4m 12s" is a human efficiency metric
- Both together tell you the real story vs manual

---

## The Five Events to Capture

```
project_opened_at   →   first_edit_at   →   analyze_started_at
                                         →   analyze_completed_at
                                                  ↓
                                            first_save_at
```

| Event | Trigger point in current code | Notes |
|-------|-------------------------------|-------|
| `project_opened_at` | `isNewProject = true` in the hydration `useEffect` (`bda/page.tsx:135`) | Fires when project first loads or switches |
| `first_edit_at` | First call to `handleFieldChange` in `ParameterManager.tsx` | Guard: only record once, ignore subsequent edits |
| `analyze_started_at` | Top of `handleAnalyze` in `hooks/useAnalyze.ts` (before the `await analyzeDocument(...)` call) | Already clearly isolated |
| `analyze_completed_at` | Right after `const final = await analyzeDocument(...)` returns | The SSE stream closed; this is the machine's done timestamp |
| `first_save_at` | Inside `handleSave` in `bda/page.tsx` after `await saveParameters(...)` resolves | Guard: only record once per session |

---

## The Idle-Time Problem

Wall-clock time from `project_opened_at` to `first_save_at` is useless if the
user goes to lunch in the middle. Use **active time** instead.

Track a running total of active milliseconds: on every field change, compute the
gap since the last edit. If the gap is under 30 minutes, add it to the running
total. If it's over, skip it (the user was idle).

```
edit at 10:00 → edit at 10:02 → gap 2min → add 2min
edit at 10:02 → edit at 13:00 → gap 3h → SKIP (idle)
edit at 13:00 → edit at 13:04 → gap 4min → add 4min
                                          → active_time = 6min
```

This gives you "true editing time" as opposed to "time the project was open".

---

## Frontend: `hooks/useSessionTimer.ts` (new hook)

This hook is pure timestamp tracking — no side effects, no API calls.

```ts
interface SessionMetadata {
  project_opened_at: string;      // ISO
  first_edit_at: string | null;
  analyze_started_at: string | null;
  analyze_completed_at: string | null;
  saved_at: string;
  active_editing_seconds: number; // idle-trimmed manual time
  extraction_method: 'manual' | 'ai_assisted' | 'mixed';
}

export const useSessionTimer = () => {
  const projectOpenedAt  = useRef<Date>(new Date());
  const firstEditAt      = useRef<Date | null>(null);
  const analyzeStartedAt = useRef<Date | null>(null);
  const analyzeCompletedAt = useRef<Date | null>(null);

  // Idle-trimmed active time tracking
  const lastActivityAt   = useRef<Date | null>(null);
  const activeMs         = useRef<number>(0);
  const IDLE_THRESHOLD   = 30 * 60 * 1000; // 30 min

  const recordSessionStart = useCallback(() => {
    projectOpenedAt.current = new Date();
    firstEditAt.current = null;
    analyzeStartedAt.current = null;
    analyzeCompletedAt.current = null;
    lastActivityAt.current = null;
    activeMs.current = 0;
  }, []);

  const recordEdit = useCallback(() => {
    const now = new Date();
    if (!firstEditAt.current) firstEditAt.current = now;

    // Accumulate active typing time
    if (lastActivityAt.current) {
      const gap = now.getTime() - lastActivityAt.current.getTime();
      if (gap < IDLE_THRESHOLD) activeMs.current += gap;
    }
    lastActivityAt.current = now;
  }, []);

  const recordAnalyzeStart = useCallback(() => {
    analyzeStartedAt.current = new Date();
  }, []);

  const recordAnalyzeComplete = useCallback(() => {
    analyzeCompletedAt.current = new Date();
  }, []);

  const getSessionMetadata = useCallback((): SessionMetadata => {
    const aiUsed = !!analyzeStartedAt.current;
    const manualEdits = !!firstEditAt.current;

    return {
      project_opened_at:     projectOpenedAt.current.toISOString(),
      first_edit_at:         firstEditAt.current?.toISOString() ?? null,
      analyze_started_at:    analyzeStartedAt.current?.toISOString() ?? null,
      analyze_completed_at:  analyzeCompletedAt.current?.toISOString() ?? null,
      saved_at:              new Date().toISOString(),
      active_editing_seconds: Math.round(activeMs.current / 1000),
      extraction_method: aiUsed && manualEdits ? 'mixed'
                       : aiUsed               ? 'ai_assisted'
                       :                        'manual',
    };
  }, []);

  return { recordSessionStart, recordEdit, recordAnalyzeStart, recordAnalyzeComplete, getSessionMetadata };
};
```

---

## Wiring Points in Existing Code

### 1. `bda/page.tsx` — start timer on project switch

In the hydration useEffect, when `isNewProject = true`:
```ts
recordSessionStart(); // reset all refs for this project's session
```

### 2. `hooks/ParameterManager.tsx` — record manual edits

`handleFieldChange` already fires on every field edit. Pass `recordEdit` as a
callback parameter, or call it inline:
```ts
// Option A: pass it in from the page
export const useParameterManager = (onEdit?: () => void) => {
  const handleFieldChange = useCallback((fieldId, value, unit) => {
    onEdit?.();
    // ... rest of handler
  }, [onEdit]);
```

### 3. `hooks/useAnalyze.ts` — record AI timings

```ts
const handleAnalyze = useCallback(async () => {
  recordAnalyzeStart();                       // ← add this
  const final = await analyzeDocument(...);
  recordAnalyzeComplete();                    // ← add this after stream closes
  ...
}, [...]);
```

`useAnalyze` would accept `recordAnalyzeStart` and `recordAnalyzeComplete` as
parameters (passed in from the page, same pattern as `handlePopulateExtractedData`).

### 4. `bda/page.tsx` — include metadata in save

```ts
const handleSave = async () => {
  const metadata = getSessionMetadata();
  const paramsToSave = fields.map(...);
  await saveParameters(activeProjectId, paramsToSave, metadata); // add 3rd arg
  setSaveSuccess(true);
};
```

---

## Backend Changes Required

### Option A — Attach to existing save endpoint (minimal change)

Extend `BatchParameterSaveInput` to accept an optional `session_metadata` field:

```python
class SessionMetadata(BaseModel):
    project_opened_at: datetime
    first_edit_at: datetime | None
    analyze_started_at: datetime | None
    analyze_completed_at: datetime | None
    saved_at: datetime
    active_editing_seconds: int
    extraction_method: str  # 'manual' | 'ai_assisted' | 'mixed'

class BatchParameterSaveInput(BaseModel):
    parameters: list[ParameterInput]
    session_metadata: SessionMetadata | None = None
```

The backend stores one `ExtractionSession` row per save containing the raw
timestamps plus computed durations:
- `ai_extraction_seconds` = `analyze_completed_at − analyze_started_at`
- `ai_review_seconds`     = `saved_at − analyze_completed_at`
- `total_session_seconds` = `saved_at − project_opened_at`

### Option B — Dedicated session endpoint (recommended for reporting)

A separate `POST /projects/:id/sessions` endpoint decouples timing from
parameter saving. Useful if you want to track sessions that don't always end
in a save, or want multiple saves in one session.

```python
class ExtractionSession(Base):
    id: UUID
    project_id: UUID
    user_id: UUID
    project_opened_at: datetime
    first_edit_at: datetime | None
    analyze_started_at: datetime | None
    analyze_completed_at: datetime | None
    saved_at: datetime
    active_editing_seconds: int
    extraction_method: str
    # Computed and stored by backend:
    ai_extraction_seconds: int | None
    ai_review_seconds: int | None
    total_session_seconds: int
    fields_filled: int          # count of non-empty params on this save
    fields_total: int           # total schema fields
```

This table lets you later query: average AI time, average review time,
manual vs AI comparison, efficiency trends per user, etc.

---

## Frontend UX: What to Show the User

### Live timer in `ProjectBar` (subtle)

A small `MM:SS` counter in the right side of the `ProjectBar`, showing elapsed
**active** time (idle-trimmed). It only starts ticking after the first edit or
the Analyze click. Gives real-time awareness without being distracting.

```
Active Project: PROJ-001             [00:04:32]  john  [logout]
```

Implementation: in `useSessionTimer`, expose a `activeSeconds: number` derived
from a `setInterval` that re-reads `activeMs.current` every second.
`ProjectBar` accepts an optional `sessionSeconds?: number` prop.

### Post-save summary in the Snackbar

Replace the current flat "State saved to database." toast with a richer message
when timing data is available:

```
✓ Saved  |  Total: 4m 32s  |  AI: 45s  |  Review: 3m 47s
```

Or for a manual-only session:
```
✓ Saved  |  Active editing: 8m 14s  |  Method: Manual
```

The current `Snackbar` in `bda/page.tsx` (line 235) can hold a custom
`<Alert>` component with these computed values.

### What NOT to do

- **No gamification** — no scores, no "you beat your record!", no progress bar
  toward a time goal. This is a professional tool, not a productivity app.
- **No blocking UI** — don't show a modal or interrupt the user with timing info.
  The timer should be ambient, not intrusive.
- **Don't show raw timestamps** — compute and show human-readable durations only.

---

## The `Project.status` field (already in the schema)

`api/projects.ts:54` already defines:
```ts
status: "NEW" | "PENDING_REVIEW" | "IN_REVIEW" | "APPROVED";
```

This is an alternative time tracking strategy: measure time spent in each
status (e.g., how long a project stayed in `IN_REVIEW` before `APPROVED`).
The backend can record `status_changed_at` transitions. This is coarser than
session-level tracking but gives a project-lifecycle view. Both can coexist.

---

## Recommended Implementation Order

1. **`hooks/useSessionTimer.ts`** — pure logic, no backend dependency. Can be
   built and tested in isolation against mock data immediately.
2. **Wire `recordEdit` into `handleFieldChange`** — one parameter change to
   `useParameterManager`, one callback passed from `bda/page.tsx`.
3. **Wire `recordAnalyzeStart/Complete` into `useAnalyze`** — two callbacks
   added as parameters.
4. **Show live timer in `ProjectBar`** — visible proof of concept before
   backend is ready.
5. **Extend `ParameterInput` payload** — add `session_metadata` to the save call.
6. **Backend: store `ExtractionSession`** — after frontend data is flowing, the
   backend can persist and start accumulating comparison data.
7. **Post-save summary Snackbar** — final UX polish once durations are real.
