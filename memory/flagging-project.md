---
name: Flagging feature state
description: Flags are frontend-only; api/parameters.ts API functions exist but are never called; backend schema fields are never read on hydration
type: project
---

Flagging is client-side only. `flagParameter` and `UnflagParameter` in `api/parameters.ts` are dead code — never imported or called. `ProjectParameter` returns `human_flagged`, `flagger_id`, `flag_reason` from the backend but `hydrateFieldsFromDB` ignores them. `handleSave` does not include flag state in its payload. Flags survive only in React state for the current session.

**Why:** The feature was scaffolded (types, API functions, backend schema) but the wiring between frontend UI and backend persistence was never completed.

**How to apply:** When the user asks to "save flags", "persist flags", or "wire up flagging" — the gap is in three places: calling the API in the flag handler, reading `human_flagged`/`flag_reason` in `hydrateFieldsFromDB`, and deciding whether `handleSave` or a dedicated flag action is the right persistence trigger.
