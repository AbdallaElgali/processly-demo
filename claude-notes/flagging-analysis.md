# Flagging Logic — Full Inventory
_Generated: 2026-04-12_

---

## Overview

Flagging lets a user mark a parameter for review, optionally with a reason string.
The feature spans types, a hook, two components, two pages, and two API functions.

**Critical gap:** The backend has a full flag schema and two API endpoints exist in
`api/parameters.ts`, but they are **never called by the frontend**. Flags live only
in React state and are lost on page refresh.

---

## 1. Type Definitions — `types/index.ts`

**Lines 36–37** — Optional fields on `InputField`:
```ts
isFlagged?: boolean;
flagReason?: string;
```
These are the only client-side flag fields. Both are optional (`?`), so all code
that reads them must guard against `undefined`.

---

## 2. Backend Schema (read-only, returned from API) — `api/projects.ts`

**Lines 41–43** — On `ProjectParameter` (the shape returned by `/projects/:id`):
```ts
human_flagged: boolean;
flagger_id: string | null;
flag_reason: string | null;
```
The backend tracks flags with a user reference (`flagger_id`) and a reason string.
These fields come back in every `apiGetProjectDetails` response — but
**`hydrateFieldsFromDB` in `ParameterManager.tsx` never reads them**. Even if a flag
was previously persisted to the backend, it would not be shown after a reload.

---

## 3. API Layer — `api/parameters.ts`

Two functions exist, **neither is imported or called anywhere in the frontend**:

```ts
// POST /projects/flag-parameter — send user_id, parameter_id, reason
export const flagParameter = async (user_id, parameter_id, reason) => { ... }

// POST /projects/flag-parameter — send user_id, parameter_id (no reason → unflag)
export const UnflagParameter = async (user_id, parameter_id) => { ... }
```

**Issues in this file:**
- Both functions POST to the same endpoint (`/flag-parameter`). Unflagging is
  distinguished only by omitting `reason` in the body — fragile convention.
- `UnflagParameter` is named with a capital `U` (violates camelCase convention).
- Hardcodes `http://localhost:8000/projects` instead of using `process.env.API_URL`.
- Neither is exported from an index or imported anywhere → dead code.

---

## 4. State Hook — `hooks/ParameterManager.tsx`

**Lines 125–133** — `handleFlag` callback (added in the modularization session):
```ts
const handleFlag = useCallback((fieldId: string, isFlagged: boolean, reason?: string) => {
  setFields(prev => prev.map(field =>
    field.id === fieldId ? { ...field, isFlagged, flagReason: reason ?? '' } : field
  ));
}, []);
```
Updates the `fields` array in place. Flag state is now in the hook, not siloed
inside the child component. Exported in the hook's return object.

---

## 5. Field Component — `components/input-field-item.tsx`

### Imports (lines 17–18)
```ts
import FlagIcon from '@mui/icons-material/Flag';        // filled — when flagged
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag'; // outline — when not
```

### Prop (line 28)
```ts
onFlag?: (id: string, isFlagged: boolean, reason?: string) => void;
```
Optional. If not provided, flagging is purely cosmetic (local state only).

### Local state (lines 44–45)
```ts
const [isFlagged, setIsFlagged] = useState(field.isFlagged ?? false);
const [flagReason, setFlagReason] = useState(field.flagReason ?? '');
```
Initialised from `field.isFlagged`/`field.flagReason`. If those are undefined
(as they are for freshly generated fields), defaults to `false`/`''`.
**Important:** this local state is separate from the hook's `fields` array.
`handleSaveFlag` calls `onFlag` which updates the hook, but the local state
also updates independently. They can drift if the parent re-renders.

### Handlers (lines 72–83)
```ts
const handleSaveFlag = () => {
  setIsFlagged(true);           // update local UI state
  setActivePanel('none');       // close the panel
  if (onFlag) onFlag(field.id, true, flagReason);  // bubble to hook
};

const handleClearFlag = () => {
  setIsFlagged(false);
  setFlagReason('');
  setActivePanel('none');
  if (onFlag) onFlag(field.id, false, '');
};
```

### Flag toggle button (lines 134–152, inside primary action row)
Only shown when `displayValue` is non-empty:
```tsx
{displayValue && (
  <Tooltip title={isFlagged ? "Edit Flag" : "Flag Parameter"} arrow>
    <IconButton onClick={() => setActivePanel(prev => prev === 'flag' ? 'none' : 'flag')}
      sx={{ color: isFlagged ? colors.warning : colors.textSecondary, ... }}
    >
      {isFlagged ? <FlagIcon /> : <OutlinedFlagIcon />}
    </IconButton>
  </Tooltip>
)}
```
The flag button is hidden for empty parameters — a user can only flag a field
that already has a value.

### Flag panel (lines 276–304, inside `<Collapse>`)
Shown when `activePanel === 'flag'`:
- A `TextField` for `flagReason`
- A "Remove Flag" button (only shown if already flagged)
- A "Save Flag" / "Update Flag" button

### `PanelView` type (line 39)
```ts
type PanelView = 'none' | 'ai' | 'snippet' | 'flag';
```
`'flag'` is one of four mutually exclusive panel states.

---

## 6. List Component — `components/input-fields-list.tsx`

### Prop (line 20)
```ts
onFlag?: (id: string, isFlagged: boolean, reason?: string) => void;
```

### Destructured (line 30) and passed to each item (line 89):
```tsx
<InputFieldItem ... onFlag={onFlag} readOnly={readOnly} />
```
Pure thread-through. No flag logic here.

---

## 7. Editor Page — `app/bda/page.tsx`

**Line 57** — destructured from hook:
```ts
handleFlag,
```

**Line 214** — wired to the list:
```tsx
<MemoizedInputFieldsList ... onFlag={handleFlag} />
```
Flags in edit mode update the hook's `fields` state but are **never saved
to the backend** (the `handleSave` function does not include `isFlagged` or
`flagReason` in the `ParameterInput` payload it sends).

---

## 8. Review Page — `app/review/page.tsx`

**Line 59** — destructured from hook:
```ts
fields, handleFlag, ...
```

**Line 131** — badge count:
```ts
const flaggedCount = fields.filter(f => f.isFlagged).length;
```

**Lines 145–182** — Flag icon with numeric badge in the minimal toolbar:
```tsx
<FlagIcon sx={{ color: flaggedCount > 0 ? colors.warning : colors.border }} />
{flaggedCount > 0 && <Box ...>{flaggedCount}</Box>}
```
Gives reviewers a running count of flagged parameters at a glance.

**Line 211** — wired to the list:
```tsx
<MemoizedInputFieldsList ... onFlag={handleFlag} readOnly />
```
Flagging is the **only write action** available in review mode. But again,
it is not persisted to the backend.

---

## Gap Summary

| Gap | Detail |
|-----|--------|
| **Not persisted** | `api/parameters.ts` `flagParameter`/`UnflagParameter` are never called. Flags vanish on refresh. |
| **Not hydrated on load** | `hydrateFieldsFromDB` ignores `human_flagged`, `flagger_id`, `flag_reason` returned by the backend. |
| **Not included in Save** | `handleSave` in `bda/page.tsx` sends `ParameterInput` which has no flag fields — even if we add an API call, the save flow doesn't capture it. |
| **Dual state risk** | `InputFieldItem` keeps its own `isFlagged`/`flagReason` local state initialised from `field.isFlagged`. If the parent resets or replaces `field`, the component's local state goes stale. |
| **API issues** | `UnflagParameter` uses same method/endpoint as flag; naming is inconsistent (capital U); hardcoded base URL. |

---

## To Wire Flagging End-to-End

1. **Call the API** — in `InputFieldItem.handleSaveFlag` (or in `handleFlag` in
   `ParameterManager`), call `flagParameter(user.id, spec.id, reason)`. Requires
   the user's `id` and the active spec's `id` (the `selected_candidate_id` or DB
   parameter `id`).
2. **Hydrate on load** — in `hydrateFieldsFromDB`, read `dbParam.human_flagged`,
   `dbParam.flag_reason` and set them on the `InputField`.
3. **Fix the unflag endpoint** — clarify how unflagging is distinguished from
   flagging on the backend (currently both use the same POST route).
4. **Consider save flow** — decide if `handleSave` should also persist flag state,
   or if flagging is a separate action with its own endpoint (current architecture
   suggests the latter).
